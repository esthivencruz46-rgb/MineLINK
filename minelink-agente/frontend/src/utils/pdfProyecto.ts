import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { BASE_URL } from "../services/api";
import { MARCA } from "../config/marca";
import { INFO_BRECHA } from "../data/brechas";
import { POR_ID_INV } from "../data/preguntasInversion";
import { formatearMonto } from "./formato";
import { ETIQUETAS_DOCUMENTO_LEGAL, type FotoPublica, type ProyectoDetalle } from "../types/proyecto";
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

// Estudios que también puede pedir el Módulo INV (mapeo geológico, análisis
// de laboratorio, estimación de recursos) — espejo de la misma constante en
// ProyectoDetalle.tsx: cuando no son parte del checklist de formalización de
// este perfil, se muestran en "Documentos de inversión" en vez de mezclarse
// en el checklist.
const ESTUDIOS_TAMBIEN_DE_INVERSION = new Set([
  "informe_geologico",
  "analisis_laboratorio",
  "estimacion_recursos",
]);

const ETIQUETA_DOC_INVERSION: Record<string, string> = {
  certificado_ley: "Certificado de ley del mineral",
};

// Espejo de interpretacion_ubicacion._TITULOS_CAPAS (backend) — para la
// galería "capas 1 por 1" del PDF (agosto 2026).
const ETIQUETA_CAPA_COPERNICUS: Record<string, string> = {
  oxidos_de_hierro: "Óxidos de hierro (Copernicus)",
  arcillas: "Arcillas (Copernicus)",
  hierro_ferroso: "Hierro ferroso (Copernicus)",
  arcilla_sulfatos_mica: "Arcilla / sulfatos / mica (Copernicus)",
  combinado: "Combinado (Copernicus)",
  coincidencias: "Coincidencias — 2+ índices de acuerdo (Copernicus)",
};

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Guarda el <img> ya DECODIFICADO (no solo el dataURL) — dibujarlo en un
// canvas con `new Image(); img.src = dataUrl; ctx.drawImage(img, ...)`
// synchronously (como hacía la versión anterior) dibuja un cuadro negro:
// asignar `.src` no garantiza que la imagen ya esté decodificada en el
// mismo tick, así que drawImage corre antes de que haya algo que pintar.
// Manteniendo el <img> ya cargado (awaited una sola vez acá) se evita
// tener que esperar de nuevo cada vez que se dibuja.
type Foto = { img: HTMLImageElement; w: number; h: number };

/** Descarga una foto pública y la devuelve con su <img> ya decodificado y
 *  sus dimensiones. null si falla: el PDF sale igual, solo sin esa foto. */
async function cargarFoto(url: string): Promise<Foto | null> {
  try {
    const resp = await fetch(`${BASE_URL}${url}`);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    const objectUrl = URL.createObjectURL(blob);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = objectUrl;
    });
    return { img, w: img.naturalWidth, h: img.naturalHeight };
  } catch {
    return null;
  }
}

/** Descarga la PRIMERA foto de cada entrada de un mapa {codigo: [FotoPublica]}
 *  en paralelo — para los mini-thumbnails del checklist y de "Documentos de
 *  inversión". Devuelve un Map código→Foto (solo las que sí cargaron). */
async function cargarPrimeraFotoPorCodigo(
  mapa: Record<string, FotoPublica[]> | undefined
): Promise<Map<string, Foto>> {
  const entradas = Object.entries(mapa ?? {}).filter(([, fotos]) => fotos.length > 0);
  const resultados = await Promise.all(
    entradas.map(async ([codigo, fotos]) => [codigo, await cargarFoto(fotos[0].url)] as const)
  );
  const salida = new Map<string, Foto>();
  for (const [codigo, foto] of resultados) if (foto) salida.set(codigo, foto);
  return salida;
}

/** Dibuja una foto RECORTADA para llenar exactamente la caja (modo
 *  "cover", como object-cover en CSS) usando un canvas intermedio. */
