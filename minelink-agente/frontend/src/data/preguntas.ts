/** Catálogo de preguntas del diagnóstico de formalización (perfiles A/B/C/D).
 *  Espejo EXACTO de backend/catalogo_diagnostico.py — cualquier desfase
 *  produce 422 en POST /diagnostico. Los textos visibles viven acá;
 *  la lógica de routing/semáforos vive en el backend (scoring.py). */

import type { IdPregunta, NombreDimension, PerfilDiagnostico } from "../types/diagnostico";

// -------------------------------------------------------------------
// Tipos
// -------------------------------------------------------------------

export type TipoPregunta = "opcion" | "numero" | "anio" | "estado_doc";

export interface OpcionPregunta {
  valor: string;
  etiqueta: string;
  descripcion?: string;
}

export interface PreguntaCatalogo {
  id: IdPregunta;
  tipo: TipoPregunta;
  texto: string;
  ayuda?: string;
  opciones?: OpcionPregunta[];
  placeholder?: string;
  min?: number;
  max?: number;
  /** Si está presente, la pregunta solo se muestra cuando el perfil
   *  evaluado contra las respuestas acumuladas devuelve true. */
  mostrarSi?: (respuestas: Record<string, string>) => boolean;
}

// -------------------------------------------------------------------
// Módulo 0: ubicación (se pregunta SIEMPRE primero)
// -------------------------------------------------------------------

export const MODULO_0: PreguntaCatalogo[] = [
  {
    id: "M0_1",
    tipo: "opcion",
    texto: "¿Cuál describe mejor tu situación?",
    ayuda:
      "Esta pregunta nos ayuda a mostrarte solo lo que te corresponde. No te preocupes si no sabes exactamente: elige la que más se parezca a tu caso.",
    opciones: [
      { valor: "concesion_propia", etiqueta: "Estoy explotando una concesión minera", descripcion: "Como titular o mediante un contrato" },
      { valor: "concesion_no_operando", etiqueta: "Tengo una concesión (o derecho para operarla), pero aún no exploto", descripcion: "Todavía no he iniciado actividades mineras" },
      { valor: "petitorio_tramite", etiqueta: "Estoy tramitando un petitorio minero", descripcion: "Busco obtener una concesión" },
      { valor: "nada", etiqueta: "Quiero empezar desde cero", descripcion: "Necesito orientación para iniciar" },
    ],
  },
  {
    id: "M0_3",
    tipo: "opcion",
    texto: "¿Estás formalizado o inscrito en REINFO?",
    ayuda:
      "REINFO es el registro para quien está EN PROCESO de formalizarse — si ya tienes tu título, licencia y todos los permisos vigentes, ya eres formal y no necesitas REINFO. Si no tienes ninguno de los dos, tu operación no tiene amparo legal todavía. Si tienes concesión propia y estás inscrito en REINFO sobre esa misma concesión, estás exceptuado de la declaración de producción semestral (D.S. N°001-2020-EM, Art. 7c).",
    opciones: [
      { valor: "formal", etiqueta: "Ya estoy formalizado", descripcion: "Tengo título, licencia y todos los permisos vigentes — no necesito REINFO" },
      { valor: "reinfo", etiqueta: "Estoy inscrito en REINFO", descripcion: "Estoy en proceso de formalización" },
      { valor: "no", etiqueta: "Ninguno de los dos" },
    ],
  },
  {
    id: "M0_4",
    tipo: "opcion",
    texto: "¿Tu REINFO está vigente o suspendido?",
    ayuda:
      "Vigente = al día. Suspendido = paralizado. Puedes verificarlo con tu DNI en la página del MINEM.",
    opciones: [
      { valor: "vigente", etiqueta: "Vigente" },
      { valor: "suspendido", etiqueta: "Suspendido" },
    ],
  },
];

// -------------------------------------------------------------------
// Módulo A: desde cero (quiere concesión)
// -------------------------------------------------------------------

