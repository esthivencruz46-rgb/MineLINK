/** Perfil informativo del diagnóstico (Fase 1, ~40 campos según ruta):
 * nunca puntúa el MineScore, pero es la base del Score de Atractivo de
 * Inversión. Se muestra agrupado por categoría (en vez de una lista plana)
 * tanto al inversionista (ProyectoDetalle.tsx) como al propio minero
 * (MiCuenta.tsx / MiConcesion.tsx, como recordatorio de lo que declaró) —
 * ver components/PerfilInformativoAgrupado.tsx. */
export const CATEGORIAS_PERFIL_INFORMATIVO = [
  "operacion",
  "geologia",
  "titularidad",
  "ambiente",
  "riesgos",
  "equipo",
  "formalizacion",
  "capital",
  "vision",
] as const;

export type CategoriaPerfilInformativo = (typeof CATEGORIAS_PERFIL_INFORMATIVO)[number];

export const NOMBRES_CATEGORIA_PERFIL_INFORMATIVO: Record<CategoriaPerfilInformativo, string> = {
  operacion: "Operación",
  geologia: "Geología y técnico",
  titularidad: "Titularidad y concesión",
  ambiente: "Ambiente",
  riesgos: "Riesgos y comunidad",
  equipo: "Equipo y capacidad",
  formalizacion: "Formalización",
  capital: "Capital y oportunidad",
  vision: "Visión a futuro",
};

export const CAMPOS_PERFIL_INFORMATIVO: {
  campo: string;
  etiqueta: string;
  categoria: CategoriaPerfilInformativo;
}[] = [
  { campo: "tiempo_operacion", etiqueta: "Tiempo operando", categoria: "operacion" },
  { campo: "modalidad_trabajadores", etiqueta: "Modalidad de trabajadores", categoria: "operacion" },
  { campo: "num_trabajadores", etiqueta: "Nº de trabajadores", categoria: "operacion" },
  { campo: "maquinaria", etiqueta: "Maquinaria principal", categoria: "operacion" },
  { campo: "provincia", etiqueta: "Provincia", categoria: "operacion" },
  { campo: "produccion_objetivo", etiqueta: "Producción objetivo", categoria: "operacion" },

  { campo: "tiene_resultados_laboratorio", etiqueta: "Resultados de laboratorio", categoria: "geologia" },
  { campo: "tipo_deposito", etiqueta: "Tipo de depósito", categoria: "geologia" },
  { campo: "toneladas_estimadas", etiqueta: "Toneladas estimadas del depósito", categoria: "geologia" },
  { campo: "ley_esperada", etiqueta: "Ley esperada", categoria: "geologia" },
  { campo: "etapa_proyecto", etiqueta: "Etapa del proyecto", categoria: "geologia" },
  { campo: "info_geologica_disponible", etiqueta: "Información geológica disponible", categoria: "geologia" },
  { campo: "tiene_estimaciones_leyes", etiqueta: "Estimaciones de leyes", categoria: "geologia" },
  { campo: "estudio_previo", etiqueta: "Estudio de prefactibilidad/factibilidad", categoria: "geologia" },

  { campo: "concesion_vigente", etiqueta: "Concesión vigente", categoria: "titularidad" },
  { campo: "documento_autorizacion", etiqueta: "Documento de autorización", categoria: "titularidad" },
  { campo: "historial_operacion", etiqueta: "Operada previamente", categoria: "titularidad" },

  { campo: "sustancias_toxicas", etiqueta: "Mercurio/cianuro/relaves", categoria: "ambiente" },
  { campo: "gestion_sustancias", etiqueta: "Gestión de esas sustancias", categoria: "ambiente" },
  { campo: "acceso_agua", etiqueta: "Acceso a agua", categoria: "ambiente" },
  { campo: "acceso_energia", etiqueta: "Acceso a energía", categoria: "ambiente" },
  { campo: "acceso_logistico", etiqueta: "Acceso logístico", categoria: "ambiente" },
  { campo: "pasivos_ambientales", etiqueta: "Pasivos ambientales heredados", categoria: "ambiente" },

  { campo: "incidentes_previos", etiqueta: "Incidentes en los últimos 2 años", categoria: "riesgos" },
  { campo: "conflictividad_social", etiqueta: "Conflictividad con comunidades", categoria: "riesgos" },
  { campo: "permisos_comunitarios", etiqueta: "Permisos/relaciones comunitarias", categoria: "riesgos" },

  { campo: "experiencia_operador", etiqueta: "Experiencia del operador", categoria: "equipo" },
  { campo: "capacitacion_operador", etiqueta: "Capacitación/colegiatura", categoria: "equipo" },
  { campo: "documentacion_disponible", etiqueta: "Documentación disponible", categoria: "equipo" },
  { campo: "experiencia_titular", etiqueta: "Experiencia del titular", categoria: "equipo" },
  { campo: "background_titular", etiqueta: "Background profesional del titular", categoria: "equipo" },
  { campo: "equipo_tecnico", etiqueta: "Equipo técnico definido", categoria: "equipo" },

  { campo: "estructura_propiedad", etiqueta: "Estructura de propiedad", categoria: "formalizacion" },
  { campo: "plan_formalizacion", etiqueta: "Plan de formalización", categoria: "formalizacion" },

  { campo: "tipo_apoyo", etiqueta: "Apoyo que busca primordialmente", categoria: "capital" },
  { campo: "monto_requerido", etiqueta: "Monto aproximado que necesita", categoria: "capital" },
  { campo: "plazo_capital", etiqueta: "Plazo para usar el capital", categoria: "capital" },
  { campo: "capital_disponible", etiqueta: "Capital ya disponible", categoria: "capital" },
  { campo: "tipo_socio_buscado", etiqueta: "Tipo de socio buscado", categoria: "capital" },

  { campo: "prioridad_crecimiento", etiqueta: "Prioridad para crecer", categoria: "vision" },
  { campo: "siguiente_hito", etiqueta: "Siguiente hito", categoria: "vision" },
  { campo: "timeline_operacion", etiqueta: "Timeline esperado hasta operación", categoria: "vision" },
  { campo: "motivo_inicio", etiqueta: "Por qué inició el proyecto", categoria: "vision" },
];
