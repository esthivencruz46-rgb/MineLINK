import { NOMBRES_DIMENSION_INVERSION, ORDEN_DIMENSION_INVERSION } from "../types/proyecto";
import { formatearMonto } from "./formato";
import type { ProyectoDetalle } from "../types/proyecto";

const COLOR_ACENTO: [number, number, number] = [37, 99, 235];
const COLOR_TEXTO: [number, number, number] = [30, 30, 30];
const COLOR_SUAVE: [number, number, number] = [120, 120, 120];
const COLOR_BARRA_FONDO: [number, number, number] = [230, 230, 230];

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Genera un PDF de una página con el resumen ejecutivo + score del
 * proyecto, para que el inversionista lo comparta con su equipo — nunca
 * incluye datos de contacto del minero (nombre real, WhatsApp, email),
 * misma regla de privacidad que la ficha pública (ver CLAUDE.md).
 * jsPDF se carga de forma diferida (import dinámico) para no pesar el
 * bundle principal — solo se descarga cuando el inversionista hace clic
 * en "Descargar Información". */
export async function generarPdfProyecto(proyecto: ProyectoDetalle): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margen = 18;
  const anchoUtil = 210 - margen * 2;
  let y = margen;

  // Encabezado
  doc.setFontSize(10);
  doc.setTextColor(...COLOR_ACENTO);
  doc.setFont("helvetica", "bold");
  doc.text("MINELINK", margen, y);
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_SUAVE);
  doc.setFont("helvetica", "normal");
  doc.text("Ficha de inversión — plataforma de formalización minera", 210 - margen, y, { align: "right" });
  y += 10;

  // Título
  doc.setFontSize(18);
  doc.setTextColor(...COLOR_TEXTO);
  doc.setFont("helvetica", "bold");
  doc.text(proyecto.nombre_proyecto, margen, y);
  y += 7;
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLOR_SUAVE);
  const tipoMina = proyecto.situacion === "minero_artesanal"
    ? (proyecto.tipo_mina === "subterranea" ? "Subterránea" : "Tajo abierto")
    : "En etapa de concesión";
  doc.text(`${cap(proyecto.mineral)} · ${cap(proyecto.region)}, Perú · ${tipoMina}`, margen, y);
  y += 10;

  // Score de Atractivo de Inversión
  doc.setDrawColor(...COLOR_BARRA_FONDO);
  doc.setFillColor(248, 248, 248);
  doc.roundedRect(margen, y, anchoUtil, 24, 2, 2, "F");
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_SUAVE);
  doc.text("SCORE DE ATRACTIVO DE INVERSIÓN", margen + 5, y + 8);
  doc.setFontSize(22);
  doc.setTextColor(...COLOR_ACENTO);
  doc.setFont("helvetica", "bold");
  doc.text(`${proyecto.score_inversion}`, margen + 5, y + 19);
  doc.setFontSize(10);
  doc.setTextColor(...COLOR_SUAVE);
  doc.setFont("helvetica", "normal");
  doc.text("/ 100", margen + 22, y + 19);
  doc.setFontSize(9);
  doc.text(`MineScore de formalización: ${proyecto.score_actual}/100`, margen + 60, y + 14);
  y += 32;

  // 6 dimensiones
  doc.setFontSize(11);
  doc.setTextColor(...COLOR_TEXTO);
  doc.setFont("helvetica", "bold");
  doc.text("Desglose por dimensión", margen, y);
  y += 6;
  for (const dim of ORDEN_DIMENSION_INVERSION) {
    const info = proyecto.dimensiones_inversion[dim];
    if (!info) continue;
    const porcentaje = info.maximo > 0 ? Math.round((info.puntaje / info.maximo) * 100) : 0;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLOR_TEXTO);
    doc.text(NOMBRES_DIMENSION_INVERSION[dim], margen, y + 3);
    doc.setTextColor(...COLOR_SUAVE);
    doc.text(`${porcentaje}`, margen + anchoUtil, y + 3, { align: "right" });
    doc.setFillColor(...COLOR_BARRA_FONDO);
    doc.roundedRect(margen + 55, y, anchoUtil - 55 - 10, 2.5, 1, 1, "F");
    doc.setFillColor(...COLOR_ACENTO);
    const anchoBarra = ((anchoUtil - 55 - 10) * porcentaje) / 100;
    if (anchoBarra > 0) doc.roundedRect(margen + 55, y, anchoBarra, 2.5, 1, 1, "F");
    y += 7;
  }
  y += 4;

  // Resumen ejecutivo
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLOR_TEXTO);
  doc.text("Resumen ejecutivo", margen, y);
  y += 6;
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");
  const partes: string[] = [
    `${proyecto.nombre_proyecto} tiene un Score de Atractivo de Inversión de ${proyecto.score_inversion}/100.`,
  ];
  if (proyecto.brechas_pendientes.length === 0) {
    partes.push("Completó todos los requisitos del diagnóstico de formalización.");
  } else {
    partes.push(
      `Tiene ${proyecto.brechas_pendientes.length} requisito${
        proyecto.brechas_pendientes.length !== 1 ? "s" : ""
      } de formalización en proceso.`
    );
  }
  if (proyecto.descripcion_generada) partes.push(proyecto.descripcion_generada);
  const resumen = doc.splitTextToSize(partes.join(" "), anchoUtil);
  doc.text(resumen, margen, y);
  y += resumen.length * 4.5 + 6;

  // Oportunidad de capital
  if (proyecto.capital_buscado) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Oportunidad de capital", margen, y);
    y += 6;
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "normal");
    const capital = `Busca ${formatearMonto(proyecto.capital_buscado)}${
      proyecto.uso_fondos ? ` — ${proyecto.uso_fondos}` : ""
    }.`;
    const lineas = doc.splitTextToSize(capital, anchoUtil);
    doc.text(lineas, margen, y);
    y += lineas.length * 4.5 + 6;
  }

  // Pie de página
  const fecha = new Date().toLocaleDateString("es-PE", { year: "numeric", month: "long", day: "numeric" });
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_SUAVE);
  doc.text(
    "Datos autodeclarados por el titular del proyecto en su diagnóstico de formalización. " +
      "Los ✓ del checklist de formalización solo cuentan con foto de respaldo verificable.",
    margen,
    285,
    { maxWidth: anchoUtil }
  );
  doc.text(`Generado el ${fecha} · mine-link-seven.vercel.app/proyectos/${proyecto.operacion_id}`, margen, 292);

  const nombreArchivo = `MineLink-${proyecto.nombre_proyecto.replace(/[^a-z0-9]+/gi, "-")}.pdf`;
  doc.save(nombreArchivo);
}
