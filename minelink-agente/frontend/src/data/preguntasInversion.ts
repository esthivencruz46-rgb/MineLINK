/** Catálogo del Módulo INV (perfil de inversión). Espejo EXACTO de
 *  backend/catalogo_inversion.py — cualquier desfase produce 422 en
 *  POST /mineros/inversion. Vive separado de data/preguntas.ts (el
 *  diagnóstico de formalización) por la misma razón que el backend: tipos
 *  distintos (multi_opcion, texto_corto) que no existen en ese catálogo. */

export type RespuestasInversion = Record<string, string | string[]>;

export type TipoPreguntaInv = "opcion" | "multi_opcion" | "texto_corto";

export interface OpcionPreguntaInv {
  valor: string;
  etiqueta: string;
}

export interface PreguntaInv {
  id: string;
  tipo: TipoPreguntaInv;
  texto: string;
  ayuda?: string;
  opciones?: OpcionPreguntaInv[];
  /** Solo para tipo "multi_opcion" */
  maxSelecciones?: number;
  /** Solo para tipo "texto_corto" */
  maxCaracteres?: number;
  /** Si está presente, la pregunta solo se muestra cuando devuelve true. */
  mostrarSi?: (respuestas: RespuestasInversion) => boolean;
}

// -------------------------------------------------------------------
// INV_0: común a todos los perfiles
// -------------------------------------------------------------------

export const MODULO_INV_0: PreguntaInv[] = [
  {
    id: "INV_0_1",
    tipo: "opcion",
    texto: "¿Cuánto capital buscas?",
    opciones: [
      { valor: "menos_25k", etiqueta: "Menos de S/ 25,000" },
      { valor: "25k_100k", etiqueta: "S/ 25,000 – 100,000" },
      { valor: "100k_500k", etiqueta: "S/ 100,000 – 500,000" },
      { valor: "500k_1m", etiqueta: "S/ 500,000 – 1,000,000" },
      { valor: "mas_1m", etiqueta: "Más de S/ 1,000,000" },
    ],
  },
  {
    id: "INV_0_2",
    tipo: "multi_opcion",
    texto: "¿Para qué usarías principalmente ese capital?",
    ayuda: "Elige hasta 3 opciones.",
    maxSelecciones: 3,
    opciones: [
      { valor: "tramites", etiqueta: "Trámites y permisos" },
      { valor: "exploracion", etiqueta: "Exploración / estudios geológicos" },
      { valor: "equipo", etiqueta: "Equipo y maquinaria" },
      { valor: "planta", etiqueta: "Planta de beneficio" },
      { valor: "capital_trabajo", etiqueta: "Capital de trabajo" },
      { valor: "terreno", etiqueta: "Acuerdo por el terreno superficial" },
    ],
  },
  {
    id: "INV_0_3",
    tipo: "opcion",
    texto: "¿Qué ofreces a cambio de la inversión?",
    opciones: [
      { valor: "participacion", etiqueta: "Porcentaje de la sociedad/empresa" },
      { valor: "regalia", etiqueta: "Porcentaje de la producción (regalía)" },
      { valor: "deuda", etiqueta: "Devolución del dinero con interés" },
      { valor: "offtake", etiqueta: "Adelanto a cuenta de producción futura / offtake" },
      { valor: "no_sabe", etiqueta: "No sé todavía, quiero asesoría" },
    ],
  },
  {
    id: "INV_0_4",
    tipo: "multi_opcion",
    texto: "¿Qué aportas tú al acuerdo?",
    opciones: [
      { valor: "concesion", etiqueta: "Concesión / petitorio" },
      { valor: "operacion", etiqueta: "Operación en marcha" },
      { valor: "equipo", etiqueta: "Equipo y maquinaria propia" },
      { valor: "mano_obra", etiqueta: "Mano de obra organizada" },
      { valor: "conocimiento", etiqueta: "Conocimiento de la zona y del yacimiento" },
    ],
  },
  {
    id: "INV_0_5",
    tipo: "opcion",
    texto: "¿En cuánto tiempo estimas que el inversionista recuperaría su capital?",
    opciones: [
      { valor: "menos_1a", etiqueta: "Menos de 1 año" },
      { valor: "1_2a", etiqueta: "1 a 2 años" },
      { valor: "2_5a", etiqueta: "2 a 5 años" },
      { valor: "no_sabe", etiqueta: "No sé" },
    ],
  },
  {
    id: "INV_0_6",
    tipo: "opcion",
    texto: "¿Has negociado antes con inversionistas?",
    opciones: [
      { valor: "negociando", etiqueta: "Sí, estoy en negociación actualmente" },
      { valor: "sin_exito", etiqueta: "Sí, pero no se concretó" },
      { valor: "nunca", etiqueta: "Nunca" },
    ],
  },
  {
    id: "INV_0_7",
    tipo: "opcion",
    texto: "¿Tienes algún compromiso de exclusividad firmado con ese inversionista?",
    opciones: [
      { valor: "si", etiqueta: "Sí" },
      { valor: "no", etiqueta: "No" },
      { valor: "no_se", etiqueta: "No sé" },
    ],
    mostrarSi: (r) => r.INV_0_6 === "negociando",
  },
];