export const MODULO_A: PreguntaCatalogo[] = [
  {
    id: "A1_1",
    tipo: "opcion",
    texto: "¿Ya identificaste un área que te interesa?",
    ayuda:
      "Es la zona geográfica donde quieres que se ubique tu futura concesión. No necesitas tenerla exacta: basta con que sepas más o menos dónde.",
    opciones: [
      { valor: "si", etiqueta: "Sí" },
      { valor: "no", etiqueta: "No" },
    ],
  },
  {
    id: "A1_2",
    tipo: "opcion",
    texto: "¿Verificaste si esa área está disponible en GEOCATMIN?",
    ayuda:
      "GEOCATMIN es la página del Estado donde puedes revisar si la zona que quieres ya tiene concesión de alguien más. Si no sabes cómo, te guiamos.",
    opciones: [
      { valor: "si", etiqueta: "Sí, la verifiqué" },
      { valor: "no", etiqueta: "No, no lo hice" },
      { valor: "no_se_como", etiqueta: "No sé cómo hacerlo" },
    ],
  },
  {
    id: "A1_3",
    tipo: "opcion",
    texto: "¿Tienes coordenadas UTM del área?",
    ayuda:
      "Son los puntos GPS exactos que marcan dónde está tu zona. Los toma un topógrafo con equipo especial y sirven para el trámite ante INGEMMET.",
    opciones: [
      { valor: "si", etiqueta: "Sí" },
      { valor: "no", etiqueta: "No" },
    ],
  },
  {
    id: "A2_1",
    tipo: "opcion",
    texto: "¿El área tiene alguna restricción especial?",
    ayuda:
      "Algunas zonas no se pueden concesionar por proteger el ambiente, la historia o las fronteras. Revisa la lista.",
    opciones: [
      { valor: "anp", etiqueta: "Área Natural Protegida" },
      { valor: "arqueologica", etiqueta: "Zona arqueológica" },
      { valor: "urbana", etiqueta: "Zona urbana" },
      { valor: "cauce_rio", etiqueta: "Cauce de río" },
      { valor: "frontera", etiqueta: "Zona de frontera" },
      { valor: "ninguna", etiqueta: "Ninguna de estas" },
      { valor: "no_se", etiqueta: "No sé" },
    ],
  },
  {
    id: "A2_2",
    tipo: "opcion",
    texto: "¿Piensas usar dragas en cuerpos de agua?",
    ayuda:
      "Las dragas son máquinas que sacan mineral de ríos o lagos. Por ley están prohibidas en Perú.",
    opciones: [
      { valor: "si", etiqueta: "Sí" },
      { valor: "no", etiqueta: "No" },
    ],
  },
  {
    id: "A3_1",
    tipo: "opcion",
    texto: "¿Quién es el dueño del terreno superficial?",
    ayuda:
      "La concesión minera es del subsuelo (lo que está debajo), pero si el terreno es de alguien más, necesitas su acuerdo para trabajar. El terreno puede ser tuyo, de un particular, de una comunidad o del Estado.",
    opciones: [
      { valor: "mio", etiqueta: "Es mío" },
      { valor: "privado", etiqueta: "Es de otra persona" },
      { valor: "comunidad", etiqueta: "Es de una comunidad" },
      { valor: "estado", etiqueta: "Es del Estado" },
      { valor: "no_se", etiqueta: "No sé" },
    ],
  },
  {
    id: "A3_2",
    tipo: "opcion",
    texto: "¿Ya conversaste con el dueño del terreno?",
    ayuda:
      "Si el terreno es de otra persona o comunidad, necesitas hablar con ellos para llegar a un acuerdo antes de iniciar trabajos.",
    opciones: [
      { valor: "si", etiqueta: "Sí" },
      { valor: "no", etiqueta: "No" },
    ],
  },
  {
    id: "A4_1",
    tipo: "opcion",
    texto: "¿Ya juntaste los documentos para el petitorio?",
    ayuda:
      "El petitorio es el conjunto de documentos que presentas ante INGEMMET para pedir tu concesión. Necesitas: planos, coordinate, pago de vigencia, etc.",
    opciones: [
      { valor: "completo", etiqueta: "Sí, tengo todo" },
      { valor: "parcial", etiqueta: "Tengo algunos" },
      { valor: "no", etiqueta: "No tengo ninguno" },
    ],
  },
  {
    id: "A4_2",
    tipo: "opcion",
    texto: "¿Te asociarías con un inversionista para costear los trámites?",
    ayuda:
      "Si no tienes todo el dinero para los trámites y estudios, un inversionista puede financiarlo a cambio de participación. Es una opción, no obligatoria.",
    opciones: [
      { valor: "si", etiqueta: "Sí, me interesa" },
      { valor: "no", etiqueta: "No, prefiero solo" },
      { valor: "tal_vez", etiqueta: "Tal vez" },
    ],
  },
  {
    id: "A5_1",
    tipo: "opcion",
    texto: "¿Cómo planeas extraer el mineral?",
    ayuda:
      "Esto define tu clasificación como Pequeña Minería (manual) o Pequeña Minería Mecanizada. Es importante para saber qué trámites necesitas.",
    opciones: [
      { valor: "manual", etiqueta: "Manual (picos, palas)" },
      { valor: "maquinaria", etiqueta: "Con maquinaria" },
      { valor: "no_se", etiqueta: "No sé todavía" },
    ],
  },
  {
    id: "A5_2",
    tipo: "opcion",
    texto: "¿Qué tipo de mineral buscas extraer?",
    ayuda:
      "El mineral que esperas encontrar define algunos trámites adicionales. Si no estás seguro, elige 'Otro'.",
    opciones: [
      { valor: "oro", etiqueta: "Oro" },
      { valor: "cobre", etiqueta: "Cobre" },
      { valor: "polimetalico", etiqueta: "Polimetálico (varios minerales)" },
      { valor: "no_metalico", etiqueta: "No metálico (arcilla, arena, etc.)" },
      { valor: "otro", etiqueta: "Otro" },
    ],
  },
];

