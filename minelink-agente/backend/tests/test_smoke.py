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
# Y nunca resuelven enlaces de Maps ni consultan GEOCATMIN contra
# internet real
os.environ["MINELINK_RESOLVER_MAPS"] = "0"
os.environ["MINELINK_GEOCATMIN"] = "0"
os.environ["MINELINK_REINFO"] = "0"
# El asesor SIEMPRE corre en modo simulado en los tests — sin esto, si
# backend/.env tiene claves reales configuradas (para probar en local),
# los tests terminan llamando a la API real de pago (julio 2026, hallado
# al agregar la cadena de respaldo: un test empezó a recibir una
# respuesta real de Gemini en vez del texto de "modo simulado").
os.environ["MINELINK_ASESOR_PROVEEDORES"] = ""
os.environ["MINELINK_ASESOR_PROVEEDOR"] = ""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import database
import models
from database import Base, get_db
from main import app
import security
from security import limitar_creaciones_publicas, limitar_intentos_login

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
# Código que abre su propia sesión FUERA de un endpoint (background tasks
# de proyectos.py: el refresco de GEOCATMIN/REINFO corre después de que
# la sesión de la petición ya se cerró, así que no puede reusarla) no pasa
# por `Depends(get_db)` y por lo tanto no ve `dependency_overrides` — solo
# sustituir `database.SessionLocal` en sí hace que también use la BD en
# memoria de los tests en vez de la real (backend/.env apunta a producción).
database.SessionLocal = TestingSessionLocal
# El límite de intentos por IP se desactiva en tests (todos comparten la IP
# "testclient" y lo dispararían); su lógica se prueba aparte más abajo.
app.dependency_overrides[limitar_intentos_login] = lambda: None
# Ídem para el límite de creaciones públicas (intereses/postulaciones):
# la suite crea decenas desde la misma IP de prueba.
app.dependency_overrides[limitar_creaciones_publicas] = lambda: None


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

# Fixture principal: Perfil C (REINFO vigente, opera en concesión propia,
# todos los documentos de formalización aprobados). Semáforo legal verde,
# sin brechas, apto para inversionistas. Es titular de su propia concesión
# → C2_7 (declaración de producción semestral) NO aplica, exceptuado por
# ley (Art. 7c, D.S. N°001-2020-EM) — no se incluye en ids_esperados.
RESPUESTAS_COMPLETAS = {
    "M0_1": "concesion_propia", "M0_3": "reinfo", "M0_4": "vigente",
    "C1_1": "vigente", "C1_2": "si", "C1_3": "titular",
    "C2_1": "aprobado", "C2_2": "aprobado", "C2_3": "aprobado",
    "C2_4": "aprobado", "C2_5": "aprobado", "C2_6": "aprobado",
    "C4_1": "50_100t", "C4_2": "siempre",
}

