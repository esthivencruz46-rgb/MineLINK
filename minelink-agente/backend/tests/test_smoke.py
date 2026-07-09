import os

# Credenciales de prueba fijas, independientes de lo que diga backend/.env:
# load_dotenv() no pisa variables ya presentes en el entorno, así que esto
# debe ir ANTES de importar main/auth.
os.environ["ADMIN_USERNAME"] = "esthiven"
os.environ["ADMIN_PASSWORD"] = "changeme"
# Los tests SIEMPRE usan el disco local para archivos, nunca el Supabase
# Storage real (mismo principio que la BD en memoria).
os.environ["SUPABASE_URL"] = ""
os.environ["SUPABASE_SERVICE_KEY"] = ""
# Y nunca resuelven enlaces de Maps contra internet real
os.environ["MINELINK_RESOLVER_MAPS"] = "0"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import models
from database import Base, get_db
from main import app
import security
from security import limitar_intentos_login

engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
# El límite de intentos por IP se desactiva en tests (todos comparten la IP
# "testclient" y lo dispararían); su lógica se prueba aparte más abajo.
app.dependency_overrides[limitar_intentos_login] = lambda: None


@pytest.fixture(autouse=True)
def _reset_db():
    Base.metadata.create_all(bind=engine)
    # Los ids autoincrement se reinician con la BD, pero los contadores de
    # intentos de recuperación viven en memoria del proceso (security.py):
    # sin este reset, un lead "id=1" de un test heredaría los intentos
    # gastados por el "id=1" de un test anterior.
    security._intentos_recuperacion.clear()
    yield
    Base.metadata.drop_all(bind=engine)


client = TestClient(app)

# PDF mínimo pero real (con página) — los documentos legales del minero se
# convierten a imagen en el servidor (ver imagenes.convertir_pdf_a_imagen),
# así que un "%PDF-..." sin páginas de verdad ya no basta para pasar.
PDF_VALIDO_DE_PRUEBA = (
    b"%PDF-1.4\n"
    b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
    b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
    b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n"
    b"trailer<</Size 4/Root 1 0 R>>\n"
    b"%%EOF"
)

RESPUESTAS_COMPLETAS = {
    "L1": True, "L2": True, "L3": True, "L4": True, "L5": True,
    "A1": True, "A2": True, "A3": True,
    "O1": True,
    "T1": True, "T2": True, "T3": True, "T4": True, "T5": True, "T6": True, "T7": True,
    "S1": True, "S2": True, "S3": True, "S4": True, "S5": False,
}


def _crear_diagnostico():
    return client.post(
        "/diagnostico",
        json={
            "respuestas": RESPUESTAS_COMPLETAS,
            "region": "arequipa",
            "mineral": "oro",
            "tipo_mina": "subterranea",
        },
    )


def _admin_token():
    resp = client.post("/admin/login", json={"username": "esthiven", "password": "changeme"})
    return resp.json()["access_token"]


def test_post_diagnostico():
    resp = _crear_diagnostico()
    assert resp.status_code == 200
    body = resp.json()
    assert body["score_total"] == 95
    assert body["brechas"] == ["estudio_ventilacion"]