// -------------------------------------------------------------------
// INV_A: perfil A y A_avanzado (desde cero / petitorio)
// -------------------------------------------------------------------

export const MODULO_INV_A: PreguntaInv[] = [
  {
    id: "INV_A1",
    tipo: "opcion",
    texto: "¿Qué evidencia tienes de que hay mineral en el área?",
    opciones: [
      { valor: "muestreo_propio", etiqueta: "Muestreo propio (artesanal)" },
      { valor: "mineria_vecina", etiqueta: "Hay minería activa en zonas vecinas" },
      { valor: "info_publica", etiqueta: "Información geológica pública (INGEMMET, GEOCATMIN)" },
      { valor: "ninguna", etiqueta: "Ninguna todavía" },
    ],
  },
  {
    id: "INV_A2",
    tipo: "opcion",
    texto: "Si consigues el capital, ¿en cuánto tiempo estimas empezar a producir?",
    opciones: [
      { valor: "menos_6m", etiqueta: "Menos de 6 meses" },
      { valor: "6_12m", etiqueta: "6 a 12 meses" },
      { valor: "12_24m", etiqueta: "12 a 24 meses" },
      { valor: "no_sabe", etiqueta: "No sé" },
    ],
  },
  {
    id: "INV_A3",
    tipo: "opcion",
    texto: "¿Quién operaría la mina?",
    opciones: [
      { valor: "yo_experiencia", etiqueta: "Yo mismo, tengo experiencia minera" },
      { valor: "yo_sin_experiencia", etiqueta: "Yo mismo, sin experiencia previa" },
      { valor: "operador", etiqueta: "Contrataría un operador / técnico" },
      { valor: "inversionista_define", etiqueta: "Esperaría que el inversionista lo defina" },
    ],
  },
];

// -------------------------------------------------------------------
// INV_B: perfil B (concesión sin operar)
// -------------------------------------------------------------------

const OPCIONES_CHECKLIST = [
  { valor: "tengo", etiqueta: "Tengo" },
  { valor: "en_proceso", etiqueta: "En proceso" },
  { valor: "no_tengo", etiqueta: "No tengo" },
];

export const MODULO_INV_B: PreguntaInv[] = [
  { id: "INV_B1a", tipo: "opcion", texto: "Mapeo geológico", opciones: OPCIONES_CHECKLIST },
  { id: "INV_B1b", tipo: "opcion", texto: "Muestreo con laboratorio certificado", opciones: OPCIONES_CHECKLIST },
  { id: "INV_B1c", tipo: "opcion", texto: "Estimación de recursos minerales", opciones: OPCIONES_CHECKLIST },
  {
    id: "INV_B2",
    tipo: "opcion",
    texto: "¿Tu concesión ha producido antes (tú o un titular anterior)?",
    opciones: [
      { valor: "si_registros", etiqueta: "Sí, con registros" },
      { valor: "si_sin_registros", etiqueta: "Sí, pero sin registros" },
      { valor: "nunca", etiqueta: "Nunca ha producido" },
      { valor: "no_sabe", etiqueta: "No sé" },
    ],
  },
  {
    id: "INV_B3",
    tipo: "opcion",
    texto: "¿Qué es lo principal que te frena para operar hoy?",
    opciones: [
      { valor: "capital", etiqueta: "Falta de capital" },
      { valor: "permisos", etiqueta: "Permisos pendientes" },
      { valor: "terreno", etiqueta: "Acuerdo con el dueño del terreno" },
      { valor: "rentabilidad", etiqueta: "No tengo certeza de que sea rentable" },
      { valor: "otro", etiqueta: "Otro" },
    ],
  },
  {
    id: "INV_B4",
    tipo: "opcion",
    texto: "¿Aceptarías que un operador con experiencia maneje la operación?",
    opciones: [
      { valor: "si_titularidad", etiqueta: "Sí, si mantengo mi titularidad" },
      { valor: "solo_socio", etiqueta: "Solo como socio en la operación" },
      { valor: "no", etiqueta: "No, quiero operarla yo" },
    ],
  },
];

