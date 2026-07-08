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
  igafom_correctivo: {
    texto: "Tu plan ambiental (IGAFOM correctivo)",
    resuelve: "Ordena el impacto ambiental que ya generó tu labor.",
  },
  igafom_preventivo: {
    texto: "Tu plan ambiental (IGAFOM preventivo)",
    resuelve: "Planifica cómo cuidarás el ambiente antes de operar.",
  },
  aprobacion_instrumento_ambiental: {
    texto: "Aprobar tu instrumento ambiental",
    resuelve: "Valida tu IGAFOM ante la autoridad.",
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
};
