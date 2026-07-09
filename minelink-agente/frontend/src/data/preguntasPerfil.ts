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

export const OPCIONES_ELEMENTO_VALOR: OpcionPerfil[] = [
  { valor: "oro", etiqueta: "Oro (Au)" },
  { valor: "plata", etiqueta: "Plata (Ag)" },
  { valor: "cobre", etiqueta: "Cobre (Cu)" },
  { valor: "zinc", etiqueta: "Zinc (Zn)" },
  { valor: "plomo", etiqueta: "Plomo (Pb)" },
  { valor: "estaño", etiqueta: "Estaño (Sn)" },
  { valor: "hierro", etiqueta: "Hierro (Fe)" },
  { valor: "polimetálico", etiqueta: "Polimetálico" },
];

// "¿Qué es lo más importante / qué tipo de apoyo buscas primordialmente?"
// — opción única (antes era multi-selección, tipo_apoyo_json).
const OPCIONES_TIPO_APOYO: OpcionPerfil[] = [
  { valor: "financiamiento", etiqueta: "Financiamiento" },
  { valor: "maquinaria", etiqueta: "Maquinaria o equipos" },
  { valor: "capital_trabajo", etiqueta: "Capital de trabajo" },
  { valor: "socio_operador", etiqueta: "Socio operador" },
  { valor: "asesoria_tecnica", etiqueta: "Asesoría técnica" },
  { valor: "permisos_licencias", etiqueta: "Permisos y licencias" },
  { valor: "mercado", etiqueta: "Conexiones comerciales / mercado" },
  { valor: "otro", etiqueta: "Otro" },
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

const OPCIONES_TRES_NIVELES = (etiquetaParcial: string, etiquetaCompleta: string): OpcionPerfil[] => [
  { valor: "no", etiqueta: "No" },
  { valor: "parcial", etiqueta: etiquetaParcial },
  { valor: "completo", etiqueta: etiquetaCompleta },
];

const OPCIONES_ACCESO_AGUA: OpcionPerfil[] = [
  { valor: "no_disponible", etiqueta: "No disponible" },
  { valor: "limitado", etiqueta: "Limitado" },
  { valor: "abundante", etiqueta: "Abundante" },
  { valor: "en_negociacion", etiqueta: "En negociación" },
];

const OPCIONES_ACCESO_ENERGIA: OpcionPerfil[] = [
  { valor: "no", etiqueta: "No" },
  { valor: "limitado", etiqueta: "Limitado" },
  { valor: "red_publica", etiqueta: "Sí, red pública" },
  { valor: "generacion_propia", etiqueta: "Generación propia posible" },
  { valor: "en_negociacion", etiqueta: "En negociación" },
];

const OPCIONES_CONFLICTIVIDAD: OpcionPerfil[] = [
  { valor: "no", etiqueta: "No" },
  { valor: "percibida", etiqueta: "Sí, percibida" },
  { valor: "activa", etiqueta: "Sí, activa/protestas" },
];

const OPCIONES_ESTRUCTURA_PROPIEDAD: OpcionPerfil[] = [
  { valor: "individual", etiqueta: "100% individual" },
  { valor: "sociedad_2_3", etiqueta: "Sociedad entre 2-3 personas" },
  { valor: "empresa_constituida", etiqueta: "Empresa constituida" },
  { valor: "multiples_socios", etiqueta: "Múltiples socios (4+)" },
  { valor: "otro", etiqueta: "Otro" },
];

const OPCIONES_PLAZO_CAPITAL: OpcionPerfil[] = [
  { valor: "< 3 meses", etiqueta: "Menos de 3 meses" },
  { valor: "3-6 meses", etiqueta: "3 a 6 meses" },
  { valor: "6-12 meses", etiqueta: "6 a 12 meses" },
  { valor: "> 12 meses", etiqueta: "Más de 12 meses" },
  { valor: "No definido", etiqueta: "No definido" },
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
    tipo: "opciones",
    opciones: OPCIONES_TRES_NIVELES("Sí, algunos", "Sí, completos"),
  },
  {
    campo: "num_trabajadores",
    texto: "¿Cuántas personas trabajan en tu operación?",
    tipo: "numero",
    placeholder: "Ej. 5",
  },
  {
    campo: "modalidad_trabajadores",
    texto: "¿Bajo qué modalidad trabajan?",
    tipo: "opciones",
    opciones: [
      { valor: "planilla", etiqueta: "Planilla" },
      { valor: "destajo", etiqueta: "Destajo" },
      { valor: "combinado", etiqueta: "Combinado" },
    ],
  },
  {
    campo: "maquinaria",
    texto: "¿Qué maquinaria principal posees?",
    tipo: "texto",
    placeholder: "Ej. excavadora, perforadoras, compresores, chancadora",
  },
  {
    campo: "provincia",
    texto: "¿En qué provincia está ubicada tu operación?",
    tipo: "texto",
    placeholder: "Ej. Camaná",
  },
  {
    campo: "sustancias_toxicas",
    texto: "¿Usas en tu proceso mercurio, cianuro, o generas relaves?",
    tipo: "opciones",
    opciones: [
      { valor: "no", etiqueta: "No" },
      { valor: "mercurio", etiqueta: "Sí, mercurio" },
      { valor: "cianuro", etiqueta: "Sí, cianuro" },
      { valor: "relaves", etiqueta: "Sí, relaves" },
      { valor: "multiples", etiqueta: "Sí, varios" },
    ],
  },
  {
    campo: "gestion_sustancias",
    texto: "¿Cómo gestionas esas sustancias o residuos?",
    tipo: "opciones",
    opciones: [
      { valor: "confinamiento", etiqueta: "Confinamiento" },
      { valor: "quema_controlada", etiqueta: "Quema controlada" },
      { valor: "reuso", etiqueta: "Reuso" },
      { valor: "venta", etiqueta: "Venta" },
      { valor: "no_se_gestiona", etiqueta: "No se gestiona" },
    ],
    mostrarSi: (p) => typeof p.sustancias_toxicas === "string" && p.sustancias_toxicas !== "no",
  },
  {
    campo: "acceso_agua",
    texto: "¿Tienes acceso a agua limpia para la operación?",
    tipo: "opciones",
    opciones: OPCIONES_ACCESO_AGUA,
  },
  {
    campo: "acceso_energia",
    texto: "¿Cómo accedes a energía (electricidad o diésel)?",
    tipo: "opciones",
    opciones: [
      { valor: "generador_diesel", etiqueta: "Generador diésel" },
      { valor: "red_publica", etiqueta: "Red pública" },
      { valor: "ambos", etiqueta: "Ambos" },
      { valor: "otro", etiqueta: "Otro" },
    ],
  },
  {
    campo: "tipo_apoyo",
    texto: "¿Qué tipo de apoyo buscas primordialmente?",
    tipo: "opciones",
    opciones: OPCIONES_TIPO_APOYO,
  },
  {
    campo: "monto_requerido",
    texto: "¿Monto aproximado que necesitas?",
    tipo: "opciones",
    opciones: [
      { valor: "< S/. 50,000", etiqueta: "Menos de S/. 50,000" },
      { valor: "S/. 50,000 - 200,000", etiqueta: "S/. 50,000 - 200,000" },
      { valor: "S/. 200,000 - 1,000,000", etiqueta: "S/. 200,000 - 1,000,000" },
      { valor: "S/. 1,000,000 - 5,000,000", etiqueta: "S/. 1,000,000 - 5,000,000" },
      { valor: "S/. 5,000,000+", etiqueta: "Más de S/. 5,000,000" },
    ],
  },
  {
    campo: "plazo_capital",
    texto: "¿En qué plazo usarías ese capital?",
    tipo: "opciones",
    opciones: OPCIONES_PLAZO_CAPITAL,
  },
  {
    campo: "uso_fondos_diagnostico",
    texto: "¿Para qué lo usarías primero?",
    tipo: "opciones",
    opciones: [
      { valor: "Compra de equipos", etiqueta: "Compra de equipos" },
      { valor: "Capital de trabajo", etiqueta: "Capital de trabajo" },
      { valor: "Exploraciones", etiqueta: "Exploraciones" },
      { valor: "Mejorar proceso", etiqueta: "Mejorar proceso" },
      { valor: "Ampliación", etiqueta: "Ampliación" },
    ],
  },
  {
    campo: "motivo_capital",
    texto: "¿Por qué necesitas capital ahora?",
    tipo: "texto",
    placeholder: 'Ej. "Cierre de cantera anterior", "Oportunidad de lote nuevo"',
  },
  {
    campo: "produccion_objetivo",
    texto: "¿Cuál es tu producción objetivo en 12 meses?",
    tipo: "opciones",
    opciones: [
      { valor: "igual", etiqueta: "Igual a hoy" },
      { valor: "2-3x", etiqueta: "2 a 3 veces más" },
      { valor: "5x+", etiqueta: "5 veces o más" },
      { valor: "no_se", etiqueta: "No sé" },
    ],
  },
  {
    campo: "incidentes_previos",
    texto: "¿Ha tenido tu operación alguna de estas situaciones en los últimos 2 años?",
    tipo: "opciones",
    opciones: [
      { valor: "no", etiqueta: "No" },
      { valor: "clausura_temporal", etiqueta: "Clausura temporal" },
      { valor: "multa", etiqueta: "Multa" },
      { valor: "accidente_denunciado", etiqueta: "Denunciado por accidente" },
      { valor: "multiples", etiqueta: "Varias de las anteriores" },
    ],
  },
  {
    campo: "conflictividad_social",
    texto: "¿Hay conflictividad con comunidades aledañas?",
    tipo: "opciones",
    opciones: OPCIONES_CONFLICTIVIDAD,
  },
  {
    campo: "permisos_comunitarios",
    texto: "¿Tienes relaciones o permisos formales con comunidades?",
    tipo: "opciones",
    opciones: [
      { valor: "no", etiqueta: "No" },
      { valor: "informales", etiqueta: "Informales" },
      { valor: "formales", etiqueta: "Formales" },
      { valor: "en_tramite", etiqueta: "En trámite" },
    ],
  },
  {
    campo: "acceso_logistico",
    texto: "¿Cómo es el acceso logístico a tu mina?",
    tipo: "opciones",
    opciones: [
      { valor: "carretera_asfaltada", etiqueta: "Carretera asfaltada" },
      { valor: "camino_afirmado", etiqueta: "Camino afirmado" },
      { valor: "trocha", etiqueta: "Trocha" },
      { valor: "muy_remoto", etiqueta: "Muy remoto" },
    ],
  },
  {
    campo: "experiencia_operador",
    texto: "¿Experiencia de quien dirige la operación?",
    tipo: "opciones",
    opciones: [
      { valor: "< 2 años", etiqueta: "Menos de 2 años" },
      { valor: "2-5 años", etiqueta: "2 a 5 años" },
      { valor: "5-10 años", etiqueta: "5 a 10 años" },
      { valor: "> 10 años", etiqueta: "Más de 10 años" },
    ],
  },
  {
    campo: "capacitacion_operador",
    texto: "¿Qué capacitación o colegiatura tiene el operador?",
    tipo: "opciones",
    opciones: [
      { valor: "ninguna", etiqueta: "Ninguna" },
      { valor: "cursos_tecnicos", etiqueta: "Cursos técnicos" },
      { valor: "cip", etiqueta: "CIP (ingeniero colegiado)" },
      { valor: "ing_geologo", etiqueta: "Ingeniero geólogo" },
      { valor: "otro_profesional", etiqueta: "Otro profesional" },
    ],
    permiteOtro: true,
  },
  {
    campo: "documentacion_disponible",
    texto: "¿Puedes documentar la operación con fotos o reportes?",
    tipo: "opciones",
    opciones: [
      { valor: "no", etiqueta: "No" },
      { valor: "fotos_basicas", etiqueta: "Sí, fotos básicas" },
      { valor: "reportes_tecnicos", etiqueta: "Sí, reportes técnicos" },
      { valor: "ambos", etiqueta: "Sí, ambos" },
    ],
  },
  {
    campo: "estructura_propiedad",
    texto: "¿Cuál es la estructura de propiedad de tu operación?",
    tipo: "opciones",
    opciones: [
      { valor: "dueno_mina", etiqueta: "Dueño de la mina" },
      { valor: "arrendatario", etiqueta: "Arrendatario de terreno" },
      { valor: "contratista", etiqueta: "Contratista" },
      { valor: "otro", etiqueta: "Otro acuerdo" },
    ],
  },
  {
    campo: "plan_formalizacion",
    texto: "¿Tienes plan para formalizar?",
    tipo: "opciones",
    opciones: [
      { valor: "sin_plan", etiqueta: "No tengo plan" },
      { valor: "menos_6_meses", etiqueta: "Planeo en menos de 6 meses" },
      { valor: "6_12_meses", etiqueta: "Planeo en 6 a 12 meses" },
      { valor: "ya_iniciado", etiqueta: "Ya iniciado" },
      { valor: "ya_aprobado", etiqueta: "Ya aprobado" },
    ],
  },
  {
    campo: "prioridad_crecimiento",
    texto: "¿Qué es lo más importante para que crezca tu mina?",
    tipo: "opciones",
    opciones: [
      { valor: "capital", etiqueta: "Acceso a capital" },
      { valor: "equipamiento", etiqueta: "Equipamiento" },
      { valor: "asesoria_legal", etiqueta: "Asesoría legal" },
      { valor: "conexiones_comerciales", etiqueta: "Conexiones comerciales" },
      { valor: "otro", etiqueta: "Otro" },
    ],
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
    tipo: "opciones",
    opciones: [
      { valor: "si", etiqueta: "Sí" },
      { valor: "no", etiqueta: "No" },
      { valor: "en_tramite_renovacion", etiqueta: "En trámite de renovación" },
    ],
  },
  {
    campo: "pagos_vigencia_al_dia",
    texto: "¿Pagos de derecho de vigencia al día?",
    tipo: "opciones",
    opciones: [
      { valor: "si", etiqueta: "Sí" },
      { valor: "atrasados", etiqueta: "Atrasados" },
      { valor: "desconozco", etiqueta: "Desconozco" },
    ],
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
    texto: "¿Qué tipo de depósito es tu concesión?",
    tipo: "opciones",
    opciones: [
      { valor: "veta epitérmica", etiqueta: "Veta epitérmica" },
      { valor: "pórfido cobre-molibdeno", etiqueta: "Pórfido cobre-molibdeno" },
      { valor: "depósito aluvial", etiqueta: "Depósito aluvial" },
      { valor: "depósito masivo", etiqueta: "Depósito masivo" },
      { valor: "diseminado", etiqueta: "Diseminado" },
      { valor: "sedimentario", etiqueta: "Sedimentario" },
      { valor: "No sé", etiqueta: "No sé" },
    ],
    permiteOtro: true,
  },
  {
    campo: "toneladas_estimadas",
    texto: "¿Estimación de toneladas del depósito?",
    tipo: "opciones",
    opciones: [
      { valor: "< 100k t", etiqueta: "Menos de 100 mil t" },
      { valor: "100k-1M", etiqueta: "100 mil a 1 millón t" },
      { valor: "1M-10M", etiqueta: "1 a 10 millones t" },
      { valor: "10M-50M", etiqueta: "10 a 50 millones t" },
      { valor: "50M-500M", etiqueta: "50 a 500 millones t" },
      { valor: "500M+", etiqueta: "Más de 500 millones t" },
      { valor: "No sé", etiqueta: "No sé" },
    ],
  },
  {
    campo: "ley_esperada",
    texto: "¿Ley esperada, si la conoces?",
    tipo: "texto",
    placeholder: 'Ej. "0.5 g/t Au" o "0.3% Cu" (si no la sabes, déjalo en blanco)',
  },
  {
    campo: "etapa_proyecto",
    texto: "¿En qué etapa consideras que se encuentra tu proyecto?",
    tipo: "opciones",
    opciones: [
      { valor: "solo concesión, sin trabajos", etiqueta: "Solo tengo la concesión, sin trabajos aún" },
      { valor: "exploración inicial", etiqueta: "Exploración inicial" },
      { valor: "exploración avanzada", etiqueta: "Exploración avanzada" },
      { valor: "pre-factibilidad", etiqueta: "Pre-factibilidad" },
      { valor: "listo para operar", etiqueta: "Listo para empezar a operar" },
    ],
    permiteOtro: true,
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
      { valor: "geofisicos", etiqueta: "Estudios geofísicos" },
      { valor: "ninguno", etiqueta: "Ninguno todavía" },
    ],
  },
  {
    campo: "info_geologica_disponible",
    texto: "¿Cuentas con información geológica disponible?",
    tipo: "opciones",
    opciones: OPCIONES_TRES_NIVELES("Sí, parcial", "Sí, completa"),
  },
  {
    campo: "tiene_resultados_laboratorio",
    texto: "¿Cuentas con ensayes de laboratorio?",
    tipo: "opciones",
    opciones: OPCIONES_TRES_NIVELES("Sí, algunos", "Sí, completos"),
  },
  {
    campo: "tiene_estimaciones_leyes",
    texto: "¿Posees estimaciones de leyes confirmadas?",
    tipo: "opciones",
    opciones: [
      { valor: "no", etiqueta: "No" },
      { valor: "preliminar", etiqueta: "Sí, preliminar" },
      { valor: "por_terceros", etiqueta: "Sí, por terceros" },
    ],
  },
  {
    campo: "produccion_objetivo",
    texto: "¿Cuál es tu producción objetivo anual una vez en operación?",
    tipo: "opciones",
    opciones: [
      { valor: "< 1k t/año", etiqueta: "Menos de 1,000 t/año" },
      { valor: "1-10k", etiqueta: "1,000 a 10,000 t/año" },
      { valor: "10-50k", etiqueta: "10,000 a 50,000 t/año" },
      { valor: "50-100k", etiqueta: "50,000 a 100,000 t/año" },
      { valor: "100-500k", etiqueta: "100,000 a 500,000 t/año" },
      { valor: "500k+", etiqueta: "Más de 500,000 t/año" },
      { valor: "No definida", etiqueta: "No definida" },
    ],
  },
  {
    campo: "monto_requerido",
    texto: "¿Cuánto capital estimas necesario para iniciar operación?",
    tipo: "opciones",
    opciones: [
      { valor: "S/. 100,000 - 500,000", etiqueta: "S/. 100,000 - 500,000" },
      { valor: "S/. 500,000 - 2,000,000", etiqueta: "S/. 500,000 - 2,000,000" },
      { valor: "S/. 2,000,000 - 10,000,000", etiqueta: "S/. 2,000,000 - 10,000,000" },
      { valor: "S/. 10,000,000 - 50,000,000", etiqueta: "S/. 10,000,000 - 50,000,000" },
      { valor: "S/. 50,000,000 - 200,000,000", etiqueta: "S/. 50,000,000 - 200,000,000" },
      { valor: "S/. 200,000,000+", etiqueta: "Más de S/. 200,000,000" },
      { valor: "No sé", etiqueta: "No sé" },
    ],
  },
  {
    campo: "capital_disponible",
    texto: "¿Ya cuentas con capital inicial o fuentes de financiamiento?",
    tipo: "opciones",
    opciones: [
      { valor: "no_tengo", etiqueta: "No tengo" },
      { valor: "parcial", etiqueta: "Tengo parcial" },
      { valor: "completo", etiqueta: "Tengo completo" },
      { valor: "buscando", etiqueta: "Busco completar" },
    ],
  },
  {
    campo: "estudio_previo",
    texto: "¿Has realizado un estudio de prefactibilidad o factibilidad?",
    tipo: "opciones",
    opciones: [
      { valor: "no", etiqueta: "No" },
      { valor: "interno_preliminar", etiqueta: "Interno preliminar" },
      { valor: "externo_parcial", etiqueta: "Externo parcial" },
      { valor: "externo_completo", etiqueta: "Externo completo" },
    ],
  },
  {
    campo: "historial_operacion",
    texto: "¿Fue operada previamente esta concesión?",
    tipo: "opciones",
    opciones: [
      { valor: "no", etiqueta: "No" },
      { valor: "< 2 años", etiqueta: "Sí, menos de 2 años" },
      { valor: "2-5 años", etiqueta: "Sí, 2 a 5 años" },
      { valor: "5-10 años", etiqueta: "Sí, 5 a 10 años" },
      { valor: "> 10 años", etiqueta: "Sí, más de 10 años" },
    ],
  },
  {
    campo: "pasivos_ambientales",
    texto: "¿Existen pasivos ambientales heredados?",
    tipo: "opciones",
    opciones: [
      { valor: "no", etiqueta: "No" },
      { valor: "menor", etiqueta: "Sí, menor" },
      { valor: "mayor", etiqueta: "Sí, mayor" },
      { valor: "desconozco", etiqueta: "Desconozco" },
    ],
  },
  {
    campo: "conflictividad_social",
    texto: "¿Hay oposición o conflictividad comunitaria conocida?",
    tipo: "opciones",
    opciones: [...OPCIONES_CONFLICTIVIDAD, { valor: "desconozco", etiqueta: "Desconozco" }],
  },
  {
    campo: "acceso_agua",
    texto: "¿Acceso a agua suficiente para la operación?",
    tipo: "opciones",
    opciones: [...OPCIONES_ACCESO_AGUA, { valor: "en_negociacion", etiqueta: "En negociación" }],
  },
  {
    campo: "acceso_energia",
    texto: "¿Acceso a energía eléctrica?",
    tipo: "opciones",
    opciones: OPCIONES_ACCESO_ENERGIA,
  },
  {
    campo: "formalizacion_iniciada",
    texto: "¿Has iniciado algún proceso de formalización (REINFO)?",
    tipo: "opciones",
    opciones: [
      { valor: "no", etiqueta: "No" },
      { valor: "en_tramite", etiqueta: "En trámite" },
      { valor: "aprobado", etiqueta: "Aprobado" },
    ],
  },
  {
    campo: "tiene_ruc",
    texto: "¿Cuentas con RUC?",
    tipo: "opciones",
    opciones: [
      { valor: "no", etiqueta: "No" },
      { valor: "activo", etiqueta: "Sí, activo" },
      { valor: "inactivo", etiqueta: "Sí, inactivo" },
    ],
  },
  {
    campo: "experiencia_titular",
    texto: "¿Experiencia del titular/promotor principal?",
    tipo: "opciones",
    opciones: [
      { valor: "individual_sin_experiencia", etiqueta: "Individual sin experiencia previa" },
      { valor: "individual_con_experiencia", etiqueta: "Individual con experiencia técnica" },
      { valor: "empresa_nueva", etiqueta: "Empresa nueva" },
      { valor: "empresa_con_trayectoria", etiqueta: "Empresa con trayectoria en minería" },
    ],
  },
  {
    campo: "background_titular",
    texto: "¿Background profesional del titular?",
    tipo: "opciones",
    opciones: [
      { valor: "ing_geologica", etiqueta: "Ingeniería geológica" },
      { valor: "ing_minas", etiqueta: "Ingeniería de minas" },
      { valor: "empresarial", etiqueta: "Empresarial" },
      { valor: "inversionista", etiqueta: "Inversionista" },
      { valor: "otro", etiqueta: "Otro" },
      { valor: "prefiero_no_decir", etiqueta: "Prefiero no decir" },
    ],
  },
  {
    campo: "equipo_tecnico",
    texto: "¿Tienes equipo técnico definido?",
    tipo: "opciones",
    opciones: [
      { valor: "no", etiqueta: "No" },
      { valor: "parcial", etiqueta: "Sí, parcial" },
      { valor: "completo", etiqueta: "Sí, completo" },
    ],
  },
  {
    campo: "tipo_socio_buscado",
    texto: "¿Qué tipo de socio o inversor buscas?",
    tipo: "opciones",
    opciones: [
      { valor: "socio_operador", etiqueta: "Socio operador" },
      { valor: "inversor_financiero", etiqueta: "Inversor financiero" },
      { valor: "comprador_mineral", etiqueta: "Comprador de mineral" },
      { valor: "proveedor_equipo", etiqueta: "Proveedor de equipo" },
      { valor: "otro", etiqueta: "Otro" },
    ],
  },
  {
    campo: "siguiente_hito",
    texto: "¿Cuál es tu siguiente hito técnico o administrativo?",
    tipo: "opciones",
    opciones: [
      { valor: "sondajes", etiqueta: "Sondajes exploratorios" },
      { valor: "prefactibilidad", etiqueta: "Estudio de prefactibilidad" },
      { valor: "igafom", etiqueta: "IGAFOM" },
      { valor: "eia", etiqueta: "EIA" },
      { valor: "construccion", etiqueta: "Construcción" },
      { valor: "operacion", etiqueta: "Operación" },
      { valor: "otro", etiqueta: "Otro" },
    ],
  },
  {
    campo: "timeline_operacion",
    texto: "¿Timeline esperado hasta operación?",
    tipo: "opciones",
    opciones: [
      { valor: "< 6 meses", etiqueta: "Menos de 6 meses" },
      { valor: "6-12 meses", etiqueta: "6 a 12 meses" },
      { valor: "1-2 años", etiqueta: "1 a 2 años" },
      { valor: "2-3 años", etiqueta: "2 a 3 años" },
      { valor: "> 3 años", etiqueta: "Más de 3 años" },
      { valor: "indefinido", etiqueta: "Indefinido" },
    ],
  },
  {
    campo: "motivo_inicio",
    texto: "¿Por qué iniciaste este proyecto?",
    tipo: "opciones",
    opciones: [
      { valor: "descubrimiento_propio", etiqueta: "Descubrimiento propio" },
      { valor: "compra_concesion", etiqueta: "Compra de concesión" },
      { valor: "opcion_tercero", etiqueta: "Opción de tercero" },
      { valor: "otra", etiqueta: "Otra" },
    ],
  },
  {
    campo: "tipo_apoyo",
    texto: "¿Qué es lo más importante para desarrollarlo?",
    tipo: "opciones",
    opciones: [
      { valor: "capital", etiqueta: "Capital" },
      { valor: "equipamiento", etiqueta: "Equipamiento" },
      { valor: "asesoria_tecnica", etiqueta: "Asesoría técnica" },
      { valor: "permisos_licencias", etiqueta: "Permisos y licencias" },
      { valor: "socio", etiqueta: "Socio" },
      { valor: "mercado", etiqueta: "Mercado" },
    ],
  },
  {
    campo: "estructura_propiedad",
    texto: "¿Estructura de propiedad?",
    tipo: "opciones",
    opciones: OPCIONES_ESTRUCTURA_PROPIEDAD,
  },
];