// -------------------------------------------------------------------
// INV_C: perfil C (opera con REINFO)
// -------------------------------------------------------------------

export const MODULO_INV_C: PreguntaInv[] = [
  {
    id: "INV_C1",
    tipo: "opcion",
    texto: "¿A quién vendes tu mineral?",
    opciones: [
      { valor: "planta_formal", etiqueta: "Planta / comercializadora formal, con liquidaciones" },
      { valor: "comprador_local", etiqueta: "Comprador local sin liquidación" },
      { valor: "acopiador", etiqueta: "Acopiador informal" },
      { valor: "no_vende", etiqueta: "Todavía no vendo" },
    ],
  },
  {
    id: "INV_C2",
    tipo: "opcion",
    texto: "¿Tienes liquidaciones de venta de los últimos 12 meses?",
    opciones: [
      { valor: "completas", etiqueta: "Completas (12 meses)" },
      { valor: "parciales", etiqueta: "Parciales (algunos meses)" },
      { valor: "no", etiqueta: "No tengo" },
    ],
  },
  {
    id: "INV_C3",
    tipo: "opcion",
    texto: "¿Conoces la ley de tu mineral?",
    opciones: [
      { valor: "lab_certificado", etiqueta: "Sí, con análisis de laboratorio certificado" },
      { valor: "analisis_comprador", etiqueta: "Sí, por el análisis del comprador" },
      { valor: "estimacion", etiqueta: "Solo una estimación propia" },
      { valor: "no_sabe", etiqueta: "No sé" },
    ],
  },
  {
    id: "INV_C4",
    tipo: "opcion",
    texto: "¿Tienes tus costos operativos (OPEX) documentados?",
    opciones: [
      { valor: "detallado", etiqueta: "Sí, registro detallado" },
      { valor: "estimacion", etiqueta: "Solo una estimación general" },
      { valor: "no", etiqueta: "No llevo registro" },
    ],
  },
  {
    id: "INV_C5",
    tipo: "opcion",
    texto: "¿Cuánto aumentaría tu producción con el capital que pides?",
    opciones: [
      { valor: "menos_50", etiqueta: "Menos del 50%" },
      { valor: "50_100", etiqueta: "Entre 50% y 100% (el doble)" },
      { valor: "mas_100", etiqueta: "Más del doble" },
      { valor: "no_produccion", etiqueta: "El capital no es para producir más (formalizar, equipo, etc.)" },
    ],
  },
];

// -------------------------------------------------------------------
// INV_D: perfil D (formal pleno)
// -------------------------------------------------------------------

