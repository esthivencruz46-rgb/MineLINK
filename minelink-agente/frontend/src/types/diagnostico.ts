/** IDs del catálogo del diagnóstico de formalización (perfiles A/B/C/D).
 *  Espejo EXACTO de backend/catalogo_diagnostico.py — cualquier desfase
 *  produce 422 en POST /diagnostico. */
export type IdPregunta =
  | "M0_1" | "M0_3" | "M0_4"
  | "A1_1" | "A1_2" | "A1_3"
  | "A2_1" | "A2_2"
  | "A3_1" | "A3_2"
  | "A4_1" | "A4_2"
  | "A5_1" | "A5_2"
  | "B1_1" | "B1_2" | "B1_3" | "B1_4" | "B1_5"
  | "B2_1" | "B2_2"
  | "B3_1" | "B3_2"
  | "B4_1"
  | "B5_1" | "B5_3" | "B5_4"
  | "C1_1" | "C1_2" | "C1_3"
  | "C2_1" | "C2_2" | "C2_3" | "C2_4" | "C2_5" | "C2_6" | "C2_7"
  | "C3_1"
  | "C4_1" | "C4_2"
  | "D1_1" | "D1_2" | "D1_3" | "D1_4"
  | "D2_1" | "D2_2"
  | "INV_1" | "INV_2" | "INV_3" | "INV_4" | "INV_5";

/** El backend acepta cualquier string como valor — los ids condicionales
 *  pueden no estar presentes. Record<string, string> es el contrato exacto
 *  de DiagnosticoRequest.respuestas. */
export type Respuestas = Record<string, string>;

export type TipoMina = "subterranea" | "tajo_abierto";

/** Perfil que clasifica el Módulo 0. */
export type PerfilDiagnostico = "A" | "A_avanzado" | "B" | "C" | "D";

/** Colores del semáforo de formalización (Track Legal / Track Técnico). */
export type ColorSemaforo = "verde" | "amarillo" | "rojo";

// -------------------------------------------------------------------
// Request
// -------------------------------------------------------------------

export interface DiagnosticoRequest {
  respuestas: Record<string, string>;
  region: string;
  mineral: string;
  tipo_mina: TipoMina;
  situacion: "minero_artesanal" | "concesionario";
  estado_formalizacion?: string;
  nombre_minero?: string;
  codigo_reinfo?: string;
  produccion_mensual?: string;
  maquinaria?: string;
  num_trabajadores?: string;
  estado_operacion?: string;
  tipo_explotacion?: string;
  material_comercializado?: string;
  forma_comercializacion?: string;
  tiempo_operacion?: string;
  ley_promedio?: string;
  ley_como_obtenida?: string;
  especie_mineral?: string;
  tiene_resultados_laboratorio?: string;
  modalidad_trabajadores?: string;
  provincia?: string;
  sustancias_toxicas?: string;
  gestion_sustancias?: string;
  incidentes_previos?: string;
  permisos_comunitarios?: string;
  acceso_logistico?: string;
  experiencia_operador?: string;
  capacitacion_operador?: string;
  documentacion_disponible?: string;
  plan_formalizacion?: string;
  prioridad_crecimiento?: string;
  concesion_vigente?: string;
  tipo_deposito?: string;
  etapa_proyecto?: string;
  trabajos_exploracion_json?: string[];
  info_geologica_disponible?: string;
  tiene_estimaciones_leyes?: string;
  pagos_vigencia_al_dia?: string;
  toneladas_estimadas?: string;
  ley_esperada?: string;
  capital_disponible?: string;
  estudio_previo?: string;
  historial_operacion?: string;
  pasivos_ambientales?: string;
  experiencia_titular?: string;
  background_titular?: string;
  equipo_tecnico?: string;
  tipo_socio_buscado?: string;
  siguiente_hito?: string;
  timeline_operacion?: string;
  motivo_inicio?: string;
  documento_autorizacion?: string;
  tipo_apoyo_json?: string[];
  tipo_apoyo?: string;
  acceso_agua?: string;
  acceso_energia?: string;
  conflictividad_social?: string;
  estructura_propiedad?: string;
  moneda_capital?: string;
  monto_requerido?: string;
  plazo_capital?: string;
  motivo_capital?: string;
  produccion_objetivo?: string;
  uso_fondos_diagnostico?: string;
}

// -------------------------------------------------------------------
// Response
// -------------------------------------------------------------------

export interface DiagnosticoResponse {
  id: string;
  perfil: PerfilDiagnostico;
  clasificacion: string | null;
  semaforo_legal: ColorSemaforo;
  bloqueantes: string[];
  etiquetas_bloqueantes: string[];
  semaforo_tecnico: ColorSemaforo | null;
  indice_madurez: number | null;
  riesgo_caducidad: boolean;
  apto_inversionistas: boolean;
  urgencia: {
    dias_restantes: number;
    docs_completados: number;
    docs_totales: number;
    docs_pendientes: number;
    dias_necesarios: number;
    alerta_roja: boolean;
  } | null;
  reloj_produccion: {
    anios_titulo: number;
    limite_anios: number;
    vencido: boolean;
    anios_restantes: number;
  } | null;
  brechas: string[];
  // Estudios del checklist C2 (perfil C) marcados "Presentado (en
  // evaluación)" — ya se tramitaron, no son brecha accionable pero
  // tampoco están resueltos (por eso el Track Legal queda en amarillo).
  brechas_en_proceso: string[];
  salidas: string[];
}

// -------------------------------------------------------------------
// Tipos legacy que siguen usados por admin/proyectos/cuenta
// (dimensiones de inversión, etc.)
// -------------------------------------------------------------------

export interface Dimension {
  puntaje: number;
  maximo: number;
}

export type NombreDimension =
  | "legal"
  | "ambiental"
  | "operativo"
  | "tecnico"
  | "seguridad"
  | "social";