// -------------------------------------------------------------------
// Módulo B: concesionario sin operar
// -------------------------------------------------------------------

export const MODULO_B: PreguntaCatalogo[] = [
  {
    id: "B1_1",
    tipo: "opcion",
    texto: "¿Estás al día con el pago de la vigencia de tu concesión?",
    ayuda:
      "La vigencia es el derecho anual que pagas a INGEMMET para mantener tu concesión. Si no pagas, puedes perderla.",
    opciones: [
      { valor: "al_dia", etiqueta: "Sí, al día" },
      { valor: "debo_1", etiqueta: "Debo 1 año" },
      { valor: "debo_2_mas", etiqueta: "Debo 2 o más años" },
      { valor: "no_se", etiqueta: "No sé" },
    ],
  },
  {
    id: "B2_1",
    tipo: "opcion",
    texto: "¿Qué tipo de constancia ambiental tienes?",
    ayuda:
      "Es el permiso ambiental que necesitas para operar. PMA = Pequeña Minería Ambiental (hasta 1,000 ha). PPM = Producción Minera (hasta 2,000 ha). Si no tienes, hay que tramitarlo. Esto define el plazo que tienes para poner tu mina en producción.",
    opciones: [
      { valor: "pma", etiqueta: "PMA (Pequeña Minería Ambiental)" },
      { valor: "ppm", etiqueta: "PPM (Producción Minera)" },
      { valor: "no_tengo", etiqueta: "No tengo" },
      { valor: "no_se", etiqueta: "No sé" },
    ],
  },
  {
    id: "B2_2",
    tipo: "numero",
    texto: "¿Cuántas hectáreas tiene tu concesión?",
    ayuda:
      "Es el tamaño de tu concesión en hectáreas. Lo encuentras en tu título o en GEOCATMIN. Si declaraste PMA pero tienes más de 1,000 ha, en la práctica te tratamos como PPM.",
    placeholder: "Ej. 500",
    min: 1,
    max: 100000,
  },
  {
    id: "B1_2",
    tipo: "anio",
    texto: "¿En qué año sacaste tu título de concesión?",
    ayuda:
      "Es el año en que INGEMMET te dio tu título oficial. Si no lo recuerdas, revisa tu documento. Con esto calculamos si tu plazo para producir (PMA: 10 años, PPM: 6 años) ya venció.",
    placeholder: "Ej. 2018",
    min: 1950,
  },
  {
    id: "B1_3",
    tipo: "opcion",
    // Solo aparece si, con la clasificación y el año ya declarados, el
    // reloj de producción mínima efectivamente venció (ver idsAplicables) —
    // antes no hay ninguna penalidad que preguntar.
    texto: "¿Ya pagaste la penalidad por no haber producido a tiempo?",
    ayuda:
      "Ya pasó tu plazo para poner la mina en producción sin haber empezado. Debes pagar una penalidad. Si no la pagaste, hay riesgo de caducidad.",
    opciones: [
      { valor: "pago", etiqueta: "Sí, ya pagué" },
      { valor: "no_pago", etiqueta: "No, no pagué" },
      { valor: "no_se", etiqueta: "No sé" },
    ],
  },
  {
    id: "B1_4",
    tipo: "opcion",
    texto: "¿Quién es el dueño del terreno superficial?",
    ayuda:
      "La concesión minera es del subsuelo (lo que está debajo), pero si el terreno es de alguien más, necesitas su acuerdo para trabajar. El terreno puede ser tuyo, de un particular, de una comunidad o del Estado.",
    opciones: [
      { valor: "mio", etiqueta: "Es mío" },
      { valor: "privado", etiqueta: "Es de otra persona" },
      { valor: "comunidad", etiqueta: "Es de una comunidad" },
      { valor: "estado", etiqueta: "Es del Estado" },
      { valor: "no_se", etiqueta: "No sé" },
    ],
  },
  {
    id: "B1_5",
    tipo: "opcion",
    texto: "¿Ya conversaste con el dueño del terreno?",
    ayuda:
      "Si el terreno es de otra persona o comunidad, necesitas llegar a un acuerdo con ellos antes de empezar a operar.",
    opciones: [
      { valor: "si", etiqueta: "Sí" },
      { valor: "no", etiqueta: "No" },
    ],
  },
  // ⏸️ EN PAUSA (julio 2026): B3_1/B3_2 son de inversión (estudios
  // geológicos/laboratorio), no de formalización — fuera de idsAplicables(),
  // no se muestran. No borrar: van a un grupo aparte más adelante.
  {
    id: "B3_1",
    tipo: "opcion",
    texto: "¿Cuentas con estudios geológicos formales?",
    ayuda:
      "Son documentos hechos por un geólogo que describen qué tipo de roca y mineral hay en tu zona. Si solo tienes información informal, elige 'Solo referencias'.",
    opciones: [
      { valor: "estudios_formales", etiqueta: "Sí, estudios formales" },
      { valor: "referencias", etiqueta: "Solo referencias informales" },
      { valor: "no", etiqueta: "No tengo" },
    ],
  },
  {
    id: "B3_2",
    tipo: "opcion",
    texto: "¿Tienes análisis de laboratorio de tu mineral?",
    ayuda:
      "Son los resultados que dicen cuánta ley tienen tus muestras (por ejemplo, cuántos gramos de oro por tonelada). Si solo has procesado artesanalmente, elige 'Artesanal'.",
    opciones: [
      { valor: "laboratorio", etiqueta: "Sí, con laboratorio certificado" },
      { valor: "artesanal", etiqueta: "Solo procesamiento artesanal" },
      { valor: "no", etiqueta: "No tengo" },
    ],
  },
  {
    id: "B4_1",
    tipo: "opcion",
    texto: "¿Qué planeas hacer con tu concesión?",
    ayuda:
      "Esto nos ayuda a mostrarte los siguientes pasos correctos.",
    opciones: [
      { valor: "operar_yo", etiqueta: "Operarla yo mismo" },
      { valor: "ceder_contrato", etiqueta: "Ceder el contrato a alguien más" },
      { valor: "buscar_inversionista", etiqueta: "Buscar un inversionista" },
      { valor: "no_se", etiqueta: "No sé todavía" },
    ],
  },
  {
    id: "B5_1",
    tipo: "opcion",
    texto: "¿Cómo está tu DIA / EIA-sd? (instrumento ambiental)",
    ayuda:
      "El DIA (Declaración de Impacto Ambiental) o EIA-sd (Estudio de Impacto Ambiental simplificado) es tu permiso para operar sin dañar el ambiente. Puede estar aprobado, en trámite o no iniciado.",
    opciones: [
      { valor: "aprobado", etiqueta: "Aprobado" },
      { valor: "en_tramite", etiqueta: "En trámite" },
      { valor: "no_iniciado", etiqueta: "No iniciado" },
      { valor: "no_se", etiqueta: "No sé" },
    ],
  },
  {
    id: "B5_3",
    tipo: "opcion",
    texto: "¿Tienes la licencia de agua de la ANA?",
    ayuda:
      "La Autoridad Nacional del Agua (ANA) otorga el permiso para usar agua en tu operación minera. Sin ella no puedes operar legalmente.",
    opciones: [
      { valor: "si", etiqueta: "Sí, ya la tengo" },
      { valor: "en_tramite", etiqueta: "Está en trámite" },
      { valor: "no", etiqueta: "No la tengo" },
      { valor: "no_usa_agua", etiqueta: "No uso agua" },
    ],
  },
  {
    id: "B5_4",
    tipo: "opcion",
    texto: "¿Tienes la autorización de la DREM/GREM?",
    ayuda:
      "La Dirección Regional de Energía y Minas (DREM) o su equivalente local (GREM) debe autorizar tu inicio de actividades. Sin esta autorización no puedes empezar a operar.",
    opciones: [
      { valor: "si", etiqueta: "Sí, ya la tengo" },
      { valor: "no", etiqueta: "No la tengo" },
      { valor: "no_sabia", etiqueta: "No sabía que la necesitaba" },
    ],
  },
];