export const MODULO_INV_D: PreguntaInv[] = [
  {
    id: "INV_D1",
    tipo: "opcion",
    texto: "¿Cómo llevas tus finanzas?",
    opciones: [
      { valor: "auditados", etiqueta: "Estados financieros auditados" },
      { valor: "contabilidad_formal", etiqueta: "Contabilidad formal (contador)" },
      { valor: "registro_interno", etiqueta: "Registro interno ordenado" },
      { valor: "no", etiqueta: "No llevo registros" },
    ],
  },
  {
    id: "INV_D2",
    tipo: "opcion",
    texto: "¿Tienes producción histórica con liquidaciones?",
    opciones: [
      { valor: "mas_12m", etiqueta: "Más de 12 meses" },
      { valor: "6_12m", etiqueta: "6 a 12 meses" },
      { valor: "menos_6m", etiqueta: "Menos de 6 meses" },
      { valor: "no", etiqueta: "No tengo" },
    ],
  },
  { id: "INV_D3a", tipo: "opcion", texto: "Mapeo geológico", opciones: OPCIONES_CHECKLIST },
  { id: "INV_D3b", tipo: "opcion", texto: "Muestreo con laboratorio certificado", opciones: OPCIONES_CHECKLIST },
  { id: "INV_D3c", tipo: "opcion", texto: "Estimación de recursos minerales", opciones: OPCIONES_CHECKLIST },
  {
    id: "INV_D4",
    tipo: "opcion",
    texto: "¿Tienes contratos de venta vigentes?",
    opciones: [
      { valor: "largo_plazo", etiqueta: "Sí, contrato de largo plazo / offtake" },
      { valor: "spot", etiqueta: "Vendo al mercado (spot)" },
      { valor: "no", etiqueta: "No tengo comprador estable" },
    ],
  },
  {
    id: "INV_D5",
    tipo: "texto_corto",
    texto: "Describe brevemente tu proyecto de expansión",
    maxCaracteres: 300,
  },
];

/** Índice id → pregunta, de TODO el catálogo (común + los 4 bloques por
 *  perfil) — para que el panel admin traduzca respuestas crudas a texto
 *  legible sin tener que saber a qué perfil pertenece cada id. */
export const POR_ID_INV: Record<string, PreguntaInv> = Object.fromEntries(
  [...MODULO_INV_0, ...MODULO_INV_A, ...MODULO_INV_B, ...MODULO_INV_C, ...MODULO_INV_D].map(
    (p) => [p.id, p]
  )
);

export const BLOQUE_INV_POR_PERFIL: Record<string, PreguntaInv[]> = {
  A: MODULO_INV_A,
  A_avanzado: MODULO_INV_A,
  B: MODULO_INV_B,
  C: MODULO_INV_C,
  D: MODULO_INV_D,
};

/** Lista ORDENADA de preguntas visibles para este perfil, dadas las
 *  respuestas actuales (INV_0_7 solo aparece si ya está negociando). */
export function preguntasVisiblesInversion(
  perfil: string | null | undefined,
  respuestas: RespuestasInversion
): PreguntaInv[] {
  const bloque = perfil ? (BLOQUE_INV_POR_PERFIL[perfil] ?? []) : [];
  return [...MODULO_INV_0, ...bloque].filter((p) => !p.mostrarSi || p.mostrarSi(respuestas));
}

/** Etiquetas de las categorías de documento de sustento del Módulo INV que
 *  NO existen ya como estudio del diagnóstico — espejo de
 *  backend/uploads_config.CATEGORIAS_INVERSION + el título de concesión
 *  (backend/types/documento.ts CATEGORIAS_DOCUMENTO). */
export const ETIQUETA_CATEGORIA_INV: Record<string, string> = {
  titulo_concesion: "Título de concesión",
  liquidaciones_venta: "Liquidaciones de venta",
  estados_financieros_libros: "Estados financieros o libros contables",
  certificado_ley: "Certificado de ley del mineral",
  fotos_equipo_maquinaria: "Fotos de tu maquinaria y equipo",
  fotos_trabajadores: "Fotos de tus trabajadores",
};

/** Documentos de sustento que el admin debe ver APROBADOS antes de dar el
 *  visto bueno del Módulo INV — espejo EXACTO de
 *  backend/catalogo_inversion.categorias_requeridas_inversion(). */
export function categoriasRequeridasInversion(
  perfil: string | null | undefined,
  respuestasInv: RespuestasInversion
): string[] {
  if (perfil === "A" || perfil === "A_avanzado") return [];
  if (perfil === "B") return ["titulo_concesion"];
  if (perfil === "C") return respuestasInv.INV_C2 !== "no" ? ["liquidaciones_venta"] : [];
  if (perfil === "D") {
    const requeridos: string[] = [];
    if (respuestasInv.INV_D1 !== "no") requeridos.push("estados_financieros_libros");
    if (respuestasInv.INV_D2 !== "no") requeridos.push("liquidaciones_venta");
    return requeridos;
  }
  return [];
}
