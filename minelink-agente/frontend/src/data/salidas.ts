/** Copy de las tarjetas "¿Qué sigue?" (scoring.salidas_de) — compartido
 *  entre /resultado y las ventanas de cuenta (MiCuenta/MiConcesion), que
 *  recalculan lo mismo en cada lectura vía estado_seguimiento.
 *
 *  `pasos` (julio 2026, reportado por el dueño): las tarjetas que
 *  prometían "aquí te explicamos los pasos" no explicaban nada — ahora
 *  las que declaran pasos se expanden y los muestran. El contenido sale
 *  del spec (context/diagnostico_formalizacion.md, bloques B4/B5) en
 *  lenguaje llano; Esthiven puede ajustar la redacción aquí mismo. */
export const TEXTO_SALIDA: Record<
  string,
  { titulo: string; descripcion: string; pasos?: string[] }
> = {
  area_no_concesionable: {
    titulo: "Tu área no se puede concesionar",
    descripcion:
      "El área que elegiste tiene una restricción que impide obtener una concesión minera. Revisa otras zonas o busca asesoría.",
  },
  verificar_area: {
    titulo: "Verifica tu área antes de avanzar",
    descripcion:
      "Hay información pendiente sobre tu área (frontera, disponibilidad, etc.). Confirma que no tiene restricciones.",
  },
  checklist_petitorio: {
    titulo: "Arma tu petitorio",
    descripcion:
      "Tu área parece viable. El siguiente paso es juntar los documentos para el petitorio ante INGEMMET.",
  },
  completar_tramites_petitorio: {
    titulo: "Te faltan trámites para tu petitorio",
    descripcion:
      "Todavía no tienes todos los documentos que pide INGEMMET para tu trámite. Busca una empresa o consultor que te ayude a completarlos.",
  },
  ruta_inversionista: {
    titulo: "Busca un inversionista",
    descripcion:
      "Un inversionista puede financiar los trámites y estudios que necesitas para formalizarte.",
  },
  alerta_caducidad: {
    titulo: "⚠️ Riesgo de caducidad",
    descripcion:
      "Debes 2 o más años de vigencia. Si no regularizas, puedes perder tu concesión.",
  },
  alerta_produccion_minima: {
    titulo: "⚠️ Debes poner tu mina en producción",
    descripcion:
      "Tu plazo para cumplir con la producción mínima ya venció. Paga la penalidad y pon tu operación en marcha.",
  },
  checklist_permisos: {
    titulo: "Checklist de permisos para operar",
    descripcion:
      "Necesitas varios permisos antes de empezar a sacar mineral. Estos son, en orden:",
    pasos: [
      "Instrumento ambiental aprobado (DIA o EIA-sd, según tu tamaño). Es tu permiso ambiental — sin él no puedes iniciar ningún otro trámite de operación.",
      "Acuerdo con el dueño del terreno superficial (o servidumbre). La concesión te da el mineral, no el terreno: necesitas autorización de quien es dueño de la superficie (si el terreno es tuyo, ya cumpliste este paso).",
      "Licencia de uso de agua de la ANA (Autoridad Nacional del Agua), si tu operación usa agua.",
      "Autorización de inicio/reinicio de actividades ante la DREM/GREM de tu región. Es el último paso: con esto ya operas como minero formal.",
    ],
  },
  guia_cesion: {
    titulo: "Guía para ceder tu concesión",
    descripcion:
      "Si quieres que otra persona opere tu concesión (y tú recibir un pago o regalía), este es el camino:",
    pasos: [
      "Decide el tipo de contrato: cesión minera (el otro asume tu posición como si fuera el titular, con tus mismas obligaciones) o contrato de explotación (le autorizas a extraer mineral en tu área a cambio de una contraprestación).",
      "Negocia y deja por escrito las condiciones: plazo, pago o regalía (fijo, porcentaje de producción o mixto), qué zona exacta cede, y quién responde por las obligaciones ambientales y de seguridad.",
      "Firma el contrato por escritura pública ante notario. Un acuerdo de palabra o un documento simple no te protege si hay problemas después.",
      "Inscribe el contrato en la SUNARP (Registro de Derechos Mineros). Sin inscripción, el contrato no tiene efectos frente a terceros ni ante la autoridad minera.",
      "Recuerda: aunque cedas la operación, la concesión sigue a tu nombre — la vigencia anual y la producción mínima siguen siendo tu responsabilidad si el contrato no dice lo contrario. Por eso conviene revisar todo con un abogado antes de firmar.",
    ],
  },
  subsanar_suspension: {
    titulo: "Subsana la suspensión de tu REINFO",
    descripcion:
      "Tu REINFO está suspendido. Debes atender la observación para reactivarlo.",
  },
  ruta_critica_documentos: {
    titulo: "Ruta crítica de documentos",
    descripcion:
      "Tienes documentos pendientes que debes completar antes del 31/12/2026. Prioriza los más urgentes.",
  },
  asesoria_legal_titular: {
    titulo: "Busca asesoría legal",
    descripcion:
      "El titular de la concesión no coopera. Necesitas un abogado que te ayude a resolver la situación.",
  },
  alertas_cumplimiento: {
    titulo: "Atiende tus alertas de cumplimiento",
    descripcion:
      "Hay observaciones o multas pendientes en tu fiscalización. Subsana antes de seguir avanzando.",
  },
};