// -------------------------------------------------------------------
// Módulo C: REINFO (opera y formaliza)
// -------------------------------------------------------------------

export const MODULO_C: PreguntaCatalogo[] = [
  {
    id: "C1_1",
    tipo: "opcion",
    texto: "¿Tu REINFO está vigente o suspendida?",
    ayuda: "Prellenada del Módulo 0 — confirma el estado de tu REINFO.",
    opciones: [
      { valor: "vigente", etiqueta: "Vigente" },
      { valor: "suspendida", etiqueta: "Suspendida" },
    ],
  },
  {
    id: "C1_2",
    tipo: "opcion",
    texto: "¿Ya hiciste el sinceramiento de coordenadas (Ley 32537)?",
    ayuda:
      "La Ley 32537 pide que actualices las coordenadas GPS de tu labor para que coincidan con lo que declaraste. Es un trámite obligatorio.",
    opciones: [
      { valor: "si", etiqueta: "Sí, ya lo hice" },
      { valor: "no", etiqueta: "No, todavía no" },
      { valor: "no_se", etiqueta: "No sé qué es eso" },
    ],
  },
  {
    id: "C1_3",
    tipo: "opcion",
    texto: "¿Eres el titular de esta concesión o la operas por contrato/cesión?",
    ayuda:
      "Si la concesión es tuya (tienes el título a tu nombre), eres el titular. Si trabajas en la concesión de otra persona con un contrato o cesión, no eres el titular.",
    opciones: [
      { valor: "titular", etiqueta: "Soy el titular" },
      { valor: "contrato", etiqueta: "La opero por contrato/cesión" },
    ],
  },
  // Bloque "no soy titular" (solo C1_3=contrato): contrato con el titular
  // + declaración semestral, encadenados justo después de la pregunta que
  // los activa — no al final del checklist (julio 2026).
  {
    id: "C3_1",
    tipo: "opcion",
    texto: "¿Cómo está el contrato con el titular de la concesión?",
    ayuda:
      "Si trabajas en una concesión que no es tuya, necesitas un contrato con el titular. Si es tu propia concesión, esta pregunta no aplica.",
    opciones: [
      { valor: "firmado_inscrito", etiqueta: "Firmado e inscrito en SUNARP" },
      { valor: "firmado_sin_inscribir", etiqueta: "Firmado pero no inscrito" },
      { valor: "en_negociacion", etiqueta: "Estamos negociando" },
      { valor: "se_niega", etiqueta: "El titular se niega" },
      { valor: "no_he_hablado", etiqueta: "No he hablado con el titular" },
    ],
  },
  {
    id: "C2_7",
    tipo: "estado_doc",
    texto: "¿Cómo está tu declaración de producción semestral?",
    ayuda:
      "Cada 6 meses debes reportar cuánto mineral produjiste. Es obligatorio para mantener tu REINFO activo.",
    opciones: [
      { valor: "aprobado", etiqueta: "Aprobado" },
      { valor: "presentado", etiqueta: "Presentado (en evaluación)" },
      { valor: "no_iniciado", etiqueta: "No iniciado" },
      { valor: "no_se", etiqueta: "No sé" },
    ],
  },
  {
    id: "C2_1",
    tipo: "estado_doc",
    texto: "¿Cómo está tu constancia de IGAFOM/IGAC?",
    ayuda:
      "Es la constancia de que tu plan ambiental fue aprobado. Puede estar aprobada, en trámite, no iniciada o no sabes.",
    opciones: [
      { valor: "aprobado", etiqueta: "Aprobado" },
      { valor: "presentado", etiqueta: "Presentado (en evaluación)" },
      { valor: "no_iniciado", etiqueta: "No iniciado" },
      { valor: "no_se", etiqueta: "No sé" },
    ],
  },
  {
    id: "C2_2",
    tipo: "estado_doc",
    texto: "¿Cómo está tu constancia de terreno superficial?",
    ayuda:
      "Es el documento que acredita que tienes acuerdo con el dueño del terreno donde está tu mina.",
    opciones: [
      { valor: "aprobado", etiqueta: "Aprobado" },
      { valor: "presentado", etiqueta: "Presentado (en evaluación)" },
      { valor: "no_iniciado", etiqueta: "No iniciado" },
      { valor: "no_se", etiqueta: "No sé" },
    ],
  },
  {
    id: "C2_3",
    tipo: "estado_doc",
    texto: "¿Cómo está la inscripción de tu titularidad en SUNARP?",
    ayuda:
      "Es el documento que dice quién es el dueño legal de la concesión, registrado en la SUNARP.",
    opciones: [
      { valor: "aprobado", etiqueta: "Aprobado" },
      { valor: "presentado", etiqueta: "Presentado (en evaluación)" },
      { valor: "no_iniciado", etiqueta: "No iniciado" },
      { valor: "no_se", etiqueta: "No sé" },
    ],
  },
  {
    id: "C2_4",
    tipo: "estado_doc",
    texto: "¿Cómo está tu declaración de restos arqueológicos?",
    ayuda:
      "Es una declaración que haces diciendo que en tu zona no hay restos arqueológicos. Si los hay, hay que hacer un estudio aparte.",
    opciones: [
      { valor: "aprobado", etiqueta: "Aprobado" },
      { valor: "presentado", etiqueta: "Presentado (en evaluación)" },
      { valor: "no_iniciado", etiqueta: "No iniciado" },
      { valor: "no_se", etiqueta: "No sé" },
    ],
  },
  {
    id: "C2_5",
    tipo: "estado_doc",
    texto: "¿Cómo está tu expediente técnico?",
    ayuda:
      "Es el documento técnico que describe cómo vas a operar tu mina de forma segura y ordenada.",
    opciones: [
      { valor: "aprobado", etiqueta: "Aprobado" },
      { valor: "presentado", etiqueta: "Presentado (en evaluación)" },
      { valor: "no_iniciado", etiqueta: "No iniciado" },
      { valor: "no_se", etiqueta: "No sé" },
    ],
  },
  {
    id: "C2_6",
    tipo: "estado_doc",
    texto: "¿Cómo está tu RUC activo de 3ª categoría?",
    ayuda:
      "Tu RUC debe estar activo y en la categoría correcta para operar como minero. Si no lo tienes o está suspendido, hay que regularizarlo.",
    opciones: [
      { valor: "aprobado", etiqueta: "Aprobado" },
      { valor: "presentado", etiqueta: "Presentado (en evaluación)" },
      { valor: "no_iniciado", etiqueta: "No iniciado" },
      { valor: "no_se", etiqueta: "No sé" },
    ],
  },
  {
    id: "C4_1",
    tipo: "opcion",
    texto: "¿Cuánto mineral produces al mes?",
    ayuda:
      "Esta información es confidencial y solo se usa para tu diagnóstico. Ayuda a saber en qué etapa estás.",
    opciones: [
      { valor: "menos_10t", etiqueta: "Menos de 10 toneladas" },
      { valor: "10_50t", etiqueta: "10 - 50 toneladas" },
      { valor: "50_100t", etiqueta: "50 - 100 toneladas" },
      { valor: "mas_100t", etiqueta: "Más de 100 toneladas" },
      { valor: "prefiero_no_decir", etiqueta: "Prefiero no decir" },
    ],
  },
  {
    id: "C4_2",
    tipo: "opcion",
    texto: "¿Con qué frecuencia produces mineral?",
    ayuda:
      "Esto mide la continuidad de tu operación. 'Siempre' significa que produce todos los meses sin parar.",
    opciones: [
      { valor: "siempre", etiqueta: "Siempre (todos los meses)" },
      { valor: "a_veces", etiqueta: "A veces (intermitente)" },
      { valor: "nunca", etiqueta: "Nunca he producido" },
    ],
  },
];

