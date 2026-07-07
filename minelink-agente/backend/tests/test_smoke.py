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
    yield
    Base.metadata.drop_all(bind=engine)


client = TestClient(app)

RESPUESTAS_COMPLETAS = {
    "L1": True, "L2": True, "L3": True, "L4": True, "L5": True,
    "A1": True, "A2": True, "A3": True,
    "O1": True,
    "T1": True, "T2": True, "T3": True, "T4": True, "T5": True, "T6": True,
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


def _lead_payload(operacion_id, **overrides):
    payload = {
        "nombre": "Juan Quispe",
        "whatsapp": "+51987654321",
        "operacion_id": operacion_id,
        "username": "juanq",
        "password": "clave123",
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
    # catastro exige PDF, no imagen
    resp = client.post(
        "/mineros/documentos",
        headers={"Authorization": f"Bearer {token}"},
        data={"categoria": "catastro"},
        files={"archivo": ("catastro.jpg", b"\xff\xd8\xffcontenido", "image/jpeg")},
    )
    assert resp.status_code == 422


def test_mineros_elimina_su_documento():
    token = _token_minero(username="minerodocs4")
    headers = {"Authorization": f"Bearer {token}"}
    doc = client.post(
        "/mineros/documentos",
        headers=headers,
        data={"categoria": "informe_leyes"},
        files={"archivo": ("leyes.pdf", b"%PDF-contenido", "application/pdf")},
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
        files={"archivo": ("titulo.pdf", b"%PDF-contenido", "application/pdf")},
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
    assert resp.content == b"%PDF-contenido"


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


def test_proyectos_excluye_operaciones_bloqueadas():
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
    client.post("/leads", json=_lead_payload(diag["id"], username="bloqueado1"))

    resp = client.get("/proyectos")
    assert resp.json() == []


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
            diag2["id"], username="filtro2", whatsapp="+51900000022"
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
        files={"archivo": ("ruc.pdf", b"%PDF-con dni", "application/pdf")},
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

    # Se puede ver la foto sin login...
    resp = client.get(foto_url)
    assert resp.status_code == 200
    assert resp.content == b"\xff\xd8\xfffoto real"

    # ...pero el PDF con datos personales no tiene ningún endpoint público
    resp = client.get(f"/proyectos/{diag['id']}/fotos/999999")
    assert resp.status_code == 404


def test_proyectos_detalle_operacion_bloqueada_da_404():
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
    assert resp.status_code == 404


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


def test_proyectos_registra_interes_operacion_bloqueada_da_404():
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
    assert resp.status_code == 404


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
    assert body["colegiatura"] == "CIP 123456"
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

    # Un PDF real (empieza con %PDF) sí pasa
    resp = client.post(
        "/mineros/documentos",
        data={"categoria": "ruc"},
        files={"archivo": ("real.pdf", b"%PDF-1.4 contenido", "application/pdf")},
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
    assert "USD 30,000" in generada
    assert "planta de beneficio" in generada
    assert "REINFO" in generada


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
        files={"archivo": ("ruc.pdf", b"%PDF-ruc", "application/pdf")},
        headers=headers,
    )
    assert resp.status_code == 201
