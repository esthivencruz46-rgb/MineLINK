/** Perfil informativo previo al cuestionario Sí/No de formalización — NUNCA
 * puntúa el MineScore. Dos arrays completamente distintos (Ruta 1: ya
 * opera / Ruta 2: recién inicia), ver context/criterios_score.md. */

export type TipoPreguntaPerfil =
  | "opciones"
  | "opciones_multi"
  | "texto"
  | "numero"
  | "numero_con_unidad"
  | "booleano";

export interface OpcionPerfil {
  valor: string;
  etiqueta: string;
}

export interface PreguntaPerfil {
  /** Nombre del campo en el objeto `perfil` acumulado y en el payload del diagnóstico. */
  campo: string;
  texto: string;
  tipo: TipoPreguntaPerfil;
  opciones?: OpcionPerfil[];
  /** Si el usuario elige "otro", se muestra un campo de texto libre y ESE
   * texto reemplaza el valor guardado (no se guarda la palabra "otro"). */
  permiteOtro?: boolean;
  placeholder?: string;
  /** Se muestra solo si esta función, evaluada contra el perfil acumulado
   * hasta ese punto, devuelve true. Sin `mostrarSi` = siempre se muestra. */
  mostrarSi?: (perfil: Record<string, unknown>) => boolean;
}

const OPCIONES_ELEMENTO_VALOR: OpcionPerfil[] = [
  { valor: "oro", etiqueta: "Oro (Au)" },
  { valor: "plata", etiqueta: "Plata (Ag)" },
  { valor: "cobre", etiqueta: "Cobre (Cu)" },
  { valor: "zinc", etiqueta: "Zinc (Zn)" },
  { valor: "plomo", etiqueta: "Plomo (Pb)" },
  { valor: "estaño", etiqueta: "Estaño (Sn)" },
  { valor: "hierro", etiqueta: "Hierro (Fe)" },
  { valor: "polimetálico", etiqueta: "Polimetálico" },
];

const OPCIONES_TIPO_APOYO: OpcionPerfil[] = [
  { valor: "financiamiento", etiqueta: "Financiamiento" },
  { valor: "compra_maquinaria", etiqueta: "Compra de maquinaria" },
  { valor: "compra_equipos", etiqueta: "Compra de equipos" },
  { valor: "capital_trabajo", etiqueta: "Capital de trabajo" },
  { valor: "socio_estrategico", etiqueta: "Socio estratégico" },
  { valor: "ampliar_produccion", etiqueta: "Ampliar la producción" },
  { valor: "mejorar_infraestructura", etiqueta: "Mejorar infraestructura" },
  { valor: "asesoria_tecnica", etiqueta: "Asesoría técnica" },
];

const OPCIONES_DOCUMENTO_AUTORIZACION: OpcionPerfil[] = [
  { valor: "contrato de explotación", etiqueta: "Contrato de explotación" },
  { valor: "cesión minera", etiqueta: "Cesión minera" },
  { valor: "autorización del titular", etiqueta: "Autorización del titular" },
];

/** Reutilizado por Cuestionario.tsx para generar dinámicamente una pregunta
 * de ley por cada elemento económico seleccionado. */
export const OPCIONES_UNIDAD_LEY: OpcionPerfil[] = [
  { valor: "g/t", etiqueta: "g/t" },
  { valor: "%", etiqueta: "%" },
  { valor: "ppm", etiqueta: "ppm" },
];

export const OPCIONES_UNIDAD_PRODUCCION: OpcionPerfil[] = [
  { valor: "toneladas de mineral", etiqueta: "Toneladas de mineral" },
  { valor: "toneladas de concentrado", etiqueta: "Toneladas de concentrado" },
  { valor: "gramos de metal", etiqueta: "Gramos de metal" },
  { valor: "kilogramos", etiqueta: "Kilogramos" },
];

// ---------- Ruta 1: minero_artesanal (ya opera) ----------