// -------------------------------------------------------------------
// Módulo D: formal pleno
// -------------------------------------------------------------------

export const MODULO_D: PreguntaCatalogo[] = [
  {
    id: "D1_1",
    tipo: "opcion",
    texto: "¿Tu vigencia de concesión está al día?",
    ayuda:
      "La vigencia es el derecho anual que pagas a INGEMMET. Si está al día, no adeudas nada.",
    opciones: [
      { valor: "si", etiqueta: "Sí, al día" },
      { valor: "no", etiqueta: "No, debo" },
      { valor: "no_se", etiqueta: "No sé" },
    ],
  },
  {
    id: "D1_2",
    tipo: "opcion",
    texto: "¿Estás al día con la penalidad por no producir?",
    ayuda:
      "Si tienes más de 6 años (PPM) o 10 años (PMA) sin producir, debes pagar una penalidad periódica. Si no la pagas, hay riesgo de caducidad.",
    opciones: [
      { valor: "si", etiqueta: "Sí, estoy al día" },
      { valor: "en_plazo", etiqueta: "Estoy dentro del plazo" },
      { valor: "pago_penalidad", etiqueta: "No, debo penalidad" },
    ],
  },
  {
    id: "D1_3",
    tipo: "opcion",
    texto: "¿Presentaste tu Declaración Anual Consolidada (DAC)?",
    ayuda:
      "La DAC es un reporte anual que presentas ante el Estado con toda tu actividad minera del año. Es obligatoria.",
    opciones: [
      { valor: "si", etiqueta: "Sí, ya la presenté" },
      { valor: "no", etiqueta: "No, no la presenté" },
      { valor: "no_se", etiqueta: "No sé qué es eso" },
    ],
  },
  {
    id: "D1_4",
    tipo: "opcion",
    texto: "¿Cómo está la fiscalización de tu operación?",
    ayuda:
      "Es la revisión que hace el Estado para ver si cumples con todo. Puede estar sin observaciones, con observaciones pendientes o con multas.",
    opciones: [
      { valor: "sin_observaciones", etiqueta: "Sin observaciones" },
      { valor: "con_observaciones", etiqueta: "Con observaciones" },
      { valor: "con_multas", etiqueta: "Con multas" },
    ],
  },
  {
    id: "D2_1",
    tipo: "opcion",
    texto: "¿Qué planeas hacer con tu operación?",
    ayuda:
      "Esto nos ayuda a mostrarte los siguientes pasos correctos para crecer.",
    opciones: [
      { valor: "ampliar", etiqueta: "Ampliar mi operación actual" },
      { valor: "nueva_concesion", etiqueta: "Sacar una nueva concesión" },
      { valor: "planta_propia", etiqueta: "Tener mi propia planta de beneficio" },
      { valor: "mantenerme", etiqueta: "Mantenerme como estoy" },
    ],
  },
  {
    id: "D2_2",
    tipo: "opcion",
    texto: "¿Cómo financiarías ese plan?",
    ayuda:
      "Esto es informativo y nos ayuda a conectarte con las oportunidades correctas.",
    opciones: [
      { valor: "autofinanciado", etiqueta: "Con mis propios ahorros" },
      { valor: "inversion", etiqueta: "Buscando un inversionista" },
      { valor: "credito", etiqueta: "Con un crédito bancario" },
      { valor: "no_pensado", etiqueta: "Todavía no lo he pensado" },
    ],
  },
];

