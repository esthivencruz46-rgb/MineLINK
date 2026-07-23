export interface LeadConDiagnostico {
  id: number;
  operacion_id: string;
  nombre: string;
  whatsapp: string;
  email?: string | null;
  nombre_operacion?: string | null;
  region: string;
  codigo_reinfo?: string | null;
  // Verificación manual del código REINFO por Esthiven (el cotejo
  // automático contra el MINEM está desactivado, ver backend/reinfo.py).
  reinfo_verificado_manual: boolean;
  reinfo_verificado_en?: string | null;
  created_at: string;
  // Declaración original del minero — inmutable
  score_total: number;
  bloqueado: boolean;
  brechas: string[];
  // Seguimiento del admin (no edita lo de arriba)
  brechas_resueltas: string[];
  brechas_pendientes: string[];
  score_actual: number;
  bloqueado_actual: boolean;
  descripcion_operacion?: string | null;
  capacidad_produccion?: string | null;
  capital_buscado?: string | null;
  uso_fondos?: string | null;
  ubicacion_maps?: string | null;
  estado_contacto: string;
  situacion: string;
  // Perfil de la operación (Ruta 1) / concesión (Ruta 2) — informativo
  estado_operacion?: string | null;
  tipo_explotacion?: string | null;
  material_comercializado?: string | null;
  forma_comercializacion?: string | null;
  tiempo_operacion?: string | null;
  ley_promedio?: string | null;
  ley_como_obtenida?: string | null;
  especie_mineral?: string | null;
  num_trabajadores?: string | null;
  maquinaria?: string | null;
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
  // El minero ya pulsó "Guardar archivos" — ya no hay visto bueno del admin
  documentos_enviados: boolean;
}

export interface TopBrecha {
  estudio: string;
  conteo: number;
}

export interface UltimoLead {
  nombre: string;
  region: string;
  // Perfil del pipeline (A/A_avanzado/B/C/D) — null = modelo viejo.
  perfil?: string | null;
  created_at: string;
}

export interface DashboardOut {
  diagnosticos_hoy: number;
  diagnosticos_total: number;
  leads_hoy: number;
  leads_total: number;
  // Conteo de diagnósticos por perfil (ej. {"C": 40, "B": 12}) —
  // reemplaza al score_promedio legacy (julio 2026).
  conteo_por_perfil: Record<string, number>;
  top_brechas: TopBrecha[];
  ultimos_leads: UltimoLead[];
  diagnosticos_iniciados: number;
  // Embudo del inversionista (julio 2026)
  carteras_vistas: number;
  fichas_vistas: number;
  intereses_inversion_total: number;
  // Salud del asesor conversacional HOY (julio 2026, tras un incidente
  // real con una clave de API incompleta en Render que pasó desapercibida).
  asesor_preguntas_hoy: number;
  asesor_fallas_hoy: number;
  // Qué proveedor respondió/falló por última vez (julio 2026, tras el 503
  // de Gemini que solo se diagnosticó probando en vivo) — para saber qué
  // está fallando sin reproducir el error a mano.
  asesor_ultimo_proveedor_ok: string | null;
  asesor_ultima_falla: { proveedor: string | null; detalle: string; created_at: string } | null;
}

// Documento subido desde /admin para nutrir al asesor sin git (julio
// 2026, pedido explícito: "imagina que ya no uso Claude Code").
export interface DocumentoAsesor {
  id: number;
  nombre: string;
  categoria: string | null;
  activo: boolean;
  created_at: string;
  caracteres: number;
}
