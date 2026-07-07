"""Remapea estudios_json de las empresas/consultores existentes del
catálogo viejo (22 preguntas / 5 dimensiones con Laboral) al catálogo
nuevo (context/criterios_score.md, julio 2026). Las etiquetas sin
equivalente directo (ligadas a la dimensión Laboral, ahora eliminada) se
descartan.

Uso (desde backend/, con el servidor detenido):
    python -m seeds.remapear_estudios
"""
import json

import models
from database import SessionLocal

MAPA_VIEJO_A_NUEVO = {
    "tramite_reinfo": "tramite_reinfo",
    "levantamiento_georreferenciado": "levantamiento_georreferenciado",
    "contrato_explotacion": "contrato_explotacion",
    "tramite_sunat": "tramite_sunat",
    "igafom_correctivo": "igafom_correctivo",
    "igafom_preventivo": "igafom_preventivo",
    "informe_geologico": "informe_geologico",
    "muestreo_ley": "analisis_laboratorio",
    "planos_geologicos": "planos_geologicos",
    "sctr": "sctr",
    "estudio_ventilacion": "estudio_ventilacion",
    "evaluacion_geomecanica": "evaluacion_geomecanica",
    "plan_seguridad": "plan_seguridad",
    "profesional_ambiental": "aprobacion_instrumento_ambiental",
    # Sin equivalente (Laboral eliminada, u otras sin mapeo directo):
    # declaracion_rraa, planilla_mensual, regularizacion_laboral,
    # contratos_laborales, inspeccion_seguridad, declaracion_produccion
}

db = SessionLocal()
empresas = db.query(models.Empresa).all()
actualizadas = 0

for empresa in empresas:
    nuevos = sorted({
        MAPA_VIEJO_A_NUEVO[e] for e in empresa.estudios_json if e in MAPA_VIEJO_A_NUEVO
    })
    if nuevos != empresa.estudios_json:
        print(f"{empresa.nombre}: {empresa.estudios_json} -> {nuevos}")
        empresa.estudios_json = nuevos
        actualizadas += 1

db.commit()
db.close()
print(f"Listo: {actualizadas} empresa(s)/consultor(es) remapeados.")