// -------------------------------------------------------------------
// Módulo INV: índice de madurez (transversal B/C/D)
// ⏸️ EN PAUSA (julio 2026): preguntas de inversión, no de formalización —
// fuera de idsAplicables(), nunca se piden. No borrar: Esthiven las
// agrupará aparte más adelante. indice_madurez() en el backend siempre
// devuelve None mientras tanto (Track Técnico no se muestra).
// -------------------------------------------------------------------

export const MODULO_INV: PreguntaCatalogo[] = [
  {
    id: "INV_1",
    tipo: "opcion",
    texto: "¿Tienes mapeo geológico de tu concesión?",
    ayuda:
      "Es un mapa que muestra la estructura de la roca y la ubicación del mineral en tu zona. Lo prepara un geólogo.",
    opciones: [
      { valor: "si", etiqueta: "Sí" },
      { valor: "no", etiqueta: "No" },
    ],
  },
  {
    id: "INV_2",
    tipo: "opcion",
    texto: "¿Tienes muestreo con laboratorio certificado?",
    ayuda:
      "Son análisis hechos en un laboratorio oficial que confirman cuánto mineral valioso tienes y de qué calidad.",
    opciones: [
      { valor: "si", etiqueta: "Sí" },
      { valor: "no", etiqueta: "No" },
    ],
  },
  {
    id: "INV_3",
    tipo: "opcion",
    texto: "¿Tienes una estimación de recursos minerales?",
    ayuda:
      "Es el cálculo técnico de cuánto mineral tienes y para cuánto tiempo te alcanza. Es lo primero que pregunta un inversionista serio.",
    opciones: [
      { valor: "si", etiqueta: "Sí" },
      { valor: "no", etiqueta: "No" },
    ],
  },
  {
    id: "INV_4",
    tipo: "opcion",
    texto: "¿Tienes documentado tus costos operativos (OPEX)?",
    ayuda:
      "Son todos los costos que tienes para operar cada mes: personal, combustible, repuestos, etc. Un inversionista necesita saber cuánto cuesta producir.",
    opciones: [
      { valor: "si", etiqueta: "Sí" },
      { valor: "no", etiqueta: "No" },
    ],
  },
  {
    id: "INV_5",
    tipo: "opcion",
    texto: "¿Tienes producción histórica con liquidaciones?",
    ayuda:
      "Son los reportes que muestran cuánto has producido y vendido en el pasado. Dan confianza de que realmente produces.",
    opciones: [
      { valor: "si", etiqueta: "Sí" },
      { valor: "no", etiqueta: "No" },
    ],
  },
];

