export interface MineroPerfil {
  operacion_id: string;
  nombre: string;
  whatsapp: string;
  email?: string | null;
  nombre_operacion?: string | null;
  region: string;
  mineral: string;
  tipo_mina: string;
  codigo_reinfo?: string | null;
  created_at: string;
  situacion: string;
  score_total: number;
  bloqueado: boolean;
  brechas: string[];
  brechas_resueltas: string[];
  brechas_pendientes: string[];
  score_actual: number;
  bloqueado_actual: boolean;
  // Track Legal / Track Técnico (julio 2026) — reemplazan score_actual/
  // bloqueado_actual en la UI. null en diagnósticos del modelo anterior.
  perfil?: string | null;
  clasificacion?: string | null;
  semaforo_legal?: string | null;
  bloqueantes: string[];
  etiquetas_bloqueantes: string[];
  semaforo_tecnico?: string | null;
  indice_madurez?: number | null;
  riesgo_caducidad: boolean;
  apto_inversionistas: boolean;
  urgencia?: {
    dias_restantes: number;
    docs_completados: number;
    docs_totales: number;
    docs_pendientes: number;
    dias_necesarios: number;
    alerta_roja: boolean;
  } | null;
  reloj_produccion?: {
    anios_titulo: number;
    limite_anios: number;
    vencido: boolean;
    anios_restantes: number;
  } | null;
  salidas: string[];
  descripcion_operacion?: string | null;
  capacidad_produccion?: string | null;
  capital_buscado?: string | null;
  uso_fondos?: string | null;
  ubicacion_maps?: string | null;
  estado_contacto: string;
  // Perfil capturado en el diagnóstico — informativo, no editable aquí
  estado_operacion?: string | null;
  tipo_explotacion?: string | null;
  material_comercializado?: string | null;
  forma_comercializacion?: string | null;
  tiempo_operacion?: string | null;
  ley_promedio?: string | null;
  ley_como_obtenida?: string | null;
  especie_mineral?: string | null;
  tiene_resultados_laboratorio?: string | null;
  modalidad_trabajadores?: string | null;
  provincia?: string | null;
  sustancias_toxicas?: string | null;
  gestion_sustancias?: string | null;
  incidentes_previos?: string | null;
  permisos_comunitarios?: string | null;
  acceso_logistico?: string | null;
  experiencia_operador?: string | null;
  capacitacion_operador?: string | null;
  documentacion_disponible?: string | null;
  plan_formalizacion?: string | null;
  prioridad_crecimiento?: string | null;
  concesion_vigente?: string | null;
  tipo_deposito?: string | null;
  etapa_proyecto?: string | null;
  trabajos_exploracion_json?: string[] | null;
  info_geologica_disponible?: string | null;
  tiene_estimaciones_leyes?: string | null;
  pagos_vigencia_al_dia?: string | null;
  toneladas_estimadas?: string | null;
  ley_esperada?: string | null;
  capital_disponible?: string | null;
  estudio_previo?: string | null;
  historial_operacion?: string | null;
  pasivos_ambientales?: string | null;
  experiencia_titular?: string | null;
  background_titular?: string | null;
  equipo_tecnico?: string | null;
  tipo_socio_buscado?: string | null;
  siguiente_hito?: string | null;
  timeline_operacion?: string | null;
  motivo_inicio?: string | null;
  documento_autorizacion?: string | null;
  tipo_apoyo_json?: string[] | null;
  tipo_apoyo?: string | null;
  acceso_agua?: string | null;
  acceso_energia?: string | null;
  conflictividad_social?: string | null;
  estructura_propiedad?: string | null;
  moneda_capital?: string | null;
  monto_requerido?: string | null;
  plazo_capital?: string | null;
  motivo_capital?: string | null;
  produccion_objetivo?: string | null;
  uso_fondos_diagnostico?: string | null;
  // Cada estudio trae qué preguntó el diagnóstico (pregunta_id) y qué
  // respondió el minero (valor crudo, ej. "en_tramite") — la UI lo
  // traduce a su etiqueta legible con data/preguntas.ts.
  estudios_aplicables: { codigo: string; pregunta_id: string; valor: string }[];
  fotos_perfil: { categoria: string; etiqueta: string }[];
  es_titular_concesion?: boolean | null;
  // Revisión de documentos por el admin (julio 2026) — gate del botón
  // "Inversionista" en /mi-cuenta y /mi-concesion.
  documentos_enviados: boolean;
  visto_bueno_documentos: boolean;
  // Módulo INV (julio 2026) — si se ofrece a este minero y en qué estado
  // está su envío.
  inversion_ofrecida: boolean;
  inversion_prioridad?: string | null;
  inv_enviado: boolean;
  inv_visto_bueno: boolean;
}

export interface Notificacion {
  id: number;
  tipo: string;
  mensaje: string;
  leida: boolean;
  created_at: string;
}

export interface PerfilInversionRequest {
  descripcion_operacion?: string;
  capacidad_produccion?: string;
  capital_buscado?: string;
  uso_fondos?: string;
  ubicacion_maps?: string;
}
