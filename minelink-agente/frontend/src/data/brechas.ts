export interface InfoBrecha {
  texto: string;
  resuelve: string;
}

// Mapeo etiqueta → texto simple, copiado de skills/score-display/SKILL.md
export const INFO_BRECHA: Record<string, InfoBrecha> = {
  tramite_reinfo: {
    texto: "Iniciar/poner al día tu REINFO",
    resuelve: "Es la base para que tu proyecto pueda formalizarse.",
  },
  titularidad_concesion: {
    texto: "Ser titular de tu concesión",
    resuelve: "Te da derecho legal directo sobre la zona minera.",
  },
  contrato_explotacion: {
    texto: "Contrato con el dueño de la concesión",
    resuelve: "Te da derecho legal a explotar esa zona.",
  },
  tramite_sunat: {
    texto: "Activar tu RUC minero",
    resuelve: "Habilita tu actividad minera ante SUNAT.",
  },
  levantamiento_georreferenciado: {
    texto: "Medir tu labor con GPS (sinceramiento)",
    resuelve: "Reporta la ubicación real de tu labor ante el Estado.",
  },
  vigencia_concesion: {
    texto: "Renovar la vigencia de tu concesión",
    resuelve: "Una concesión vencida no te da derechos legales sobre la zona.",
  },
  igafom_aprobado: {
    texto: "Tu plan ambiental (IGAFOM) aprobado y vigente",
    resuelve: "Ordena y valida ante la autoridad el impacto ambiental de tu labor (Correctivo si ya operas, Preventivo si vas a operar).",
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
  puesta_en_produccion: {
    texto: "Poner tu operación en producción",
    resuelve: "Muestra que tu labor ya extrae mineral de forma activa.",
  },
  informe_geologico: {
    texto: "Informe geológico de tu veta",
    resuelve: "Certifica la estructura mineral de tu labor.",
  },
  muestreo_geoquimico: {
    texto: "Muestreo geoquímico de tu mineral",
    resuelve: "Identifica la composición química de tu yacimiento.",
  },
  analisis_laboratorio: {
    texto: "Análisis de laboratorio de tu mineral",
    resuelve: "Confirma cuánto mineral valioso tiene tu labor.",
  },
  planos_geologicos: {
    texto: "Planos de tu estructura mineralizada",
    resuelve: "Documenta gráficamente dónde está tu veta.",
  },
  levantamiento_topografico: {
    texto: "Topografía de tu labor",
    resuelve: "Mide y documenta la superficie real de tu terreno.",
  },
  estimacion_recursos: {
    texto: "Estimación de tus recursos minerales",
    resuelve: "Calcula cuánto mineral aprovechable tienes disponible.",
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
  documentacion_operacion: {
    texto: "Documentar tu operación (fotos, reportes o estudios previos)",
    resuelve: "Respalda con evidencia lo que declaras — le da confianza a quien evalúa tu proyecto.",
  },
  gestion_conflictividad_social: {
    texto: "Gestionar la relación con comunidades cercanas",
    resuelve: "Reduce el riesgo de que una oposición social frene tu proyecto.",
  },
};