// -------------------------------------------------------------------
// Todos los módulos en un solo array (para búsqueda por id)
// -------------------------------------------------------------------

export const TODAS_LAS_PREGUNTAS: PreguntaCatalogo[] = [
  ...MODULO_0,
  ...MODULO_A,
  ...MODULO_B,
  ...MODULO_C,
  ...MODULO_D,
  ...MODULO_INV,
];

export const POR_ID: Record<string, PreguntaCatalogo> = Object.fromEntries(
  TODAS_LAS_PREGUNTAS.map((p) => [p.id, p])
);

// -------------------------------------------------------------------
// Routing: qué preguntas mostrar según el perfil (espejo del backend)
// -------------------------------------------------------------------

// Límites del reloj de producción mínima (Perfil B) — espejo de
// backend/catalogo_diagnostico.py. Deciden si B1_3 (penalidad) aplica.
const HECTAREAS_MAX_PMA = 1_000;
const HECTAREAS_MAX_PPM = 2_000;
const ANIO_PRODUCCION_MINIMA_PMA = 10;
const ANIO_PRODUCCION_MINIMA_PPM = 6;

function clasificacionB(respuestas: Record<string, string>): "pma" | "ppm" | "no_califica" | null {
  const hectareas = Number(respuestas.B2_2);
  const tieneHectareas = respuestas.B2_2 !== undefined && !Number.isNaN(hectareas);
  const declarada = respuestas.B2_1;
  if (tieneHectareas && hectareas > HECTAREAS_MAX_PPM) return "no_califica";
  if (declarada === "pma") {
    if (tieneHectareas && hectareas > HECTAREAS_MAX_PMA) return "ppm";
    return "pma";
  }
  if (declarada === "ppm") return "ppm";
  return null;
}

/** True si el reloj de producción mínima ya venció — solo entonces B1_3
 *  (¿ya pagaste la penalidad?) tiene sentido preguntar. Espejo de
 *  backend/catalogo_diagnostico._reloj_vencido(). */
function relojVencido(respuestas: Record<string, string>): boolean {
  const anioTitulo = Number(respuestas.B1_2);
  if (respuestas.B1_2 === undefined || Number.isNaN(anioTitulo)) return false;
  const limite =
    clasificacionB(respuestas) === "pma" ? ANIO_PRODUCCION_MINIMA_PMA : ANIO_PRODUCCION_MINIMA_PPM;
  return new Date().getFullYear() - anioTitulo >= limite;
}

