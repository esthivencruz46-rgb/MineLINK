export type CategoriaDocumento =
  | "fotos_mina"
  | "informe_leyes"
  | "catastro"
  | "ruc"
  | "contrato_explotacion"
  | "titulo_concesion";

export interface CategoriaInfo {
  categoria: CategoriaDocumento;
  etiqueta: string;
  descripcion: string;
  accept: string;
  formatos: string;
  /** Lo que el minero marcó en el diagnóstico para este estudio, ya
   *  traducido a su etiqueta legible (ej. "Marcaste: En trámite"). Solo
   *  aplica a los estudios de "Respalda tu declaración". */
  declarado?: string;
}

export const CATEGORIAS_DOCUMENTO: CategoriaInfo[] = [
  {
    categoria: "fotos_mina",
    etiqueta: "Fotos de la mina",
    descripcion: "Fotos actuales de tu labor u operación (también respaldan que produces y que documentas tu operación)",
    accept: "image/jpeg,image/png,image/webp",
    formatos: "Formatos: JPG, PNG o WEBP. Si tu foto es HEIC (iPhone), conviértela a JPG antes de subirla.",
  },
  {
    categoria: "informe_leyes",
    etiqueta: "Informe de leyes / ensayes",
    descripcion: "Resultados de laboratorio sobre la calidad del mineral (también respalda tu análisis de laboratorio)",
    accept: "application/pdf,image/jpeg,image/png,image/webp",
    formatos: "Formato: PDF o una foto del documento (JPG, PNG, WEBP)",
  },
  {
    categoria: "catastro",
    etiqueta: "Catastro / plano de ubicación",
    descripcion: "Documento o plano que ubica tu concesión (también respalda tu georreferenciación y topografía)",
    accept: "application/pdf,image/jpeg,image/png,image/webp",
    formatos: "Formato: PDF o una foto del documento (JPG, PNG, WEBP)",
  },
  {
    categoria: "ruc",
    etiqueta: "RUC escaneado",
    descripcion: "Constancia de tu RUC activo (también respalda tu trámite en SUNAT)",
    accept: "application/pdf,image/jpeg,image/png,image/webp",
    formatos: "Formato: PDF o una foto del documento (JPG, PNG, WEBP)",
  },
  {
    categoria: "contrato_explotacion",
    etiqueta: "Contrato de explotación",
    descripcion: "Contrato firmado con el titular de la concesión (si TÚ no eres el titular)",
    accept: "application/pdf,image/jpeg,image/png,image/webp",
    formatos: "Formato: PDF o una foto del documento (JPG, PNG, WEBP)",
  },
  {
    categoria: "titulo_concesion",
    etiqueta: "Título de concesión",
    descripcion: "Documento que acredita que ERES el titular (también respalda que tu concesión está vigente)",
    accept: "application/pdf,image/jpeg,image/png,image/webp",
    formatos: "Formato: PDF o una foto del documento (JPG, PNG, WEBP)",
  },
];

export type EstadoRevisionDocumento = "pendiente" | "aprobado" | "rechazado";

export interface DocumentoOperacion {
  id: number;
  categoria: CategoriaDocumento;
  nombre_original: string;
  content_type: string;
  created_at: string;
  estado_revision: EstadoRevisionDocumento;
  motivo_rechazo?: string | null;
}
