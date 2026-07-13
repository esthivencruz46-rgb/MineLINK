export interface InfoBrecha {
  texto: string;
  resuelve: string;
}

/** Brechas del catálogo nuevo (BRECHA_POR_PREGUNTA) + estudios legacy
 *  que siguen en el catálogo de empresas. Mantener sincronizado con
 *  backend/catalogo_diagnostico.py. */
export const INFO_BRECHA: Record<string, InfoBrecha> = {
  // --- Brechas del nuevo diagnóstico ---
  tramite_reinfo: {
    texto: "Iniciar/poner al día tu REINFO",
    resuelve: "Es la base para que tu proyecto pueda formalizarse.",
  },
  levantamiento_georreferenciado: {
    texto: "Medir tu labor con GPS (sinceramiento)",
    resuelve: "Reporta la ubicación real de tu labor ante el Estado.",
  },
  acreditacion_terreno: {
    texto: "Acreditar tu derecho sobre el terreno",
    resuelve: "Te da derecho legal para trabajar en esa zona.",
  },
  vigencia_concesion: {
    texto: "Renovar la vigencia de tu concesión",
    resuelve: "Una concesión vencida no te da derechos legales sobre la zona.",
  },
  declaracion_bienal_pma_ppm: {
    texto: "Declaración Bienal (clasificación PMA/PPM)",
    resuelve: "Acredita ante la autoridad minera regional tu condición de Pequeño Productor Minero (PPM) o Productor Minero Artesanal (PMA).",
  },
  // No es una brecha: es la credencial del perfil D (formal pleno) — se
  // usa como slot de "Respalda tu declaración" (ver scoring.estudios_aplicables).
  autorizacion_drem: {
    texto: "Autorización de inicio de actividades (DREM/GREM)",
    resuelve: "Es el documento que acredita que ya eres un minero formal.",
  },
  informe_geologico: {
    texto: "Informe geológico de tu veta",
    resuelve: "Certifica la estructura mineral de tu labor.",
  },
  analisis_laboratorio: {
    texto: "Análisis de laboratorio de tu mineral",
    resuelve: "Confirma cuánto mineral valioso tiene tu labor.",
  },
  instrumento_ambiental_dia_eia: {
    texto: "Tu instrumento ambiental (DIA o EIA-sd) aprobado",
    resuelve: "Es tu permiso ambiental para operar sin dañar el ambiente.",
  },
  licencia_agua_ana: {
    texto: "Licencia de uso de agua (ANA)",
    resuelve: "Necesitas permiso de la Autoridad Nacional del Agua para usar agua en tu operación.",
  },
  autorizacion_inicio_actividades: {
    texto: "Autorización de la DREM/GREM para iniciar actividades",
    resuelve: "La Dirección Regional de Energía y Minas debe autorizar tu inicio de operaciones.",
  },
  igafom_aprobado: {
    texto: "Tu plan ambiental (IGAFOM) aprobado y vigente",
    resuelve: "Ordena y valida ante la autoridad el impacto ambiental de tu labor.",
  },
  contrato_explotacion: {
    texto: "Contrato con el dueño de la concesión",
    resuelve: "Te da derecho legal a explotar esa zona.",
  },
  tramite_sunat: {
    texto: "Activar tu RUC minero",
    resuelve: "Habilita tu actividad minera ante SUNAT.",
  },
  dj_arqueologica: {
    texto: "Declaración jurada de restos arqueológicos",
    resuelve: "Declara que no hay restos arqueológicos en tu zona de trabajo.",
  },
  expediente_tecnico: {
    texto: "Expediente técnico aprobado",
    resuelve: "Describe cómo vas a operar tu mina de forma segura y ordenada.",
  },
  declaracion_produccion_semestral: {
    texto: "Declaración de producción semestral",
    resuelve: "Reporta tu producción cada 6 meses para mantener tu REINFO activo.",
  },
  puesta_en_produccion: {
    texto: "Poner tu operación en producción",
    resuelve: "Muestra que tu labor ya extrae mineral de forma activa.",
  },
  declaracion_anual_consolidada: {
    texto: "Declaración Anual Consolidada (DAC)",
    resuelve: "Reporte anual obligatorio de toda tu actividad minera.",
  },
  subsanacion_fiscalizacion: {
    texto: "Subsanar observaciones de fiscalización",
    resuelve: "Atender las observaciones o multas pendientes de la fiscalización.",
  },
  estimacion_recursos: {
    texto: "Estimación de tus recursos minerales",
    resuelve: "Calcula cuánto mineral aprovechable tienes disponible.",
  },
  costos_opex: {
    texto: "Documentar tus costos operativos (OPEX)",
    resuelve: "Registra todos los costos de operación mensuales para sustentar tu negocio.",
  },
  documentacion_operacion: {
    texto: "Documentar tu operación (fotos, reportes o estudios previos)",
    resuelve: "Respalda con evidencia lo que declaras — le da confianza a quien evalúa tu proyecto.",
  },
  // --- Estudios legacy (conservados en el catálogo de empresas) ---
  titularidad_concesion: {
    texto: "Ser titular de tu concesión",
    resuelve: "Te da derecho legal directo sobre la zona minera.",
  },
  iperc: {
    texto: "Identificación de peligros y riesgos (IPERC)",
    resuelve: "Detecta los riesgos de tu labor antes de que ocurra un accidente.",
  },
  sctr: {
    texto: "Seguro SCTR para tus trabajadores",
    resuelve: "Los protege ante accidentes o enfermedades del trabajo.",
  },
  plan_seguridad: {
    texto: "Plan de seguridad de tu labor",
    resuelve: "Protege a tu equipo con reglas claras y firmadas.",
  },
  evaluacion_geomecanica: {
    texto: "Revisar el sostenimiento de tu labor",
    resuelve: "Evita derrumbes en tus labores subterráneas.",
  },
  estudio_ventilacion: {
    texto: "Medir el aire de tus labores",
    resuelve: "Asegura aire respirable dentro de la mina (solo minería subterránea).",
  },
  instrumento_ambiental_vigente: {
    texto: "Renovar la vigencia de tu instrumento ambiental",
    resuelve: "Un instrumento ambiental aprobado hace tiempo también vence y hay que renovarlo.",
  },
  sin_clausura_ambiental: {
    texto: "Regularizar clausuras ambientales previas",
    resuelve: "Una clausura ambiental en los últimos 3 años pesa en tu historial de cumplimiento.",
  },
  plan_manejo_residuos: {
    texto: "Plan de manejo de mercurio, cianuro o relaves",
    resuelve: "Ordena cómo confinas, tratas o reúsas esas sustancias sin dañar el ambiente.",
  },
  muestreo_geoquimico: {
    texto: "Muestreo geoquímico de tu mineral",
    resuelve: "Identifica la composición química de tu yacimiento.",
  },
  planos_geologicos: {
    texto: "Planos de tu estructura mineralizada",
    resuelve: "Documenta gráficamente dónde está tu veta.",
  },
  levantamiento_topografico: {
    texto: "Topografía de tu labor",
    resuelve: "Mide y documenta la superficie real de tu terreno.",
  },
  gestion_conflictividad_social: {
    texto: "Gestionar la relación con comunidades cercanas",
    resuelve: "Reduce el riesgo de que una oposición social frene tu proyecto.",
  },
  elaboracion_petitorio: {
    texto: "Elaborar tu petitorio minero completo",
    resuelve: "Junta todos los documentos que INGEMMET necesita para darte tu concesión.",
  },
};
