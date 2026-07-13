import { BASE_URL } from "../services/api";
import { INFO_BRECHA } from "../data/brechas";
import { formatearMonto } from "./formato";
import { ETIQUETAS_DOCUMENTO_LEGAL, type ProyectoDetalle } from "../types/proyecto";
import type { jsPDF } from "jspdf";

const ACENTO: [number, number, number] = [37, 99, 235];
const TEXTO: [number, number, number] = [30, 30, 30];
const SUAVE: [number, number, number] = [110, 110, 110];
const FONDO_CAJA: [number, number, number] = [246, 248, 252];
const VERDE: [number, number, number] = [16, 158, 92];
const AMARILLO: [number, number, number] = [217, 156, 14];
const ROJO: [number, number, number] = [220, 56, 46];

const MARGEN = 16;
const ANCHO = 210;
const ALTO = 297;
const ANCHO_UTIL = ANCHO - MARGEN * 2;

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Descarga una foto pública y la devuelve como JPEG dataURL con sus
 *  dimensiones — pasa por un canvas para normalizar el formato (jsPDF no
 *  soporta WebP) y evitar problemas de codificación. null si falla:
 *  el PDF sale igual, solo sin esa foto. */
async function cargarFoto(
  url: string
): Promise<{ dataUrl: string; w: number; h: number } | null> {
  try {
    const resp = await fetch(`${BASE_URL}${url}`);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = objectUrl;
      });
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d")?.drawImage(img, 0, 0);
      return {
        dataUrl: canvas.toDataURL("image/jpeg", 0.82),
        w: img.naturalWidth,
        h: img.naturalHeight,
      };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return null;
  }
}

/** Dibuja una foto RECORTADA para llenar exactamente la caja (modo
 *  "cover", como object-cover en CSS) usando un canvas intermedio. */
function fotoEnCaja(
  doc: jsPDF,
  foto: { dataUrl: string; w: number; h: number },
  x: number,
  y: number,
  ancho: number,
  alto: number
): void {
  const escala = Math.max(ancho / foto.w, alto / foto.h);
  const wRec = ancho / escala;
  const hRec = alto / escala;
  const canvas = document.createElement("canvas");
  // Resolución de salida ~150dpi para que pese poco y se vea bien.
  const px = 6;
  canvas.width = Math.round(ancho * px);
  canvas.height = Math.round(alto * px);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const img = new Image();
  img.src = foto.dataUrl;
  ctx.drawImage(
    img,
    (foto.w - wRec) / 2,
    (foto.h - hRec) / 2,
    wRec,
    hRec,
    0,
    0,
    canvas.width,
    canvas.height
  );
  doc.addImage(canvas.toDataURL("image/jpeg", 0.82), "JPEG", x, y, ancho, alto);
}

function encabezado(doc: jsPDF): void {
  doc.setFillColor(...ACENTO);
  doc.rect(0, 0, ANCHO, 14, "F");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("MINELINK", MARGEN, 9);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Ficha de inversión — minería artesanal formalizándose en Perú", ANCHO - MARGEN, 9, {
    align: "right",
  });
}

