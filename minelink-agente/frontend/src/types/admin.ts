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
  score_total: number;
  created_at: string;
}

export interface DashboardOut {
  diagnosticos_hoy: number;
  diagnosticos_total: number;
  leads_hoy: number;
  leads_total: number;
  score_promedio: number;
  top_brechas: TopBrecha[];
  ultimos_leads: UltimoLead[];
  diagnosticos_iniciados: number;
}