# Perfil B: concesionaria sin operar (tiene concesión pero no extrae
# mineral). Semáforo legal verde si no hay bloqueantes, apta para
# inversionistas. B4_1="buscar_inversionista" para evitar requisitos B5.
# B3_1/B3_2 y el Módulo INV están en pausa (julio 2026) — fuera del fixture.
# B1_2=2020 + pma (10 años) todavía no vence el reloj → B1_3 no aplica.
RESPUESTAS_SIN_TRAMITE = {
    "M0_1": "concesion_no_operando",
    "B1_1": "al_dia", "B1_2": "2020", "B1_4": "mio",
    "B2_1": "pma", "B2_2": "500",
    "B4_1": "buscar_inversionista",
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
    assert body["perfil"] == "C"
    assert body["semaforo_legal"] == "verde"
    assert body["brechas"] == []
    assert body["apto_inversionistas"] is True


def test_post_diagnostico_c2_presentado_no_es_brecha_pero_avisa_en_proceso():
    # Regresión (julio 2026): marcar un requisito C2 como "Presentado (en
    # evaluación)" no debe contar como brecha accionable (ya se tramitó,
    # no hace falta buscar empresa) NI decir "no te falta ningún estudio"
    # (sigue pendiente de que la entidad lo apruebe — por eso el semáforo
    # queda en amarillo). Debe aparecer en brechas_en_proceso.
    respuestas = dict(RESPUESTAS_COMPLETAS)
    respuestas["C2_1"] = "presentado"
    resp = client.post(
        "/diagnostico",
        json={
            "respuestas": respuestas,
            "region": "puno",
            "mineral": "oro",
            "tipo_mina": "subterranea",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["semaforo_legal"] == "amarillo"
    assert body["brechas"] == []
    assert body["brechas_en_proceso"] == ["igafom_aprobado"]


def test_cuenta_lista_c2_presentado_y_subir_respaldo_lo_resuelve():
    # Regresión (julio 2026): un C2 "presentado" debe verse en /mineros/me
    # como brechas_en_proceso (no en brechas_pendientes) y, al subir el
    # respaldo, auto-resolverse igual que una brecha normal — pasando a
    # brechas_resueltas y desapareciendo de brechas_en_proceso.
    respuestas = dict(RESPUESTAS_COMPLETAS)
    respuestas["C2_1"] = "presentado"
    diag = client.post(
        "/diagnostico",
        json={
            "respuestas": respuestas,
            "region": "puno",
            "mineral": "oro",
            "tipo_mina": "subterranea",
        },
    ).json()
    client.post(
        "/leads",
        json=_lead_payload(diag["id"], username="c2presentado", password="clave123"),
    )
    token = client.post(
        "/mineros/login", json={"username": "c2presentado", "password": "clave123"}
    ).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    perfil = client.get("/mineros/me", headers=headers).json()
    assert perfil["brechas_en_proceso"] == ["igafom_aprobado"]
    assert "igafom_aprobado" not in perfil["brechas_pendientes"]
    assert perfil["semaforo_legal"] == "amarillo"

    resp = client.post(
        "/mineros/documentos",
        headers=headers,
        data={"categoria": "igafom_aprobado"},
        files={"archivo": ("igafom.jpg", b"\xff\xd8\xffcontenido", "image/jpeg")},
    )
    assert resp.status_code == 201, resp.json()

    perfil = client.get("/mineros/me", headers=headers).json()
    assert perfil["brechas_en_proceso"] == []
    assert "igafom_aprobado" in perfil["brechas_resueltas"]
    assert perfil["semaforo_legal"] == "verde"


def test_slot_de_c2_presentado_pasa_a_marcaste_aprobado_al_subir():
    # Regresión (julio 2026): "Respalda tu declaración" mostraba
    # "Marcaste: Presentado (en evaluación)" en el slot de expediente
    # técnico — y seguía diciendo lo mismo PARA SIEMPRE incluso después de
    # subir el archivo y auto-resolverse, porque el slot leía la
    # declaración cruda en vez de la respuesta parchada. Debe pasar a
    # "Marcaste: Aprobado".
    respuestas = dict(RESPUESTAS_COMPLETAS)
    respuestas["C2_5"] = "presentado"
    diag = client.post(
        "/diagnostico",
        json={
            "respuestas": respuestas,
            "region": "puno",
            "mineral": "oro",
            "tipo_mina": "subterranea",
        },
    ).json()
    client.post(
        "/leads",
        json=_lead_payload(diag["id"], username="expedientetecnico", password="clave123"),
    )
    token = client.post(
        "/mineros/login", json={"username": "expedientetecnico", "password": "clave123"}
    ).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    perfil = client.get("/mineros/me", headers=headers).json()
    slot = next(e for e in perfil["estudios_aplicables"] if e["codigo"] == "expediente_tecnico")
    assert slot["valor"] == "presentado"  # aún sin subir nada

    client.post(
        "/mineros/documentos",
        headers=headers,
        data={"categoria": "expediente_tecnico"},
        files={"archivo": ("expediente.jpg", b"\xff\xd8\xffcontenido", "image/jpeg")},
    )

    perfil = client.get("/mineros/me", headers=headers).json()
    slot = next(e for e in perfil["estudios_aplicables"] if e["codigo"] == "expediente_tecnico")
    assert slot["valor"] == "aprobado"
    assert "expediente_tecnico" in perfil["brechas_resueltas"]


def test_gps_y_ruc_tienen_slot_propio_en_vez_de_ocultarse_por_equivalencia():
    # Regresión (julio 2026, pedido explícito de Esthiven): "Medir tu labor
    # con GPS (sinceramiento)" y "Activar tu RUC minero" quedaban ocultos
    # de "Respalda tu declaración" porque se consideraban "la misma foto"
    # que Catastro/RUC de Documentos legales — invisibles para el minero
    # aunque nunca hubiera subido ninguno de los dos. Ahora tienen su
    # propio slot, sin importar los documentos legales.
    token = _token_minero(username="gpsyrucpropios")
    headers = {"Authorization": f"Bearer {token}"}

    perfil = client.get("/mineros/me", headers=headers).json()
    codigos = {e["codigo"] for e in perfil["estudios_aplicables"]}
    assert "levantamiento_georreferenciado" in codigos
    assert "tramite_sunat" in codigos


def test_analisis_laboratorio_ya_no_equivale_a_informe_leyes():
    # Julio 2026: analisis_laboratorio (de B3_2, hoy en pausa) equivalía a
    # informe_leyes de "Documentos legales" — sección OCULTA en ambas
    # ventanas del minero, mismo callejón sin salida que contrato_explotacion.
    # Sin efecto visible HOY (B3_1/B3_2 están en pausa, no se preguntan),
    # pero deja listo el terreno para cuando se reactiven.
    from uploads_config import categoria_equivalente

    assert categoria_equivalente("analisis_laboratorio", "minero_artesanal") is None
    assert categoria_equivalente("analisis_laboratorio", "concesionario") is None


def test_contrato_con_el_titular_tiene_slot_propio():
    # Regresión (julio 2026): "Contrato con el dueño de la concesión"
    # (contrato_explotacion) equivalía a sí mismo en "Documentos legales"
    # — pero esa sección está OCULTA en ambas ventanas del minero
    # (ocultarDocumentosLegales), así que era un callejón sin salida: no
    # existía en NINGÚN lugar de la cuenta donde subirlo, aunque sí se
    # mostraba pendiente en la ficha pública. Perfil C que opera por
    # contrato (C1_3="contrato") debe verlo en "Respalda tu declaración".
    respuestas = dict(RESPUESTAS_COMPLETAS)
    respuestas["C1_3"] = "contrato"
    respuestas.pop("C2_3", None)  # no aplica a quien opera por contrato
    respuestas["C2_7"] = "aprobado"  # SÍ aplica a quien opera por contrato (solo excluida para titular)
    respuestas["C3_1"] = "firmado_inscrito"
    diag = client.post(
        "/diagnostico",
        json={
            "respuestas": respuestas,
            "region": "cusco",
            "mineral": "oro",
            "tipo_mina": "subterranea",
        },
    ).json()
    client.post(
        "/leads", json=_lead_payload(diag["id"], username="contratopropio", password="clave123")
    )
    token = client.post(
        "/mineros/login", json={"username": "contratopropio", "password": "clave123"}
    ).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    perfil = client.get("/mineros/me", headers=headers).json()
    slot = next(
        (e for e in perfil["estudios_aplicables"] if e["codigo"] == "contrato_explotacion"),
        None,
    )
    assert slot is not None
    assert slot["valor"] == "firmado_inscrito"


def test_ruc_minero_se_respalda_con_codigo_escrito_no_con_archivo():
    # "Activar tu RUC minero" no pide foto: el respaldo es el número de
    # RUC escrito. Escribirlo resuelve la brecha igual que subir un
    # archivo resuelve las demás, y el check público se activa sin que
    # exista ningún documento subido.
    respuestas = dict(RESPUESTAS_COMPLETAS)
    respuestas["C2_6"] = "no_iniciado"  # brecha real de tramite_sunat
    diag = client.post(
        "/diagnostico",
        json={
            "respuestas": respuestas,
            "region": "cusco",
            "mineral": "oro",
            "tipo_mina": "subterranea",
        },
    ).json()
    client.post(
        "/leads", json=_lead_payload(diag["id"], username="rucescrito", password="clave123")
    )
    token = client.post(
        "/mineros/login", json={"username": "rucescrito", "password": "clave123"}
    ).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    perfil = client.get("/mineros/me", headers=headers).json()
    assert "tramite_sunat" in perfil["brechas_pendientes"]

    resp = client.put(
        "/mineros/perfil-inversion",
        json={"datos_formalizacion": {"tramite_sunat": "10123456789"}},
        headers=headers,
    )
    assert resp.status_code == 200

    perfil = client.get("/mineros/me", headers=headers).json()
    assert "tramite_sunat" not in perfil["brechas_pendientes"]
    assert "tramite_sunat" in perfil["brechas_resueltas"]
    # Ningún archivo se subió para tramite_sunat — el respaldo fue el
    # código escrito, no una foto.
    assert not any(d["categoria"] == "tramite_sunat" for d in client.get("/mineros/documentos", headers=headers).json())


def test_post_diagnostico_tajo_abierto():
    respuestas = {k: v for k, v in RESPUESTAS_COMPLETAS.items()}
    respuestas["M0_1"] = "nada"  # Perfil A
    respuestas.update({
        "A1_1": "si", "A1_2": "si", "A1_3": "si",
        "A2_1": "ninguna", "A2_2": "no",
        "A3_1": "mio", "A4_1": "completo", "A5_1": "maquinaria", "A5_2": "oro",
    })
    # Quitar ids de perfil C que no aplican a perfil A
    for k in list(respuestas.keys()):
        if k.startswith("C") or k.startswith("INV") or k == "M0_3" or k == "M0_4":
            del respuestas[k]
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
    assert body["perfil"] == "A"
    assert body["semaforo_legal"] == "verde"


def test_post_diagnostico_ids_faltantes_falla():
    respuestas = dict(RESPUESTAS_COMPLETAS)
    del respuestas["C2_1"]
    resp = client.post(
        "/diagnostico",
        json={
            "respuestas": respuestas,
            "region": "arequipa",
            "mineral": "oro",
            "tipo_mina": "subterranea",
        },
    )
    assert resp.status_code == 422


def test_post_diagnostico_ids_extra_falla():
    respuestas = dict(RESPUESTAS_COMPLETAS)
    respuestas["X99"] = "si"
    resp = client.post(
        "/diagnostico",
        json={
            "respuestas": respuestas,
            "region": "arequipa",
            "mineral": "oro",
            "tipo_mina": "subterranea",
        },
    )
    assert resp.status_code == 422


def test_post_diagnostico_ids_de_otro_perfil_falla():
    respuestas = dict(RESPUESTAS_SIN_TRAMITE)
    resp = client.post(
        "/diagnostico",
        json={
            "respuestas": respuestas,
            "region": "arequipa",
            "mineral": "oro",
            "tipo_mina": "subterranea",
        },
    )
    assert resp.status_code == 200  # Perfil B es válido


def test_post_diagnostico_concesionario_es_perfil_b():
    resp = client.post(
        "/diagnostico",
        json={
            "respuestas": dict(RESPUESTAS_SIN_TRAMITE),
            "region": "arequipa",
            "mineral": "oro",
            "tipo_mina": "subterranea",
            "situacion": "concesionario",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["perfil"] == "B"


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


def test_mineros_puede_completar_codigo_reinfo_desde_su_cuenta():
    # Julio 2026: si no dejó el código REINFO al registrarse, lo puede
    # completar después desde su cuenta (activa el cotejo con el MINEM).
    diag = _crear_diagnostico().json()
    client.post("/leads", json=_lead_payload(diag["id"], username="sincodigo"))
    token = client.post(
        "/mineros/login", json={"username": "sincodigo", "password": "clave123"}
    ).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    assert client.get("/mineros/me", headers=headers).json()["codigo_reinfo"] is None

    resp = client.put(
        "/mineros/perfil-inversion",
        json={"codigo_reinfo": "REI-999"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["codigo_reinfo"] == "REI-999"

    # Un código REINFO ya usado por otro minero se rechaza igual que en el registro.
    diag2 = _crear_diagnostico().json()
    client.post(
        "/leads",
        json=_lead_payload(diag2["id"], username="otrominero", whatsapp="+51911223344"),
    )
    token2 = client.post(
        "/mineros/login", json={"username": "otrominero", "password": "clave123"}
    ).json()["access_token"]
    resp = client.put(
        "/mineros/perfil-inversion",
        json={"codigo_reinfo": "REI-999"},
        headers={"Authorization": f"Bearer {token2}"},
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
    assert body["score_total"] == 0  # legacy placeholder for new system
    assert body["brechas"] == diag["brechas"]
    assert body["descripcion_operacion"] is None
    assert body["capacidad_produccion"] is None
    assert body["capital_buscado"] is None
    assert body["uso_fondos"] is None
    # Track Legal/Técnico del nuevo modelo — recalculados en cada lectura
    # (mismo mecanismo de estado_seguimiento que usa /proyectos).
    assert body["perfil"] == diag["perfil"]
    assert body["semaforo_legal"] == diag["semaforo_legal"]
    # apto_inversionistas en el diagnóstico crudo es "elegible en teoría"
    # (perfil+semáforo, sin BD); en /mineros/me exige ADEMÁS haber ENVIADO
    # documentos de formalización + Módulo INV — recién creada la cuenta,
    # todavía no envió nada, así que acá es False aunque el diagnóstico
    # crudo haya dado True.
    assert body["apto_inversionistas"] is False
    assert body["semaforo_tecnico"] is None  # Módulo INV en pausa
    assert body["indice_madurez"] is None


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

    # PUT es una actualización PARCIAL: los campos no enviados se
    # conservan tal cual — varios recuadros de la cuenta guardan cada uno
    # su propio campo por separado (ubicación, capital, ley del mineral)
    # y no deben pisarse entre sí.
    resp = client.put(
        "/mineros/perfil-inversion",
        headers=headers,
        json={"descripcion_operacion": "Actualizado"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["descripcion_operacion"] == "Actualizado"
    assert body["capacidad_produccion"] == "50 toneladas/mes, reservas estimadas en 5 años"
    assert body["capital_buscado"] == "USD 80,000"

    # Explícitamente vaciar un campo (string vacío) sí lo borra — solo
    # omitirlo del body es lo que lo preserva.
    resp = client.put(
        "/mineros/perfil-inversion",
        headers=headers,
        json={"capital_buscado": None},
    )
    assert resp.status_code == 200
    assert resp.json()["capital_buscado"] is None

    # El admin también ve el perfil de inversión en /admin/leads
    admin_token = _admin_token()
    leads = client.get(
        "/admin/leads", headers={"Authorization": f"Bearer {admin_token}"}
    ).json()
    lead = next(l for l in leads if l["nombre"] == "Juan Quispe")
    assert lead["descripcion_operacion"] == "Actualizado"


def test_mineros_guarda_ley_promedio_sin_pisar_el_resto():
    # ley_promedio vive en Operacion (no en Lead) — se guarda junto al slot
    # "Certificado de ley del mineral" en Respalda tu inversión, sin
    # afectar los demás campos del perfil de inversión.
    token = _token_minero(username="mineroley")
    headers = {"Authorization": f"Bearer {token}"}

    client.put(
        "/mineros/perfil-inversion",
        headers=headers,
        json={"capital_buscado": "USD 20,000"},
    )
    resp = client.put(
        "/mineros/perfil-inversion",
        headers=headers,
        json={"ley_promedio": "2.5 g/t Au"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ley_promedio"] == "2.5 g/t Au"
    assert body["capital_buscado"] == "USD 20,000"


def test_scores_por_track_suben_con_el_avance():
    # Score de Formalización 0-100: sube al resolver una brecha (subiendo
    # su respaldo). Score de Inversión: None hasta que aplique el módulo,
    # y sube al enviar el perfil INV.
    respuestas_b = dict(RESPUESTAS_SIN_TRAMITE)
    respuestas_b["B1_1"] = "debo_1"
    respuestas_b["B1_4"] = "privado"
    respuestas_b["B1_5"] = "no"
    diag = client.post(
        "/diagnostico",
        json={
            "respuestas": respuestas_b,
            "region": "arequipa",
            "mineral": "oro",
            "tipo_mina": "subterranea",
        },
    ).json()
    client.post(
        "/leads", json=_lead_payload(diag["id"], username="minerscore", password="clave123")
    )
    token = client.post(
        "/mineros/login", json={"username": "minerscore", "password": "clave123"}
    ).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    me = client.get("/mineros/me", headers=headers).json()
    score_inicial = me["score_formalizacion"]
    # La etapa manda: un perfil B (concesionario sin operar) vive en el
    # rango 30-55 — ni con su etapa impecable alcanza a un formal pleno
    # (80-100). Ver RANGO_SCORE_POR_PERFIL.
    assert isinstance(score_inicial, int) and 30 <= score_inicial <= 55
    assert me["brechas_pendientes"], "el fixture debe tener brechas"

    # Resolver una brecha con respaldo debe SUBIR el score de formalización
    client.post(
        "/mineros/documentos",
        headers=headers,
        data={"categoria": me["brechas_pendientes"][0]},
        files={"archivo": ("r.jpg", b"\xff\xd8\xffcontenido", "image/jpeg")},
    )
    me = client.get("/mineros/me", headers=headers).json()
    assert me["score_formalizacion"] > score_inicial

    # Inversión: perfil B ofrece el módulo → score numérico; enviar sube
    score_inv_inicial = me["score_inversion"]
    assert isinstance(score_inv_inicial, int)
    resp = client.post(
        "/mineros/inversion", json={"respuestas": RESPUESTAS_INV_B}, headers=headers
    )
    assert resp.status_code == 200
    me = client.get("/mineros/me", headers=headers).json()
    assert me["score_inversion"] > score_inv_inicial
    assert 0 <= me["score_inversion"] <= 100


def test_mineros_guarda_fechas_de_formalizacion_por_clave():
    # datos_formalizacion se FUSIONA por clave: cada slot guarda su fecha
    # sin pisar las demás; un valor vacío borra solo esa clave.
    token = _token_minero(username="minerofechas")
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.put(
        "/mineros/perfil-inversion",
        headers=headers,
        json={"datos_formalizacion": {"autorizacion_drem": "2024-03-15"}},
    )
    assert resp.status_code == 200
    resp = client.put(
        "/mineros/perfil-inversion",
        headers=headers,
        json={"datos_formalizacion": {"vigencia_concesion": "2026-01-10"}},
    )
    assert resp.json()["datos_formalizacion"] == {
        "autorizacion_drem": "2024-03-15",
        "vigencia_concesion": "2026-01-10",
    }

    # Vaciar una clave la borra sin tocar la otra
    resp = client.put(
        "/mineros/perfil-inversion",
        headers=headers,
        json={"datos_formalizacion": {"autorizacion_drem": ""}},
    )
    assert resp.json()["datos_formalizacion"] == {"vigencia_concesion": "2026-01-10"}


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
    # Perfil C con todos los docs aprobados: no hay brechas, pero los
    # estudios del catálogo que aplican a su perfil siguen disponibles
    # para subir respaldo.
    assert isinstance(aplicables, list)
    codigos = {a["codigo"] for a in aplicables}
    # Cada item trae la pregunta y el valor crudo que el minero declaró.
    assert all({"codigo", "pregunta_id", "valor"} <= set(a) for a in aplicables)
    # puesta_en_produccion/analisis_laboratorio siguen equivaliendo a
    # documentos legales fijos (fotos_mina/informe_leyes, sí visibles en
    # la cuenta) — pero contrato_explotacion ya NO se oculta (julio 2026):
    # "Documentos legales" está oculto en ambas ventanas del minero, así
    # que ocultarlo por "equivalencia consigo mismo" lo dejaba sin ningún
    # lugar donde subirse.
    assert "contrato_explotacion" in codigos


def test_mineros_perfil_b_expone_slots_pma_ppm_y_vigencia():
    # Perfil B declarando "al día" + "pma": ambos deben tener slot propio
    # para subir respaldo — antes vigencia_concesion se fusionaba con el
    # título y no existía ningún slot para acreditar PMA/PPM.
    diag = client.post(
        "/diagnostico",
        json={
            "respuestas": RESPUESTAS_SIN_TRAMITE,
            "region": "arequipa",
            "mineral": "oro",
            "tipo_mina": "subterranea",
        },
    ).json()
    client.post(
        "/leads",
        json=_lead_payload(diag["id"], username="minerobpmappm", nombre_operacion="Concesion PMA"),
    )
    token = client.post(
        "/mineros/login", json={"username": "minerobpmappm", "password": "clave123"}
    ).json()["access_token"]
    resp = client.get("/mineros/me", headers={"Authorization": f"Bearer {token}"})
    aplicables = resp.json()["estudios_aplicables"]
    por_codigo = {a["codigo"]: a for a in aplicables}
    assert "declaracion_bienal_pma_ppm" in por_codigo
    assert por_codigo["declaracion_bienal_pma_ppm"] == {
        "codigo": "declaracion_bienal_pma_ppm", "pregunta_id": "B2_1", "valor": "pma",
    }
    assert "vigencia_concesion" in por_codigo
    assert por_codigo["vigencia_concesion"]["valor"] == "al_dia"


def _minero_con_estudios(username: str) -> tuple[str, dict, list[str]]:
    """Crea un minero (diagnóstico + lead + login) y devuelve
    (operacion_id, headers, codigos de estudios_aplicables) — atajo para
    los tests de revisión de documentos, que necesitan un minero con al
    menos un estudio declarado para poder enviar/aprobar/dar visto bueno."""
    diag = _crear_diagnostico().json()
    client.post("/leads", json=_lead_payload(diag["id"], username=username, password="clave123"))
    token = client.post(
        "/mineros/login", json={"username": username, "password": "clave123"}
    ).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    perfil = client.get("/mineros/me", headers=headers).json()
    codigos = [e["codigo"] for e in perfil["estudios_aplicables"]]
    return diag["id"], headers, codigos


def test_subir_respaldo_de_brecha_la_resuelve_solo():
    # Auto-resolución con evidencia (julio 2026): el minero sube el
    # respaldo de una brecha pendiente desde "Lo que te falta" y esta pasa
    # a resuelta sin intervención del admin.
    respuestas_b = dict(RESPUESTAS_SIN_TRAMITE)
    respuestas_b["B1_1"] = "debo_1"
    respuestas_b["B1_4"] = "privado"
    respuestas_b["B1_5"] = "no"
    diag = client.post(
        "/diagnostico",
        json={
            "respuestas": respuestas_b,
            "region": "arequipa",
            "mineral": "oro",
            "tipo_mina": "subterranea",
        },
    ).json()
    client.post(
        "/leads", json=_lead_payload(diag["id"], username="autoresuelve", password="clave123")
    )
    token = client.post(
        "/mineros/login", json={"username": "autoresuelve", "password": "clave123"}
    ).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    perfil = client.get("/mineros/me", headers=headers).json()
    assert perfil["brechas_pendientes"], "el fixture debe tener al menos una brecha"
    brecha = perfil["brechas_pendientes"][0]

    resp = client.post(
        "/mineros/documentos",
        headers=headers,
        data={"categoria": brecha},
        files={"archivo": ("respaldo.jpg", b"\xff\xd8\xffcontenido", "image/jpeg")},
    )
    assert resp.status_code == 201

    perfil = client.get("/mineros/me", headers=headers).json()
    assert brecha not in perfil["brechas_pendientes"]
    assert brecha in perfil["brechas_resueltas"]


def test_mineros_enviar_documentos_exige_todos_los_slots():
    _operacion_id, headers, codigos = _minero_con_estudios("enviodocs1")
    assert codigos, "el fixture del diagnóstico debe declarar al menos un estudio"

    resp = client.post("/mineros/documentos/enviar", headers=headers)
    assert resp.status_code == 422
    assert codigos[0] in resp.json()["detail"]


def test_mineros_enviar_documentos_completo():
    _operacion_id, headers, codigos = _minero_con_estudios("enviodocs2")
    for codigo in codigos:
        resp = client.post(
            "/mineros/documentos",
            headers=headers,
            data={"categoria": codigo},
            files={"archivo": (f"{codigo}.jpg", b"\xff\xd8\xffcontenido", "image/jpeg")},
        )
        assert resp.status_code == 201

    resp = client.post("/mineros/documentos/enviar", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["documentos_enviados"] is True


def test_admin_revisa_documento_aprobado_y_rechazado():
    _operacion_id, headers, codigos = _minero_con_estudios("revisadocs1")
    doc = client.post(
        "/mineros/documentos",
        headers=headers,
        data={"categoria": codigos[0]},
        files={"archivo": ("a.jpg", b"\xff\xd8\xffcontenido", "image/jpeg")},
    ).json()
    admin_headers = {"Authorization": f"Bearer {_admin_token()}"}

    resp = client.put(
        f"/admin/documentos/{doc['id']}/revision",
        json={"estado_revision": "rechazado", "motivo_rechazo": "Foto borrosa"},
        headers=admin_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["estado_revision"] == "rechazado"
    assert resp.json()["motivo_rechazo"] == "Foto borrosa"

    # Rechazar sin motivo → 422 (el schema lo exige)
    resp = client.put(
        f"/admin/documentos/{doc['id']}/revision",
        json={"estado_revision": "rechazado", "motivo_rechazo": ""},
        headers=admin_headers,
    )
    assert resp.status_code == 422

    resp = client.put(
        f"/admin/documentos/{doc['id']}/revision",
        json={"estado_revision": "aprobado"},
        headers=admin_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["estado_revision"] == "aprobado"
    assert resp.json()["motivo_rechazo"] is None


def test_documentos_enviados_no_exige_aprobacion_del_admin():
    # Julio 2026: se quitó el visto bueno manual del admin — los
    # inversionistas verifican los datos por sí mismos. "Guardar archivos"
    # solo exige que TODO esté subido (cualquier estado de revisión), no
    # que ya esté aprobado.
    operacion_id, headers, codigos = _minero_con_estudios("vistobueno1")
    assert len(codigos) >= 1
    admin_headers = {"Authorization": f"Bearer {_admin_token()}"}

    for codigo in codigos:
        client.post(
            "/mineros/documentos",
            headers=headers,
            data={"categoria": codigo},
            files={"archivo": (f"{codigo}.jpg", b"\xff\xd8\xffcontenido", "image/jpeg")},
        )

    # Nada aprobado todavía, ni falta que hace — igual se puede enviar.
    resp = client.post("/mineros/documentos/enviar", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["documentos_enviados"] is True

    # Esthiven puede seguir rechazando un documento puntual (informativo),
    # pero eso no revierte el envío.
    doc = client.get("/mineros/documentos", headers=headers).json()[0]
    client.put(
        f"/admin/documentos/{doc['id']}/revision",
        json={"estado_revision": "rechazado", "motivo_rechazo": "Prueba"},
        headers=admin_headers,
    )
    resp = client.get("/mineros/me", headers=headers)
    assert resp.json()["documentos_enviados"] is True


def _minero_con_visto_bueno(username: str, respuestas=None) -> tuple[str, dict, dict]:
    """Crea un minero y sube+aprueba un documento por cada estudio
    aplicable — atajo para los tests del Módulo INV. Ya NO hay un visto
    bueno manual que esperar (julio 2026: la publicación es automática al
    enviar, los inversionistas verifican los datos por sí mismos); el
    nombre se conserva por costumbre pero ya no bloquea nada. Devuelve
    (operacion_id, headers, admin_headers)."""
    respuestas = respuestas or RESPUESTAS_COMPLETAS
    diag = client.post(
        "/diagnostico",
        json={
            "respuestas": respuestas,
            "region": "arequipa",
            "mineral": "oro",
            "tipo_mina": "subterranea",
        },
    ).json()
    client.post("/leads", json=_lead_payload(diag["id"], username=username, password="clave123"))
    token = client.post(
        "/mineros/login", json={"username": username, "password": "clave123"}
    ).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    admin_headers = {"Authorization": f"Bearer {_admin_token()}"}

    perfil = client.get("/mineros/me", headers=headers).json()
    for e in perfil["estudios_aplicables"]:
        doc = client.post(
            "/mineros/documentos",
            headers=headers,
            data={"categoria": e["codigo"]},
            files={"archivo": (f"{e['codigo']}.jpg", b"\xff\xd8\xffcontenido", "image/jpeg")},
        ).json()
        client.put(
            f"/admin/documentos/{doc['id']}/revision",
            json={"estado_revision": "aprobado"},
            headers=admin_headers,
        )
    return diag["id"], headers, admin_headers


RESPUESTAS_INV_C = {
    "INV_0_1": "100k_500k",
    "INV_0_2": ["tramites", "equipo"],
    "INV_0_3": "participacion",
    "INV_0_4": ["operacion", "conocimiento"],
    "INV_0_5": "1_2a",
    "INV_0_6": "nunca",
    "INV_0_9": "persona_natural",
    "INV_0_10": "20_40",
    "INV_0_11": "sin_deudas",
    "INV_0_12": ["dinero", "maquinaria_equipos"],
    "INV_C0": "tengo",
    "INV_C1": "planta_formal",
    "INV_C2": "completas",
    "INV_C3": "lab_certificado",
    "INV_C4": "detallado",
    "INV_C5": "50_100",
}

RESPUESTAS_INV_B = {
    "INV_0_1": "25k_100k",
    "INV_0_2": ["equipo"],
    "INV_0_3": "regalia",
    "INV_0_4": ["concesion"],
    "INV_0_5": "2_5a",
    "INV_0_6": "nunca",
    "INV_0_9": "persona_natural",
    "INV_0_10": "20_40",
    "INV_0_11": "sin_deudas",
    "INV_0_12": ["dinero", "maquinaria_equipos"],
    "INV_B1a": "no_tengo",
    "INV_B1b": "no_tengo",
    "INV_B1c": "no_tengo",
    "INV_B2": "nunca",
    "INV_B3": "capital",
    "INV_B4": "si_titularidad",
}


def _hacer_apto_inversionistas(operacion_id, username, password="clave123", respuestas_inv=None):
    """Empuja una operación (con lead ya creado) por TODO el pipeline hasta
    apto_inversionistas=True: envía los documentos de formalización y el
    Módulo INV con sus documentos de sustento. Atajo para los tests de
    /proyectos. Ya NO hay aprobación manual del admin — desde julio 2026
    la publicación es automática al enviar ambas partes (ver
    scoring.estado_seguimiento); los inversionistas verifican los datos
    por sí mismos, no Esthiven."""
    token = client.post(
        "/mineros/login", json={"username": username, "password": password}
    ).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    perfil = client.get("/mineros/me", headers=headers).json()
    for e in perfil["estudios_aplicables"]:
        client.post(
            "/mineros/documentos",
            headers=headers,
            data={"categoria": e["codigo"]},
            files={"archivo": (f"{e['codigo']}.jpg", b"\xff\xd8\xffcontenido", "image/jpeg")},
        )
    resp = client.post("/mineros/documentos/enviar", headers=headers)
    assert resp.status_code == 200, resp.json()

    respuestas_inv = respuestas_inv or RESPUESTAS_INV_C
    resp = client.post(
        "/mineros/inversion", json={"respuestas": respuestas_inv}, headers=headers
    )
    assert resp.status_code == 200, resp.json()

    for c in resp.json()["categorias_requeridas"]:
        client.post(
            "/mineros/documentos",
            headers=headers,
            data={"categoria": c["categoria"]},
            files={"archivo": (f"{c['categoria']}.jpg", b"\xff\xd8\xffcontenido", "image/jpeg")},
        )


def test_inversion_no_exige_documentos_enviados_para_enviarse():
    # El minero puede responder el Módulo INV en la misma sesión en que
    # sube sus documentos de formalización, sin esperar a haberlos
    # enviado — solo la publicación pública exige AMBOS envíos completos
    # (ver test_proyectos_exige_ambos_envios).
    diag = _crear_diagnostico().json()
    client.post("/leads", json=_lead_payload(diag["id"], username="invsindocs", password="clave123"))
    token = client.post(
        "/mineros/login", json={"username": "invsindocs", "password": "clave123"}
    ).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.get("/mineros/inversion", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["ofrece"] is True  # perfil C siempre se ofrece
    assert resp.json()["enviado"] is False

    resp = client.post(
        "/mineros/inversion", json={"respuestas": RESPUESTAS_INV_C}, headers=headers
    )
    assert resp.status_code == 200
    assert resp.json()["enviado"] is True


def test_proyectos_exige_ambos_envios():
    diag = _crear_diagnostico().json()
    client.post("/leads", json=_lead_payload(diag["id"], username="ambosenviados", password="clave123"))
    token = client.post(
        "/mineros/login", json={"username": "ambosenviados", "password": "clave123"}
    ).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Envía inversión ANTES de enviar sus documentos de formalización.
    resp = client.post(
        "/mineros/inversion", json={"respuestas": RESPUESTAS_INV_C}, headers=headers
    )
    assert resp.status_code == 200

    # Con solo una de las dos partes enviada: no aparece.
    assert diag["id"] not in {p["operacion_id"] for p in client.get("/proyectos").json()}

    _hacer_apto_inversionistas(diag["id"], "ambosenviados")

    # Con las dos partes enviadas: ya aparece, sin que nadie lo apruebe.
    assert diag["id"] in {p["operacion_id"] for p in client.get("/proyectos").json()}


def test_inversion_perfil_a_con_a4_2_no_no_se_ofrece():
    respuestas_a = {
        "M0_1": "nada",
        "A1_1": "no",
        "A3_1": "no_se",
        "A4_1": "no", "A4_2": "no",
        "A5_1": "manual", "A5_2": "oro",
    }
    _operacion_id, headers, _admin_headers = _minero_con_visto_bueno("invperfila", respuestas_a)

    resp = client.get("/mineros/inversion", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["ofrece"] is False

    resp = client.post("/mineros/inversion", json={"respuestas": {}}, headers=headers)
    assert resp.status_code == 422


def test_inversion_envio_completo_perfil_c():
    operacion_id, headers, admin_headers = _minero_con_visto_bueno("invperfilc")

    resp = client.post(
        "/mineros/inversion", json={"respuestas": RESPUESTAS_INV_C}, headers=headers
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["enviado"] is True
    assert body["respuestas"]["INV_C2"] == "completas"

    resp = client.get("/mineros/me", headers=headers)
    assert resp.json()["inv_enviado"] is True
    assert resp.json()["inversion_ofrecida"] is True
    # Los documentos de sustento de inversión se ven en la cuenta igual que
    # los de formalización — no solo dentro del wizard de /mi-inversion.
    categorias = {c["categoria"]: c for c in resp.json()["categorias_requeridas_inversion"]}
    assert "liquidaciones_venta" in categorias  # INV_C2="completas" ≠ "no"
    assert categorias["liquidaciones_venta"]["aprobado"] is False

    # El admin ve las mismas respuestas + alertas (ninguna debería saltar
    # con estas respuestas "limpias")
    resp = client.get(f"/admin/operaciones/{operacion_id}/inversion", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["respuestas"]["INV_C1"] == "planta_formal"


def test_inversion_perfil_c_pide_mapeo_geologico_y_fotos_presentacion():
    # Julio 2026 (pedido de Esthiven): C ya opera y vende, pero eso no
    # garantiza tener un estudio geológico formal — se le pide el mismo
    # checklist que a B/D. Además se le ofrece un slot de fotos de
    # presentación (mina/concesión) SIN depender de ninguna respuesta,
    # porque quien ya opera siempre tiene algo que mostrar.
    _operacion_id, headers, _admin_headers = _minero_con_visto_bueno("invc0")
    respuestas = dict(RESPUESTAS_INV_C)
    respuestas["INV_C0"] = "no_tengo"

    resp = client.post("/mineros/inversion", json={"respuestas": respuestas}, headers=headers)
    assert resp.status_code == 200, resp.json()

    me = client.get("/mineros/me", headers=headers).json()
    assert "informe_geologico" in me["brechas_inversion"]
    assert any(
        r["codigo"] == "fotos_presentacion" for r in me["respaldos_declarados_inversion"]
    )

    # Subir el mapeo geológico resuelve la brecha, igual que las demás.
    client.post(
        "/mineros/documentos",
        headers=headers,
        data={"categoria": "informe_geologico"},
        files={"archivo": ("mapeo.jpg", b"\xff\xd8\xffcontenido", "image/jpeg")},
    )
    me = client.get("/mineros/me", headers=headers).json()
    assert "informe_geologico" not in me["brechas_inversion"]


def test_inversion_multi_opcion_respeta_maximo():
    _operacion_id, headers, _admin_headers = _minero_con_visto_bueno("invmulti")
    respuestas = dict(RESPUESTAS_INV_C)
    respuestas["INV_0_2"] = ["tramites", "exploracion", "equipo", "planta"]  # 4 > máximo 3

    resp = client.post("/mineros/inversion", json={"respuestas": respuestas}, headers=headers)
    assert resp.status_code == 422


def test_inversion_condicional_negociando_exige_inv_0_7():
    _operacion_id, headers, _admin_headers = _minero_con_visto_bueno("invcondicional")
    respuestas = dict(RESPUESTAS_INV_C)
    respuestas["INV_0_6"] = "negociando"  # ahora exige INV_0_7

    resp = client.post("/mineros/inversion", json={"respuestas": respuestas}, headers=headers)
    assert resp.status_code == 422

    respuestas["INV_0_7"] = "no"
    resp = client.post("/mineros/inversion", json={"respuestas": respuestas}, headers=headers)
    assert resp.status_code == 200


def test_inversion_categorias_requeridas_perfil_b_no_bloquea_envio():
    # Perfil B requiere titulo_concesion como documento de sustento, pero
    # ya no bloquea nada — es solo informativo (aprobado: bool en la
    # respuesta) hasta que el minero lo suba.
    operacion_id, headers, admin_headers = _minero_con_visto_bueno(
        "invsustentob", RESPUESTAS_SIN_TRAMITE
    )
    resp = client.post("/mineros/documentos/enviar", headers=headers)
    assert resp.status_code == 200
    respuestas_inv_b = {
        "INV_0_1": "25k_100k",
        "INV_0_2": ["equipo"],
        "INV_0_3": "regalia",
        "INV_0_4": ["concesion"],
        "INV_0_5": "2_5a",
        "INV_0_6": "nunca",
            "INV_0_9": "persona_natural",
        "INV_0_10": "20_40",
        "INV_0_11": "sin_deudas",
    "INV_0_12": ["dinero", "maquinaria_equipos"],
    "INV_0_9": "persona_natural",
    "INV_0_10": "20_40",
    "INV_0_11": "sin_deudas",
    "INV_0_12": ["dinero", "maquinaria_equipos"],
        "INV_B1a": "no_tengo",
        "INV_B1b": "no_tengo",
        "INV_B1c": "no_tengo",
        "INV_B2": "nunca",
        "INV_B3": "capital",
        "INV_B4": "si_titularidad",
    }
    resp = client.post(
        "/mineros/inversion", json={"respuestas": respuestas_inv_b}, headers=headers
    )
    assert resp.status_code == 200
    categorias = {c["categoria"]: c for c in resp.json()["categorias_requeridas"]}
    assert categorias["titulo_concesion"]["aprobado"] is False

    # julio 2026 (a pedido de Esthiven): perfil B también puede mostrar
    # fotos de presentación (concesión, terreno, acceso) aunque no opere
    # todavía — antes era exclusivo de C/D.
    me = client.get("/mineros/me", headers=headers).json()
    assert "fotos_presentacion" in {
        r["codigo"] for r in me["respaldos_declarados_inversion"]
    }

    doc = client.post(
        "/mineros/documentos",
        headers=headers,
        data={"categoria": "titulo_concesion"},
        files={"archivo": ("titulo.jpg", b"\xff\xd8\xffcontenido", "image/jpeg")},
    ).json()
    client.put(
        f"/admin/documentos/{doc['id']}/revision",
        json={"estado_revision": "aprobado"},
        headers=admin_headers,
    )

    resp = client.get("/mineros/me", headers=headers)
    categorias = {
        c["categoria"]: c for c in resp.json()["categorias_requeridas_inversion"]
    }
    assert categorias["titulo_concesion"]["aprobado"] is True
    # Y el proyecto ya aparece en la cartera con solo haber ENVIADO ambas
    # partes — sin depender de que lo aprueben.
    assert operacion_id in {p["operacion_id"] for p in client.get("/proyectos").json()}

    # Brecha de inversión ("No tengo" estimación de recursos) — al subir el
    # respaldo desde "lo que te falta" sale de brechas_inversion Y gana su
    # recuadro en "Respalda tu inversión" (la evidencia manda; antes el
    # archivo quedaba invisible).
    me = resp.json()
    assert "estimacion_recursos" in me["brechas_inversion"]
    assert "estimacion_recursos" not in {
        r["codigo"] for r in me["respaldos_declarados_inversion"]
    }
    client.post(
        "/mineros/documentos",
        headers=headers,
        data={"categoria": "estimacion_recursos"},
        files={"archivo": ("estimacion.jpg", b"\xff\xd8\xffcontenido", "image/jpeg")},
    )
    me = client.get("/mineros/me", headers=headers).json()
    assert "estimacion_recursos" not in me["brechas_inversion"]
    respaldos = {r["codigo"]: r for r in me["respaldos_declarados_inversion"]}
    # julio 2026 (reportado por Esthiven): valor/pregunta_id vacíos a
    # propósito — el valor crudo detrás de este slot es siempre una
    # respuesta NEGATIVA ("no_tengo"), y mostrar "Marcaste: No tengo" al
    # lado de un archivo YA subido es contradictorio. Sin pregunta_id el
    # frontend no arma la línea "Marcaste: X".
    assert respaldos["estimacion_recursos"]["valor"] == ""
    assert respaldos["estimacion_recursos"]["pregunta_id"] == ""


def test_mapa_cotejo_no_revienta_si_el_pin_no_cae_en_concesion():
    # Regresión (julio 2026): el caché guarda "concesion": None cuando el
    # pin no cae en ninguna concesión — el default de .get() solo aplica si
    # la CLAVE falta, no si vale None, así que None.get("poligono")
    # devolvía 500 en el caso más común. Debe ser 404 limpio (GEOCATMIN
    # está desactivado en tests, no hay imagen que generar), nunca 500.
    diag = _crear_diagnostico().json()
    client.post("/leads", json=_lead_payload(diag["id"], username="mapacotejo1"))
    _hacer_apto_inversionistas(diag["id"], "mapacotejo1")

    db = TestingSessionLocal()
    lead_db = db.query(models.Lead).filter(models.Lead.username == "mapacotejo1").first()
    lead_db.ubicacion_coords = "-12.5,-76.7"
    operacion = db.query(models.Operacion).filter(models.Operacion.id == diag["id"]).first()
    operacion.datos_formalizacion_json = {
        **(operacion.datos_formalizacion_json or {}),
        "_geocatmin": {"v": 6, "coords": "-12.5,-76.7", "concesion": None, "geologia": None},
    }
    db.commit()
    db.close()

    resp = client.get(f"/proyectos/{diag['id']}/mapa-cotejo.jpg")
    assert resp.status_code == 404  # sin red en tests — pero JAMÁS 500


def test_ficha_publica_no_espera_a_geocatmin_ni_reinfo(monkeypatch):
    # Regresión (julio 2026, reportado como "se demora un montón" al abrir
    # un proyecto): antes GEOCATMIN/REINFO se consultaban EN VIVO dentro de
    # la misma petición — hasta 11 llamadas seguidas a servidores lentos
    # del Estado antes de responder. Ahora la 1ª visita responde con
    # geocatmin/reinfo en None (nada que mostrar todavía, pero SIN
    # esperar la red) y el refresco real corre en segundo plano
    # (BackgroundTasks) — la 2ª visita ya lo tiene cacheado.
    import geocatmin as geocatmin_modulo
    import reinfo as reinfo_modulo

    llamadas = {"geocatmin": 0, "reinfo": 0}

    def geocatmin_falso(coords):
        llamadas["geocatmin"] += 1
        return {
            "v": 6, "coords": coords, "consultado_en": "2026-07-16",
            "concesion": None, "geologia": None, "geologia_50k": None,
            "fallas": None, "restricciones": [], "anp": None,
        }

    def reinfo_falso(codigo):
        llamadas["reinfo"] += 1
        return {
            "v": 2, "codigo": codigo, "consultado_en": "2026-07-16",
            "estado": "VIGENTE", "declarante": None, "derecho": None, "distrito": None,
            "ruc": None, "departamento": None, "provincia": None,
        }

    monkeypatch.setattr(geocatmin_modulo, "consultar", geocatmin_falso)
    monkeypatch.setattr(reinfo_modulo, "consultar_reinfo", reinfo_falso)

    diag = _crear_diagnostico().json()
    client.post(
        "/leads",
        json=_lead_payload(diag["id"], username="fichasinred", codigo_reinfo="REI-FICHA-1"),
    )
    _hacer_apto_inversionistas(diag["id"], "fichasinred")
    # MINELINK_RESOLVER_MAPS=0 en tests desactiva la resolución real del
    # enlace — se fija ubicacion_coords directo en la BD (equivalente a un
    # enlace que sí resolvió) para poder probar el camino de GEOCATMIN.
    db = TestingSessionLocal()
    lead_db = db.query(models.Lead).filter(models.Lead.username == "fichasinred").first()
    lead_db.ubicacion_coords = "-12.5,-76.7"
    db.commit()
    db.close()

    # 1ª visita: sin caché todavía — la ficha responde con geocatmin/reinfo
    # en None, NO con el resultado (aunque el fake fuera instantáneo, el
    # punto es que el camino síncrono nunca lo llama).
    detalle = client.get(f"/proyectos/{diag['id']}").json()
    assert detalle["geocatmin"] is None
    assert detalle["reinfo"] is None
    assert llamadas == {"geocatmin": 1, "reinfo": 1}  # sí se agendó, en background

    # 2ª visita: el background task de la 1ª ya guardó el caché.
    detalle = client.get(f"/proyectos/{diag['id']}").json()
    assert detalle["geocatmin"]["concesion"] is None  # viene del fake, pero YA está poblado
    assert detalle["reinfo"]["estado"] == "VIGENTE"
    assert llamadas == {"geocatmin": 1, "reinfo": 1}  # con caché fresco, no se repite


def test_admin_marca_y_desmarca_reinfo_verificado_manual():
    # Julio 2026: el cotejo automático contra el MINEM quedó desactivado
    # (ver reinfo.py) porque da falsos "no_encontrado" — Esthiven verifica
    # el código a mano y lo marca aquí; la ficha pública lo muestra.
    diag = _crear_diagnostico().json()
    client.post(
        "/leads",
        json=_lead_payload(diag["id"], username="reinfomanual1", codigo_reinfo="010253815"),
    )
    _hacer_apto_inversionistas(diag["id"], "reinfomanual1")
    admin_headers = {"Authorization": f"Bearer {_admin_token()}"}

    detalle = client.get(f"/proyectos/{diag['id']}").json()
    assert detalle["reinfo_verificado_manual"] is False
    assert detalle["reinfo_verificado_en"] is None

    resp = client.put(
        f"/admin/operaciones/{diag['id']}/reinfo-verificado",
        json={"verificado": True},
        headers=admin_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["reinfo_verificado_manual"] is True
    assert resp.json()["reinfo_verificado_en"] is not None

    detalle = client.get(f"/proyectos/{diag['id']}").json()
    assert detalle["reinfo_verificado_manual"] is True
    assert detalle["reinfo_verificado_en"] is not None
    assert detalle["codigo_reinfo"] == "010253815"

    leads = client.get("/admin/leads", headers=admin_headers).json()
    lead = next(l for l in leads if l["operacion_id"] == diag["id"])
    assert lead["reinfo_verificado_manual"] is True

    resp = client.put(
        f"/admin/operaciones/{diag['id']}/reinfo-verificado",
        json={"verificado": False},
        headers=admin_headers,
    )
    assert resp.json()["reinfo_verificado_manual"] is False
    assert resp.json()["reinfo_verificado_en"] is None


def test_mineros_completa_pregunta_inv_agregada_despues_del_envio():
    # Reproduce el caso real reportado (perfil C, "Minera Santa Luisa"):
    # su Módulo INV se envió ANTES de que INV_C0 (mapeo geológico) existiera
    # en el catálogo. Antes de este fix, esa pregunta quedaba invisible
    # para siempre — ni aparecía en "lo que te falta" ni había forma de
    # responderla, porque inv_enviado ya era True y el wizard completo no
    # se vuelve a mostrar.
    diag = _crear_diagnostico().json()
    client.post("/leads", json=_lead_payload(diag["id"], username="pendienteinv1"))
    _hacer_apto_inversionistas(diag["id"], "pendienteinv1")

    # Simula el envío "viejo" (sin INV_C0) escribiendo directo a la BD —
    # como si el minero hubiera enviado antes de julio 2026.
    db = TestingSessionLocal()
    operacion = db.query(models.Operacion).filter(models.Operacion.id == diag["id"]).first()
    respuestas_sin_c0 = dict(operacion.inv_respuestas_json)
    del respuestas_sin_c0["INV_C0"]
    operacion.inv_respuestas_json = respuestas_sin_c0
    db.commit()
    db.close()

    token = client.post(
        "/mineros/login", json={"username": "pendienteinv1", "password": "clave123"}
    ).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    me = client.get("/mineros/me", headers=headers).json()
    assert me["inv_enviado"] is True
    assert me["inv_preguntas_pendientes"] == ["INV_C0"]

    # Responderla con un id que NO está pendiente → 422.
    resp = client.post(
        "/mineros/inversion/completar",
        headers=headers,
        json={"respuestas": {"INV_C1": "planta_formal"}},
    )
    assert resp.status_code == 422

    # Responderla de verdad.
    resp = client.post(
        "/mineros/inversion/completar",
        headers=headers,
        json={"respuestas": {"INV_C0": "en_proceso"}},
    )
    assert resp.status_code == 200
    assert resp.json()["inv_preguntas_pendientes"] == []

    me = client.get("/mineros/me", headers=headers).json()
    assert me["inv_preguntas_pendientes"] == []
    # El resto de las respuestas viejas se conservó (fusión, no reemplazo).
    assert me["datos_formalizacion"] is not None  # smoke: la cuenta sigue íntegra


def test_mineros_completar_inversion_requiere_haber_enviado_antes():
    diag = _crear_diagnostico().json()
    client.post("/leads", json=_lead_payload(diag["id"], username="pendienteinv2"))
    token = client.post(
        "/mineros/login", json={"username": "pendienteinv2", "password": "clave123"}
    ).json()["access_token"]
    resp = client.post(
        "/mineros/inversion/completar",
        headers={"Authorization": f"Bearer {token}"},
        json={"respuestas": {"INV_C0": "tengo"}},
    )
    assert resp.status_code == 422


def test_mineros_marca_no_llevo_registro_opex_y_luego_sube_evidencia():
    # Caso real reportado (perfil C, "Minera Santa Luisa"): INV_C4="no"
    # ("No llevo registro") — subir un respaldo desde "Lo que te falta" ya
    # NO debe mostrar "Marcaste: No llevo registro" al lado del archivo
    # (contradictorio); solo debe verse el slot con su archivo.
    diag = _crear_diagnostico().json()
    client.post("/leads", json=_lead_payload(diag["id"], username="opexnoregistro1"))
    token = client.post(
        "/mineros/login", json={"username": "opexnoregistro1", "password": "clave123"}
    ).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    respuestas_c = dict(RESPUESTAS_INV_C)
    respuestas_c["INV_C4"] = "no"
    resp = client.post("/mineros/inversion", json={"respuestas": respuestas_c}, headers=headers)
    assert resp.status_code == 200

    me = client.get("/mineros/me", headers=headers).json()
    assert "costos_opex" in me["brechas_inversion"]
    assert "costos_opex" not in {r["codigo"] for r in me["respaldos_declarados_inversion"]}

    client.post(
        "/mineros/documentos",
        headers=headers,
        data={"categoria": "costos_opex"},
        files={"archivo": ("opex.jpg", b"\xff\xd8\xffcontenido", "image/jpeg")},
    )
    me = client.get("/mineros/me", headers=headers).json()
    assert "costos_opex" not in me["brechas_inversion"]
    respaldos = {r["codigo"]: r for r in me["respaldos_declarados_inversion"]}
    assert respaldos["costos_opex"]["valor"] == ""
    assert respaldos["costos_opex"]["pregunta_id"] == ""


def test_proyectos_detalle_contrato_explotacion_se_ve_en_documentos_estudios():
    # Caso real reportado (perfil C, "Minera Santa Luisa", opera por
    # contrato con el dueño de la concesión): contrato_explotacion está en
    # CATEGORIAS_LEGALES Y en CATEGORIAS_ESTUDIO a la vez. Con el `elif`
    # viejo, el documento caía SOLO en documentos_legales (que ninguna
    # pantalla del frontend renderiza) y el checklist de Formalización
    # (que solo lee documentos_estudios) lo mostraba como pendiente sin
    # foto, aunque el archivo estuviera subido y servible.
    respuestas_contrato = dict(RESPUESTAS_COMPLETAS)
    respuestas_contrato["C1_3"] = "contrato"
    respuestas_contrato["C2_7"] = "aprobado"
    respuestas_contrato["C3_1"] = "firmado_inscrito"
    respuestas_contrato.pop("C2_3")
    diag = client.post(
        "/diagnostico",
        json={
            "respuestas": respuestas_contrato,
            "region": "arequipa",
            "mineral": "oro",
            "tipo_mina": "subterranea",
        },
    ).json()
    client.post("/leads", json=_lead_payload(diag["id"], username="contratoexplot1"))
    token = client.post(
        "/mineros/login", json={"username": "contratoexplot1", "password": "clave123"}
    ).json()["access_token"]
    client.post(
        "/mineros/documentos",
        headers={"Authorization": f"Bearer {token}"},
        data={"categoria": "contrato_explotacion"},
        files={"archivo": ("contrato.jpg", b"\xff\xd8\xffcontenido", "image/jpeg")},
    )
    _hacer_apto_inversionistas(diag["id"], "contratoexplot1")

    detalle = client.get(f"/proyectos/{diag['id']}").json()
    assert len(detalle["documentos_legales"]["contrato_explotacion"]) >= 1
    assert len(detalle["documentos_estudios"]["contrato_explotacion"]) >= 1
    resp_foto = client.get(detalle["documentos_estudios"]["contrato_explotacion"][0]["url"])
    assert resp_foto.status_code == 200


def test_proyectos_detalle_muestra_certificado_ley_publico():
    # Julio 2026 (reportado por Esthiven): certificado_ley (el análisis o
    # certificado de ley del mineral, INV_C3) se subía pero nunca se
    # mostraba al inversionista — no estaba en ningún set de categorías
    # públicas. No es información financiera sensible, es evidencia.
    diag = _crear_diagnostico().json()
    client.post("/leads", json=_lead_payload(diag["id"], username="certley1"))
    _hacer_apto_inversionistas(diag["id"], "certley1")

    token = client.post(
        "/mineros/login", json={"username": "certley1", "password": "clave123"}
    ).json()["access_token"]
    resp = client.post(
        "/mineros/documentos",
        headers={"Authorization": f"Bearer {token}"},
        data={"categoria": "certificado_ley"},
        files={"archivo": ("ley.jpg", b"\xff\xd8\xffcontenido", "image/jpeg")},
    )
    assert resp.status_code == 201

    detalle = client.get(f"/proyectos/{diag['id']}").json()
    assert len(detalle["documentos_inversion"]["certificado_ley"]) == 1
    resp_foto = client.get(detalle["documentos_inversion"]["certificado_ley"][0]["url"])
    assert resp_foto.status_code == 200


def test_admin_reinfo_verificado_requiere_jwt():
    diag = _crear_diagnostico().json()
    client.post("/leads", json=_lead_payload(diag["id"], username="reinfomanual2"))
    resp = client.put(
        f"/admin/operaciones/{diag['id']}/reinfo-verificado", json={"verificado": True}
    )
    assert resp.status_code == 403


def test_detalle_publico_indicadores_verificados_sin_exponer_documentos():
    # Los documentos sensibles (liquidaciones) generan una SEÑAL pública
    # verificada (existe, cuántos, de cuándo) pero el archivo en sí NUNCA
    # se sirve públicamente.
    diag = _crear_diagnostico().json()
    client.post("/leads", json=_lead_payload(diag["id"], username="indicadores1"))
    _hacer_apto_inversionistas(diag["id"], "indicadores1", respuestas_inv=RESPUESTAS_INV_C)
    token = client.post(
        "/mineros/login", json={"username": "indicadores1", "password": "clave123"}
    ).json()["access_token"]

    # Subir liquidación + dato de OPEX + nº de trabajadores
    doc = client.post(
        "/mineros/documentos",
        headers={"Authorization": f"Bearer {token}"},
        data={"categoria": "liquidaciones_venta"},
        files={"archivo": ("liq.jpg", b"\xff\xd8\xffcontenido", "image/jpeg")},
    ).json()
    doc_opex = client.post(
        "/mineros/documentos",
        headers={"Authorization": f"Bearer {token}"},
        data={"categoria": "registro_opex"},
        files={"archivo": ("opex.jpg", b"\xff\xd8\xffcontenido", "image/jpeg")},
    ).json()
    client.put(
        "/mineros/perfil-inversion",
        headers={"Authorization": f"Bearer {token}"},
        json={"datos_formalizacion": {"registro_opex": "120", "fotos_trabajadores": "8"}},
    )

    # julio 2026 (pedido explícito): "verificado" ahora exige que Esthiven
    # apruebe el documento — antes de aprobar, el indicador NO debe marcar
    # verificado aunque el archivo ya esté subido.
    detalle = client.get(f"/proyectos/{diag['id']}").json()
    assert detalle["indicadores"]["ventas_liquidacion_verificada"] is False
    assert detalle["indicadores"]["opex_verificado"] is False

    admin_headers = {"Authorization": f"Bearer {_admin_token()}"}
    client.put(
        f"/admin/documentos/{doc['id']}/revision",
        json={"estado_revision": "aprobado"},
        headers=admin_headers,
    )
    client.put(
        f"/admin/documentos/{doc_opex['id']}/revision",
        json={"estado_revision": "aprobado"},
        headers=admin_headers,
    )

    detalle = client.get(f"/proyectos/{diag['id']}").json()
    ind = detalle["indicadores"]
    assert ind["ventas_liquidacion_verificada"] is True
    assert ind["ventas_liquidacion_docs"] >= 1
    assert ind["ventas_liquidacion_ultima"]
    assert ind["opex_verificado"] is True
    assert ind["opex_costo_aprox"] == "120"
    assert ind["num_trabajadores"] == "8"

    # El ARCHIVO de la liquidación sigue siendo privado: el endpoint
    # público lo rechaza aunque el proyecto esté publicado.
    resp = client.get(f"/proyectos/{diag['id']}/documentos/{doc['id']}")
    assert resp.status_code == 404
    resp = client.get(f"/proyectos/{diag['id']}/fotos/{doc['id']}")
    assert resp.status_code == 404


def test_notificacion_cuando_admin_resuelve_la_brecha_que_bloqueaba():
    # Hallazgo de auditoría (julio 2026): si el semáforo legal estaba en
    # rojo (REINFO suspendido) con ambas partes ya enviadas, y el admin
    # marcaba resuelta esa brecha por seguimiento manual, el proyecto se
    # publicaba solo en la siguiente lectura — pero el minero nunca
    # recibía la notificación de "publicado", porque solo se disparaba
    # desde los envíos del propio minero.
    respuestas_suspendido = dict(RESPUESTAS_COMPLETAS)
    respuestas_suspendido["M0_4"] = "suspendido"
    respuestas_suspendido["C1_1"] = "suspendida"
    diag = client.post(
        "/diagnostico",
        json={
            "respuestas": respuestas_suspendido,
            "region": "arequipa",
            "mineral": "oro",
            "tipo_mina": "subterranea",
        },
    ).json()
    assert diag["semaforo_legal"] == "rojo"
    client.post("/leads", json=_lead_payload(diag["id"], username="notifdesbloqueo1"))
    _hacer_apto_inversionistas(diag["id"], "notifdesbloqueo1")

    token = client.post(
        "/mineros/login", json={"username": "notifdesbloqueo1", "password": "clave123"}
    ).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Con el semáforo en rojo, aunque envió todo, NO está publicado ni
    # notificado.
    tipos = {n["tipo"] for n in client.get("/mineros/notificaciones", headers=headers).json()}
    assert "publicado_cartera" not in tipos
    assert diag["id"] not in {p["operacion_id"] for p in client.get("/proyectos").json()}

    # El admin se entera (ej. por WhatsApp) de que el REINFO ya se
    # reactivó y marca la brecha como resuelta → se publica Y se notifica.
    admin_headers = {"Authorization": f"Bearer {_admin_token()}"}
    resp = client.put(
        f"/admin/operaciones/{diag['id']}/brechas-resueltas",
        json={"brechas_resueltas": ["tramite_reinfo"]},
        headers=admin_headers,
    )
    assert resp.status_code == 200

    assert diag["id"] in {p["operacion_id"] for p in client.get("/proyectos").json()}
    tipos = {n["tipo"] for n in client.get("/mineros/notificaciones", headers=headers).json()}
    assert "publicado_cartera" in tipos


def test_mineros_notificaciones_requiere_jwt():
    resp = client.get("/mineros/notificaciones")
    assert resp.status_code == 403


def test_notificacion_al_rechazar_documento():
    _operacion_id, headers, _codigos = _minero_con_estudios("notifrechazo")
    admin_headers = {"Authorization": f"Bearer {_admin_token()}"}
    doc = client.post(
        "/mineros/documentos",
        headers=headers,
        data={"categoria": "fotos_mina"},
        files={"archivo": ("a.jpg", b"\xff\xd8\xffcontenido", "image/jpeg")},
    ).json()

    resp = client.get("/mineros/notificaciones", headers=headers)
    assert resp.json() == []

    client.put(
        f"/admin/documentos/{doc['id']}/revision",
        json={"estado_revision": "rechazado", "motivo_rechazo": "Foto borrosa"},
        headers=admin_headers,
    )

    resp = client.get("/mineros/notificaciones", headers=headers)
    assert resp.status_code == 200
    notifs = resp.json()
    assert len(notifs) == 1
    assert notifs[0]["tipo"] == "documento_rechazado"
    assert "Foto borrosa" in notifs[0]["mensaje"]
    assert notifs[0]["leida"] is False


def test_notificacion_al_publicarse_en_cartera():
    # Julio 2026: no hay visto bueno manual — se notifica automáticamente
    # apenas la operación queda apta para la cartera (ambas partes
    # enviadas), una sola vez aunque se reenvíe algo después.
    operacion_id, headers, _admin_headers = _minero_con_visto_bueno("notifpublicado")

    resp = client.post("/mineros/documentos/enviar", headers=headers)
    assert resp.status_code == 200
    # Con solo formalización enviada, todavía no es apto → sin notificación.
    resp = client.get("/mineros/notificaciones", headers=headers)
    assert not any(n["tipo"] == "publicado_cartera" for n in resp.json())

    resp = client.post(
        "/mineros/inversion", json={"respuestas": RESPUESTAS_INV_C}, headers=headers
    )
    assert resp.status_code == 200
    # RESPUESTAS_INV_C tiene INV_C2="completas" (≠ "no") → requiere
    # liquidaciones_venta, pero eso es solo informativo — no bloquea nada.
    resp = client.get("/mineros/notificaciones", headers=headers)
    assert any(n["tipo"] == "publicado_cartera" for n in resp.json())
    assert operacion_id in {p["operacion_id"] for p in client.get("/proyectos").json()}

    # Reenviar no duplica la notificación.
    client.post(
        "/mineros/inversion", json={"respuestas": RESPUESTAS_INV_C}, headers=headers
    )
    resp = client.get("/mineros/notificaciones", headers=headers)
    assert sum(1 for n in resp.json() if n["tipo"] == "publicado_cartera") == 1


def test_mineros_marcar_notificaciones_leidas():
    _operacion_id, headers, _codigos = _minero_con_estudios("notifleidas")
    admin_headers = {"Authorization": f"Bearer {_admin_token()}"}
    doc = client.post(
        "/mineros/documentos",
        headers=headers,
        data={"categoria": "fotos_mina"},
        files={"archivo": ("a.jpg", b"\xff\xd8\xffcontenido", "image/jpeg")},
    ).json()
    client.put(
        f"/admin/documentos/{doc['id']}/revision",
        json={"estado_revision": "rechazado", "motivo_rechazo": "Mal enfocada"},
        headers=admin_headers,
    )

    resp = client.post("/mineros/notificaciones/marcar-leidas", headers=headers)
    assert resp.status_code == 200
    assert all(n["leida"] is True for n in resp.json())

    resp = client.get("/mineros/notificaciones", headers=headers)
    assert all(n["leida"] is True for n in resp.json())


def test_inversion_bloqueada_si_titular_se_niega_a_firmar_contrato():
    respuestas_contrato_se_niega = dict(RESPUESTAS_COMPLETAS)
    respuestas_contrato_se_niega.update(
        {
            "C1_3": "contrato",
            "C2_7": "aprobado",
            "C3_1": "se_niega",
        }
    )
    respuestas_contrato_se_niega.pop("C2_3")  # no aplica a contrato
    operacion_id, headers, admin_headers = _minero_con_visto_bueno(
        "invriesgolegal", respuestas_contrato_se_niega
    )

    resp = client.get("/mineros/inversion", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["ofrece"] is False
    assert "riesgo legal" in resp.json()["motivo"].lower()

    resp = client.post(
        "/mineros/inversion", json={"respuestas": RESPUESTAS_INV_C}, headers=headers
    )
    assert resp.status_code == 422

    # El admin resuelve la brecha "contrato_explotacion" (mismo mecanismo
    # de seguimiento manual que ya existía) → se desbloquea solo.
    client.put(
        f"/admin/operaciones/{operacion_id}/brechas-resueltas",
        json={"brechas_resueltas": ["contrato_explotacion"]},
        headers=admin_headers,
    )
    resp = client.get("/mineros/inversion", headers=headers)
    assert resp.json()["ofrece"] is True

    resp = client.post(
        "/mineros/inversion", json={"respuestas": RESPUESTAS_INV_C}, headers=headers
    )
    assert resp.status_code == 200


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
    _hacer_apto_inversionistas(diag["id"], "proyectominero")

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
    _hacer_apto_inversionistas(diag["id"], "sinapodo")

    resp = client.get("/proyectos")
    assert resp.json()[0]["nombre_proyecto"] == "Proyecto minero en Arequipa"


def test_proyectos_incluye_operaciones_bloqueadas():
    # REINFO/trámite de formalización ya NO es requisito para la vitrina
    # pública — bloqueado es solo informativo, no filtra el listado.
    diag = client.post(
        "/diagnostico",
        json={
            "respuestas": RESPUESTAS_SIN_TRAMITE,
            "region": "arequipa",
            "mineral": "oro",
            "tipo_mina": "subterranea",
        },
    ).json()
    assert diag["apto_inversionistas"] is True
    client.post("/leads", json=_lead_payload(diag["id"], username="bloqueado1"))
    _hacer_apto_inversionistas(diag["id"], "bloqueado1", respuestas_inv=RESPUESTAS_INV_B)

    resp = client.get("/proyectos")
    assert len(resp.json()) == 1


def test_proyectos_filtra_por_mineral_y_region():
    diag1 = _crear_diagnostico().json()
    client.post(
        "/leads",
        json=_lead_payload(diag1["id"], username="filtro1", whatsapp="+51900000011"),
    )
    _hacer_apto_inversionistas(diag1["id"], "filtro1")
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
    _hacer_apto_inversionistas(diag2["id"], "filtro2")

    resp = client.get("/proyectos?region=puno")
    assert len(resp.json()) == 1
    assert resp.json()[0]["region"] == "puno"

    resp = client.get("/proyectos?mineral=oro")
    assert len(resp.json()) == 1
    assert resp.json()[0]["mineral"] == "oro"


def test_proyectos_regla_de_bloqueo_oculta_rojos_y_perfil_a():
    # REGLA DE BLOQUEO del spec: nunca mostrar a inversionistas un proyecto
    # con incendio legal activo (semáforo rojo), ni perfiles sin proyecto
    # publicable (A). El minero con REINFO suspendido NO debe listarse.
    respuestas_suspendido = dict(RESPUESTAS_COMPLETAS)
    respuestas_suspendido["M0_4"] = "suspendido"
    respuestas_suspendido["C1_1"] = "suspendida"
    diag_rojo = client.post(
        "/diagnostico",
        json={
            "respuestas": respuestas_suspendido,
            "region": "arequipa",
            "mineral": "oro",
            "tipo_mina": "subterranea",
        },
    ).json()
    assert diag_rojo["semaforo_legal"] == "rojo"
    assert diag_rojo["apto_inversionistas"] is False
    client.post("/leads", json=_lead_payload(diag_rojo["id"], username="rojooculto"))

    # Perfil A registrado: puede tener cuenta pero NO proyecto público.
    respuestas_a = {
        "M0_1": "nada",
        "A1_1": "no",
        "A3_1": "no_se",
        "A4_1": "no", "A4_2": "si",
        "A5_1": "manual", "A5_2": "oro",
    }
    diag_a = client.post(
        "/diagnostico",
        json={
            "respuestas": respuestas_a,
            "region": "puno",
            "mineral": "oro",
            "tipo_mina": "tajo_abierto",
            "situacion": "concesionario",
        },
    ).json()
    assert diag_a["perfil"] == "A"
    client.post(
        "/leads",
        json=_lead_payload(diag_a["id"], username="perfilAoculto", whatsapp="+51987000222"),
    )

    # Un perfil C verde con visto bueno de inversión SÍ se lista.
    diag_ok = _crear_diagnostico().json()
    client.post(
        "/leads",
        json=_lead_payload(diag_ok["id"], username="verdevisible", whatsapp="+51987000333"),
    )
    _hacer_apto_inversionistas(diag_ok["id"], "verdevisible")

    # Sube su título de concesión: la credencial que prueba que el
    # proyecto existe, mostrada como mini-foto en la tarjeta.
    token_credencial = client.post(
        "/mineros/login", json={"username": "verdevisible", "password": "clave123"}
    ).json()["access_token"]
    client.post(
        "/mineros/documentos",
        headers={"Authorization": f"Bearer {token_credencial}"},
        data={"categoria": "titulo_concesion"},
        files={"archivo": ("titulo.jpg", b"\xff\xd8\xffcontenido", "image/jpeg")},
    )

    # julio 2026 (pedido explícito): "ventas_verificadas" ahora exige que
    # Esthiven apruebe la liquidación subida por _hacer_apto_inversionistas
    # — antes bastaba con que existiera el archivo.
    admin_headers = {"Authorization": f"Bearer {_admin_token()}"}
    docs_ok = client.get(
        f"/admin/operaciones/{diag_ok['id']}/documentos", headers=admin_headers
    ).json()
    liquidacion = next(d for d in docs_ok if d["categoria"] == "liquidaciones_venta")
    client.put(
        f"/admin/documentos/{liquidacion['id']}/revision",
        json={"estado_revision": "aprobado"},
        headers=admin_headers,
    )

    proyectos = client.get("/proyectos").json()
    ids = {p["operacion_id"] for p in proyectos}
    assert diag_ok["id"] in ids
    assert diag_rojo["id"] not in ids
    assert diag_a["id"] not in ids

    tarjeta = next(p for p in proyectos if p["operacion_id"] == diag_ok["id"])
    assert tarjeta["perfil"] == "C"
    assert tarjeta["semaforo_legal"] == "verde"
    assert tarjeta["indice_madurez"] is None  # Módulo INV en pausa
    assert tarjeta["docs_completados"] == 6
    assert tarjeta["docs_totales"] == 6
    assert tarjeta["vende_liquidacion"] is True
    # Cartera renovada (julio 2026): scores por track + ventas verificadas
    # en la tarjeta. Perfil C puntúa dentro de su rango (55-80) y el ✓ de
    # ventas aparece porque declaró INV_C2 y subió la liquidación (el
    # documento en sí sigue siendo privado — ver IndicadoresVerificadosOut).
    assert 55 <= tarjeta["score_formalizacion"] <= 80
    assert isinstance(tarjeta["score_inversion"], int)
    assert tarjeta["ventas_verificadas"] is True
    assert tarjeta["credencial_etiqueta"] == "Título de concesión"
    assert tarjeta["credencial_url"].startswith(f"/proyectos/{diag_ok['id']}/documentos/")


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
    _hacer_apto_inversionistas(diag["id"], "detalleproyecto")

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


def test_proyectos_detalle_no_apto_da_404():
    # Julio 2026 (hallazgo de auditoría): antes SOLO `listar_proyectos()`
    # filtraba por apto_inversionistas — la ficha individual, dejar
    # interés y ver fotos/documentos no repetían el chequeo, así que un
    # link directo a un proyecto que nunca envió documentos+Módulo INV (o
    # con semáforo legal rojo) seguía abriendo su ficha completa aunque no
    # apareciera en la lista pública. Ahora `_lead_y_operacion_visibles()`
    # aplica la MISMA regla en los 4 lugares.
    diag = client.post(
        "/diagnostico",
        json={
            "respuestas": RESPUESTAS_SIN_TRAMITE,
            "region": "arequipa",
            "mineral": "oro",
            "tipo_mina": "subterranea",
        },
    ).json()
    client.post("/leads", json=_lead_payload(diag["id"], username="bloqueado2"))

    resp = client.get(f"/proyectos/{diag['id']}")
    assert resp.status_code == 404


def test_proyectos_detalle_bloqueado_legacy_no_impide_acceso_si_es_apto():
    # El campo legacy `Operacion.bloqueado` (score viejo) es solo
    # informativo — lo que de verdad manda es `apto_inversionistas`
    # (semáforo legal + documentos y Módulo INV enviados). Una operación
    # puede quedar con `bloqueado=True` y aun así ser apto si cumplió el
    # pipeline completo.
    diag = client.post(
        "/diagnostico",
        json={
            "respuestas": RESPUESTAS_SIN_TRAMITE,
            "region": "arequipa",
            "mineral": "oro",
            "tipo_mina": "subterranea",
        },
    ).json()
    client.post("/leads", json=_lead_payload(diag["id"], username="bloqueadoapto1"))
    _hacer_apto_inversionistas(diag["id"], "bloqueadoapto1", respuestas_inv=RESPUESTAS_INV_B)

    resp = client.get(f"/proyectos/{diag['id']}")
    assert resp.status_code == 200


def test_proyectos_detalle_inexistente_da_404():
    resp = client.get("/proyectos/no-existe")
    assert resp.status_code == 404


def test_proyectos_detalle_incluye_brechas():
    diag = _crear_diagnostico().json()
    client.post("/leads", json=_lead_payload(diag["id"], username="dimensionesproyecto"))
    _hacer_apto_inversionistas(diag["id"], "dimensionesproyecto")

    resp = client.get(f"/proyectos/{diag['id']}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["brechas_pendientes"] == []
    assert body["brechas_resueltas"] == []


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
        "tipo_aporte_json": ["dinero", "maquinaria_equipos"],
    }
    payload.update(overrides)
    return payload


def test_proyectos_registra_interes_inversion():
    diag = _crear_diagnostico().json()
    client.post("/leads", json=_lead_payload(diag["id"], username="interesproyecto"))
    _hacer_apto_inversionistas(diag["id"], "interesproyecto")

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

    # El minero ve CUÁNTOS intereses recibió (solo el número — los datos
    # de contacto del inversionista siguen siendo exclusivos del admin).
    token = client.post(
        "/mineros/login", json={"username": "interesproyecto", "password": "clave123"}
    ).json()["access_token"]
    me = client.get("/mineros/me", headers={"Authorization": f"Bearer {token}"}).json()
    assert me["intereses_recibidos"] == 1


def test_proyectos_registra_interes_email_opcional():
    diag = _crear_diagnostico().json()
    client.post("/leads", json=_lead_payload(diag["id"], username="interessinemail"))
    _hacer_apto_inversionistas(diag["id"], "interessinemail")

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
    _hacer_apto_inversionistas(diag["id"], "interesproyecto3")

    client.post(
        f"/proyectos/{diag['id']}/interes",
        json=_interes_payload(username="repetido"),
    )
    resp = client.post(
        f"/proyectos/{diag['id']}/interes",
        json=_interes_payload(username="repetido", email="otro@example.com"),
    )
    assert resp.status_code == 409


def test_proyectos_registra_interes_operacion_no_apto_da_404():
    # Mismo hallazgo que test_proyectos_detalle_no_apto_da_404, aplicado a
    # "dejar interés" — antes se podía dejar interés en un proyecto que
    # nunca fue apto para inversionistas con solo tener su operacion_id.
    diag = client.post(
        "/diagnostico",
        json={
            "respuestas": RESPUESTAS_SIN_TRAMITE,
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
    _hacer_apto_inversionistas(diag["id"], "paralogininversionista")
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
    # Seguimiento (julio 2026): arranca en "recibido", con el nombre del
    # proyecto para enlazar a la ficha.
    assert body["estado_contacto"] == "recibido"
    assert body["nombre_proyecto"]
    assert body["proyecto_publicado"] is True
    # Aporte en especie (julio 2026): lo que ofreció queda guardado
    assert body["tipo_aporte_json"] == ["dinero", "maquinaria_equipos"]


def test_inversionista_ve_avance_cuando_admin_cambia_el_estado():
    """Flujo completo del seguimiento (julio 2026): el admin avanza el
    interés (recibido → en_intermediacion → contactado) y el inversionista
    lo ve reflejado en su cuenta."""
    diag = _crear_diagnostico().json()
    client.post("/leads", json=_lead_payload(diag["id"], username="paraseguimiento"))
    _hacer_apto_inversionistas(diag["id"], "paraseguimiento")
    client.post(
        f"/proyectos/{diag['id']}/interes",
        json=_interes_payload(username="invseguimiento", password="clave123"),
    )
    token_inv = client.post(
        "/inversionistas/login",
        json={"username": "invseguimiento", "password": "clave123"},
    ).json()["access_token"]
    headers_admin = {"Authorization": f"Bearer {_admin_token()}"}

    # El admin encuentra el interés en el listado de la operación
    intereses = client.get(
        f"/admin/operaciones/{diag['id']}/intereses", headers=headers_admin
    ).json()
    interes_id = [i for i in intereses if i["nombre"] == "Inversionista Prueba"][0]["id"]
    assert intereses[0]["estado_contacto"] == "recibido"

    resp = client.put(
        f"/admin/intereses/{interes_id}/estado-contacto",
        headers=headers_admin,
        json={"estado_contacto": "en_intermediacion"},
    )
    assert resp.status_code == 200

    body = client.get(
        "/inversionistas/me", headers={"Authorization": f"Bearer {token_inv}"}
    ).json()
    assert body["estado_contacto"] == "en_intermediacion"

    # Un estado inventado se rechaza
    resp = client.put(
        f"/admin/intereses/{interes_id}/estado-contacto",
        headers=headers_admin,
        json={"estado_contacto": "cualquiercosa"},
    )
    assert resp.status_code == 422


def test_inversionistas_recuperar_password_flujo_completo():
    diag = _crear_diagnostico().json()
    client.post("/leads", json=_lead_payload(diag["id"], username="paralead4"))
    _hacer_apto_inversionistas(diag["id"], "paralead4")
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
    _hacer_apto_inversionistas(diag["id"], "paralead5")
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
    assert lead["brechas"] == diag["brechas"]
    assert lead["email"] == "juan@example.com"
    assert lead["nombre_operacion"] == "Labor La Esperanza"
    # Recién creado: nada resuelto todavía
    assert lead["brechas_resueltas"] == []
    assert lead["brechas_pendientes"] == diag["brechas"]


def test_marcar_brecha_resuelta_no_altera_declaracion_original():
    token = _admin_token()
    headers = {"Authorization": f"Bearer {token}"}
    # Crear un diagnóstico con brechas (perfil B con vigencia/terreno pendientes)
    respuestas_b = dict(RESPUESTAS_SIN_TRAMITE)
    respuestas_b["B1_1"] = "debo_1"
    respuestas_b["B1_4"] = "privado"
    respuestas_b["B1_5"] = "no"
    diag = client.post(
        "/diagnostico",
        json={
            "respuestas": respuestas_b,
            "region": "arequipa",
            "mineral": "oro",
            "tipo_mina": "subterranea",
        },
    ).json()
    assert "vigencia_concesion" in diag["brechas"]

    resp = client.put(
        f"/admin/operaciones/{diag['id']}/brechas-resueltas",
        json={"brechas_resueltas": ["vigencia_concesion"]},
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["brechas_resueltas"] == ["vigencia_concesion"]
    assert body["brechas_pendientes"] == ["acreditacion_terreno"]

    # Se puede desmarcar enviando una lista más corta (vacía)
    resp = client.put(
        f"/admin/operaciones/{diag['id']}/brechas-resueltas",
        json={"brechas_resueltas": []},
        headers=headers,
    )
    assert resp.status_code == 200
    # Con brechas vacías, score_actual vuelve a 0 (placeholder del nuevo sistema)
    assert resp.json()["score_actual"] == 0


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
    # Crear diagnóstico con brechas reales (perfil B con vigencia/terreno pendientes)
    respuestas_b = dict(RESPUESTAS_SIN_TRAMITE)
    respuestas_b["B1_1"] = "debo_1"
    respuestas_b["B1_4"] = "privado"
    respuestas_b["B1_5"] = "no"
    diag = client.post(
        "/diagnostico",
        json={
            "respuestas": respuestas_b,
            "region": "arequipa",
            "mineral": "oro",
            "tipo_mina": "subterranea",
        },
    ).json()

    # Debe haber al menos una brecha pendiente
    resp = client.get("/admin/dashboard", headers=headers)
    brechas = resp.json()["top_brechas"]
    assert len(brechas) > 0
    primera = brechas[0]["estudio"]

    # Resolvemos la primera brecha
    client.put(
        f"/admin/operaciones/{diag['id']}/brechas-resueltas",
        json={"brechas_resueltas": [primera]},
        headers=headers,
    )

    resp = client.get("/admin/dashboard", headers=headers)
    top_actual = [b["estudio"] for b in resp.json()["top_brechas"]]
    assert primera not in top_actual


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
    # Conteo por perfil (julio 2026): reemplaza al score_promedio legacy,
    # que promediaba el score_total viejo (0 en el modelo A/B/C/D).
    assert body["conteo_por_perfil"] == {"C": 1}
    # Profile C con todo aprobado no tiene brechas
    assert body["top_brechas"] == []
    assert body["ultimos_leads"][0]["nombre"] == "Ana"
    assert body["ultimos_leads"][0]["perfil"] == "C"


def test_admin_dashboard_embudo_inversionista():
    """Embudo del inversionista (julio 2026): cartera_vista y
    ficha_proyecto_vista son eventos anónimos; el interés dejado se cuenta
    directo de la tabla real (más exacto que duplicarlo como evento)."""
    diag = _crear_diagnostico().json()
    client.post("/leads", json=_lead_payload(diag["id"], username="paraembudoinv"))
    _hacer_apto_inversionistas(diag["id"], "paraembudoinv")
    client.post(
        f"/proyectos/{diag['id']}/interes",
        json=_interes_payload(username="inversionistaembudo"),
    )

    client.post("/eventos", json={"tipo": "cartera_vista"})
    client.post("/eventos", json={"tipo": "cartera_vista"})
    client.post("/eventos", json={"tipo": "ficha_proyecto_vista"})

    headers = {"Authorization": f"Bearer {_admin_token()}"}
    resp = client.get("/admin/dashboard", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["carteras_vistas"] == 2
    assert body["fichas_vistas"] == 1
    assert body["intereses_inversion_total"] == 1


def test_evento_sin_ruta_mostrado_es_aceptado():
    # Hallazgo julio 2026: el frontend ya llamaba a este tipo desde
    # Cuestionario.tsx, pero no estaba en TIPOS_EVENTO_VALIDOS y fallaba en
    # 422 silenciosamente (registrarEvento es fire-and-forget).
    resp = client.post("/eventos", json={"tipo": "sin_ruta_mostrado"})
    assert resp.status_code == 201


def test_asesor_publico_responde_en_modo_simulado_sin_cuenta():
    """Asesor conversacional PÚBLICO (julio 2026, decisión explícita del
    dueño: "cualquier persona sin registrarse lo pueda usar") — responde
    en modo simulado (sin ninguna API key configurada en el entorno de
    test) SIN necesitar token ni cuenta de ningún tipo."""
    resp = client.post("/asesor", json={"pregunta": "¿qué es el REINFO?"})
    assert resp.status_code == 200
    respuesta = resp.json()["respuesta"]
    assert "REINFO" in respuesta  # el modo simulado repite la pregunta
    assert "simulado" in respuesta.lower()


def test_asesor_publico_rechaza_pregunta_vacia():
    resp = client.post("/asesor", json={"pregunta": "   "})
    assert resp.status_code == 422


def test_asesor_publico_respeta_el_limite_por_ip():
    import security

    # El límite es en memoria por proceso, keyed por IP — TestClient usa
    # siempre la misma IP ("testclient"), así que se limpia para no
    # arrastrar conteo de otros tests que también llamen a /asesor.
    security._preguntas_asesor_por_ip.clear()

    tope_original = security.MAX_PREGUNTAS_ASESOR_HORA
    security.MAX_PREGUNTAS_ASESOR_HORA = 2
    try:
        for _ in range(2):
            resp = client.post("/asesor", json={"pregunta": "hola"})
            assert resp.status_code == 200
        resp = client.post("/asesor", json={"pregunta": "hola"})
        assert resp.status_code == 429
    finally:
        security.MAX_PREGUNTAS_ASESOR_HORA = tope_original


def test_asesor_publico_registra_evento_de_exito_en_el_dashboard():
    # Julio 2026, tras un incidente real (clave de API incompleta en Render
    # pasó desapercibida varios días): el dashboard admin debe reflejar si
    # el asesor está respondiendo bien HOY, sin que Esthiven tenga que
    # probarlo a mano.
    token = _admin_token()
    headers = {"Authorization": f"Bearer {token}"}
    antes = client.get("/admin/dashboard", headers=headers).json()["asesor_preguntas_hoy"]

    resp = client.post("/asesor", json={"pregunta": "¿qué es el REINFO?"})
    assert resp.status_code == 200

    dashboard = client.get("/admin/dashboard", headers=headers).json()
    assert dashboard["asesor_preguntas_hoy"] == antes + 1
    assert dashboard["asesor_ultimo_proveedor_ok"] == "simulado"


def test_asesor_publico_registra_evento_de_falla_en_el_dashboard(monkeypatch):
    # julio 2026: además del conteo, el dashboard debe decir QUÉ proveedor
    # falló y por qué — es lo que hubiera hecho falta para diagnosticar el
    # 503 de Gemini sin tener que probarlo en vivo desde la terminal.
    import asesor

    def _siempre_falla(system, historial):
        raise asesor.AsesorNoDisponible(
            "proveedor simulado caído para la prueba", proveedor="gemini"
        )

    monkeypatch.setattr(asesor, "generar_respuesta_con_proveedor", _siempre_falla)

    token = _admin_token()
    headers = {"Authorization": f"Bearer {token}"}
    antes = client.get("/admin/dashboard", headers=headers).json()["asesor_fallas_hoy"]

    resp = client.post("/asesor", json={"pregunta": "¿qué es el REINFO?"})
    assert resp.status_code == 503

    dashboard = client.get("/admin/dashboard", headers=headers).json()
    assert dashboard["asesor_fallas_hoy"] == antes + 1
    assert dashboard["asesor_ultima_falla"]["proveedor"] == "gemini"
    assert "proveedor simulado caído" in dashboard["asesor_ultima_falla"]["detalle"]


def test_subir_documento_asesor_md_queda_disponible_para_el_asesor():
    # julio 2026, pedido explícito: "imagina que ya no uso Claude Code" —
    # Esthiven debe poder nutrir al asesor subiendo un archivo desde
    # /admin, sin git. Fin a fin: sube un .md → el asesor lo encuentra.
    import asesor

    token = _admin_token()
    headers = {"Authorization": f"Bearer {token}"}

    contenido = b"El Decreto de Prueba XYZ regula el submarinismo minero en altura."
    resp = client.post(
        "/admin/asesor/documentos",
        headers=headers,
        files={"archivo": ("decreto_prueba_xyz.md", contenido, "text/markdown")},
        data={"categoria": "prueba"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["nombre"] == "decreto_prueba_xyz.md"
    assert data["categoria"] == "prueba"
    assert data["activo"] is True
    assert data["caracteres"] == len(contenido)
    documento_id = data["id"]

    # Aparece en el listado
    listado = client.get("/admin/asesor/documentos", headers=headers).json()
    assert any(d["id"] == documento_id for d in listado)

    # El asesor público lo encuentra (dispara actualizar_documentos_admin)
    resp_asesor = client.post("/asesor", json={"pregunta": "submarinismo minero en altura"})
    assert resp_asesor.status_code == 200
    extra = asesor._recuperar_fragmentos_relevantes("submarinismo minero en altura")
    assert "decreto prueba xyz" in extra  # etiqueta citable derivada del nombre del archivo
    assert "regula el submarinismo minero en altura" in extra

    # Desactivarlo lo saca de la búsqueda
    resp_desactivar = client.put(
        f"/admin/asesor/documentos/{documento_id}/activo",
        headers=headers,
        json={"activo": False},
    )
    assert resp_desactivar.status_code == 200
    client.post("/asesor", json={"pregunta": "submarinismo minero en altura"})  # refresca el índice
    extra_tras_desactivar = asesor._recuperar_fragmentos_relevantes("submarinismo minero en altura")
    assert "regula el submarinismo minero en altura" not in extra_tras_desactivar

    # Borrarlo lo quita del listado
    resp_borrar = client.delete(f"/admin/asesor/documentos/{documento_id}", headers=headers)
    assert resp_borrar.status_code == 204
    listado_tras_borrar = client.get("/admin/asesor/documentos", headers=headers).json()
    assert not any(d["id"] == documento_id for d in listado_tras_borrar)


def test_subir_documento_asesor_pdf_real_extrae_texto():
    import fitz

    doc = fitz.open()
    pagina = doc.new_page()
    pagina.insert_text((72, 72), "Contenido real de un PDF subido desde el panel admin.")
    contenido = doc.tobytes()
    doc.close()

    token = _admin_token()
    headers = {"Authorization": f"Bearer {token}"}
    resp = client.post(
        "/admin/asesor/documentos",
        headers=headers,
        files={"archivo": ("norma.pdf", contenido, "application/pdf")},
    )
    assert resp.status_code == 201
    assert resp.json()["caracteres"] > 0


def test_subir_documento_asesor_rechaza_extension_no_permitida():
    token = _admin_token()
    headers = {"Authorization": f"Bearer {token}"}
    resp = client.post(
        "/admin/asesor/documentos",
        headers=headers,
        files={"archivo": ("norma.docx", b"contenido cualquiera", "application/msword")},
    )
    assert resp.status_code == 422


def test_subir_documento_asesor_rechaza_pdf_sin_capa_de_texto():
    token = _admin_token()
    headers = {"Authorization": f"Bearer {token}"}
    resp = client.post(
        "/admin/asesor/documentos",
        headers=headers,
        # Firma real de PDF, pero no es un PDF parseable de verdad — igual
        # que un escaneo sin texto: extraer_texto_pdf_bytes devuelve "".
        files={"archivo": ("norma.pdf", b"%PDF-1.4\nno es un pdf de verdad", "application/pdf")},
    )
    assert resp.status_code == 422


def test_subir_documento_asesor_requiere_admin():
    resp = client.post(
        "/admin/asesor/documentos",
        files={"archivo": ("norma.md", b"contenido", "text/markdown")},
    )
    assert resp.status_code in (401, 403)


def test_avisenme_cuando_haya_notifica_al_activar_empresa_que_calza():
    """"Avísenme cuando haya" (julio 2026): antes el botón solo registraba
    al minero y no guardaba nada — nunca se le volvía a avisar. Ahora,
    activar una empresa que cubre su brecha pendiente en su región le crea
    una notificación real."""
    respuestas = dict(RESPUESTAS_COMPLETAS)
    respuestas["C2_1"] = "no_iniciado"  # brecha pendiente real: igafom_aprobado
    diag = client.post(
        "/diagnostico",
        json={"respuestas": respuestas, "region": "cusco", "mineral": "oro", "tipo_mina": "subterranea"},
    ).json()
    assert "igafom_aprobado" in diag["brechas"]
    client.post("/leads", json=_lead_payload(diag["id"], username="paraavisenme", region="cusco"))

    token = client.post(
        "/mineros/login", json={"username": "paraavisenme", "password": "clave123"}
    ).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    assert client.get("/mineros/notificaciones", headers=headers).json() == []

    admin_headers = {"Authorization": f"Bearer {_admin_token()}"}

    # Una empresa en OTRA región no debe notificar (no calza)
    client.post(
        "/admin/empresas",
        headers=admin_headers,
        json={
            "tipo": "empresa", "nombre": "Consultora Lejana SAC", "ruc": "20111111111",
            "anios_servicio": 5, "regiones_json": ["lima"],
            "estudios_json": ["igafom_aprobado"], "whatsapp": "+51900000001", "activa": True,
        },
    )
    assert client.get("/mineros/notificaciones", headers=headers).json() == []

    # Una empresa en SU región con SU estudio pendiente sí notifica
    resp = client.post(
        "/admin/empresas",
        headers=admin_headers,
        json={
            "tipo": "empresa", "nombre": "Consultora Cusco SAC", "ruc": "20222222222",
            "anios_servicio": 5, "regiones_json": ["cusco"],
            "estudios_json": ["igafom_aprobado"], "whatsapp": "+51900000002", "activa": True,
        },
    )
    assert resp.status_code == 201
    notifs = client.get("/mineros/notificaciones", headers=headers).json()
    assert len(notifs) == 1
    assert notifs[0]["tipo"] == "empresa_disponible"
    assert "Consultora Cusco SAC" in notifs[0]["mensaje"]

    # Activar por EDICIÓN (transición inactiva→activa) también notifica
    resp = client.post(
        "/admin/empresas",
        headers=admin_headers,
        json={
            "tipo": "empresa", "nombre": "Consultora Inactiva SAC", "ruc": "20333333333",
            "anios_servicio": 5, "regiones_json": ["cusco"],
            "estudios_json": ["igafom_aprobado"], "whatsapp": "+51900000003", "activa": False,
        },
    )
    empresa_id = resp.json()["id"]
    assert client.get("/mineros/notificaciones", headers=headers).json() == notifs  # sin cambios

    client.put(
        f"/admin/empresas/{empresa_id}",
        headers=admin_headers,
        json={
            "tipo": "empresa", "nombre": "Consultora Inactiva SAC", "ruc": "20333333333",
            "anios_servicio": 5, "regiones_json": ["cusco"],
            "estudios_json": ["igafom_aprobado"], "whatsapp": "+51900000003", "activa": True,
        },
    )
    assert len(client.get("/mineros/notificaciones", headers=headers).json()) == 2


def test_admin_leads_pagina_y_expone_el_total():
    # Paginación (julio 2026): el panel pide de a `limit` leads con
    # `offset`, y el total real viaja en el header X-Total-Count para
    # pintar las páginas — antes se cargaban TODOS los leads (cada uno
    # recalcula su diagnóstico completo) en cada visita al panel.
    for n in range(3):
        diag = _crear_diagnostico().json()
        client.post(
            "/leads",
            json=_lead_payload(
                diag["id"], username=f"paginado{n}", whatsapp=f"+5190000090{n}"
            ),
        )
    headers = {"Authorization": f"Bearer {_admin_token()}"}

    resp = client.get("/admin/leads?limit=2&offset=0", headers=headers)
    assert resp.status_code == 200
    assert resp.headers["X-Total-Count"] == "3"
    assert len(resp.json()) == 2

    resp = client.get("/admin/leads?limit=2&offset=2", headers=headers)
    assert len(resp.json()) == 1

    # Sin parámetros usa el default (50) — con 3 leads devuelve todo.
    resp = client.get("/admin/leads", headers=headers)
    assert len(resp.json()) == 3


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


def test_admin_elimina_lead_borra_tambien_sus_notificaciones():
    # Regresión: Notificacion.lead_id es FK NOT NULL — Postgres (producción)
    # rechaza borrar el lead si le quedan notificaciones huérfanas (SQLite
    # local no lo hace cumplir por defecto, por eso el bug no se vio en
    # tests hasta que se agregó este caso explícito).
    token = _admin_token()
    headers = {"Authorization": f"Bearer {token}"}
    _operacion_id, minero_headers, _codigos = _minero_con_estudios("connotificaciones")
    doc = client.post(
        "/mineros/documentos",
        headers=minero_headers,
        data={"categoria": "fotos_mina"},
        files={"archivo": ("a.jpg", b"\xff\xd8\xffcontenido", "image/jpeg")},
    ).json()
    client.put(
        f"/admin/documentos/{doc['id']}/revision",
        json={"estado_revision": "rechazado", "motivo_rechazo": "Prueba"},
        headers=headers,
    )
    resp = client.get("/mineros/notificaciones", headers=minero_headers)
    assert len(resp.json()) > 0

    resp = client.get("/admin/leads", headers=headers)
    lead_id = next(
        l["id"] for l in resp.json() if l["operacion_id"] == _operacion_id
    )
    resp = client.delete(f"/admin/leads/{lead_id}", headers=headers)
    assert resp.status_code == 204


def test_admin_elimina_lead_borra_tambien_intereses_empresa():
    # Regresión: InteresEmpresa.operacion_id es FK NOT NULL — nunca se
    # borraba junto con el lead (bug preexistente, no de esta sesión).
    token = _admin_token()
    headers = {"Authorization": f"Bearer {token}"}
    empresa = _crear_empresa(token, nombre="Empresa Interes SAC", ruc="20777777777")
    diag = _crear_diagnostico().json()
    lead = client.post(
        "/leads", json=_lead_payload(diag["id"], username="conintereseempresa")
    ).json()
    resp = client.post(
        f"/empresas/{empresa['id']}/interes",
        json={
            "operacion_id": diag["id"],
            "nombre": "Juan Quispe",
            "whatsapp": "+51987654321",
        },
    )
    assert resp.status_code == 201

    resp = client.delete(f"/admin/leads/{lead['id']}", headers=headers)
    assert resp.status_code == 204


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
        "whatsapp": "+51987654321",
        "email": "juana.perez@example.com",
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


def test_postular_consultor_requiere_email_valido():
    # El email es obligatorio desde julio 2026 (los años de experiencia ya
    # no se preguntan — se evalúan con el CV).
    resp = client.post(
        "/consultores/postular",
        data={k: v for k, v in _campos_postulacion().items() if k != "email"},
        files={"cv": ("cv.pdf", PDF_DE_PRUEBA, "application/pdf")},
    )
    assert resp.status_code == 422

    resp = _postular(email="no-es-un-email")
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
    operacion_id = client.get("/mineros/me", headers=headers).json()["operacion_id"]
    _hacer_apto_inversionistas(operacion_id, "minerogenerado")

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


def test_proyectos_ya_no_expone_scores_0_100():
    # Spec julio 2026: los semáforos + Índice de Madurez reemplazaron al
    # MineScore/Score de Atractivo viejos. La cartera renovada SÍ lleva los
    # scores NUEVOS por track (score_formalizacion/score_inversion, anclados
    # a la etapa del pipeline) — lo prohibido es que vuelva el modelo viejo
    # (dimensiones con puntaje, score único sin etapa).
    diag = _crear_diagnostico().json()
    client.post(
        "/leads",
        json=_lead_payload(diag["id"], username="scoreinversion", nombre_operacion="Mina Score"),
    )
    _hacer_apto_inversionistas(diag["id"], "scoreinversion")

    proyectos = client.get("/proyectos").json()
    assert len(proyectos) == 1
    proyecto = proyectos[0]
    assert isinstance(proyecto["score_formalizacion"], int)
    assert isinstance(proyecto["score_inversion"], int)
    assert proyecto["semaforo_legal"] == "verde"
    assert proyecto["semaforo_tecnico"] is None  # Módulo INV en pausa
    assert proyecto["indice_madurez"] is None

    detalle = client.get(f"/proyectos/{proyecto['operacion_id']}").json()
    assert detalle["semaforo_legal"] == "verde"
    assert detalle["dimensiones_inversion"] == {}
    # Ficha renovada: las respuestas de DECISIÓN del Módulo INV son
    # públicas (estructura legal, % a ceder, deudas...), pero el historial
    # de negociaciones y los bloques por perfil quedan privados.
    publicas = detalle["respuestas_inversion_publicas"]
    assert publicas["INV_0_9"] == "persona_natural"
    assert publicas["INV_0_10"] == "20_40"
    assert publicas["INV_0_11"] == "sin_deudas"
    assert "INV_0_6" not in publicas
    assert "INV_C2" not in publicas
    # El checklist público solo lista los estudios del perfil, no el
    # catálogo completo (los legacy sin pregunta, ej. sctr, ya no salen).
    assert "igafom_aprobado" in detalle["estudios_aplicables"]
    assert "sctr" not in detalle["estudios_aplicables"]
    # GEOCATMIN/REINFO desactivados en tests (sin red): los campos existen
    # y son None.
    assert detalle["geocatmin"] is None
    assert detalle["reinfo"] is None


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
            "estado_formalizacion": "formal",
            "experiencia_operador": "5-10 años",
            "capacitacion_operador": "cip",
            "monto_requerido": "S/. 200,000 - 1,000,000",
        },
    ).json()
    client.post(
        "/leads",
        json=_lead_payload(diag["id"], username="perfilexpuesto", nombre_operacion="Mina Perfil"),
    )
    _hacer_apto_inversionistas(diag["id"], "perfilexpuesto")

    detalle = client.get(f"/proyectos/{diag['id']}").json()
    assert detalle["experiencia_operador"] == "5-10 años"
    assert detalle["capacitacion_operador"] == "cip"
    assert detalle["monto_requerido"] == "S/. 200,000 - 1,000,000"


def test_proyectos_check_publico_requiere_foto_de_respaldo():
    # El diagnóstico es autodeclarado: responder "sí" no basta para que la
    # ficha pública muestre check ✓. Solo cuenta como verificado si además
    # hay una foto de respaldo subida para ese estudio.
    # Usamos perfil B con documentos pendientes para tener brechas reales.
    respuestas_b = dict(RESPUESTAS_SIN_TRAMITE)
    respuestas_b["B1_1"] = "debo_1"
    respuestas_b["B1_4"] = "privado"
    respuestas_b["B1_5"] = "no"
    diag = client.post(
        "/diagnostico",
        json={
            "respuestas": respuestas_b,
            "region": "arequipa",
            "mineral": "oro",
            "tipo_mina": "subterranea",
        },
    ).json()
    # Crear lead + login para el diagnóstico con brechas
    client.post(
        "/leads",
        json=_lead_payload(diag["id"], username="checkphoto1", nombre_operacion="Mina Check", password="clave123"),
    )
    token_resp = client.post(
        "/mineros/login", json={"username": "checkphoto1", "password": "clave123"}
    )
    token = token_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    admin_headers = {"Authorization": f"Bearer {_admin_token()}"}
    # Apto para inversionistas (semáforo no rojo con "debo_1") SIN resolver
    # la brecha de abajo — _hacer_apto_inversionistas solo sube documentos
    # para lo que el minero declaró SÍ tener (estudios_aplicables), nunca
    # toca las brechas (lo que declaró NO tener), así que la brecha sigue
    # pendiente para poder probar el check público.
    _hacer_apto_inversionistas(diag["id"], "checkphoto1", respuestas_inv=RESPUESTAS_INV_B)

    detalle = client.get(f"/proyectos/{diag['id']}").json()
    assert len(detalle["brechas_pendientes"]) > 0
    primera_brecha = detalle["brechas_pendientes"][0]
    assert primera_brecha not in detalle["brechas_verificadas"]

    # Marcar resuelta por el admin SIN foto → tampoco cuenta como
    # verificada (el check público siempre exige el respaldo).
    client.put(
        f"/admin/operaciones/{diag['id']}/brechas-resueltas",
        json={"brechas_resueltas": [primera_brecha]},
        headers=admin_headers,
    )
    detalle_resuelta_sin_foto = client.get(f"/proyectos/{diag['id']}").json()
    assert primera_brecha not in detalle_resuelta_sin_foto["brechas_verificadas"]
    client.put(
        f"/admin/operaciones/{diag['id']}/brechas-resueltas",
        json={"brechas_resueltas": []},
        headers=admin_headers,
    )

    # Subir la foto de respaldo la AUTO-RESUELVE (julio 2026) — deja de ser
    # brecha pendiente — pero "verificada" (sello público "Con respaldo")
    # ahora exige ADEMÁS que Esthiven la apruebe (pedido explícito,
    # julio 2026): antes de aprobar, sigue sin contar como verificada.
    doc = client.post(
        "/mineros/documentos",
        headers=headers,
        data={"categoria": primera_brecha},
        files={"archivo": ("foto.jpg", b"\xff\xd8\xffcontenido", "image/jpeg")},
    ).json()
    detalle_sin_aprobar = client.get(f"/proyectos/{diag['id']}").json()
    assert primera_brecha not in detalle_sin_aprobar["brechas_verificadas"]
    assert len(detalle_sin_aprobar["documentos_estudios"].get(primera_brecha, [])) == 1
    assert detalle_sin_aprobar["documentos_estudios"][primera_brecha][0]["aprobado"] is False

    client.put(
        f"/admin/documentos/{doc['id']}/revision",
        json={"estado_revision": "aprobado"},
        headers=admin_headers,
    )
    detalle_con_foto = client.get(f"/proyectos/{diag['id']}").json()
    assert primera_brecha in detalle_con_foto["brechas_verificadas"]
    assert len(detalle_con_foto["documentos_estudios"].get(primera_brecha, [])) == 1
    assert detalle_con_foto["documentos_estudios"][primera_brecha][0]["aprobado"] is True


def test_proyectos_check_publico_acepta_categoria_equivalente():
    # Varios estudios piden, en la práctica, la MISMA foto que un documento
    # legal fijo (ver uploads_config.categoria_equivalente) — subir la
    # categoría equivalente también debe verificar el estudio.
    respuestas_b = dict(RESPUESTAS_SIN_TRAMITE)
    respuestas_b["B1_1"] = "debo_1"
    respuestas_b["B1_4"] = "privado"
    respuestas_b["B1_5"] = "no"
    diag = client.post(
        "/diagnostico",
        json={
            "respuestas": respuestas_b,
            "region": "arequipa",
            "mineral": "oro",
            "tipo_mina": "subterranea",
        },
    ).json()
    client.post(
        "/leads",
        json=_lead_payload(diag["id"], username="minerocheckequiv", nombre_operacion="Mina Equiv", password="clave123"),
    )
    token_resp = client.post(
        "/mineros/login", json={"username": "minerocheckequiv", "password": "clave123"}
    )
    token = token_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    admin_headers = {"Authorization": f"Bearer {_admin_token()}"}
    _hacer_apto_inversionistas(diag["id"], "minerocheckequiv", respuestas_inv=RESPUESTAS_INV_B)

    detalle_inicial = client.get(f"/proyectos/{diag['id']}").json()
    assert len(detalle_inicial["brechas_pendientes"]) > 0

    # Marcar la primera brecha como resuelta + subir foto
    primera_brecha = detalle_inicial["brechas_pendientes"][0]
    client.put(
        f"/admin/operaciones/{diag['id']}/brechas-resueltas",
        json={"brechas_resueltas": [primera_brecha]},
        headers=admin_headers,
    )
    doc = client.post(
        "/mineros/documentos",
        headers=headers,
        data={"categoria": primera_brecha},
        files={"archivo": (f"{primera_brecha}.jpg", b"\xff\xd8\xffcontenido", "image/jpeg")},
    ).json()
    # "Con respaldo" exige aprobación de Esthiven (julio 2026).
    client.put(
        f"/admin/documentos/{doc['id']}/revision",
        json={"estado_revision": "aprobado"},
        headers=admin_headers,
    )

    detalle_final = client.get(f"/proyectos/{diag['id']}").json()
    assert primera_brecha in detalle_final["brechas_verificadas"]
    assert len(detalle_final["documentos_estudios"].get(primera_brecha, [])) == 1


def test_mineros_me_ya_no_ofrece_fotos_perfil_pausadas():
    # ⏸️ EN PAUSA (julio 2026, a pedido de Esthiven): las "fotos sueltas"
    # (mineral/acceso/agua/energía) ya no se ofrecen a nadie —
    # fotos_presentacion las reemplaza. El upload directo a esas categorías
    # sigue aceptándose (fotos ya subidas por mineros anteriores no se
    # rompen), solo se dejó de sugerir el slot.
    diag = client.post(
        "/diagnostico",
        json={
            "respuestas": RESPUESTAS_COMPLETAS,
            "region": "arequipa",
            "mineral": "cobre",
            "tipo_mina": "subterranea",
            "situacion": "minero_artesanal",
            "acceso_logistico": "trocha",
            "acceso_agua": "limitado",
            "acceso_energia": "generador_diesel",
        },
    ).json()
    token = client.post(
        "/leads",
        json=_lead_payload(diag["id"], username="minerofotoperfil", nombre_operacion="Mina Foto"),
    )
    token = client.post(
        "/mineros/login", json={"username": "minerofotoperfil", "password": "clave123"}
    ).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.get("/mineros/me", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["fotos_perfil"] == []

    # El upload directo a esas categorías sigue aceptándose (backward compat).
    resp = client.post(
        "/mineros/documentos",
        headers=headers,
        data={"categoria": "foto_mineral"},
        files={"archivo": ("mineral.jpg", b"\xff\xd8\xffcontenido", "image/jpeg")},
    )
    assert resp.status_code == 201


def test_mineros_fotos_perfil_no_aplican_a_concesionario():
    diag = client.post(
        "/diagnostico",
        json={
            "respuestas": RESPUESTAS_CONCESIONARIO,
            "region": "arequipa",
            "mineral": "oro",
            "tipo_mina": "subterranea",
            "situacion": "concesionario",
        },
    ).json()
    token = client.post(
        "/leads",
        json=_lead_payload(diag["id"], username="minerofotoperfil2", nombre_operacion="Concesion Foto"),
    )
    token = client.post(
        "/mineros/login", json={"username": "minerofotoperfil2", "password": "clave123"}
    ).json()["access_token"]

    resp = client.get("/mineros/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["fotos_perfil"] == []


def test_mineros_me_expone_es_titular_concesion():
    # El Módulo 0 lo responde directo: M0_1=concesion_propia → titular.
    token = _token_minero(username="mineroTitular")
    resp = client.get("/mineros/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["es_titular_concesion"] is True

    # Quien opera en concesión ajena (C1_3=contrato) → False.
    respuestas_contrato = dict(RESPUESTAS_COMPLETAS)
    respuestas_contrato["C1_3"] = "contrato"
    respuestas_contrato["C2_7"] = "aprobado"
    respuestas_contrato["C3_1"] = "firmado_inscrito"
    respuestas_contrato.pop("C2_3")  # no aplica a contrato
    diag = client.post(
        "/diagnostico",
        json={
            "respuestas": respuestas_contrato,
            "region": "arequipa",
            "mineral": "oro",
            "tipo_mina": "subterranea",
        },
    ).json()
    client.post(
        "/leads",
        json=_lead_payload(
            diag["id"], username="mineroNoTitular", whatsapp="+51987000444"
        ),
    )
    token2 = client.post(
        "/mineros/login", json={"username": "mineroNoTitular", "password": "clave123"}
    ).json()["access_token"]
    resp2 = client.get("/mineros/me", headers={"Authorization": f"Bearer {token2}"})
    assert resp2.json()["es_titular_concesion"] is False


def test_proyectos_detalle_expone_titularidad_y_fotos_de_perfil():
    # La ficha pública debe ser consistente con lo que el minero declara en
    # su propia cuenta: mismo filtro de titularidad, y las fotos de
    # mineral/acceso/agua/energía (no solo fotos_mina) deben verse.
    diag = client.post(
        "/diagnostico",
        json={
            "respuestas": RESPUESTAS_COMPLETAS,
            "region": "arequipa",
            "mineral": "cobre",
            "tipo_mina": "subterranea",
            "situacion": "minero_artesanal",
            "acceso_logistico": "trocha",
            "acceso_agua": "limitado",
            "acceso_energia": "generador_diesel",
        },
    ).json()
    client.post(
        "/leads",
        json=_lead_payload(diag["id"], username="mineroproyectofotos", nombre_operacion="Mina Foto Pub"),
    )
    token = client.post(
        "/mineros/login", json={"username": "mineroproyectofotos", "password": "clave123"}
    ).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    resp_subida = client.post(
        "/mineros/documentos",
        headers=headers,
        data={"categoria": "foto_mineral"},
        files={"archivo": ("mineral.jpg", b"\xff\xd8\xffcontenido", "image/jpeg")},
    )
    assert resp_subida.status_code == 201
    _hacer_apto_inversionistas(diag["id"], "mineroproyectofotos")

    detalle = client.get(f"/proyectos/{diag['id']}").json()
    assert detalle["es_titular_concesion"] is True  # M0_1=concesion_propia
    assert len(detalle["fotos"]) == 1

    resp_foto = client.get(detalle["fotos"][0]["url"])
    assert resp_foto.status_code == 200


def test_diagnostico_guarda_y_expone_moneda_capital():
    diag = client.post(
        "/diagnostico",
        json={
            "respuestas": RESPUESTAS_COMPLETAS,
            "region": "arequipa",
            "mineral": "oro",
            "tipo_mina": "subterranea",
            "moneda_capital": "dolares",
            "monto_requerido": "USD 55,000 - 270,000",
        },
    ).json()
    client.post(
        "/leads",
        json=_lead_payload(diag["id"], username="mineromoneda", nombre_operacion="Mina Moneda"),
    )
    _hacer_apto_inversionistas(diag["id"], "mineromoneda")

    detalle = client.get(f"/proyectos/{diag['id']}").json()
    assert detalle["moneda_capital"] == "dolares"
    assert detalle["monto_requerido"] == "USD 55,000 - 270,000"

    token = client.post(
        "/mineros/login", json={"username": "mineromoneda", "password": "clave123"}
    ).json()["access_token"]
    perfil = client.get("/mineros/me", headers={"Authorization": f"Bearer {token}"}).json()
    assert perfil["moneda_capital"] == "dolares"


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
    _hacer_apto_inversionistas(diag["id"], "especiemineral")

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


def test_perfil_carga_aunque_exista_cache_geocatmin():
    # Regresión (julio 2026): la ficha pública cachea GEOCATMIN como clave
    # interna "_geocatmin" (un dict ANIDADO) dentro de
    # datos_formalizacion_json — /mineros/me declara ese campo como
    # dict[str, str] y sin filtro la validación revienta con 500 ("no
    # cargan mis datos"). Las claves con "_" nunca deben salir al perfil.
    diag = _crear_diagnostico().json()
    client.post("/leads", json=_lead_payload(diag["id"], username="congeocache"))

    db = TestingSessionLocal()
    op = db.query(models.Operacion).filter(models.Operacion.id == diag["id"]).first()
    op.datos_formalizacion_json = {
        "autorizacion_drem": "2024-04-10",
        "_geocatmin": {"coords": "-11.9,-77.0", "concesion": None, "geologia": None},
    }
    db.commit()
    db.close()

    token = client.post(
        "/mineros/login", json={"username": "congeocache", "password": "clave123"}
    ).json()["access_token"]
    resp = client.get("/mineros/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200, resp.text
    datos = resp.json()["datos_formalizacion"]
    assert datos["autorizacion_drem"] == "2024-04-10"
    assert "_geocatmin" not in datos


def test_extraccion_de_coordenadas_de_enlaces_maps():
    from geoubicacion import _extraer

    assert _extraer("https://www.google.com/maps/place/Mina/@-12.52,-76.71,15z") == "-12.52,-76.71"
    assert _extraer("https://google.com/maps?q=-11.1,-75.2") == "-11.1,-75.2"
    assert _extraer("https://maps.google.com/algo!3d-12.5!4d-76.7!") == "-12.5,-76.7"
    assert _extraer("https://maps.app.goo.gl/corto") is None
    # Formato nuevo de los enlaces cortos de la app (2026): coordenadas en
    # la RUTA /maps/search/lat,+lng — antes de soportarlo, el enlace del
    # minero quedaba guardado sin mapa (caso real, julio 2026).
    assert (
        _extraer("https://www.google.com/maps/search/-11.965602,+-77.094409?entry=tts")
        == "-11.965602,-77.094409"
    )
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
    operacion_id = client.get("/mineros/me", headers=headers).json()["operacion_id"]
    _hacer_apto_inversionistas(operacion_id, "minerofoto")

    proyectos = client.get("/proyectos").json()
    assert proyectos[0]["foto_portada_url"] is not None
    assert "/fotos/" in proyectos[0]["foto_portada_url"]


def test_proyectos_lista_usa_fotos_presentacion_como_portada():
    # Julio 2026: fotos_mina es una categoría a la que ya nadie sube desde
    # la cuenta actual — fotos_presentacion es la que sí se usa hoy (Módulo
    # INV). Antes de este fix, este minero nunca tenía portada aunque sí
    # hubiera subido fotos.
    token = _token_minero(username="minerofotopresentacionportada")
    headers = {"Authorization": f"Bearer {token}"}
    client.post(
        "/mineros/documentos",
        data={"categoria": "fotos_presentacion"},
        files={"archivo": ("presentacion.jpg", b"\xff\xd8\xfffoto de presentacion", "image/jpeg")},
        headers=headers,
    )
    operacion_id = client.get("/mineros/me", headers=headers).json()["operacion_id"]
    _hacer_apto_inversionistas(operacion_id, "minerofotopresentacionportada")

    proyectos = client.get("/proyectos").json()
    proyecto = next(p for p in proyectos if p["operacion_id"] == operacion_id)
    assert proyecto["foto_portada_url"] is not None
    assert "/fotos/" in proyecto["foto_portada_url"]


def test_proyectos_lista_prioriza_fotos_presentacion_sobre_otra_categoria_mas_antigua():
    # fotos_presentacion es la categoría pensada para "mostrar tu proyecto"
    # — debe ganar como portada aunque se haya subido después que otra foto
    # de galería.
    token = _token_minero(username="minerofotoprioridad")
    headers = {"Authorization": f"Bearer {token}"}
    client.post(
        "/mineros/documentos",
        data={"categoria": "muestreo_propio"},
        files={"archivo": ("muestreo.jpg", b"\xff\xd8\xfffoto muestreo", "image/jpeg")},
        headers=headers,
    )
    client.post(
        "/mineros/documentos",
        data={"categoria": "fotos_presentacion"},
        files={"archivo": ("presentacion.jpg", b"\xff\xd8\xfffoto presentacion", "image/jpeg")},
        headers=headers,
    )
    operacion_id = client.get("/mineros/me", headers=headers).json()["operacion_id"]
    _hacer_apto_inversionistas(operacion_id, "minerofotoprioridad")

    db = TestingSessionLocal()
    try:
        foto_presentacion = (
            db.query(models.DocumentoOperacion)
            .filter(
                models.DocumentoOperacion.operacion_id == operacion_id,
                models.DocumentoOperacion.categoria == "fotos_presentacion",
            )
            .first()
        )
    finally:
        db.close()

    proyectos = client.get("/proyectos").json()
    proyecto = next(p for p in proyectos if p["operacion_id"] == operacion_id)
    assert proyecto["foto_portada_url"] == f"/proyectos/{operacion_id}/fotos/{foto_presentacion.id}"


def test_maximo_fotos_de_presentacion():
    # Julio 2026: sin mínimo, máximo 5 — es una vitrina, no un álbum.
    from uploads_config import FOTOS_PRESENTACION_MAXIMO

    token = _token_minero(username="minerofotospresentacion")
    headers = {"Authorization": f"Bearer {token}"}

    for i in range(FOTOS_PRESENTACION_MAXIMO):
        resp = client.post(
            "/mineros/documentos",
            data={"categoria": "fotos_presentacion"},
            files={"archivo": (f"p{i}.jpg", b"\xff\xd8\xfffoto", "image/jpeg")},
            headers=headers,
        )
        assert resp.status_code == 201

    resp = client.post(
        "/mineros/documentos",
        data={"categoria": "fotos_presentacion"},
        files={"archivo": ("p6.jpg", b"\xff\xd8\xfffoto", "image/jpeg")},
        headers=headers,
    )
    assert resp.status_code == 422
    assert "máximo" in resp.json()["detail"].lower()


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


def test_importar_csv_sin_ruc_ni_colegiatura_crea_inactivas():
    """Import masivo (julio 2026): una fuente tipo scraping no trae RUC ni
    colegiatura — la fila entra igual pero nace INACTIVA (no visible al
    público hasta que el admin la revise). Regresión doble: (1) el import no
    debe rechazarlas, (2) el listado del admin no debe romperse al LEER una
    empresa sin RUC (EmpresaOut no hereda esa exigencia)."""
    token = _admin_token()
    headers = {"Authorization": f"Bearer {token}"}

    csv_contenido = (
        "tipo,nombre,ruc,colegiatura,anios_servicio,regiones,estudios,whatsapp,email,rating,num_resenas\n"
        "empresa,Scrapeada Sin Ruc,,,0,lima,tramite_reinfo,+51911224466,,4.1,10\n"
        "consultor,Abogado Sin CIP,,,0,lima,tramite_reinfo,+51911224477,,,\n"
    )
    resp = client.post(
        "/admin/empresas/importar",
        headers=headers,
        files={"archivo": ("scraping.csv", csv_contenido.encode(), "text/csv")},
    )
    assert resp.status_code == 200
    r = resp.json()
    assert r["creadas"] == 2
    assert r["errores"] == []

    # El listado del admin las muestra (inactivas) sin explotar
    empresas = client.get("/admin/empresas", headers=headers).json()
    scrapeada = [e for e in empresas if e["nombre"] == "Scrapeada Sin Ruc"][0]
    assert scrapeada["activa"] is False
    assert scrapeada["ruc"] is None

    # El alta manual del admin sigue exigiendo RUC (la relajación es SOLO
    # para el import masivo)
    resp = client.post(
        "/admin/empresas",
        headers=headers,
        json={
            "tipo": "empresa",
            "nombre": "Manual Sin Ruc SAC",
            "anios_servicio": 3,
            "regiones_json": ["lima"],
            "estudios_json": ["tramite_reinfo"],
            "whatsapp": "+51999888666",
        },
    )
    assert resp.status_code == 422


def test_importar_csv_formato_scraping_google_maps():
    """El importador acepta el CSV del scraper TAL CUAL (julio 2026):
    detecta el formato por los encabezados (name/address/phone...) y lo
    convierte solo — tipo por categoría (Abogado→consultor), estudio
    provisional por block, y el contexto (web, teléfono, dirección,
    categoría, keyword) guardado en sus columnas nuevas."""
    token = _admin_token()
    headers = {"Authorization": f"Bearer {token}"}

    csv_contenido = (
        "name,address,phone,website,rating,reviews_count,category,city_searched,"
        "distrito,departamento,region,keyword,block,verified,source\n"
        'Estudio Scraping Legal,"Av. Prueba 123, Lima",+51911335577,https://ejemplo.pe/,'
        "4.4,80.0,Asesor,Lima,Lima,Lima,Centro,tramites mineros,LEGAL,False,google_places_api\n"
        'Geólogo Scraping,"Jr. Test 456, Cusco",911335588,,5.0,3.0,Abogado,Cusco,'
        "Cusco,Cusco,Sur,geologia minera,GEOLOGICO,False,google_places_api\n"
        # Sin teléfono: debe reportarse como error sin frenar el resto
        'Sin Telefono SAC,"Av. X 1, Lima",,,4.0,1.0,,Lima,Lima,Lima,Centro,x,LEGAL,False,api\n'
    )
    resp = client.post(
        "/admin/empresas/importar",
        headers=headers,
        files={"archivo": ("providers.csv", csv_contenido.encode("utf-8-sig"), "text/csv")},
    )
    assert resp.status_code == 200
    r = resp.json()
    assert r["creadas"] == 2
    assert len(r["errores"]) == 1  # la fila sin teléfono

    empresas = client.get("/admin/empresas", headers=headers).json()
    legal = [e for e in empresas if e["nombre"] == "Estudio Scraping Legal"][0]
    assert legal["tipo"] == "empresa"
    assert legal["activa"] is False
    assert legal["estudios_json"] == ["tramite_reinfo"]
    assert legal["regiones_json"] == ["lima"]
    assert legal["whatsapp"] == "+51911335577"
    assert legal["web"] == "https://ejemplo.pe/"
    assert legal["telefono"] == "+51911335577"
    assert legal["direccion"] == "Av. Prueba 123, Lima"
    assert legal["categoria"] == "Asesor"
    assert legal["keyword"] == "tramites mineros"
    assert legal["rating"] == 4.4
    assert legal["num_resenas"] == 80

    geo = [e for e in empresas if e["nombre"] == "Geólogo Scraping"][0]
    assert geo["tipo"] == "consultor"  # categoría Abogado
    assert geo["estudios_json"] == ["informe_geologico"]  # block GEOLOGICO
    assert geo["regiones_json"] == ["cusco"]
    assert geo["whatsapp"] == "+51911335588"  # se le antepone +51 solo


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


# Ruta 2 (concesionario): en el nuevo sistema, el perfil se determina por
# M0_1 (concesion_no_operando = perfil B). La situación "concesionario"
# es solo metadata, no afecta el routing.
RESPUESTAS_CONCESIONARIO = dict(RESPUESTAS_SIN_TRAMITE)


def test_diagnostico_concesionario_es_perfil_b():
    resp = client.post(
        "/diagnostico",
        json={
            "respuestas": dict(RESPUESTAS_CONCESIONARIO),
            "region": "arequipa",
            "mineral": "oro",
            "tipo_mina": "subterranea",
            "situacion": "concesionario",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["perfil"] == "B"
    assert body["brechas"] == []
    assert body["apto_inversionistas"] is True


def test_diagnostico_ids_extra_rechaza():
    respuestas = dict(RESPUESTAS_SIN_TRAMITE)
    respuestas["L6"] = "si"  # L6 no existe en el nuevo catálogo
    resp = client.post(
        "/diagnostico",
        json={
            "respuestas": respuestas,
            "region": "arequipa",
            "mineral": "oro",
            "tipo_mina": "subterranea",
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
            "respuestas": dict(RESPUESTAS_CONCESIONARIO),
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


def test_diagnostico_perfil_a_guarda_sustancias_toxicas():
    # Perfil A con sustancias_toxicas en el request
    respuestas = {
        "M0_1": "nada",
        "A1_1": "si", "A1_2": "si", "A1_3": "si",
        "A2_1": "ninguna", "A2_2": "no",
        "A3_1": "mio", "A4_1": "completo", "A5_1": "manual", "A5_2": "oro",
    }
    resp = client.post(
        "/diagnostico",
        json={
            "respuestas": respuestas,
            "region": "arequipa",
            "mineral": "oro",
            "tipo_mina": "subterranea",
            "sustancias_toxicas": "mercurio",
        },
    )
    assert resp.status_code == 200
    assert resp.json()["perfil"] == "A"


def test_diagnostico_situacion_yacimiento_ya_no_existe():
    # Se descartó esta opción: el producto es solo para quien ya tiene
    # una operación o una concesión
    respuestas = {
        "M0_1": "nada",
        "A1_1": "si", "A1_2": "si", "A1_3": "si",
        "A2_1": "ninguna", "A2_2": "no",
        "A3_1": "mio", "A4_1": "completo", "A5_1": "manual", "A5_2": "cobre",
    }
    resp = client.post(
        "/diagnostico",
        json={
            "respuestas": respuestas,
            "region": "puno",
            "mineral": "cobre",
            "tipo_mina": "tajo_abierto",
            "situacion": "yacimiento",
        },
    )
    assert resp.status_code == 422  # yacimiento is no longer a valid situacion