function pie(doc: jsPDF, proyecto: ProyectoDetalle, pagina: number, total: number): void {
  const fecha = new Date().toLocaleDateString("es-PE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  doc.setFontSize(7.5);
  doc.setTextColor(...SUAVE);
  doc.setFont("helvetica", "normal");
  doc.text(
    "Datos autodeclarados por el titular en su diagnóstico de formalización. Un requisito solo " +
      "figura como verificado cuando hay una foto de respaldo.",
    MARGEN,
    ALTO - 12,
    { maxWidth: ANCHO_UTIL }
  );
  doc.text(
    `Generado el ${fecha} · mine-link-seven.vercel.app/proyectos/${proyecto.operacion_id}`,
    MARGEN,
    ALTO - 6
  );
  doc.text(`${pagina}/${total}`, ANCHO - MARGEN, ALTO - 6, { align: "right" });
}

function tituloSeccion(doc: jsPDF, y: number, texto: string): number {
  doc.setFillColor(...ACENTO);
  doc.rect(MARGEN, y - 3.2, 1.6, 4.4, "F");
  doc.setFontSize(11.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXTO);
  doc.text(texto.toUpperCase(), MARGEN + 4, y);
  return y + 7;
}

/** Ficha de inversión de 2 páginas con los datos REALES del proyecto —
 *  portada fotográfica, semáforos del spec, oportunidad de capital,
 *  leyes declaradas, checklist verificado y galería. Nunca incluye datos
 *  de contacto del minero (misma regla que la ficha pública). jsPDF se
 *  carga diferido para no pesar el bundle. */
export async function generarPdfProyecto(proyecto: ProyectoDetalle): Promise<void> {
  const { jsPDF } = await import("jspdf");

  // Fotos: portada + hasta 4 para la galería (se descargan primero; las
  // que fallen simplemente no salen).
  const urlsFotos = proyecto.fotos.slice(0, 5).map((f) => f.url);
  const fotos = (await Promise.all(urlsFotos.map(cargarFoto))).filter(
    (f): f is NonNullable<typeof f> => f !== null
  );
  const portada = fotos[0] ?? null;
  const galeria = fotos.slice(1, 5);

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = 22;

  // ---------- PÁGINA 1 ----------
  encabezado(doc);

  // Título
  doc.setFontSize(20);
  doc.setTextColor(...TEXTO);
  doc.setFont("helvetica", "bold");
  doc.text(proyecto.nombre_proyecto, MARGEN, y + 4);
  y += 10;
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...SUAVE);
  doc.text(`${cap(proyecto.mineral)} · ${cap(proyecto.region)}, Perú`, MARGEN, y);
  y += 6;

  // Foto de portada
  if (portada) {
    fotoEnCaja(doc, portada, MARGEN, y, ANCHO_UTIL, 62);
    y += 66;
  } else {
    y += 2;
  }

  // Caja de los dos tracks del spec
  const COLOR_SEMAFORO: Record<string, [number, number, number]> = {
    verde: VERDE,
    amarillo: AMARILLO,
    rojo: ROJO,
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
  const colorLegal = COLOR_SEMAFORO[proyecto.semaforo_legal ?? ""] ?? SUAVE;

  doc.setFillColor(...FONDO_CAJA);
  doc.roundedRect(MARGEN, y, ANCHO_UTIL, 26, 2, 2, "F");
  const mitad = MARGEN + ANCHO_UTIL / 2;
  doc.setFontSize(8);
  doc.setTextColor(...SUAVE);
  doc.setFont("helvetica", "normal");
  doc.text("TRACK LEGAL", MARGEN + 5, y + 7);
  doc.setFillColor(...colorLegal);
  doc.circle(MARGEN + 6.5, y + 13.5, 2, "F");
  doc.setFontSize(11);
  doc.setTextColor(...colorLegal);
  doc.setFont("helvetica", "bold");
  doc.text(ETIQUETA_SEMAFORO[proyecto.semaforo_legal ?? ""] ?? "SIN DATO", MARGEN + 11, y + 15);
  doc.setFontSize(8.5);
  doc.setTextColor(...TEXTO);
  doc.setFont("helvetica", "normal");
  doc.text(TRACK_LEGAL[proyecto.perfil ?? ""] ?? "En evaluación", MARGEN + 5, y + 21.5);

  doc.setFontSize(8);
  doc.setTextColor(...SUAVE);
  doc.text("MADUREZ TÉCNICA", mitad + 3, y + 7);
  if (proyecto.indice_madurez != null) {
    // Barra de 5 segmentos, como en la web.
    for (let i = 0; i < 5; i++) {
      const lleno = i < (proyecto.indice_madurez ?? 0);
      if (lleno) doc.setFillColor(...ACENTO);
      else doc.setFillColor(222, 226, 233);
      doc.roundedRect(mitad + 3 + i * 9, y + 11, 7.5, 3, 1, 1, "F");
    }
    doc.setFontSize(10);
    doc.setTextColor(...TEXTO);
    doc.setFont("helvetica", "bold");
    doc.text(`Nivel ${proyecto.indice_madurez}/5`, mitad + 3 + 5 * 9 + 3, y + 14);
    if (proyecto.vende_liquidacion) {
      doc.setFontSize(8.5);
      doc.setTextColor(...VERDE);
      doc.setFont("helvetica", "normal");
      doc.text("Vende con liquidación formal", mitad + 3, y + 21.5);
    }
  } else {
    doc.setFontSize(9);
    doc.setTextColor(...SUAVE);
    doc.text("Aún sin operación que medir", mitad + 3, y + 14);
  }
  y += 32;

  // Resumen ejecutivo
  y = tituloSeccion(doc, y, "Resumen ejecutivo");
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...TEXTO);
  const partes: string[] = [];
  if (proyecto.descripcion_generada) partes.push(proyecto.descripcion_generada);
  if (proyecto.brechas_pendientes.length === 0) {
    partes.push("Completó todos los requisitos del diagnóstico de formalización.");
  } else {
    partes.push(
      `Tiene ${proyecto.brechas_pendientes.length} requisito${
        proyecto.brechas_pendientes.length !== 1 ? "s" : ""
      } de formalización en proceso.`
    );
  }
  const resumen = doc.splitTextToSize(partes.join(" "), ANCHO_UTIL);
  doc.text(resumen, MARGEN, y);
  y += resumen.length * 4.4 + 2;
  if (proyecto.descripcion_operacion) {
    doc.setFont("helvetica", "italic");
    doc.setTextColor(...SUAVE);
    const cita = doc.splitTextToSize(`"${proyecto.descripcion_operacion}"`, ANCHO_UTIL - 6);
    doc.setDrawColor(...ACENTO);
    doc.setLineWidth(0.7);
    doc.line(MARGEN + 1, y - 2.5, MARGEN + 1, y + cita.length * 4.4 - 2.5);
    doc.text(cita, MARGEN + 5, y);
    y += cita.length * 4.4 + 3;
    doc.setFont("helvetica", "normal");
  }
  y += 3;

  // Oportunidad de inversión (datos duros en dos columnas)
  y = tituloSeccion(doc, y, "Oportunidad de inversión");
  const datos: [string, string][] = [];
  if (proyecto.capital_buscado) datos.push(["Capital buscado", formatearMonto(proyecto.capital_buscado)]);
  if (proyecto.uso_fondos) datos.push(["Uso de los fondos", proyecto.uso_fondos]);
  if (proyecto.ley_promedio) datos.push(["Ley del mineral declarada", proyecto.ley_promedio]);
  if (proyecto.capacidad_produccion) datos.push(["Producción y reservas", proyecto.capacidad_produccion]);
  if (proyecto.tiempo_operacion) datos.push(["Tiempo de operación", proyecto.tiempo_operacion]);
  if (proyecto.ubicacion_maps) datos.push(["Ubicación (Google Maps)", proyecto.ubicacion_maps]);
  if (datos.length === 0) {
    doc.setFontSize(9.5);
    doc.setTextColor(...SUAVE);
    doc.text("El titular aún no completó los datos de su oportunidad.", MARGEN, y);
    y += 6;
  }
  for (const [etiqueta, valor] of datos) {
    doc.setFontSize(8);
    doc.setTextColor(...SUAVE);
    doc.setFont("helvetica", "normal");
    doc.text(etiqueta.toUpperCase(), MARGEN, y);
    doc.setFontSize(10);
    doc.setTextColor(...TEXTO);
    doc.setFont("helvetica", "bold");
    const lineasValor = doc.splitTextToSize(valor, ANCHO_UTIL - 62);
    doc.text(lineasValor, MARGEN + 62, y);
    y += Math.max(5.5, lineasValor.length * 4.6 + 1);
  }

  pie(doc, proyecto, 1, 2);

  // ---------- PÁGINA 2 ----------
  doc.addPage();
  encabezado(doc);
  y = 24;

  // Checklist de formalización
  y = tituloSeccion(doc, y, "Estado de formalización");
  doc.setFont("helvetica", "normal");
  const verificadas = proyecto.brechas_verificadas ?? [];
  const pendientes = proyecto.brechas_pendientes ?? [];
  const filas: [string, boolean][] = [
    ...verificadas.map((b): [string, boolean] => [INFO_BRECHA[b]?.texto ?? b, true]),
    ...pendientes.map((b): [string, boolean] => [INFO_BRECHA[b]?.texto ?? b, false]),
  ].slice(0, 14);
  if (filas.length === 0) {
    doc.setFontSize(9.5);
    doc.setTextColor(...SUAVE);
    doc.text("Sin requisitos verificables registrados todavía.", MARGEN, y);
    y += 6;
  }
  for (const [texto, ok] of filas) {
    // El glifo "✓" no existe en las fuentes estándar de jsPDF — se dibuja
    // el check con líneas; el pendiente es un punto relleno ámbar.
    if (ok) {
      doc.setDrawColor(...VERDE);
      doc.setLineWidth(0.6);
      doc.line(MARGEN, y - 1.4, MARGEN + 1.1, y - 0.3);
      doc.line(MARGEN + 1.1, y - 0.3, MARGEN + 3, y - 2.6);
    } else {
      doc.setFillColor(...AMARILLO);
      doc.circle(MARGEN + 1.5, y - 1.3, 0.9, "F");
    }
    doc.setFontSize(9.5);
    doc.setTextColor(...TEXTO);
    doc.setFont("helvetica", "normal");
    doc.text(texto, MARGEN + 5, y);
    doc.setFontSize(8);
    doc.setTextColor(...SUAVE);
    doc.text(ok ? "verificado con foto" : "en proceso", ANCHO - MARGEN, y, { align: "right" });
    doc.setFontSize(9.5);
    y += 5.4;
  }
  y += 3;

  // Documentos presentados
  const presentados = Object.entries(proyecto.documentos_presentados ?? {}).filter(([, v]) => v);
  if (presentados.length > 0) {
    y = tituloSeccion(doc, y, "Documentos presentados");
    doc.setFontSize(9.5);
    doc.setTextColor(...TEXTO);
    doc.setFont("helvetica", "normal");
    doc.text(
      presentados.map(([c]) => ETIQUETAS_DOCUMENTO_LEGAL[c] ?? c).join("  ·  "),
      MARGEN,
      y,
      { maxWidth: ANCHO_UTIL }
    );
    y += 10;
  }

  // Galería
  if (galeria.length > 0) {
    y = tituloSeccion(doc, y, "Galería de la operación");
    const anchoFoto = (ANCHO_UTIL - 4) / 2;
    const altoFoto = 42;
    galeria.forEach((foto, i) => {
      const col = i % 2;
      const fila = Math.floor(i / 2);
      fotoEnCaja(doc, foto, MARGEN + col * (anchoFoto + 4), y + fila * (altoFoto + 4), anchoFoto, altoFoto);
    });
    y += Math.ceil(galeria.length / 2) * (altoFoto + 4) + 2;
  }

  pie(doc, proyecto, 2, 2);

  const nombreArchivo = `MineLink-${proyecto.nombre_proyecto.replace(/[^a-z0-9]+/gi, "-")}.pdf`;
  doc.save(nombreArchivo);
}