export const PERFIL_ARTESANAL: PreguntaPerfil[] = [
  {
    campo: "estado_operacion",
    texto: "¿Tu operación minera se encuentra activa?",
    tipo: "opciones",
    opciones: [
      { valor: "activa", etiqueta: "Sí, está activa" },
      { valor: "no_activa", etiqueta: "No, está detenida" },
      { valor: "temporal", etiqueta: "Temporalmente detenida" },
    ],
  },
  {
    campo: "tipo_explotacion",
    texto: "¿Qué tipo de explotación realizas?",
    tipo: "opciones",
    opciones: [
      { valor: "subterranea", etiqueta: "Subterránea" },
      { valor: "tajo_abierto", etiqueta: "Tajo abierto" },
      { valor: "aluvial", etiqueta: "Aluvial" },
      { valor: "mixta", etiqueta: "Mixta" },
    ],
    permiteOtro: true,
  },
  {
    campo: "material_comercializado",
    texto: "¿Qué material comercializas actualmente?",
    tipo: "opciones",
    opciones: [
      { valor: "mineral en bruto (ROM)", etiqueta: "Mineral en bruto (ROM)" },
      { valor: "mineral seleccionado", etiqueta: "Mineral seleccionado" },
      { valor: "mineral chancado", etiqueta: "Mineral chancado" },
      { valor: "concentrado", etiqueta: "Concentrado" },
      { valor: "arena aurífera", etiqueta: "Arena aurífera" },
      { valor: "relaves", etiqueta: "Relaves" },
    ],
    permiteOtro: true,
  },
  {
    campo: "elemento_valor",
    texto: "¿Qué elementos económicos extraes? (puedes marcar varios)",
    tipo: "opciones_multi",
    opciones: OPCIONES_ELEMENTO_VALOR,
  },
  {
    campo: "forma_comercializacion",
    texto: "¿Cómo comercializas actualmente el material?",
    tipo: "opciones",
    opciones: [
      { valor: "Lo vendo directamente sin procesamiento", etiqueta: "Lo vendo directamente sin procesamiento" },
      { valor: "Lo vendo luego de seleccionar el mineral", etiqueta: "Lo vendo luego de seleccionar el mineral" },
      { valor: "Lo proceso hasta obtener concentrado", etiqueta: "Lo proceso hasta obtener concentrado" },
      { valor: "Lo proceso hasta obtener el metal", etiqueta: "Lo proceso hasta obtener el metal" },
      { valor: "Aún no comercializo", etiqueta: "Aún no comercializo" },
    ],
  },
  {
    campo: "tiempo_operacion",
    texto: "¿Desde cuándo vienes explotando esta mina?",
    tipo: "opciones",
    opciones: [
      { valor: "Menos de 1 año", etiqueta: "Menos de 1 año" },
      { valor: "Entre 1 y 3 años", etiqueta: "Entre 1 y 3 años" },
      { valor: "Entre 3 y 5 años", etiqueta: "Entre 3 y 5 años" },
      { valor: "Más de 5 años", etiqueta: "Más de 5 años" },
    ],
  },
  {
    campo: "produccion_mensual",
    texto: "¿Cuál es tu producción mensual aproximada?",
    tipo: "numero_con_unidad",
    placeholder: "Ej. 30",
    opciones: OPCIONES_UNIDAD_PRODUCCION,
    permiteOtro: true,
  },
  {
    campo: "conoce_ley",
    texto: "¿Conoces la ley promedio de los elementos que extraes?",
    tipo: "booleano",
  },
  // Las preguntas de ley (una por cada elemento marcado arriba, valor+unidad
  // en una sola pantalla) se insertan dinámicamente aquí — ver
  // construirPerfilVisible() en Cuestionario.tsx.
  {
    campo: "ley_como_obtenida",
    texto: "¿Cómo obtuviste esas leyes?",
    tipo: "opciones",
    opciones: [
      { valor: "Ensaye de laboratorio certificado", etiqueta: "Ensaye de laboratorio certificado" },
      { valor: "Ensaye particular", etiqueta: "Ensaye particular" },
      { valor: "Estimación propia", etiqueta: "Estimación propia" },
      { valor: "No lo sé", etiqueta: "No lo sé" },
    ],
    permiteOtro: true,
    mostrarSi: (p) => p.conoce_ley === true,
  },
  {
    campo: "tiene_resultados_laboratorio",
    texto: "¿Cuentas con resultados de laboratorio?",
    tipo: "booleano",
  },
  {
    campo: "tipo_apoyo_json",
    texto: "¿Qué tipo de apoyo buscas actualmente?",
    tipo: "opciones_multi",
    opciones: OPCIONES_TIPO_APOYO,
  },
];
// Nota: titularidad y contrato/autorización NO se repiten aquí — para
// Ruta 1 se preguntan como L2/L3 en el cuestionario Sí/No de siempre.

