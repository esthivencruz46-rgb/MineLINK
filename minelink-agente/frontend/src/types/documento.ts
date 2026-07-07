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
}

export const CATEGORIAS_DOCUMENTO: CategoriaInfo[] = [
  {
    categoria: "fotos_mina",
    etiqueta: "Fotos de la mina",
    descripcion: "Fotos actuales de tu labor u operación",
    accept: "image/jpeg,image/png,image/webp",
    formatos: "Formatos: JPG, PNG o WEBP. Si tu foto es HEIC (iPhone), conviértela a JPG antes de subirla.",
  },
  {
    categoria: "informe_leyes",
    etiqueta: "Informe de leyes / ensayes",
    descripcion: "Resultados de laboratorio sobre la calidad del mineral",
    accept: "application/pdf",
    formatos: "Formato: PDF",
  },
  {
    categoria: "catastro",
    etiqueta: "Catastro / plano de ubicación",
    descripcion: "Documento o plano que ubica tu concesión",
    accept: "application/pdf",
    formatos: "Formato: PDF",
  },
  {
    categoria: "ruc",
    etiqueta: "RUC escaneado",
    descripcion: "Constancia de tu RUC activo",
    accept: "application/pdf",
    formatos: "Formato: PDF",
  },
  {
    categoria: "contrato_explotacion",
    etiqueta: "Contrato de explotación",
    descripcion: "Contrato firmado con el titular de la concesión",
    accept: "application/pdf",
    formatos: "Formato: PDF",
  },
  {
    categoria: "titulo_concesion",
    etiqueta: "Título de concesión",
    descripcion: "Documento que acredita la titularidad",
    accept: "application/pdf",
    formatos: "Formato: PDF",
  },
];

export interface DocumentoOperacion {
  id: number;
  categoria: CategoriaDocumento;
  nombre_original: string;
  content_type: string;
  created_at: string;
}