/** Determina el set exacto de ids aplicables dadas las respuestas del
 *  Módulo 0. Espejo de backend/catalogo_diagnostico.ids_esperados(). */
export function idsAplicables(respuestas: Record<string, string>): Set<string> {
  const m0_1 = respuestas.M0_1;
  const ids = new Set<string>(["M0_1"]);

  if (m0_1 === "concesion_propia") {
    ids.add("M0_3");
    if (respuestas.M0_3 === "reinfo") {
      ids.add("M0_4");
    }
  }

  const perfil = clasificarPerfil(respuestas);
  if (perfil === "sin_ruta") return ids;

  if (perfil === "A" || perfil === "A_avanzado") {
    if (perfil === "A") {
      ids.add("A1_1");
      if (respuestas.A1_1 === "si") {
        ids.add("A1_2");
        ids.add("A1_3");
        ids.add("A2_1");
        ids.add("A2_2");
      }
    }
    ids.add("A3_1");
    if (respuestas.A3_1 === "privado" || respuestas.A3_1 === "comunidad") {
      ids.add("A3_2");
    }
    ids.add("A4_1");
    if (respuestas.A4_1 === "parcial" || respuestas.A4_1 === "no") {
      ids.add("A4_2");
    }
    ids.add("A5_1");
    ids.add("A5_2");
    return ids;
  }

  if (perfil === "B") {
    // Orden con sentido: primero vigencia, LUEGO la clasificación PMA/PPM
    // (B2_1/B2_2) y el año del título — B1_3 (penalidad) recién se
    // pregunta si con esos datos el reloj de producción ya venció
    // (B3_1/B3_2, estudios geológicos/laboratorio, y el Módulo INV están
    // en pausa aparte, ver banner en MODULO_B/MODULO_INV más abajo).
    ids.add("B1_1");
    ids.add("B2_1");
    ids.add("B2_2");
    ids.add("B1_2");
    if (respuestas.B1_2 !== undefined && relojVencido(respuestas)) {
      ids.add("B1_3");
    }
    ids.add("B1_4");
    if (respuestas.B1_4 === "privado" || respuestas.B1_4 === "comunidad") {
      ids.add("B1_5");
    }
    ids.add("B4_1");
    if (respuestas.B4_1 === "operar_yo") {
      ids.add("B5_1");
      ids.add("B5_3");
      ids.add("B5_4");
    }
    return ids;
  }

  if (perfil === "C") {
    ids.add("C1_1");
    ids.add("C1_2");
    ids.add("C1_3");
    for (let i = 1; i <= 6; i++) ids.add(`C2_${i}`);
    // C2_7 (declaración de producción semestral) no aplica al titular de
    // su propia concesión — exceptuado por ley (Art. 7c, D.S. N°001-2020-EM).
    if (respuestas.C1_3 !== "titular") ids.add("C2_7");
    // Quien opera por contrato no ve C2_3: C3_1 ya pregunta firma e
    // inscripción del contrato — sería preguntar lo mismo dos veces.
    if (respuestas.C1_3 === "contrato") {
      ids.add("C3_1");
      ids.delete("C2_3");
    }
    ids.add("C4_1");
    ids.add("C4_2");
    return ids;
  }

  // Perfil D
  ids.add("D1_1");
  ids.add("D1_2");
  ids.add("D1_3");
  ids.add("D1_4");
  ids.add("D2_1");
  ids.add("D2_2");
  return ids;
}

/** Clasifica el perfil a partir de las respuestas del Módulo 0.
 *  Espejo de backend/catalogo_diagnostico.clasificar_perfil(). */
export function clasificarPerfil(respuestas: Record<string, string>): PerfilDiagnostico | "sin_ruta" {
  const m0_1 = respuestas.M0_1;
  if (m0_1 === "nada") return "A";
  if (m0_1 === "petitorio_tramite") return "A_avanzado";
  if (m0_1 === "concesion_no_operando") return "B";
  if (m0_1 !== "concesion_propia") return "sin_ruta";

  if (respuestas.M0_3 === "no") return "sin_ruta";
  if (respuestas.M0_3 === "formal") return "D";
  return "C";
}

// -------------------------------------------------------------------
// Dimensiones (para admin/proyectos/cuenta — se mantiene legacy)
// -------------------------------------------------------------------

export const NOMBRES_DIMENSION: Record<NombreDimension, string> = {
  legal: "Legal",
  ambiental: "Ambiental",
  operativo: "Operativo",
  tecnico: "Técnico",
  seguridad: "Seguridad",
  social: "Social",
};

/** Nombre legible de cada perfil. */
export const NOMBRE_PERFIL: Record<string, string> = {
  A: "Desde cero (quiere concesión)",
  A_avanzado: "Petitorio en trámite",
  B: "Concesionario sin operar",
  C: "Operando con REINFO",
  D: "Formal pleno",
};