def test_post_diagnostico_tajo_abierto_no_debe_incluir_s5():
    respuestas = {k: v for k, v in RESPUESTAS_COMPLETAS.items() if k != "S5"}
    resp = client.post(
        "/diagnostico",
        json={
            "respuestas": respuestas,
            "region": "arequipa",
            "mineral": "oro",
            "tipo_mina": "tajo_abierto",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["score_total"] == 100
    assert body["dimensiones"]["seguridad"]["maximo"] == 25


def test_post_diagnostico_ids_no_calzan_con_tipo_mina_falla():
    # RESPUESTAS_COMPLETAS incluye S5, pero tajo_abierto no lo acepta
    resp = client.post(
        "/diagnostico",
        json={
            "respuestas": RESPUESTAS_COMPLETAS,
            "region": "arequipa",
            "mineral": "oro",
            "tipo_mina": "tajo_abierto",
        },
    )
    assert resp.status_code == 422


def test_get_empresas_sin_filtro():
    resp = client.get("/empresas")
    assert resp.status_code == 200
    assert resp.json() == []


def test_get_empresa_404():
    resp = client.get("/empresas/999")
    assert resp.status_code == 404


def test_get_empresas_region_vacia_se_comporta_como_sin_filtro():
    # region="" (ej. "Todos los departamentos") NUNCA debe colarse hasta
    # recomendar() como si fuera un departamento real — ahí ninguna
    # empresa calza y la lista sale vacía por error (ver
    # errores_aprendidos.md, 2026-07-09).
    token = _admin_token()
    _crear_empresa(token, nombre="Empresa Cualquiera SAC", ruc="20444444444")

    resp = client.get("/empresas", params={"estudios": "tramite_reinfo", "region": ""})
    assert resp.status_code == 200
    assert len(resp.json()) == 1

    resp = client.get("/empresas", params={"estudios": "", "region": "cusco"})
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_empresas_publico_no_expone_whatsapp():
    # El WhatsApp de la empresa ya no es público: el contacto pasa por
    # "Me interesa" (POST /empresas/{id}/interes), Esthiven intermedia.
    token = _admin_token()
    empresa = _crear_empresa(token, nombre="Empresa Privada SAC", ruc="20222222222")

    resp = client.get("/empresas")
    assert resp.status_code == 200
    assert all("whatsapp" not in e for e in resp.json())

    resp = client.get(f"/empresas/{empresa['id']}")
    assert resp.status_code == 200
    assert "whatsapp" not in resp.json()


def test_interes_empresa_flujo_completo():
    token = _admin_token()
    empresa = _crear_empresa(
        token, nombre="Consultora Interesada SAC", ruc="20333333333"
    )
    diag = _crear_diagnostico().json()

    resp = client.post(
        f"/empresas/{empresa['id']}/interes",
        json={
            "operacion_id": diag["id"],
            "nombre": "Juan Quispe",
            "whatsapp": "+51987654321",
            "brecha": "estudio_ventilacion",
            "mensaje": "Necesito ayuda con esto",
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["empresa_nombre"] == "Consultora Interesada SAC"
    assert body["empresa_whatsapp"] == empresa["whatsapp"]
    assert body["estado_contacto"] == "buscando"

    # Empresa inexistente
    resp = client.post(
        "/empresas/99999/interes",
        json={"operacion_id": diag["id"], "nombre": "Juan", "whatsapp": "+51987654321"},
    )
    assert resp.status_code == 404

    # Operación inexistente
    resp = client.post(
        f"/empresas/{empresa['id']}/interes",
        json={"operacion_id": "no-existe", "nombre": "Juan", "whatsapp": "+51987654321"},
    )
    assert resp.status_code == 404

    headers = {"Authorization": f"Bearer {token}"}
    resp = client.get(f"/admin/operaciones/{diag['id']}/intereses-empresas", headers=headers)
    assert resp.status_code == 200
    intereses = resp.json()
    assert len(intereses) == 1
    interes_id = intereses[0]["id"]

    # Sin JWT, el admin no puede ver los intereses
    resp = client.get(f"/admin/operaciones/{diag['id']}/intereses-empresas")
    assert resp.status_code == 403

    resp = client.put(
        f"/admin/intereses-empresas/{interes_id}/estado-contacto",
        json={"estado_contacto": "contactado"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["estado_contacto"] == "contactado"


def _lead_payload(operacion_id, **overrides):
    payload = {
        "nombre": "Juan Quispe",
        "whatsapp": "+51987654321",
        "operacion_id": operacion_id,
        "region": "arequipa",
        "username": "juanq",
        "password": "clave123",
        "pregunta_seguridad": "¿Nombre de tu primera mascota?",
        "respuesta_seguridad": "Rocky",
    }
    payload.update(overrides)
    return payload


def test_post_leads():
    diag = _crear_diagnostico().json()
    resp = client.post("/leads", json=_lead_payload(diag["id"]))
    assert resp.status_code == 201
    assert resp.json()["nombre"] == "Juan Quispe"


def test_post_leads_registro_completo():
    diag = _crear_diagnostico().json()
    resp = client.post(
        "/leads",
        json=_lead_payload(
            diag["id"],
            email="juan@example.com",
            nombre_operacion="Labor La Esperanza",
        ),
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["email"] == "juan@example.com"
    assert body["nombre_operacion"] == "Labor La Esperanza"


def test_post_leads_username_corto_rechazado():
    diag = _crear_diagnostico().json()
    resp = client.post("/leads", json=_lead_payload(diag["id"], username="ab"))
    assert resp.status_code == 422


def test_post_leads_password_corta_rechazada():
    diag = _crear_diagnostico().json()
    resp = client.post("/leads", json=_lead_payload(diag["id"], password="123"))
    assert resp.status_code == 422


def test_post_leads_username_duplicado_rechazado():
    diag1 = _crear_diagnostico().json()
    diag2 = _crear_diagnostico().json()
    client.post("/leads", json=_lead_payload(diag1["id"], username="mismouser"))
    resp = client.post(
        "/leads",
        json=_lead_payload(
            diag2["id"], whatsapp="+51911119999", username="mismouser"
        ),
    )
    assert resp.status_code == 409


def test_post_leads_whatsapp_duplicado_rechazado():
    diag1 = _crear_diagnostico().json()
    diag2 = _crear_diagnostico().json()
    client.post("/leads", json=_lead_payload(diag1["id"]))
    resp = client.post(
        "/leads",
        json=_lead_payload(diag2["id"], username="otrousuario"),
    )
    assert resp.status_code == 409


def test_post_leads_codigo_reinfo_duplicado_rechazado():
    diag1 = _crear_diagnostico().json()
    diag2 = _crear_diagnostico().json()
    client.post(
        "/leads", json=_lead_payload(diag1["id"], codigo_reinfo="REI-001")
    )
    resp = client.post(
        "/leads",
        json=_lead_payload(
            diag2["id"],
            whatsapp="+51911112222",
            username="otrousuario",
            codigo_reinfo="REI-001",
        ),
    )
    assert resp.status_code == 409


def test_mineros_recuperar_password_flujo_completo():
    diag = _crear_diagnostico().json()
    client.post(
        "/leads",
        json=_lead_payload(diag["id"], username="recupera1", password="claveorig"),
    )

    resp = client.get("/mineros/pregunta-seguridad/recupera1")
    assert resp.status_code == 200
    assert resp.json()["pregunta"] == "¿Nombre de tu primera mascota?"

    # La respuesta no distingue mayúsculas ni espacios extra
    resp = client.post(
        "/mineros/recuperar-password",
        json={
            "username": "recupera1",
            "respuesta_seguridad": "  ROCKY  ",
            "nueva_password": "clavenueva123",
        },
    )
    assert resp.status_code == 200
    token = resp.json()["access_token"]

    # La contraseña vieja ya no sirve, la nueva sí
    assert client.post(
        "/mineros/login", json={"username": "recupera1", "password": "claveorig"}
    ).status_code == 401
    assert client.post(
        "/mineros/login",
        json={"username": "recupera1", "password": "clavenueva123"},
    ).status_code == 200
    assert client.get(
        "/mineros/me", headers={"Authorization": f"Bearer {token}"}
    ).status_code == 200


def test_mineros_recuperar_password_agota_los_4_intentos():
    diag = _crear_diagnostico().json()
    client.post("/leads", json=_lead_payload(diag["id"], username="recupera2"))

    # 3 fallos consumen intentos (quedan 2, 1, 0) sin bloquear todavía
    for _ in range(3):
        resp = client.post(
            "/mineros/recuperar-password",
            json={
                "username": "recupera2",
                "respuesta_seguridad": "respuesta incorrecta",
                "nueva_password": "clavenueva123",
            },
        )
        assert resp.status_code == 400

    # El 4to fallo agota el límite (400, pero ya en 0 intentos restantes)
    resp = client.post(
        "/mineros/recuperar-password",
        json={
            "username": "recupera2",
            "respuesta_seguridad": "respuesta incorrecta",
            "nueva_password": "clavenueva123",
        },
    )
    assert resp.status_code == 429

    # Ya no se permite ni con la respuesta correcta
    resp = client.post(
        "/mineros/recuperar-password",
        json={
            "username": "recupera2",
            "respuesta_seguridad": "Rocky",
            "nueva_password": "clavenueva123",
        },
    )
    assert resp.status_code == 429


def test_mineros_recuperar_password_lead_sin_pregunta_configurada():
    # Simula un lead creado ANTES de que existiera esta función (nullable
    # en la BD): sin pregunta, la recuperación autoservicio no está
    # disponible y el minero debe usar el reseteo manual del admin.
    diag = _crear_diagnostico().json()
    db = TestingSessionLocal()
    lead = models.Lead(
        operacion_id=diag["id"],
        nombre="Lead Viejo",
        whatsapp="+51900000999",
        region="arequipa",
        username="viejo1",
        password_hash="hash-lo-que-sea",
    )
    db.add(lead)
    db.commit()
    db.close()

    assert client.get("/mineros/pregunta-seguridad/viejo1").status_code == 404
    assert client.get("/mineros/pregunta-seguridad/usuario_inexistente").status_code == 404
    resp = client.post(
        "/mineros/recuperar-password",
        json={
            "username": "viejo1",
            "respuesta_seguridad": "lo que sea",
            "nueva_password": "clavenueva123",
        },
    )
    assert resp.status_code == 404


def test_mineros_login_y_perfil():
    diag = _crear_diagnostico().json()
    client.post(
        "/leads",
        json=_lead_payload(
            diag["id"], username="minero1", password="clave123"
        ),
    )

    resp = client.post(
        "/mineros/login", json={"username": "minero1", "password": "clave123"}
    )
    assert resp.status_code == 200
    token = resp.json()["access_token"]

    resp = client.get(
        "/mineros/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["nombre"] == "Juan Quispe"
    assert body["score_total"] == diag["score_total"]
    assert body["brechas"] == diag["brechas"]
    assert body["descripcion_operacion"] is None
    assert body["capacidad_produccion"] is None
    assert body["capital_buscado"] is None
    assert body["uso_fondos"] is None


def test_mineros_actualiza_perfil_inversion():
    token = _token_minero(username="mineroinversion")
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.put(
        "/mineros/perfil-inversion",
        headers=headers,
        json={
            "descripcion_operacion": "Mina de oro a tajo abierto en Arequipa",
            "capacidad_produccion": "50 toneladas/mes, reservas estimadas en 5 años",
            "capital_buscado": "USD 80,000",
            "uso_fondos": "Compra de chancadora y planta de beneficio",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["descripcion_operacion"] == "Mina de oro a tajo abierto en Arequipa"
    assert body["capital_buscado"] == "USD 80,000"

    # PUT reemplaza el perfil completo: los campos no enviados quedan en
    # blanco (el frontend siempre manda las 4 respuestas juntas)
    resp = client.put(
        "/mineros/perfil-inversion",
        headers=headers,
        json={"descripcion_operacion": "Actualizado"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["descripcion_operacion"] == "Actualizado"
    assert body["capacidad_produccion"] is None
    assert body["capital_buscado"] is None

    # El admin también ve el perfil de inversión en /admin/leads
    admin_token = _admin_token()
    leads = client.get(
        "/admin/leads", headers={"Authorization": f"Bearer {admin_token}"}
    ).json()
    lead = next(l for l in leads if l["nombre"] == "Juan Quispe")
    assert lead["descripcion_operacion"] == "Actualizado"


def test_mineros_perfil_inversion_requiere_jwt():
    resp = client.put("/mineros/perfil-inversion", json={})
    assert resp.status_code == 403


def test_mineros_login_credenciales_invalidas():
    diag = _crear_diagnostico().json()
    client.post("/leads", json=_lead_payload(diag["id"], username="minero2"))

    resp = client.post(
        "/mineros/login", json={"username": "minero2", "password": "malacontrasena"}
    )
    assert resp.status_code == 401


def test_mineros_me_requiere_jwt():
    resp = client.get("/mineros/me")
    assert resp.status_code == 403


def _token_minero(username="minerodocs", password="clave123"):
    diag = _crear_diagnostico().json()
    client.post(
        "/leads", json=_lead_payload(diag["id"], username=username, password=password)
    )
    resp = client.post("/mineros/login", json={"username": username, "password": password})
    return resp.json()["access_token"]


def test_mineros_sube_lista_y_ve_documento():
    token = _token_minero()
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.post(
        "/mineros/documentos",
        headers=headers,
        data={"categoria": "fotos_mina"},
        files={"archivo": ("mina.jpg", b"\xff\xd8\xffcontenido de imagen falso", "image/jpeg")},
    )
    assert resp.status_code == 201
    doc = resp.json()
    assert doc["categoria"] == "fotos_mina"
    assert doc["nombre_original"] == "mina.jpg"

    resp = client.get("/mineros/documentos", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 1

    resp = client.get(f"/mineros/documentos/{doc['id']}/archivo", headers=headers)
    assert resp.status_code == 200
    assert resp.content == b"\xff\xd8\xffcontenido de imagen falso"


def test_mineros_documento_rechaza_categoria_invalida():
    token = _token_minero(username="minerodocs2")
    resp = client.post(
        "/mineros/documentos",
        headers={"Authorization": f"Bearer {token}"},
        data={"categoria": "no_existe"},
        files={"archivo": ("a.pdf", b"%PDF-contenido", "application/pdf")},
    )
    assert resp.status_code == 422


def test_mineros_documento_rechaza_tipo_incorrecto():
    token = _token_minero(username="minerodocs3")
    # catastro acepta PDF o imagen, pero no cualquier tipo (ej. texto plano)
    resp = client.post(
        "/mineros/documentos",
        headers={"Authorization": f"Bearer {token}"},
        data={"categoria": "catastro"},
        files={"archivo": ("catastro.txt", b"esto no es un pdf ni una imagen", "text/plain")},
    )
    assert resp.status_code == 422


def test_mineros_documento_legal_acepta_imagen():
    # Muchos mineros solo tienen una foto del documento, no un escaneo PDF
    token = _token_minero(username="minerodocs3b")
    resp = client.post(
        "/mineros/documentos",
        headers={"Authorization": f"Bearer {token}"},
        data={"categoria": "catastro"},
        files={"archivo": ("catastro.jpg", b"\xff\xd8\xffcontenido", "image/jpeg")},
    )
    assert resp.status_code == 201


def test_mineros_puede_subir_respaldo_de_estudio_del_catalogo():
    # El diagnostico Sí/No no se puede comprobar por sí solo: el minero
    # puede subir una foto de respaldo por cada estudio del catálogo
    # (ej. "tramite_reinfo", "iperc"), aplique o no a su ruta.
    token = _token_minero(username="minerorespaldo")
    resp = client.post(
        "/mineros/documentos",
        headers={"Authorization": f"Bearer {token}"},
        data={"categoria": "tramite_reinfo"},
        files={"archivo": ("reinfo.jpg", b"\xff\xd8\xffcontenido", "image/jpeg")},
    )
    assert resp.status_code == 201
    assert resp.json()["categoria"] == "tramite_reinfo"


def test_mineros_me_expone_estudios_aplicables_a_su_ruta():
    token = _token_minero(username="minerorespaldo2")
    resp = client.get("/mineros/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    aplicables = resp.json()["estudios_aplicables"]
    # minero_artesanal (default de _token_minero): solo lo que declaró
    # SÍ tener (RESPUESTAS_COMPLETAS responde Sí a todo salvo S5) — no le
    # pedimos foto de algo que ya dijo que no tiene.
    assert "tramite_reinfo" in aplicables  # L1 = True
    assert "iperc" in aplicables  # S1 = True
    assert "vigencia_concesion" not in aplicables  # L6, exclusivo de concesionario
    assert "estudio_ventilacion" not in aplicables  # S5 = False, no aplica pedirle foto


def test_mineros_documento_pdf_se_convierte_a_foto():
    # "Documentación" siempre muestra fotos, nunca un PDF crudo: la primera
    # hoja del PDF se convierte a JPEG al subirse.
    token = _token_minero(username="minerodocs3c")
    resp = client.post(
        "/mineros/documentos",
        headers={"Authorization": f"Bearer {token}"},
        data={"categoria": "catastro"},
        files={"archivo": ("catastro.pdf", PDF_VALIDO_DE_PRUEBA, "application/pdf")},
    )
    assert resp.status_code == 201
    doc = resp.json()
    assert doc["content_type"] == "image/jpeg"


def test_mineros_documento_pdf_ilegible_se_rechaza():
    token = _token_minero(username="minerodocs3d")
    resp = client.post(
        "/mineros/documentos",
        headers={"Authorization": f"Bearer {token}"},
        data={"categoria": "catastro"},
        files={"archivo": ("catastro.pdf", b"%PDF-1.4 pero sin paginas reales", "application/pdf")},
    )
    assert resp.status_code == 422


def test_mineros_elimina_su_documento():
    token = _token_minero(username="minerodocs4")
    headers = {"Authorization": f"Bearer {token}"}
    doc = client.post(
        "/mineros/documentos",
        headers=headers,
        data={"categoria": "informe_leyes"},
        files={"archivo": ("leyes.pdf", PDF_VALIDO_DE_PRUEBA, "application/pdf")},
    ).json()

    resp = client.delete(f"/mineros/documentos/{doc['id']}", headers=headers)
    assert resp.status_code == 204

    resp = client.get("/mineros/documentos", headers=headers)
    assert resp.json() == []


def test_mineros_documentos_requiere_jwt():
    resp = client.get("/mineros/documentos")
    assert resp.status_code == 403


def test_admin_ve_documentos_de_operacion():
    token_minero = _token_minero(username="minerodocs5")
    client.post(
        "/mineros/documentos",
        headers={"Authorization": f"Bearer {token_minero}"},
        data={"categoria": "titulo_concesion"},
        files={"archivo": ("titulo.pdf", PDF_VALIDO_DE_PRUEBA, "application/pdf")},
    )

    admin_token = _admin_token()
    headers_admin = {"Authorization": f"Bearer {admin_token}"}
    leads = client.get("/admin/leads", headers=headers_admin).json()
    assert len(leads) == 1
    operacion_id = leads[0]["operacion_id"]

    resp = client.get(
        f"/admin/operaciones/{operacion_id}/documentos", headers=headers_admin
    )
    assert resp.status_code == 200
    assert len(resp.json()) == 1
    doc_id = resp.json()[0]["id"]

    resp = client.get(f"/admin/documentos/{doc_id}/archivo", headers=headers_admin)
    assert resp.status_code == 200
    # El PDF subido se convierte a foto (primera hoja) al guardarse — nunca
    # se guarda el PDF crudo.
    assert resp.headers["content-type"] == "image/jpeg"


def test_proyectos_publicos_lista_sin_datos_sensibles():
    diag = _crear_diagnostico().json()
    client.post(
        "/leads",
        json=_lead_payload(diag["id"], username="proyectominero", nombre_operacion="Mina Amanecer"),
    )
    token = client.post(
        "/mineros/login", json={"username": "proyectominero", "password": "clave123"}
    ).json()["access_token"]
    client.put(
        "/mineros/perfil-inversion",
        headers={"Authorization": f"Bearer {token}"},
        json={"capital_buscado": "USD 10,000"},
    )

    resp = client.get("/proyectos")
    assert resp.status_code == 200
    proyectos = resp.json()
    assert len(proyectos) == 1
    proyecto = proyectos[0]
    assert proyecto["nombre_proyecto"] == "Mina Amanecer"
    assert proyecto["capital_buscado"] == "USD 10,000"
    assert proyecto["region"] == "arequipa"
    # Nunca datos de contacto
    assert "whatsapp" not in proyecto
    assert "email" not in proyecto
    assert "nombre" not in proyecto


def test_proyectos_sin_nombre_operacion_usa_generico():
    diag = _crear_diagnostico().json()
    client.post("/leads", json=_lead_payload(diag["id"], username="sinapodo"))

    resp = client.get("/proyectos")
    assert resp.json()[0]["nombre_proyecto"] == "Proyecto minero en Arequipa"


def test_proyectos_incluye_operaciones_bloqueadas():
    # REINFO/trámite de formalización ya NO es requisito para la vitrina
    # pública — bloqueado es solo informativo, no filtra el listado.
    respuestas_bloqueadas = dict(RESPUESTAS_COMPLETAS)
    respuestas_bloqueadas["L1"] = False
    diag = client.post(
        "/diagnostico",
        json={
            "respuestas": respuestas_bloqueadas,
            "region": "arequipa",
            "mineral": "oro",
            "tipo_mina": "subterranea",
        },
    ).json()
    assert diag["bloqueado"] is True
    client.post("/leads", json=_lead_payload(diag["id"], username="bloqueado1"))

    resp = client.get("/proyectos")
    assert len(resp.json()) == 1


def test_proyectos_filtra_por_mineral_y_region():
    diag1 = _crear_diagnostico().json()
    client.post(
        "/leads",
        json=_lead_payload(diag1["id"], username="filtro1", whatsapp="+51900000011"),
    )
    diag2 = client.post(
        "/diagnostico",
        json={
            "respuestas": RESPUESTAS_COMPLETAS,
            "region": "puno",
            "mineral": "estaño",
            "tipo_mina": "subterranea",
        },
    ).json()
    client.post(
        "/leads",
        json=_lead_payload(
            diag2["id"], username="filtro2", whatsapp="+51900000022", region="puno"
        ),
    )

    resp = client.get("/proyectos?region=puno")
    assert len(resp.json()) == 1
    assert resp.json()[0]["region"] == "puno"

    resp = client.get("/proyectos?mineral=oro")
    assert len(resp.json()) == 1
    assert resp.json()[0]["mineral"] == "oro"


def test_proyectos_minerales_distintos():
    diag = _crear_diagnostico().json()
    client.post("/leads", json=_lead_payload(diag["id"], username="mineraldistinto"))

    resp = client.get("/proyectos/minerales")
    assert resp.status_code == 200
    assert resp.json() == ["oro"]


def test_proyectos_detalle_muestra_fotos_y_checklist_sin_pdfs():
    diag = _crear_diagnostico().json()
    client.post(
        "/leads",
        json=_lead_payload(diag["id"], username="detalleproyecto", nombre_operacion="Mina Detalle"),
    )
    token = client.post(
        "/mineros/login", json={"username": "detalleproyecto", "password": "clave123"}
    ).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    client.post(
        "/mineros/documentos",
        headers=headers,
        data={"categoria": "fotos_mina"},
        files={"archivo": ("mina.jpg", b"\xff\xd8\xfffoto real", "image/jpeg")},
    )
    client.post(
        "/mineros/documentos",
        headers=headers,
        data={"categoria": "ruc"},
        files={"archivo": ("ruc.pdf", PDF_VALIDO_DE_PRUEBA, "application/pdf")},
    )

    resp = client.get(f"/proyectos/{diag['id']}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["nombre_proyecto"] == "Mina Detalle"
    assert len(body["fotos"]) == 1
    foto_url = body["fotos"][0]["url"]
    assert body["documentos_presentados"]["ruc"] is True
    assert body["documentos_presentados"]["catastro"] is False
    assert "fotos_mina" not in body["documentos_presentados"]

    # Se puede ver la foto de la mina sin login...
    resp = client.get(foto_url)
    assert resp.status_code == 200
    assert resp.content == b"\xff\xd8\xfffoto real"

    # ...y también la foto del documento legal (el PDF que subió el minero
    # se convirtió a foto de la primera hoja al subirse).
    assert len(body["documentos_legales"]["ruc"]) == 1
    assert len(body["documentos_legales"]["catastro"]) == 0
    resp = client.get(body["documentos_legales"]["ruc"][0]["url"])
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "image/jpeg"

    resp = client.get(f"/proyectos/{diag['id']}/fotos/999999")
    assert resp.status_code == 404


def test_proyectos_detalle_operacion_bloqueada_ya_no_da_404():
    # Antes esto daba 404 (regla vieja); ahora bloqueado es solo
    # informativo y el detalle del proyecto sigue siendo visible.
    respuestas_bloqueadas = dict(RESPUESTAS_COMPLETAS)
    respuestas_bloqueadas["L1"] = False
    diag = client.post(
        "/diagnostico",
        json={
            "respuestas": respuestas_bloqueadas,
            "region": "arequipa",
            "mineral": "oro",
            "tipo_mina": "subterranea",
        },
    ).json()
    client.post("/leads", json=_lead_payload(diag["id"], username="bloqueado2"))

    resp = client.get(f"/proyectos/{diag['id']}")
    assert resp.status_code == 200


def test_proyectos_detalle_inexistente_da_404():
    resp = client.get("/proyectos/no-existe")
    assert resp.status_code == 404


def test_proyectos_detalle_incluye_dimensiones_y_brechas():
    diag = _crear_diagnostico().json()
    client.post("/leads", json=_lead_payload(diag["id"], username="dimensionesproyecto"))

    resp = client.get(f"/proyectos/{diag['id']}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["brechas_pendientes"] == ["estudio_ventilacion"]
    assert body["brechas_resueltas"] == []
    assert body["dimensiones"]["seguridad"]["puntaje"] == 20
    assert body["dimensiones"]["seguridad"]["maximo"] == 25
    assert body["dimensiones"]["legal"]["puntaje"] == 25


def _interes_payload(**overrides):
    payload = {
        "nombre": "Inversionista Prueba",
        "username": "inversionista1",
        "password": "clave123",
        "pregunta_seguridad": "¿Ciudad donde naciste?",
        "respuesta_seguridad": "Lima",
        "telefono": "+51900000123",
        "email": "inversionista@example.com",
        "motivo_inversion": "Diversificar cartera en minería formal",
        "monto": "USD 20,000",
        "informacion_requerida": "Estados financieros y plan de producción",
        "mensaje": "Me interesa este proyecto",
    }
    payload.update(overrides)
    return payload


def test_proyectos_registra_interes_inversion():
    diag = _crear_diagnostico().json()
    client.post("/leads", json=_lead_payload(diag["id"], username="interesproyecto"))

    resp = client.post(f"/proyectos/{diag['id']}/interes", json=_interes_payload())
    assert resp.status_code == 201
    body = resp.json()
    assert body["nombre"] == "Inversionista Prueba"
    assert body["operacion_id"] == diag["id"]
    assert body["motivo_inversion"] == "Diversificar cartera en minería formal"
    assert body["monto"] == "USD 20,000"
    assert "username" not in body
    assert "password" not in body

    admin_token = _admin_token()
    resp = client.get(
        f"/admin/operaciones/{diag['id']}/intereses",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    assert len(resp.json()) == 1
    assert resp.json()[0]["email"] == "inversionista@example.com"


def test_proyectos_registra_interes_email_opcional():
    diag = _crear_diagnostico().json()
    client.post("/leads", json=_lead_payload(diag["id"], username="interessinemail"))

    resp = client.post(
        f"/proyectos/{diag['id']}/interes",
        json=_interes_payload(username="sinemail1", email=None),
    )
    assert resp.status_code == 201
    assert resp.json()["email"] is None


def test_proyectos_registra_interes_rechaza_email_invalido():
    diag = _crear_diagnostico().json()
    client.post("/leads", json=_lead_payload(diag["id"], username="interesproyecto2"))

    resp = client.post(
        f"/proyectos/{diag['id']}/interes",
        json=_interes_payload(username="interes2", email="no-es-email"),
    )
    assert resp.status_code == 422


def test_proyectos_registra_interes_username_duplicado():
    diag = _crear_diagnostico().json()
    client.post("/leads", json=_lead_payload(diag["id"], username="interesproyecto3"))

    client.post(
        f"/proyectos/{diag['id']}/interes",
        json=_interes_payload(username="repetido"),
    )
    resp = client.post(
        f"/proyectos/{diag['id']}/interes",
        json=_interes_payload(username="repetido", email="otro@example.com"),
    )
    assert resp.status_code == 409


def test_proyectos_registra_interes_operacion_bloqueada_ya_no_da_404():
    # Antes esto daba 404 (regla vieja); ahora bloqueado es solo
    # informativo y el proyecto acepta interés igual.
    respuestas_bloqueadas = dict(RESPUESTAS_COMPLETAS)
    respuestas_bloqueadas["L1"] = False
    diag = client.post(
        "/diagnostico",
        json={
            "respuestas": respuestas_bloqueadas,
            "region": "arequipa",
            "mineral": "oro",
            "tipo_mina": "subterranea",
        },
    ).json()
    client.post("/leads", json=_lead_payload(diag["id"], username="bloqueado3"))

    resp = client.post(
        f"/proyectos/{diag['id']}/interes",
        json=_interes_payload(username="bloqueadoInteres"),
    )
    assert resp.status_code == 201


def test_inversionistas_login_y_perfil():
    diag = _crear_diagnostico().json()
    client.post("/leads", json=_lead_payload(diag["id"], username="paralogininversionista"))
    client.post(
        f"/proyectos/{diag['id']}/interes",
        json=_interes_payload(username="inversionistalogin", password="clave123"),
    )

    resp = client.post(
        "/inversionistas/login",
        json={"username": "inversionistalogin", "password": "clave123"},
    )
    assert resp.status_code == 200
    token = resp.json()["access_token"]

    resp = client.get(
        "/inversionistas/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["nombre"] == "Inversionista Prueba"
    assert body["monto"] == "USD 20,000"
    assert body["operacion_id"] == diag["id"]


def test_inversionistas_recuperar_password_flujo_completo():
    diag = _crear_diagnostico().json()
    client.post("/leads", json=_lead_payload(diag["id"], username="paralead4"))
    client.post(
        f"/proyectos/{diag['id']}/interes",
        json=_interes_payload(username="inversionistarecupera", password="claveorig"),
    )

    resp = client.get("/inversionistas/pregunta-seguridad/inversionistarecupera")
    assert resp.status_code == 200
    assert resp.json()["pregunta"] == "¿Ciudad donde naciste?"

    resp = client.post(
        "/inversionistas/recuperar-password",
        json={
            "username": "inversionistarecupera",
            "respuesta_seguridad": "lima",
            "nueva_password": "clavenueva123",
        },
    )
    assert resp.status_code == 200

    assert client.post(
        "/inversionistas/login",
        json={"username": "inversionistarecupera", "password": "clavenueva123"},
    ).status_code == 200


def test_inversionistas_recuperar_password_agota_los_4_intentos():
    diag = _crear_diagnostico().json()
    client.post("/leads", json=_lead_payload(diag["id"], username="paralead5"))
    client.post(
        f"/proyectos/{diag['id']}/interes",
        json=_interes_payload(username="inversionistaagota"),
    )

    for _ in range(3):
        resp = client.post(
            "/inversionistas/recuperar-password",
            json={
                "username": "inversionistaagota",
                "respuesta_seguridad": "respuesta incorrecta",
                "nueva_password": "clavenueva123",
            },
        )
        assert resp.status_code == 400

    resp = client.post(
        "/inversionistas/recuperar-password",
        json={
            "username": "inversionistaagota",
            "respuesta_seguridad": "respuesta incorrecta",
            "nueva_password": "clavenueva123",
        },
    )
    assert resp.status_code == 429

    resp = client.post(
        "/inversionistas/recuperar-password",
        json={
            "username": "inversionistaagota",
            "respuesta_seguridad": "Lima",
            "nueva_password": "clavenueva123",
        },
    )
    assert resp.status_code == 429


def test_inversionistas_login_credenciales_invalidas():
    diag = _crear_diagnostico().json()
    client.post("/leads", json=_lead_payload(diag["id"], username="paralogininversionista2"))
    client.post(
        f"/proyectos/{diag['id']}/interes",
        json=_interes_payload(username="inversionistamal"),
    )

    resp = client.post(
        "/inversionistas/login",
        json={"username": "inversionistamal", "password": "malacontrasena"},
    )
    assert resp.status_code == 401


def test_inversionistas_me_requiere_jwt():
    resp = client.get("/inversionistas/me")
    assert resp.status_code == 403


def test_admin_intereses_requiere_jwt():
    resp = client.get("/admin/operaciones/no-importa/intereses")
    assert resp.status_code == 403


def test_admin_login():
    resp = client.post("/admin/login", json={"username": "esthiven", "password": "changeme"})
    assert resp.status_code == 200
    assert "access_token" in resp.json()


def test_admin_login_credenciales_invalidas():
    resp = client.post("/admin/login", json={"username": "esthiven", "password": "mala"})
    assert resp.status_code == 401


def test_admin_leads_requiere_jwt():
    resp = client.get("/admin/leads")
    assert resp.status_code == 403  # HTTPBearer sin credenciales


def test_admin_leads_con_jwt():
    token = _admin_token()
    diag = _crear_diagnostico().json()
    client.post(
        "/leads",
        json=_lead_payload(
            diag["id"],
            email="juan@example.com",
            nombre_operacion="Labor La Esperanza",
        ),
    )

    resp = client.get(
        "/admin/leads", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 200
    lead = resp.json()[0]
    assert lead["score_total"] == diag["score_total"]
    assert lead["brechas"] == diag["brechas"]
    assert lead["email"] == "juan@example.com"
    assert lead["nombre_operacion"] == "Labor La Esperanza"
    # Recién creado: nada resuelto todavía, "actual" == original
    assert lead["brechas_resueltas"] == []
    assert lead["brechas_pendientes"] == diag["brechas"]
    assert lead["score_actual"] == diag["score_total"]
    assert lead["bloqueado_actual"] == diag["bloqueado"]


def test_marcar_brecha_resuelta_no_altera_declaracion_original():
    token = _admin_token()
    headers = {"Authorization": f"Bearer {token}"}
    diag = _crear_diagnostico().json()
    assert diag["brechas"] == ["estudio_ventilacion"]

    resp = client.put(
        f"/admin/operaciones/{diag['id']}/brechas-resueltas",
        json={"brechas_resueltas": ["estudio_ventilacion"]},
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["score_total"] == diag["score_total"]  # original intacto
    assert body["brechas"] == ["estudio_ventilacion"]  # original intacto
    assert body["brechas_resueltas"] == ["estudio_ventilacion"]
    assert body["brechas_pendientes"] == []
    assert body["score_actual"] == 100
    assert body["bloqueado_actual"] is False

    # Se puede desmarcar enviando una lista más corta (vacía)
    resp = client.put(
        f"/admin/operaciones/{diag['id']}/brechas-resueltas",
        json={"brechas_resueltas": []},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["score_actual"] == diag["score_total"]


def test_marcar_brecha_resuelta_rechaza_estudio_que_no_es_brecha_real():
    token = _admin_token()
    headers = {"Authorization": f"Bearer {token}"}
    diag = _crear_diagnostico().json()

    resp = client.put(
        f"/admin/operaciones/{diag['id']}/brechas-resueltas",
        json={"brechas_resueltas": ["igafom_correctivo"]},  # no es una brecha de este diag
        headers=headers,
    )
    assert resp.status_code == 400


def test_marcar_brecha_resuelta_requiere_jwt():
    diag = _crear_diagnostico().json()
    resp = client.put(
        f"/admin/operaciones/{diag['id']}/brechas-resueltas",
        json={"brechas_resueltas": []},
    )
    assert resp.status_code == 403


def test_marcar_brecha_resuelta_operacion_inexistente():
    token = _admin_token()
    resp = client.put(
        "/admin/operaciones/no-existe/brechas-resueltas",
        json={"brechas_resueltas": []},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404


def test_dashboard_top_brechas_excluye_las_ya_resueltas():
    token = _admin_token()
    headers = {"Authorization": f"Bearer {token}"}
    diag = _crear_diagnostico().json()

    resp = client.get("/admin/dashboard", headers=headers)
    assert {"estudio": "estudio_ventilacion", "conteo": 1} in resp.json()["top_brechas"]

    client.put(
        f"/admin/operaciones/{diag['id']}/brechas-resueltas",
        json={"brechas_resueltas": ["estudio_ventilacion"]},
        headers=headers,
    )

    resp = client.get("/admin/dashboard", headers=headers)
    assert resp.json()["top_brechas"] == []


def test_admin_leads_filtro_por_region():
    token = _admin_token()
    headers = {"Authorization": f"Bearer {token}"}
    diag = _crear_diagnostico().json()
    client.post(
        "/leads",
        json=_lead_payload(diag["id"], nombre="Ana", whatsapp="+51911111111", username="ana1"),
    )

    resp = client.get("/admin/leads?region=puno", headers=headers)
    assert resp.status_code == 200
    assert resp.json() == []

    resp = client.get("/admin/leads?region=arequipa", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_admin_dashboard():
    token = _admin_token()
    headers = {"Authorization": f"Bearer {token}"}
    diag = _crear_diagnostico().json()
    client.post(
        "/leads",
        json=_lead_payload(diag["id"], nombre="Ana", whatsapp="+51911111111", username="ana2"),
    )

    resp = client.get("/admin/dashboard", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["diagnosticos_total"] == 1
    assert body["diagnosticos_hoy"] == 1
    assert body["leads_total"] == 1
    assert body["leads_hoy"] == 1
    assert body["score_promedio"] == 95
    assert body["top_brechas"] == [{"estudio": "estudio_ventilacion", "conteo": 1}]
    assert body["ultimos_leads"][0]["nombre"] == "Ana"


def test_admin_dashboard_requiere_jwt():
    resp = client.get("/admin/dashboard")
    assert resp.status_code == 403


def test_admin_crud_empresas():
    token = _admin_token()
    headers = {"Authorization": f"Bearer {token}"}

    empresa = {
        "nombre": "Estudios Andinos SAC",
        "ruc": "20123456789",
        "anios_servicio": 5,
        "regiones_json": ["arequipa"],
        "estudios_json": ["informe_geologico", "muestreo_ley"],
        "whatsapp": "+51987000000",
        "email": None,
        "activa": True,
    }
    resp = client.post("/admin/empresas", json=empresa, headers=headers)
    assert resp.status_code == 201
    empresa_id = resp.json()["id"]

    resp = client.put(
        f"/admin/empresas/{empresa_id}",
        json={**empresa, "anios_servicio": 6},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["anios_servicio"] == 6

    resp = client.delete(f"/admin/empresas/{empresa_id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["activa"] is False

    # GET /admin/empresas incluye inactivas (a diferencia de GET /empresas público)
    resp = client.get("/admin/empresas", headers=headers)
    assert resp.status_code == 200
    assert any(e["id"] == empresa_id and not e["activa"] for e in resp.json())


def test_admin_elimina_empresa_definitivamente():
    token = _admin_token()
    headers = {"Authorization": f"Bearer {token}"}
    empresa = _crear_empresa(token, nombre="Para Borrar SAC", ruc="20888888888")

    resp = client.delete(f"/admin/empresas/{empresa['id']}/eliminar", headers=headers)
    assert resp.status_code == 204

    resp = client.get(f"/empresas/{empresa['id']}")
    assert resp.status_code == 404


def test_admin_elimina_empresa_requiere_jwt():
    resp = client.delete("/admin/empresas/999/eliminar")
    assert resp.status_code == 403


def test_admin_elimina_lead_y_su_operacion():
    token = _admin_token()
    headers = {"Authorization": f"Bearer {token}"}
    diag = _crear_diagnostico().json()
    lead = client.post(
        "/leads", json=_lead_payload(diag["id"], username="paraborrar")
    ).json()

    resp = client.delete(f"/admin/leads/{lead['id']}", headers=headers)
    assert resp.status_code == 204

    resp = client.get("/admin/leads", headers=headers)
    assert resp.json() == []

    # También borró la operación asociada (nadie más la referenciaba)
    resp = client.post(
        "/mineros/login", json={"username": "paraborrar", "password": "clave123"}
    )
    assert resp.status_code == 401


def test_admin_elimina_lead_requiere_jwt():
    resp = client.delete("/admin/leads/999")
    assert resp.status_code == 403


def test_admin_elimina_lead_borra_tambien_sus_documentos():
    token = _admin_token()
    headers = {"Authorization": f"Bearer {token}"}
    diag = _crear_diagnostico().json()
    lead = client.post(
        "/leads", json=_lead_payload(diag["id"], username="conarchivos")
    ).json()
    login = client.post(
        "/mineros/login", json={"username": "conarchivos", "password": "clave123"}
    ).json()
    minero_headers = {"Authorization": f"Bearer {login['access_token']}"}
    doc = client.post(
        "/mineros/documentos",
        headers=minero_headers,
        data={"categoria": "fotos_mina"},
        files={"archivo": ("mina.jpg", b"\xff\xd8\xfffoto", "image/jpeg")},
    ).json()

    resp = client.delete(f"/admin/leads/{lead['id']}", headers=headers)
    assert resp.status_code == 204

    resp = client.get(f"/admin/documentos/{doc['id']}/archivo", headers=headers)
    assert resp.status_code == 404


def test_admin_elimina_lead_inexistente():
    token = _admin_token()
    resp = client.delete(
        "/admin/leads/999999", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 404


def _crear_empresa(token, **overrides):
    empresa = {
        "nombre": "Empresa de prueba",
        "ruc": "20999999999",
        "anios_servicio": 3,
        "regiones_json": ["cusco"],
        "estudios_json": ["tramite_reinfo"],
        "whatsapp": "+51987000001",
        "email": None,
        "activa": True,
        **overrides,
    }
    resp = client.post(
        "/admin/empresas", json=empresa, headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 201
    return resp.json()


def test_mejor_opcion_empresa_unica_cubre_todo():
    token = _admin_token()
    _crear_empresa(
        token,
        nombre="Cubre Todo SAC",
        ruc="20111111111",
        anios_servicio=10,
        estudios_json=["tramite_reinfo", "plan_seguridad", "informe_geologico"],
    )
    _crear_empresa(
        token,
        nombre="Solo Reinfo SAC",
        ruc="20111111112",
        estudios_json=["tramite_reinfo"],
    )

    resp = client.get(
        "/empresas/mejor-opcion"
        "?estudios=tramite_reinfo,plan_seguridad,informe_geologico&region=cusco"
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["modo"] == "empresa_unica"
    assert body["empresa_unica"]["nombre"] == "Cubre Todo SAC"


def test_mejor_opcion_por_brecha_cuando_nadie_cubre_todo():
    token = _admin_token()
    _crear_empresa(
        token,
        nombre="Especialista Reinfo SAC",
        ruc="20222222221",
        anios_servicio=8,
        estudios_json=["tramite_reinfo"],
    )
    _crear_empresa(
        token,
        nombre="Especialista Seguridad SAC",
        ruc="20222222222",
        anios_servicio=4,
        estudios_json=["plan_seguridad"],
    )

    resp = client.get(
        "/empresas/mejor-opcion?estudios=tramite_reinfo,plan_seguridad,muestreo_ley&region=cusco"
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["modo"] == "por_brecha"
    assert body["mejores_por_brecha"]["tramite_reinfo"]["nombre"] == "Especialista Reinfo SAC"
    assert body["mejores_por_brecha"]["plan_seguridad"]["nombre"] == "Especialista Seguridad SAC"
    assert body["mejores_por_brecha"]["muestreo_ley"] is None


PDF_DE_PRUEBA = b"%PDF-1.4\n%fake cv content for tests\n%%EOF"


def _campos_postulacion(**overrides):
    campos = {
        "nombre": "Ing. Juana Pérez",
        "colegiatura": "CIP 123456",
        "anios_servicio": 3,
        "whatsapp": "+51987654321",
        "regiones_json": '["arequipa"]',
        "estudios_json": '["estudio_ventilacion"]',
    }
    campos.update(overrides)
    return campos


def _postular(archivo=None, **overrides):
    files = {"cv": ("cv.pdf", archivo or PDF_DE_PRUEBA, "application/pdf")}
    return client.post(
        "/consultores/postular", data=_campos_postulacion(**overrides), files=files
    )


def test_postular_consultor_queda_inactivo():
    resp = _postular()
    assert resp.status_code == 201
    body = resp.json()
    assert body["tipo"] == "consultor"
    # Se envió "CIP 123456": el backend guarda solo el número
    assert body["colegiatura"] == "123456"
    assert body["ruc"] is None
    assert body["cv_filename"] is not None
    assert body["activa"] is False  # pendiente de aprobación de Esthiven

    # No debe aparecer en el listado público (solo activas)
    resp = client.get("/empresas")
    assert all(e["nombre"] != "Ing. Juana Pérez" for e in resp.json())


def test_postular_consultor_rechaza_menos_de_3_anios():
    resp = _postular(anios_servicio=2)
    assert resp.status_code == 422


def test_postular_consultor_requiere_colegiatura():
    resp = _postular(colegiatura="")
    assert resp.status_code == 422


def test_postular_consultor_rechaza_archivo_no_pdf():
    resp = client.post(
        "/consultores/postular",
        data=_campos_postulacion(),
        files={"cv": ("cv.txt", b"esto no es un pdf", "text/plain")},
    )
    assert resp.status_code == 422


def test_postular_consultor_rechaza_colegiatura_duplicada():
    resp1 = _postular()
    assert resp1.status_code == 201

    resp2 = _postular(nombre="Ing. Otro Nombre", whatsapp="+51911112222")
    assert resp2.status_code == 409


def test_admin_puede_descargar_cv_y_activar_consultor_postulado():
    token = _admin_token()
    headers = {"Authorization": f"Bearer {token}"}
    postulado = _postular().json()

    # Descarga del CV protegida con JWT
    resp = client.get(f"/admin/empresas/{postulado['id']}/cv", headers=headers)
    assert resp.status_code == 200
    assert resp.content == PDF_DE_PRUEBA

    # Sin JWT no se puede descargar
    resp = client.get(f"/admin/empresas/{postulado['id']}/cv")
    assert resp.status_code == 403

    resp = client.put(
        f"/admin/empresas/{postulado['id']}",
        json={**postulado, "activa": True},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["activa"] is True

    resp = client.get("/empresas")
    assert any(e["nombre"] == "Ing. Juana Pérez" for e in resp.json())


def test_empresa_sin_ruc_falla_validacion():
    token = _admin_token()
    resp = client.post(
        "/admin/empresas",
        json={
            "tipo": "empresa",
            "nombre": "Empresa sin RUC SAC",
            "anios_servicio": 3,
            "regiones_json": ["cusco"],
            "estudios_json": ["tramite_reinfo"],
            "whatsapp": "+51987000002",
            "email": None,
            "activa": True,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 422


def test_limite_de_intentos_de_login():
    from types import SimpleNamespace

    from fastapi import HTTPException

    import security

    peticion = SimpleNamespace(client=SimpleNamespace(host="ip-de-prueba-unica"))
    for _ in range(security.MAX_INTENTOS):
        security.limitar_intentos_login(peticion)
    with pytest.raises(HTTPException) as exc:
        security.limitar_intentos_login(peticion)
    assert exc.value.status_code == 429


def test_documento_rechaza_contenido_que_no_coincide_con_tipo():
    diag = _crear_diagnostico().json()
    client.post(
        "/leads",
        json=_lead_payload(
            diag["id"],
            whatsapp="+51911111199",
            username="minerofirma",
            password="clave12345",
        ),
    )
    token = client.post(
        "/mineros/login", json={"username": "minerofirma", "password": "clave12345"}
    ).json()["access_token"]

    # Un "PDF" que en realidad es texto plano debe rechazarse
    resp = client.post(
        "/mineros/documentos",
        data={"categoria": "ruc"},
        files={"archivo": ("falso.pdf", b"no soy un pdf", "application/pdf")},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 422

    # Un PDF real (con contenido válido) sí pasa
    resp = client.post(
        "/mineros/documentos",
        data={"categoria": "ruc"},
        files={"archivo": ("real.pdf", PDF_VALIDO_DE_PRUEBA, "application/pdf")},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201


def test_perfil_inversion_guarda_ubicacion_maps_valida():
    token = _token_minero(username="minerodeubicacion")
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.put(
        "/mineros/perfil-inversion",
        headers=headers,
        json={
            "capital_buscado": "USD 50,000",
            "uso_fondos": "comprar chancadora",
            "ubicacion_maps": "https://maps.app.goo.gl/abc123XYZ",
        },
    )
    assert resp.status_code == 200
    assert resp.json()["ubicacion_maps"] == "https://maps.app.goo.gl/abc123XYZ"

    # Un enlace que no es de Google Maps se rechaza
    resp = client.put(
        "/mineros/perfil-inversion",
        headers=headers,
        json={"ubicacion_maps": "https://miweb-falsa.com/mapa"},
    )
    assert resp.status_code == 422


def test_detalle_proyecto_incluye_descripcion_generada_y_ubicacion():
    token = _token_minero(username="minerogenerado")
    headers = {"Authorization": f"Bearer {token}"}
    client.put(
        "/mineros/perfil-inversion",
        headers=headers,
        json={
            "capital_buscado": "USD 30,000",
            "uso_fondos": "planta de beneficio",
            "ubicacion_maps": "https://maps.app.goo.gl/zona1",
        },
    )

    proyectos = client.get("/proyectos").json()
    assert len(proyectos) == 1
    detalle = client.get(f"/proyectos/{proyectos[0]['operacion_id']}").json()

    assert detalle["ubicacion_maps"] == "https://maps.app.goo.gl/zona1"
    generada = detalle["descripcion_generada"]
    assert "oro" in generada
    assert "Arequipa" in generada
    assert "REINFO" in generada
    # Capital buscado / uso de fondos y MineScore van solo en el "Resumen
    # Ejecutivo" del frontend, no se repiten en la descripción generada.
    assert "USD 30,000" not in generada
    assert "planta de beneficio" not in generada


def test_proyectos_expone_score_de_inversion():
    diag = _crear_diagnostico().json()
    client.post(
        "/leads",
        json=_lead_payload(diag["id"], username="scoreinversion", nombre_operacion="Mina Score"),
    )

    proyectos = client.get("/proyectos").json()
    assert len(proyectos) == 1
    proyecto = proyectos[0]
    assert "score_inversion" in proyecto
    assert isinstance(proyecto["score_inversion"], int)
    assert 0 <= proyecto["score_inversion"] <= 100

    detalle = client.get(f"/proyectos/{proyecto['operacion_id']}").json()
    dims = detalle["dimensiones_inversion"]
    assert set(dims.keys()) == {
        "formalizacion", "escala_economica", "viabilidad_tecnica",
        "riesgo_ambiental_social", "capacidad_equipo", "claridad_oportunidad",
    }
    for dim in dims.values():
        assert dim["maximo"] == 100
        assert 0 <= dim["puntaje"] <= 100
    # score_actual (MineScore de formalización) sigue viviendo aparte, es
    # uno de los ingredientes, no el resultado final.
    assert dims["formalizacion"]["puntaje"] == detalle["score_actual"]


def test_proyectos_expone_perfil_informativo_del_diagnostico():
    # Antes el perfil (Fase 1) solo alimentaba el cálculo del score de
    # inversión; ahora también se expone tal cual para que el
    # inversionista lo vea como texto en la ficha del proyecto.
    diag = client.post(
        "/diagnostico",
        json={
            "respuestas": RESPUESTAS_COMPLETAS,
            "region": "arequipa",
            "mineral": "oro",
            "tipo_mina": "subterranea",
            "situacion": "minero_artesanal",
            "experiencia_operador": "5-10 años",
            "capacitacion_operador": "cip",
            "monto_requerido": "S/. 200,000 - 1,000,000",
        },
    ).json()
    client.post(
        "/leads",
        json=_lead_payload(diag["id"], username="perfilexpuesto", nombre_operacion="Mina Perfil"),
    )

    detalle = client.get(f"/proyectos/{diag['id']}").json()
    assert detalle["experiencia_operador"] == "5-10 años"
    assert detalle["capacitacion_operador"] == "cip"
    assert detalle["monto_requerido"] == "S/. 200,000 - 1,000,000"


def test_proyectos_check_publico_requiere_foto_de_respaldo():
    # El diagnóstico es autodeclarado: responder "sí" no basta para que la
    # ficha pública muestre check ✓. Solo cuenta como verificado si además
    # hay una foto de respaldo subida para ese estudio.
    token = _token_minero(username="minerocheck")
    headers = {"Authorization": f"Bearer {token}"}

    proyectos = client.get("/proyectos").json()
    operacion_id = proyectos[0]["operacion_id"]

    detalle_sin_fotos = client.get(f"/proyectos/{operacion_id}").json()
    # "tramite_reinfo" (L1) fue respondido "sí" en RESPUESTAS_COMPLETAS
    # (por eso no aparece en brechas_pendientes), pero sin foto no debe
    # contar como verificado para el check ✓ público.
    assert "tramite_reinfo" not in detalle_sin_fotos["brechas_pendientes"]
    assert "tramite_reinfo" not in detalle_sin_fotos["brechas_verificadas"]

    client.post(
        "/mineros/documentos",
        headers=headers,
        data={"categoria": "tramite_reinfo"},
        files={"archivo": ("reinfo.jpg", b"\xff\xd8\xffcontenido", "image/jpeg")},
    )

    detalle_con_foto = client.get(f"/proyectos/{operacion_id}").json()
    assert "tramite_reinfo" in detalle_con_foto["brechas_verificadas"]
    assert len(detalle_con_foto["documentos_estudios"]["tramite_reinfo"]) == 1
    # Una brecha que sigue pendiente (S5) no se vuelve verificada aunque
    # alguien suba una foto con esa categoría.
    client.post(
        "/mineros/documentos",
        headers=headers,
        data={"categoria": "estudio_ventilacion"},
        files={"archivo": ("vent.jpg", b"\xff\xd8\xffcontenido", "image/jpeg")},
    )
    detalle_final = client.get(f"/proyectos/{operacion_id}").json()
    assert "estudio_ventilacion" not in detalle_final["brechas_verificadas"]


def test_diagnostico_guarda_y_expone_especie_mineral():
    # No basta con saber que el minero extrae cobre: puede ser calcopirita,
    # malaquita, etc. — se declara por elemento en el perfil (Fase 1) y se
    # combina en un solo string legible, igual que ley_promedio.
    diag = client.post(
        "/diagnostico",
        json={
            "respuestas": RESPUESTAS_COMPLETAS,
            "region": "arequipa",
            "mineral": "oro, cobre",
            "tipo_mina": "subterranea",
            "situacion": "minero_artesanal",
            "especie_mineral": "Oro: Oro nativo; Cobre: Calcopirita, Malaquita",
        },
    ).json()
    client.post(
        "/leads",
        json=_lead_payload(diag["id"], username="especiemineral", nombre_operacion="Mina Especie"),
    )

    detalle = client.get(f"/proyectos/{diag['id']}").json()
    assert detalle["especie_mineral"] == "Oro: Oro nativo; Cobre: Calcopirita, Malaquita"

    token = _admin_token()
    leads = client.get("/admin/leads", headers={"Authorization": f"Bearer {token}"}).json()
    lead = next(l for l in leads if l["nombre_operacion"] == "Mina Especie")
    assert lead["especie_mineral"] == "Oro: Oro nativo; Cobre: Calcopirita, Malaquita"


def test_evento_diagnostico_iniciado_y_metricas():
    resp = client.post("/eventos", json={"tipo": "diagnostico_iniciado"})
    assert resp.status_code == 201

    # Tipo desconocido se rechaza
    resp = client.post("/eventos", json={"tipo": "hackeo"})
    assert resp.status_code == 422

    token = _admin_token()
    dashboard = client.get(
        "/admin/dashboard", headers={"Authorization": f"Bearer {token}"}
    ).json()
    assert dashboard["diagnosticos_iniciados"] == 1


def test_admin_cambia_estado_contacto_y_minero_lo_ve():
    token_minero = _token_minero(username="mineroestado")
    perfil = client.get(
        "/mineros/me", headers={"Authorization": f"Bearer {token_minero}"}
    ).json()
    assert perfil["estado_contacto"] == "buscando"

    token_admin = _admin_token()
    headers_admin = {"Authorization": f"Bearer {token_admin}"}
    leads = client.get("/admin/leads", headers=headers_admin).json()
    lead_id = leads[0]["id"]

    resp = client.put(
        f"/admin/leads/{lead_id}/estado-contacto",
        headers=headers_admin,
        json={"estado_contacto": "contactado"},
    )
    assert resp.status_code == 200

    # Estado inválido se rechaza
    resp = client.put(
        f"/admin/leads/{lead_id}/estado-contacto",
        headers=headers_admin,
        json={"estado_contacto": "cualquiercosa"},
    )
    assert resp.status_code == 422

    perfil = client.get(
        "/mineros/me", headers={"Authorization": f"Bearer {token_minero}"}
    ).json()
    assert perfil["estado_contacto"] == "contactado"


def test_extraccion_de_coordenadas_de_enlaces_maps():
    from geoubicacion import _extraer

    assert _extraer("https://www.google.com/maps/place/Mina/@-12.52,-76.71,15z") == "-12.52,-76.71"
    assert _extraer("https://google.com/maps?q=-11.1,-75.2") == "-11.1,-75.2"
    assert _extraer("https://maps.google.com/algo!3d-12.5!4d-76.7!") == "-12.5,-76.7"
    assert _extraer("https://maps.app.goo.gl/corto") is None
    # El pin real (!3d!4d) manda sobre el centro de la vista (@): si el mapa
    # estaba alejado al compartir, @ puede quedar muy lejos del pin
    url_con_ambos = "https://google.com/maps/place/Mina/@-12.52,-76.71,135803m/data=!3d-12.31!4d-75.70"
    assert _extraer(url_con_ambos) == "-12.31,-75.70"


def test_admin_resetea_password_de_minero():
    _token_minero(username="mineroolvidadizo", password="claveperdida1")

    token_admin = _admin_token()
    headers_admin = {"Authorization": f"Bearer {token_admin}"}
    leads = client.get("/admin/leads", headers=headers_admin).json()

    resp = client.post(
        f"/admin/leads/{leads[0]['id']}/resetear-password", headers=headers_admin
    )
    assert resp.status_code == 200
    nueva = resp.json()["password_temporal"]
    assert len(nueva) == 8

    # La clave vieja ya no sirve; la nueva sí
    resp = client.post(
        "/mineros/login",
        json={"username": "mineroolvidadizo", "password": "claveperdida1"},
    )
    assert resp.status_code == 401
    resp = client.post(
        "/mineros/login", json={"username": "mineroolvidadizo", "password": nueva}
    )
    assert resp.status_code == 200


def test_proyectos_lista_incluye_foto_portada():
    token = _token_minero(username="minerofoto")
    headers = {"Authorization": f"Bearer {token}"}
    client.post(
        "/mineros/documentos",
        data={"categoria": "fotos_mina"},
        files={"archivo": ("mina.jpg", b"\xff\xd8\xfffoto portada", "image/jpeg")},
        headers=headers,
    )

    proyectos = client.get("/proyectos").json()
    assert proyectos[0]["foto_portada_url"] is not None
    assert "/fotos/" in proyectos[0]["foto_portada_url"]


def test_maximo_fotos_de_mina():
    from uploads_config import FOTOS_MINA_MAXIMO

    token = _token_minero(username="minerodiezfotos")
    headers = {"Authorization": f"Bearer {token}"}

    for i in range(FOTOS_MINA_MAXIMO):
        resp = client.post(
            "/mineros/documentos",
            data={"categoria": "fotos_mina"},
            files={"archivo": (f"f{i}.jpg", b"\xff\xd8\xfffoto", "image/jpeg")},
            headers=headers,
        )
        assert resp.status_code == 201

    # Una foto mas alla del maximo se rechaza
    resp = client.post(
        "/mineros/documentos",
        data={"categoria": "fotos_mina"},
        files={"archivo": ("f11.jpg", b"\xff\xd8\xfffoto", "image/jpeg")},
        headers=headers,
    )
    assert resp.status_code == 422
    assert "máximo" in resp.json()["detail"].lower()

    # Pero otros documentos (PDF) sí se pueden seguir subiendo
    resp = client.post(
        "/mineros/documentos",
        data={"categoria": "ruc"},
        files={"archivo": ("ruc.pdf", PDF_VALIDO_DE_PRUEBA, "application/pdf")},
        headers=headers,
    )
    assert resp.status_code == 201


def test_importar_empresas_desde_csv():
    token = _admin_token()
    headers = {"Authorization": f"Bearer {token}"}

    csv_contenido = (
        "tipo,nombre,ruc,colegiatura,anios_servicio,regiones,estudios,whatsapp,email,rating,num_resenas\n"
        "empresa,Geoconsult SAC,20123456789,,8,arequipa;puno,igafom_correctivo;topografia,+51911223344,geo@x.com,4.7,120\n"
        "consultor,Ing. Test Import,,CIP 99887,5,cusco,iperc,+51911223355,,4.2,15\n"
        # Duplicado del primero (mismo RUC): debe saltarse
        "empresa,Geoconsult SAC,20123456789,,8,arequipa,topografia,+51911223344,,4.7,120\n"
        # Fila mala (sin nombre): debe reportar error sin romper el resto
        "empresa,,,,3,lima,iperc,+51900000000,,,\n"
    )
    resp = client.post(
        "/admin/empresas/importar",
        headers=headers,
        files={"archivo": ("profesionales.csv", csv_contenido.encode(), "text/csv")},
    )
    assert resp.status_code == 200
    r = resp.json()
    assert r["creadas"] == 2
    assert r["saltadas"] == 1
    assert len(r["errores"]) == 1

    empresas = client.get("/admin/empresas", headers=headers).json()
    geo = [e for e in empresas if e["nombre"] == "Geoconsult SAC"][0]
    assert geo["rating"] == 4.7
    assert geo["num_resenas"] == 120


def test_rating_fuera_de_rango_rechazado():
    token = _admin_token()
    resp = client.post(
        "/admin/empresas",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "tipo": "empresa",
            "nombre": "Rating Malo SAC",
            "ruc": "20999999999",
            "anios_servicio": 3,
            "regiones_json": ["lima"],
            "estudios_json": ["iperc"],
            "whatsapp": "+51999888777",
            "rating": 7.5,
        },
    )
    assert resp.status_code == 422


RESPUESTAS_CONCESIONARIO = {
    "L1": True, "L2": True, "L3": True, "L4": True, "L6": True,
    "A1": True, "A2": True,
    "T1": True, "T3": True, "T6": True, "T7": True,
    "R1": True,
}


def test_diagnostico_concesionario_set_reducido():
    resp = client.post(
        "/diagnostico",
        json={
            "respuestas": RESPUESTAS_CONCESIONARIO,
            "region": "arequipa",
            "mineral": "oro",
            "tipo_mina": "subterranea",
            "situacion": "concesionario",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["score_total"] == 100
    assert set(body["dimensiones"].keys()) == {"legal", "ambiental", "tecnico", "social"}
    assert body["dimensiones"]["legal"]["maximo"] == 25  # L1,L2,L3,L4,L6 (sin L5)
    assert body["dimensiones"]["ambiental"]["maximo"] == 10  # A1,A2
    assert body["dimensiones"]["tecnico"]["maximo"] == 20  # T1,T3,T6,T7
    assert body["dimensiones"]["social"]["maximo"] == 5  # R1
    assert body["brechas"] == []

    # El set completo de artesanal (con L5, sin L6) debe rechazarse para concesionario
    resp = client.post(
        "/diagnostico",
        json={
            "respuestas": RESPUESTAS_COMPLETAS,
            "region": "arequipa",
            "mineral": "oro",
            "tipo_mina": "subterranea",
            "situacion": "concesionario",
        },
    )
    assert resp.status_code == 422


def test_diagnostico_l6_solo_aplica_a_concesionario():
    # L6 no existe para minero_artesanal: mandarlo (junto con el resto) rechaza
    respuestas = {**RESPUESTAS_COMPLETAS, "L6": True}
    resp = client.post(
        "/diagnostico",
        json={
            "respuestas": respuestas,
            "region": "arequipa",
            "mineral": "oro",
            "tipo_mina": "subterranea",
            "situacion": "minero_artesanal",
        },
    )
    assert resp.status_code == 422

    # Y falta L6 para concesionario también rechaza
    respuestas_sin_l6 = {k: v for k, v in RESPUESTAS_CONCESIONARIO.items() if k != "L6"}
    resp = client.post(
        "/diagnostico",
        json={
            "respuestas": respuestas_sin_l6,
            "region": "arequipa",
            "mineral": "oro",
            "tipo_mina": "subterranea",
            "situacion": "concesionario",
        },
    )
    assert resp.status_code == 422


def test_diagnostico_guarda_perfil_ruta1():
    resp = client.post(
        "/diagnostico",
        json={
            "respuestas": RESPUESTAS_COMPLETAS,
            "region": "arequipa",
            "mineral": "oro",
            "tipo_mina": "subterranea",
            "situacion": "minero_artesanal",
            "estado_operacion": "activa",
            "tipo_explotacion": "subterranea",
            "tiene_resultados_laboratorio": "completo",
            "tipo_apoyo": "financiamiento",
        },
    )
    assert resp.status_code == 200


def test_diagnostico_guarda_perfil_ruta2():
    resp = client.post(
        "/diagnostico",
        json={
            "respuestas": RESPUESTAS_CONCESIONARIO,
            "region": "puno",
            "mineral": "cobre",
            "tipo_mina": "subterranea",
            "situacion": "concesionario",
            "concesion_vigente": "si",
            "etapa_proyecto": "exploracion inicial",
            "trabajos_exploracion_json": ["muestreo", "calicatas"],
        },
    )
    assert resp.status_code == 200


def test_diagnostico_a4_es_condicional_segun_sustancias_toxicas():
    # Sin declarar sustancias tóxicas, A4 no debe pedirse ni aceptarse.
    resp = client.post(
        "/diagnostico",
        json={
            "respuestas": RESPUESTAS_COMPLETAS,
            "region": "arequipa",
            "mineral": "oro",
            "tipo_mina": "subterranea",
            "situacion": "minero_artesanal",
            "sustancias_toxicas": "no",
        },
    )
    assert resp.status_code == 200

    # Si declara mercurio/cianuro/relaves, A4 pasa a ser obligatorio.
    respuestas_con_a4 = {**RESPUESTAS_COMPLETAS, "A4": True}
    resp = client.post(
        "/diagnostico",
        json={
            "respuestas": respuestas_con_a4,
            "region": "arequipa",
            "mineral": "oro",
            "tipo_mina": "subterranea",
            "situacion": "minero_artesanal",
            "sustancias_toxicas": "mercurio",
            "gestion_sustancias": "confinamiento",
        },
    )
    assert resp.status_code == 200
    assert resp.json()["dimensiones"]["ambiental"]["maximo"] == 20  # A1-A4

    # El mismo payload SIN A4 debe rechazarse cuando sí declaró sustancias tóxicas.
    resp = client.post(
        "/diagnostico",
        json={
            "respuestas": RESPUESTAS_COMPLETAS,
            "region": "arequipa",
            "mineral": "oro",
            "tipo_mina": "subterranea",
            "situacion": "minero_artesanal",
            "sustancias_toxicas": "mercurio",
        },
    )
    assert resp.status_code == 422


def test_diagnostico_situacion_yacimiento_ya_no_existe():
    # Se descartó esta opción: el producto es solo para quien ya tiene
    # una operación o una concesión (quedan 2 situaciones, no 3)
    resp = client.post(
        "/diagnostico",
        json={
            "respuestas": {i: True for i in ["L2", "L4", "L5", "T1", "T2", "T3", "T4", "T5", "T6"]},
            "region": "puno",
            "mineral": "cobre",
            "tipo_mina": "tajo_abierto",
            "situacion": "yacimiento",
        },
    )
    assert resp.status_code == 422
