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
  doc.text(`${cap(proyecto.mineral)} · ${cap(proyecto.region)}, Perú`, margen, y);
  y += 10;

  // Los dos tracks del spec: semáforo legal + madurez técnica (0-5).
  const COLOR_SEMAFORO: Record<string, [number, number, number]> = {
    verde: [16, 158, 92],
    amarillo: [217, 156, 14],
    rojo: [220, 56, 46],
  };
  const ETIQUETA_SEMAFORO: Record<string, string> = {
    verde: "EN ORDEN",
    amarillo: "CON PENDIENTES",
    rojo: "BLOQUEADO",
  };
  const TRACK_LEGAL: Record<string, string> = {
    B: "Concesión titulada",
    C:
      proyecto.docs_completados != null && proyecto.docs_totales != null
        ? `REINFO vigente · ${proyecto.docs_completados}/${proyecto.docs_totales} documentos`
        : "REINFO vigente",
    D: "Formal — autorización DREM/GREM",
  };
  const colorLegal = COLOR_SEMAFORO[proyecto.semaforo_legal ?? ""] ?? COLOR_SUAVE;

  doc.setDrawColor(...COLOR_BARRA_FONDO);
  doc.setFillColor(248, 248, 248);
  doc.roundedRect(margen, y, anchoUtil, 30, 2, 2, "F");
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_SUAVE);
  doc.text("TRACK LEGAL", margen + 5, y + 8);
  doc.setFontSize(13);
  doc.setTextColor(...colorLegal);
  doc.setFont("helvetica", "bold");
  doc.text(
    `${ETIQUETA_SEMAFORO[proyecto.semaforo_legal ?? ""] ?? "SIN DATO"} — ${
      TRACK_LEGAL[proyecto.perfil ?? ""] ?? "En evaluación"
    }`,
    margen + 5,
    y + 15
  );
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_SUAVE);
  doc.setFont("helvetica", "normal");
  doc.text("MADUREZ TÉCNICA", margen + 5, y + 22);
  doc.setTextColor(...COLOR_TEXTO);
  doc.setFont("helvetica", "bold");
  doc.text(
    proyecto.indice_madurez != null
      ? `Nivel ${proyecto.indice_madurez}/5${proyecto.vende_liquidacion ? " · vende con liquidación formal" : ""}`
      : "Aún sin operación que medir",
    margen + 42,
    y + 22
  );
  doc.setFont("helvetica", "normal");
  y += 38;

  // Resumen ejecutivo
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLOR_TEXTO);
  doc.text("Resumen ejecutivo", margen, y);
  y += 6;
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");
  const partes: string[] = [];
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