function fotoEnCaja(
  doc: jsPDF,
  foto: Foto,
  x: number,
  y: number,
  ancho: number,
  alto: number,
  radio = 0
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
  // Fondo blanco ANTES de dibujar (agosto 2026): sin esto, un PNG
  // transparente (como las capas de anomalías espectrales) sale con fondo
  // NEGRO al convertir a JPEG -- el canvas compone lo transparente sobre
  // negro por defecto al aplanar a un formato sin canal alfa. Para fotos
  // opacas normales esto no cambia nada (drawImage las cubre por completo).
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(
    foto.img,
    (foto.w - wRec) / 2,
    (foto.h - hRec) / 2,
    wRec,
    hRec,
    0,
    0,
    canvas.width,
    canvas.height
  );
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  doc.addImage(dataUrl, "JPEG", x, y, ancho, alto);
  if (radio > 0) {
    // jsPDF no recorta imágenes a un roundedRect sin plugins extra — se
    // dibuja un marco fino encima como acabado visual de la miniatura.
    doc.setDrawColor(225, 228, 234);
    doc.setLineWidth(0.3);
    doc.rect(x, y, ancho, alto, "S");
  }
}

function encabezado(doc: jsPDF): void {
  doc.setFillColor(...ACENTO);
  doc.rect(0, 0, ANCHO, 14, "F");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text(MARCA.toUpperCase(), MARGEN, 9);
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
    "Datos autodeclarados por el titular. El sello \"Con respaldo\" solo aparece en documentos " +
      `ya revisados y aprobados por el equipo de ${MARCA} — los demás son visibles pero aún sin revisar.`,
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

/** Asegura que quede espacio para lo que sigue — si no, agrega página
 *  nueva con encabezado y devuelve el nuevo y. */
function asegurarEspacio(doc: jsPDF, y: number, necesita: number): number {
  if (y + necesita <= ALTO - 18) return y;
  doc.addPage();
  encabezado(doc);
  return 24;
}

/** Fila de checklist CON miniatura real del documento de respaldo (si hay
 *  una foto descargada para ese código) — antes solo había un check/punto
 *  de texto, sin mostrar la evidencia en sí. "Con respaldo" (verde) exige
 *  aprobación de Esthiven; con foto pero sin aprobar sale en ámbar como
 *  "sin revisar todavía"; sin foto en gris como pendiente.
 *
 *  `y` es siempre el TOP de la fila (no una línea base) — evita la trampa
 *  de mezclar "y como baseline de texto" con "y como borde superior de la
 *  imagen" que causaba filas superpuestas con el título de la sección de
 *  arriba en la primera versión. */
function filaChecklist(
  doc: jsPDF,
  y: number,
  texto: string,
  estado: "aprobado" | "sin_revisar" | "pendiente",
  foto?: Foto
): number {
  const ANCHO_FOTO = 13;
  const alto = foto ? ANCHO_FOTO + 3 : 7;
  y = asegurarEspacio(doc, y, alto + 2);

  const xTexto = foto ? MARGEN + ANCHO_FOTO + 4 : MARGEN + 6;
  const yPrimeraLinea = y + 4.5;

  if (foto) {
    fotoEnCaja(doc, foto, MARGEN, y, ANCHO_FOTO, ANCHO_FOTO, 1.5);
  } else {
    const color = estado === "pendiente" ? [222, 226, 233] : AMARILLO;
    doc.setFillColor(...(color as [number, number, number]));
    doc.circle(MARGEN + 1.8, yPrimeraLinea - 1.3, 1.6, "F");
  }

  doc.setFontSize(9.5);
  doc.setTextColor(...TEXTO);
  doc.setFont("helvetica", "normal");
  const lineasTexto = doc.splitTextToSize(texto, ANCHO_UTIL - (xTexto - MARGEN) - 34);
  doc.text(lineasTexto, xTexto, yPrimeraLinea);

  const ETIQUETA = {
    aprobado: "Con respaldo",
    sin_revisar: "Sin revisar aún",
    pendiente: "Pendiente",
  }[estado];
  const COLOR = { aprobado: VERDE, sin_revisar: AMARILLO, pendiente: SUAVE }[estado];
  doc.setFontSize(8);
  doc.setTextColor(...COLOR);
  doc.setFont("helvetica", "bold");
  doc.text(ETIQUETA, ANCHO - MARGEN, yPrimeraLinea, { align: "right" });

  return y + alto;
}

/** Ficha de inversión con los datos REALES del proyecto — portada
 *  fotográfica, semáforos del spec, oportunidad de capital, checklist de
 *  formalización CON miniatura del respaldo, documentos de inversión,
 *  cotejo GEOCATMIN/SERNANP/REINFO y galería. Nunca incluye datos de
 *  contacto del minero (misma regla que la ficha pública). jsPDF se carga
 *  diferido para no pesar el bundle. */
export async function generarPdfProyecto(proyecto: ProyectoDetalle): Promise<void> {
  const { jsPDF } = await import("jspdf");

  const aplicables = new Set(proyecto.estudios_aplicables ?? []);
  const verificadas = new Set(proyecto.brechas_verificadas ?? []);
  const pendientes = proyecto.brechas_pendientes ?? [];

  // Ítems del checklist que sí aplican a este perfil (estructural) más
  // cualquiera con foto subida aunque no sea estructural (misma regla que
  // la ficha web, salvo los del Módulo INV que van a su propia sección).
  const codigosChecklist = new Set<string>([...aplicables, ...verificadas, ...pendientes]);
  for (const c of ESTUDIOS_TAMBIEN_DE_INVERSION) {
    if (!aplicables.has(c)) codigosChecklist.delete(c);
  }
  const documentosInversionExtra = [...ESTUDIOS_TAMBIEN_DE_INVERSION].filter(
    (e) => !aplicables.has(e) && (proyecto.documentos_estudios[e]?.length ?? 0) > 0
  );

  // Descargas en paralelo: mapa de portada + fotos + miniaturas del
  // checklist + miniaturas de documentos de inversión — todo antes de
  // dibujar, para no ir armando el PDF a pedazos mientras llegan las fotos.
  const urlsFotos = proyecto.fotos.slice(0, 5).map((f) => f.url);
  // capas_pdf (compuestas sobre base satelital), no "capas" (transparente
  // -- esa es solo para el mapa interactivo, que ya tiene su propio
  // basemap vivo debajo). Ver backend/copernicus.py imagen_con_satelite.
  const capasCopernicusUrls = Object.entries(proyecto.anomalias_satelitales?.capas_pdf ?? {});
  const [
    mapaPortada,
    fotos,
    miniaturasChecklist,
    miniaturasInversion,
    capaCatastroAnalisis,
    capaAster,
    capaAnomaliaGeocatmin,
    capasCopernicus,
  ] = await Promise.all([
    // Portada (pedido explícito, julio 2026): en vez de una foto cualquiera
    // del minero, la imagen inicial es el mapa de ubicación con catastro y
    // geología — se genera server-side (ver geocatmin.imagen_mapa_cotejo).
    // Si no hay pin declarado, mapa_cotejo_url viene null y se cae de
    // vuelta a la primera foto de la galería como antes.
    proyecto.mapa_cotejo_url ? cargarFoto(proyecto.mapa_cotejo_url) : Promise.resolve(null),
    Promise.all(urlsFotos.map(cargarFoto)),
    cargarPrimeraFotoPorCodigo(
      Object.fromEntries(
        [...codigosChecklist].map((c) => [c, proyecto.documentos_estudios[c] ?? []])
      )
    ),
    cargarPrimeraFotoPorCodigo({
      ...(proyecto.documentos_inversion ?? {}),
      ...Object.fromEntries(documentosInversionExtra.map((e) => [e, proyecto.documentos_estudios[e]]))
    }),
    // Capas de análisis satelital "1 por 1" (agosto 2026, pedido explícito
    // de Esthiven). La de catastro/geología/fallas usa su PROPIA imagen
    // (geocatmin_catastro_analisis_url), con el bbox ajustado al polígono
    // en vez de reusar la portada (bbox panorámico centrado en el pin) --
    // corrección agosto 2026, reportado en vivo con captura: la concesión
    // aparecía como un recuadro chico perdido en una esquina.
    proyecto.geocatmin_catastro_analisis_url
      ? cargarFoto(proyecto.geocatmin_catastro_analisis_url)
      : Promise.resolve(null),
    proyecto.geocatmin_aster_url ? cargarFoto(proyecto.geocatmin_aster_url) : Promise.resolve(null),
    proyecto.geocatmin_anomalia_espectral_url
      ? cargarFoto(proyecto.geocatmin_anomalia_espectral_url)
      : Promise.resolve(null),
    Promise.all(
      capasCopernicusUrls.map(async ([nombre, url]) => [nombre, await cargarFoto(url)] as const)
    ),
  ]);
  const fotosOk = fotos.filter((f): f is Foto => f !== null);
  const portada = mapaPortada ?? fotosOk[0] ?? null;
  // Si el mapa se usó de portada, ninguna foto de la galería se "gasta" en
  // eso — todas quedan disponibles para la sección de galería.
  const galeria = mapaPortada ? fotosOk.slice(0, 4) : fotosOk.slice(1, 5);

  // Galería de capas para la sección "Análisis satelital (IA)". Solo
  // entran las que sí cargaron (best-effort, igual que el resto del PDF).
  const capasAnalisis: { etiqueta: string; foto: Foto }[] = [
    ...(capaCatastroAnalisis
      ? [{ etiqueta: "Catastro, geología y fallas (GEOCATMIN)", foto: capaCatastroAnalisis }]
      : []),
    ...(capaAster ? [{ etiqueta: "ASTER 9-3-1 — roca vs. vegetación (GEOCATMIN)", foto: capaAster }] : []),
    ...(capaAnomaliaGeocatmin
      ? [{ etiqueta: "Anomalías Espectrales (GEOCATMIN)", foto: capaAnomaliaGeocatmin }]
      : []),
    ...capasCopernicus
      .filter((par): par is [string, Foto] => par[1] !== null)
      .map(([nombre, foto]) => ({ etiqueta: ETIQUETA_CAPA_COPERNICUS[nombre] ?? nombre, foto })),
  ];

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
  {
    // Tipo de aporte que le sirve (INV_0_12, julio 2026) — traducido con
    // las mismas etiquetas del cuestionario.
    const aporte = proyecto.respuestas_inversion_publicas?.INV_0_12;
    if (Array.isArray(aporte) && aporte.length > 0) {
      const etiquetas = aporte.map(
        (v) => POR_ID_INV.INV_0_12?.opciones?.find((o) => o.valor === v)?.etiqueta ?? v
      );
      datos.push(["Aportes que le sirven", etiquetas.join(", ")]);
    }
  }
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

  // ---------- PÁGINA 2 ----------
  doc.addPage();
  encabezado(doc);
  y = 24;

  // Checklist de formalización — CON miniatura real del documento cuando
  // hay una foto subida (antes solo era texto + un check/punto).
  y = tituloSeccion(doc, y, "Estado de formalización");
  doc.setFont("helvetica", "normal");
  const filasChecklist: { texto: string; estado: "aprobado" | "sin_revisar" | "pendiente"; foto?: Foto }[] =
    [...codigosChecklist]
      .sort((a, b) => (verificadas.has(b) ? 1 : 0) - (verificadas.has(a) ? 1 : 0))
      .slice(0, 16)
      .map((codigo) => {
        const foto = miniaturasChecklist.get(codigo);
        const esPendiente = pendientes.includes(codigo);
        const estado: "aprobado" | "sin_revisar" | "pendiente" = esPendiente
          ? "pendiente"
          : verificadas.has(codigo)
            ? "aprobado"
            : "sin_revisar";
        return { texto: INFO_BRECHA[codigo]?.texto ?? codigo, estado, foto };
      });
  if (filasChecklist.length === 0) {
    doc.setFontSize(9.5);
    doc.setTextColor(...SUAVE);
    doc.text("Sin requisitos verificables registrados todavía.", MARGEN, y);
    y += 6;
  }
  for (const fila of filasChecklist) {
    y = filaChecklist(doc, y, fila.texto, fila.estado, fila.foto);
  }
  y += 3;

  // Documentos presentados
  const presentados = Object.entries(proyecto.documentos_presentados ?? {}).filter(([, v]) => v);
  if (presentados.length > 0) {
    y = asegurarEspacio(doc, y, 14);
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

  // Documentos de inversión — certificado de ley, mapeo geológico, etc.
  // (agregado julio 2026: antes esta evidencia no salía para nada en el
  // PDF, aunque ya se mostraba en la ficha web).
  const codigosInversion = [
    ...((proyecto.documentos_inversion?.certificado_ley?.length ?? 0) > 0 ? ["certificado_ley"] : []),
    ...documentosInversionExtra,
  ];
  if (codigosInversion.length > 0) {
    y = asegurarEspacio(doc, y, 20);
    y = tituloSeccion(doc, y, "Documentos de inversión");
    for (const codigo of codigosInversion) {
      const foto = miniaturasInversion.get(codigo);
      const etiqueta = ETIQUETA_DOC_INVERSION[codigo] ?? INFO_BRECHA[codigo]?.texto ?? codigo;
      // "Con respaldo" SOLO si Esthiven aprobó el documento (flag
      // `aprobado` de FotoPublica) — mismo criterio que la ficha web;
      // que la foto exista no basta (julio 2026, misma regla que el
      // checklist de formalización).
      const fotosDelCodigo =
        codigo === "certificado_ley" && proyecto.documentos_inversion?.certificado_ley
          ? proyecto.documentos_inversion.certificado_ley
          : proyecto.documentos_estudios[codigo] ?? [];
      const aprobado = fotosDelCodigo.some((f) => f.aprobado);
      y = filaChecklist(doc, y, etiqueta, aprobado ? "aprobado" : "sin_revisar", foto);
    }
    y += 3;
  }

  // Cotejo con registros públicos — GEOCATMIN (catastro + geología) y
  // REINFO (verificado a mano por MineLink) — agregado julio 2026.
  const geocatmin = proyecto.geocatmin;
  const tieneCotejo =
    geocatmin?.concesion ||
    geocatmin?.geologia ||
    geocatmin?.fallas ||
    geocatmin?.sedimentos ||
    proyecto.reinfo_verificado_manual;
  if (tieneCotejo) {
    y = asegurarEspacio(doc, y, 26);
    y = tituloSeccion(doc, y, "Cotejo con registros públicos");
    doc.setFontSize(9);
    doc.setTextColor(...TEXTO);
    doc.setFont("helvetica", "normal");
    if (geocatmin?.concesion) {
      const c = geocatmin.concesion;
      const linea = `Concesión ${c.nombre ?? ""}${c.leyenda ? ` · ${c.leyenda.toLowerCase()}` : ""}${
        c.hectareas != null ? ` · ${Math.round(c.hectareas)} ha` : ""
      } (GEOCATMIN/INGEMMET)`;
      const l = doc.splitTextToSize(linea, ANCHO_UTIL);
      doc.text(l, MARGEN, y);
      y += l.length * 4.4 + 1;
    }
    if (geocatmin?.geologia?.unidad) {
      doc.text(`Geología 1:100,000: ${geocatmin.geologia.unidad}`, MARGEN, y);
      y += 5;
    }
    if (geocatmin?.fallas) {
      const escalaTxt = geocatmin.fallas.escala === "50k" ? "1:50,000" : "1:100,000";
      const lineaFallas =
        geocatmin.fallas.items.length > 0
          ? `Fallas geológicas cercanas (${escalaTxt}): ${geocatmin.fallas.items
              .map((f) => f.nombre)
              .join(", ")}`
          : `Fallas geológicas (${escalaTxt}): ninguna registrada cerca (referencial)`;
      const l = doc.splitTextToSize(lineaFallas, ANCHO_UTIL);
      doc.text(l, MARGEN, y);
      y += l.length * 4.4 + 1;
    }
    if (geocatmin?.sedimentos) {
      const s = geocatmin.sedimentos;
      const distMin = s.cercanas.length
        ? Math.min(...s.cercanas.map((c) => c.distancia_km ?? 0))
        : null;
      const lineaS =
        s.total_dentro > 0
          ? `Sedimentos de quebrada (geoquímica): ${s.total_dentro} muestra(s) dentro del polígono de la concesión`
          : s.cercanas.length > 0
          ? `Sedimentos de quebrada (geoquímica): ninguna dentro del polígono; ${s.cercanas.length} cercana(s), la más próxima a ~${distMin} km del pin`
          : `Sedimentos de quebrada (geoquímica): ninguna registrada dentro ni cerca (referencial)`;
      const l = doc.splitTextToSize(lineaS, ANCHO_UTIL);
      doc.text(l, MARGEN, y);
      y += l.length * 4.4 + 1;
    }
    if (geocatmin?.anp?.zona === "dentro") {
      doc.setTextColor(...ROJO);
      doc.setFont("helvetica", "bold");
      doc.text("Alerta: el punto cae dentro de un Área Natural Protegida", MARGEN, y);
      doc.setFont("helvetica", "normal");
      y += 5;
    }
    if (proyecto.reinfo_verificado_manual) {
      doc.setTextColor(...VERDE);
      doc.setFont("helvetica", "bold");
      doc.text(
        `Código REINFO verificado por el equipo de ${MARCA}${
          proyecto.codigo_reinfo ? ` (${proyecto.codigo_reinfo})` : ""
        }`,
        MARGEN,
        y
      );
      doc.setFont("helvetica", "normal");
      y += 5;
    }
    y += 2;
  }

  // Análisis satelital (IA) — agosto 2026, pedido explícito de Esthiven:
  // el mismo texto que ya se ve en la ficha web, más las capas 1 por 1
  // (catastro+geología+fallas combinadas en una sola imagen, el resto
  // separadas). El aviso de que es una hipótesis sin confirmar va chico,
  // debajo del texto (ver comentario más abajo) — no una caja grande.
  if (proyecto.interpretacion_ubicacion || capasAnalisis.length > 0) {
    // Se mide el texto ANTES de escribir el título para poder reservar
    // título + párrafo + primera fila de imágenes de una sola vez (agosto
    // 2026). Si se reserva solo el título y después el texto no entra, el
    // salto de página cae en medio y el título queda huérfano al pie de la
    // página anterior, separado de su propio contenido — que es justo lo
    // que hacía parecer que la interpretación no se generaba.
    doc.setFontSize(9.5);
    const lineasInterpretacion = proyecto.interpretacion_ubicacion
      ? doc.splitTextToSize(proyecto.interpretacion_ubicacion, ANCHO_UTIL)
      : [];
    const altoTexto = lineasInterpretacion.length * 4.4 + (lineasInterpretacion.length ? 12 : 0);
    y = asegurarEspacio(doc, y, 20 + altoTexto + (capasAnalisis.length > 0 ? 44 : 0));
    y = tituloSeccion(doc, y, "Análisis satelital (IA)");

    // Aviso bajado a una línea chica DEBAJO del texto (agosto 2026, pedido
    // explícito tras ver el análisis funcionando bien en proyectos reales:
    // "no pongas mucho de eso de advertencia porque está analizando bien")
    // -- antes era una caja grande con ícono de alerta arriba del texto.
    if (lineasInterpretacion.length > 0) {
      doc.setFontSize(9.5);
      doc.setTextColor(...TEXTO);
      doc.setFont("helvetica", "normal");
      // Sin asegurarEspacio acá: el espacio para el párrafo completo ya se
      // reservó junto con el título, arriba.
      doc.text(lineasInterpretacion, MARGEN, y, { align: "justify", maxWidth: ANCHO_UTIL });
      y += lineasInterpretacion.length * 4.4 + 3;

      doc.setFontSize(7.5);
      doc.setTextColor(...SUAVE);
      const aviso = doc.splitTextToSize(
        "Hipótesis generada por IA a partir de imágenes satelitales — señal a verificar en " +
          "campo, no un hallazgo confirmado.",
        ANCHO_UTIL
      );
      y = asegurarEspacio(doc, y, aviso.length * 3.6 + 2);
      doc.text(aviso, MARGEN, y);
      y += aviso.length * 3.6 + 5;
    }

    if (capasAnalisis.length > 0) {
      // Fila por fila, NO reservando la grilla entera de una vez: con las
      // 9 capas (5 filas ≈ 230mm) la grilla completa nunca entra en lo que
      // queda de una página, así que reservarla toda empujaba SIEMPRE la
      // grilla a una página nueva y dejaba el título "Análisis satelital
      // (IA)" y el párrafo de la IA solos al pie de la anterior — se leía
      // como que la interpretación no estaba (reportado en vivo, agosto
      // 2026: "tampoco hay la interpretación de la IA... dentro del PDF").
      // Se avanza `y` fila por fila y se salta de página solo cuando la
      // fila siguiente no entra, así el texto y sus primeras imágenes
      // quedan juntos.
      const anchoCapa = (ANCHO_UTIL - 4) / 2;
      const altoCapa = 36;
      for (let fila = 0; fila * 2 < capasAnalisis.length; fila++) {
        y = asegurarEspacio(doc, y, altoCapa + 8);
        for (let col = 0; col < 2; col++) {
          const capa = capasAnalisis[fila * 2 + col];
          if (!capa) break;
          const xCapa = MARGEN + col * (anchoCapa + 4);
          fotoEnCaja(doc, capa.foto, xCapa, y, anchoCapa, altoCapa, 1.5);
          doc.setFontSize(7.5);
          doc.setTextColor(...SUAVE);
          doc.setFont("helvetica", "normal");
          doc.text(capa.etiqueta, xCapa, y + altoCapa + 3.5, { maxWidth: anchoCapa });
        }
        y += altoCapa + 8;
      }
      y += 2;
    }
  }

  // Galería
  if (galeria.length > 0) {
    // Espacio para la galería COMPLETA (título + todas las filas), no solo
    // la primera — si no, con 3-4 fotos la segunda fila pisaba el pie de
    // página en vez de saltar a una página nueva.
    const filasGaleria = Math.ceil(galeria.length / 2);
    y = asegurarEspacio(doc, y, 10 + filasGaleria * 46);
    y = tituloSeccion(doc, y, "Galería de la operación");
    const anchoFoto = (ANCHO_UTIL - 4) / 2;
    const altoFoto = 42;
    galeria.forEach((foto, i) => {
      const col = i % 2;
      const fila = Math.floor(i / 2);
      const yFoto = y + fila * (altoFoto + 4);
      fotoEnCaja(doc, foto, MARGEN + col * (anchoFoto + 4), yFoto, anchoFoto, altoFoto);
    });
    y += Math.ceil(galeria.length / 2) * (altoFoto + 4) + 2;
  }

  // Pie de página en TODAS las páginas generadas (antes solo se numeraban
  // 2 fijas; ahora el checklist con fotos puede empujar a una 3ª página).
  const totalPaginas = doc.getNumberOfPages();
  for (let p = 1; p <= totalPaginas; p++) {
    doc.setPage(p);
    pie(doc, proyecto, p, totalPaginas);
  }

  const nombreArchivo = `${MARCA}-${proyecto.nombre_proyecto.replace(/[^a-z0-9]+/gi, "-")}.pdf`;

  // En la app nativa, doc.save() no sirve de nada (agosto 2026, bug real
  // reportado: "no se genera") -- ese método dispara el truco de
  // descarga del NAVEGADOR (un <a download> con blob URL simulando un
  // clic), que depende del gestor de descargas de Chrome/Firefox/etc.
  // El WebView embebido de Capacitor no tiene eso: el clic no hace nada
  // visible, sin error. El camino real en una app nativa es escribir el
  // archivo con Filesystem y abrir la hoja nativa de "Compartir/Guardar"
  // con Share -- mismo patrón que cualquier app Capacitor que genera un
  // archivo (documentado así por el propio Capacitor).
  if (Capacitor.isNativePlatform()) {
    const base64 = doc.output("datauristring").split(",")[1];
    const { uri } = await Filesystem.writeFile({
      path: nombreArchivo,
      data: base64,
      directory: Directory.Cache,
    });
    await Share.share({
      title: nombreArchivo,
      dialogTitle: "Guardar o compartir tu PDF",
      url: uri,
    });
    return;
  }

  doc.save(nombreArchivo);
}
