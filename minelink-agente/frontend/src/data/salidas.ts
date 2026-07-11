/** Copy de las tarjetas "¿Qué sigue?" (scoring.salidas_de) — compartido
 *  entre /resultado y las ventanas de cuenta (MiCuenta/MiConcesion), que
 *  recalculan lo mismo en cada lectura vía estado_seguimiento. */
export const TEXTO_SALIDA: Record<string, { titulo: string; descripcion: string }> = {
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
      "Necesitas varios permisos antes de empezar a sacar mineral. Te mostramos cuáles.",
  },
  guia_cesion: {
    titulo: "Guía para ceder tu contrato",
    descripcion:
      "Si quieres ceder tu concesión a alguien más, aquí te explicamos los pasos.",
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