// ---------- Ruta 2: concesionario (recién inicia) ----------

export const PERFIL_CONCESIONARIO: PreguntaPerfil[] = [
  {
    campo: "titular",
    texto: "¿Eres titular de la concesión minera?",
    tipo: "booleano",
  },
  {
    campo: "documento_autorizacion",
    texto: "¿Qué documento te autoriza a trabajar en la concesión?",
    tipo: "opciones",
    opciones: OPCIONES_DOCUMENTO_AUTORIZACION,
    permiteOtro: true,
    mostrarSi: (p) => p.titular === false,
  },
  {
    campo: "concesion_vigente",
    texto: "¿La concesión se encuentra vigente?",
    tipo: "booleano",
  },
  {
    campo: "elemento_valor",
    texto: "¿Cuál es el principal elemento económico esperado?",
    tipo: "opciones",
    opciones: OPCIONES_ELEMENTO_VALOR,
    permiteOtro: true,
  },
  {
    campo: "tipo_deposito",
    texto: "¿Conoces el tipo de depósito?",
    tipo: "texto",
    placeholder: "Ej. vetas, pórfido, aluvial (si no lo sabes, déjalo en blanco)",
  },
  {
    campo: "etapa_proyecto",
    texto: "¿En qué etapa consideras que se encuentra tu proyecto?",
    tipo: "opciones",
    opciones: [
      { valor: "solo concesión, sin trabajos", etiqueta: "Solo tengo la concesión, sin trabajos aún" },
      { valor: "exploración inicial", etiqueta: "Exploración inicial" },
      { valor: "exploración avanzada", etiqueta: "Exploración avanzada" },
      { valor: "listo para operar", etiqueta: "Listo para empezar a operar" },
    ],
  },
  {
    campo: "trabajos_exploracion_json",
    texto: "¿Qué trabajos de exploración has realizado?",
    tipo: "opciones_multi",
    opciones: [
      { valor: "muestreo", etiqueta: "Muestreo" },
      { valor: "calicatas", etiqueta: "Calicatas" },
      { valor: "trincheras", etiqueta: "Trincheras" },
      { valor: "perforacion", etiqueta: "Perforación" },
      { valor: "cartografia", etiqueta: "Cartografía geológica" },
      { valor: "ninguno", etiqueta: "Ninguno todavía" },
    ],
  },
  {
    campo: "info_geologica_disponible",
    texto: "¿Cuentas con información geológica disponible?",
    tipo: "booleano",
  },
  {
    campo: "tiene_resultados_laboratorio",
    texto: "¿Cuentas con ensayes de laboratorio?",
    tipo: "booleano",
  },
  {
    campo: "tiene_estimaciones_leyes",
    texto: "¿Posees estimaciones de leyes?",
    tipo: "booleano",
  },
  {
    campo: "formalizacion_iniciada",
    texto: "¿Has iniciado algún proceso de formalización (REINFO)?",
    tipo: "booleano",
  },
  {
    campo: "tiene_ruc",
    texto: "¿Cuentas con RUC?",
    tipo: "booleano",
  },
  {
    campo: "tipo_apoyo_json",
    texto: "¿Qué tipo de apoyo buscas actualmente?",
    tipo: "opciones_multi",
    opciones: OPCIONES_TIPO_APOYO,
  },
];
