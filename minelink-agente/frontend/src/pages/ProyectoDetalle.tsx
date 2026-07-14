import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowUpRight,
  BadgeCheck,
  Check,
  ChevronLeft,
  ImageIcon,
  Map as MapIcon,
  MapPin,
  Minus,
  Star,
} from "lucide-react";
import { GaleriaProyecto } from "../components/proyecto/GaleriaProyecto";
import { InteresInversionModal } from "../components/proyecto/InteresInversionModal";
import { INFO_BRECHA } from "../data/brechas";
import { POR_ID_INV } from "../data/preguntasInversion";
import { DIMENSION_POR_ESTUDIO } from "../data/estudioDimension";
import { NOMBRES_DIMENSION } from "../data/preguntas";
import { obtenerProyecto, BASE_URL } from "../services/api";
import { semaforoDesdeColor } from "../utils/semaforo";
import { formatearMonto } from "../utils/formato";
import { generarPdfProyecto } from "../utils/pdfProyecto";
import type { FotoPublica, ProyectoDetalle as ProyectoDetalleType } from "../types/proyecto";
import type { NombreDimension } from "../types/diagnostico";

export function ProyectoDetalle() {
  const { id } = useParams<{ id: string }>();
  const [proyecto, setProyecto] = useState<ProyectoDetalleType | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalMensaje, setModalMensaje] = useState<string | null>(null);
  const [enlaceCopiado, setEnlaceCopiado] = useState(false);
  const [fotoAbierta, setFotoAbierta] = useState<{ url: string; etiqueta: string } | null>(null);
  const [generandoPdf, setGenerandoPdf] = useState(false);

  async function compartir() {
    if (!proyecto) return;
    const url = window.location.href;
    const texto = `Mira este proyecto minero en MineLink: ${proyecto.nombre_proyecto} (${proyecto.mineral}, ${proyecto.region})`;
    // En celular abre el menú nativo de compartir (WhatsApp, etc.);
    // en PC copia el enlace al portapapeles.
    if (navigator.share) {
      try {
        await navigator.share({ title: proyecto.nombre_proyecto, text: texto, url });
        return;
      } catch {
        // usuario canceló el menú — no hacer nada
        return;
      }
    }
    await navigator.clipboard.writeText(`${texto}\n${url}`);
    setEnlaceCopiado(true);
    setTimeout(() => setEnlaceCopiado(false), 2500);
  }

  useEffect(() => {
    if (!id) return;
    setCargando(true);
    obtenerProyecto(id)
      .then((data) => {
        setProyecto(data);
        setError(null);
      })
      .catch(() => setError("No pudimos cargar este proyecto."))
      .finally(() => setCargando(false));
  }, [id]);

  if (cargando) {
    return <p className="p-8 text-center text-texto-suave dark:text-texto-suave-dark">Cargando...</p>;
  }

  if (error || !proyecto || !id) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-8 text-center">
        <p className="text-red-500">{error ?? "Proyecto no encontrado."}</p>
        <Link to="/proyectos" className="text-sm font-semibold text-acento underline">
          Volver a proyectos
        </Link>
      </div>
    );
  }

  const semLegal = semaforoDesdeColor(proyecto.semaforo_legal);
  const semTecnico = semaforoDesdeColor(proyecto.semaforo_tecnico);
  const madurez = proyecto.indice_madurez;
  const destacado = proyecto.semaforo_legal === "verde" && (madurez ?? 0) >= 4;
  const TRACK_LEGAL_TEXTO: Record<string, string> = {
    B: "Concesión titulada al día",
    C:
      proyecto.docs_completados != null && proyecto.docs_totales != null
        ? `REINFO vigente · ${proyecto.docs_completados}/${proyecto.docs_totales} documentos`
        : "REINFO vigente",
    D: "Formal — autorización DREM/GREM",
  };
  const trackLegalTexto = TRACK_LEGAL_TEXTO[proyecto.perfil ?? ""] ?? "En evaluación";

  // El diagnóstico es autodeclarado — el minero puede responder "sí" a
  // todo sin sustento. brechas_verificadas es el subconjunto de
  // brechas_resueltas que además tiene foto de respaldo subida: solo esas
  // muestran check ✓ en la ficha pública.
  const verificadas = new Set(proyecto.brechas_verificadas);

  // Solo se muestra "Contrato de explotación" cuando NO es titular — si ya
  // es titular, el título de concesión ya cubre eso (mismo criterio que en
  // su propia cuenta, ver DocumentosMinero.tsx).
  const estudiosDe = (dim: NombreDimension) =>
    Object.keys(INFO_BRECHA).filter(
      (e) =>
        DIMENSION_POR_ESTUDIO[e] === dim &&
        !(proyecto.es_titular_concesion === true && e === "contrato_explotacion")
    );

  // Un solo checklist cubre TODO el diagnóstico de formalización (antes
  // "Estado de Formalización" solo mostraba legal/ambiental/seguridad/
  // social y dejaba técnico y operativo en una tarjeta aparte con las
  // mismas fotos repetidas — julio 2026: se unificó en un solo lugar, cada
  // ítem con su propia miniatura, sin recuadros redundantes).
  const BLOQUES_FORMALIZACION: { dim: NombreDimension; conReinfo?: boolean }[] = [
    { dim: "legal", conReinfo: true },
    { dim: "ambiental" },
    { dim: "tecnico" },
    { dim: "seguridad" },
    { dim: "social" },
    { dim: "operativo" },
  ];

  // Varios estudios del catálogo piden en la práctica LA MISMA foto (ej.
  // "Plano georreferenciado" en Legal y "Levantamiento topográfico" en
  // Técnico se respaldan ambos con el catastro) — sin fusionarlos, subir
  // un solo archivo hacía que la misma imagen apareciera dos veces en el
  // checklist, viéndose como un error/duplicado. Se detecta por el id de
  // la primera foto (si dos ítems comparten la misma primera foto, el
  // backend les copió la misma lista completa — ver categoria_equivalente
  // en routers/proyectos.py) y se combinan en un solo ítem con las
  // etiquetas juntas. Un ítem puede tener varias fotos (el minero puede
  // subir más de una por categoría, ej. 3 ángulos del catastro) — se
  // muestran todas, no solo la primera.
  type ItemFormalizacion = {
    dim: NombreDimension;
    etiqueta: string;
    fotos: FotoPublica[];
    completo: boolean;
  };
  const fotosYaMostradas = new Map<number, ItemFormalizacion>();
  const itemsFormalizacion: ItemFormalizacion[] = [];
  for (const { dim } of BLOQUES_FORMALIZACION) {
    for (const estudio of estudiosDe(dim)) {
      const item: ItemFormalizacion = {
        dim,
        etiqueta: INFO_BRECHA[estudio]?.texto ?? estudio,
        fotos: proyecto.documentos_estudios[estudio] ?? [],
        completo: verificadas.has(estudio),
      };
      if (item.fotos.length > 0) {
        const previo = fotosYaMostradas.get(item.fotos[0].id);
        if (previo) {
          previo.etiqueta = `${previo.etiqueta} / ${item.etiqueta}`;
          previo.completo = previo.completo || item.completo;
          continue;
        }
        fotosYaMostradas.set(item.fotos[0].id, item);
      }
      itemsFormalizacion.push(item);
    }
  }

  // Resumen ejecutivo: foco en el score y la oportunidad de inversión, con
  // los puntos a favor como chips cortos en vez de una lista/tarjeta aparte.
  const partesResumen: string[] = [
    `${proyecto.nombre_proyecto}: ${trackLegalTexto.toLowerCase()}${
      madurez != null ? `, con madurez técnica ${madurez}/5` : ""
    }.`,
  ];
  if (proyecto.brechas_pendientes.length === 0) {
    partesResumen.push("Completó todos los requisitos del diagnóstico de formalización.");
  } else {
    partesResumen.push(
      `Tiene ${proyecto.brechas_pendientes.length} requisito${
        proyecto.brechas_pendientes.length !== 1 ? "s" : ""
      } de formalización en proceso.`
    );
  }
  if (proyecto.capital_buscado) {
    partesResumen.push(
      `Actualmente busca ${formatearMonto(proyecto.capital_buscado)}${
        proyecto.uso_fondos ? ` para ${proyecto.uso_fondos.toLowerCase()}` : ""
      }.`
    );
  }

  const puntosAFavor: string[] = [];
  if (proyecto.semaforo_legal === "verde") puntosAFavor.push("Sin pendientes legales en su etapa");
  if (proyecto.indicadores?.ventas_liquidacion_verificada) {
    puntosAFavor.push("Ventas con liquidación verificadas");
  } else if (proyecto.vende_liquidacion) {
    puntosAFavor.push("Vende con liquidación formal");
  }
  if ((madurez ?? 0) >= 4) puntosAFavor.push("Madurez técnica alta");
  if (proyecto.brechas_resueltas.length > 0) {
    puntosAFavor.push(`${proyecto.brechas_resueltas.length} trámite(s) resuelto(s)`);
  }
  if (proyecto.capital_buscado) puntosAFavor.push("Busca capital activamente");

  // Respuestas públicas del Módulo INV traducidas a etiquetas legibles con
  // el mismo catálogo del cuestionario (data/preguntasInversion.ts).
  const inv = proyecto.respuestas_inversion_publicas ?? {};
  const etiquetaInv = (id: string, valor: string): string =>
    POR_ID_INV[id]?.opciones?.find((o) => o.valor === valor)?.etiqueta ?? valor;
  const valorInv = (id: string): string | null => {
    const v = inv[id];
    if (v == null) return null;
    if (Array.isArray(v)) {
      return v.length > 0 ? v.map((x) => etiquetaInv(id, x)).join(", ") : null;
    }
    return etiquetaInv(id, v);
  };
  const filasOportunidad = [
    { id: "INV_0_1", etiqueta: "Capital que busca" },
    { id: "INV_0_2", etiqueta: "Uso del capital" },
    { id: "INV_0_3", etiqueta: "Qué ofrece a cambio" },
    { id: "INV_0_4", etiqueta: "Qué aporta el titular" },
    { id: "INV_0_5", etiqueta: "Retorno estimado por el titular" },
    { id: "INV_0_9", etiqueta: "Estructura legal" },
    { id: "INV_0_10", etiqueta: "Dispuesto a ceder" },
    { id: "INV_0_11", etiqueta: "Deudas declaradas" },
  ]
    .map((f) => ({ ...f, valor: valorInv(f.id) }))
    .filter((f): f is { id: string; etiqueta: string; valor: string } => f.valor != null);

  // Datos estructurados de la operación (los escribe el minero junto a sus
  // archivos de respaldo — ver DocumentosInversionSustento).
  const filasOperacion = [
    { etiqueta: "Ley promedio del mineral", valor: proyecto.ley_promedio },
    { etiqueta: "Minerales y litología", valor: proyecto.especie_mineral },
    { etiqueta: "Reservas estimadas", valor: proyecto.toneladas_estimadas },
    {
      etiqueta: "Costo operativo aproximado",
      valor: proyecto.indicadores?.opex_costo_aprox
        ? `S/ ${proyecto.indicadores.opex_costo_aprox} por TN`
        : null,
    },
    {
      etiqueta: "Equipo de trabajo",
      valor:
        [
          proyecto.indicadores?.num_trabajadores
            ? `${proyecto.indicadores.num_trabajadores} trabajadores`
            : null,
          proyecto.indicadores?.maquinaria,
        ]
          .filter(Boolean)
          .join(" · ") || null,
    },
  ].filter((f): f is { etiqueta: string; valor: string } => Boolean(f.valor));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link to="/proyectos" className="inline-flex items-center gap-1 text-sm font-semibold text-acento underline">
        <ChevronLeft size={16} strokeWidth={2.25} aria-hidden />
        Volver a proyectos
      </Link>

      {/* HEADER */}
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-500">
          <BadgeCheck size={14} strokeWidth={2.25} aria-hidden />
          Proyecto Verificado
        </span>
        <span className={`rounded-full bg-black/5 px-3 py-1 text-xs font-semibold dark:bg-white/10 ${semLegal.claseTexto}`}>
          {trackLegalTexto}
        </span>
        <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-semibold text-texto-suave dark:bg-white/10 dark:text-texto-suave-dark">
          {proyecto.tipo_mina === "subterranea" ? "Subterránea" : "Tajo abierto"}
        </span>
        {destacado && (
          <span className="inline-flex items-center gap-1 rounded-full bg-secundario/15 px-3 py-1 text-xs font-semibold text-secundario">
            <Star size={13} strokeWidth={2.25} fill="currentColor" aria-hidden />
            Destacado
          </span>
        )}
      </div>

      <h1 className="mt-3 text-3xl font-bold md:text-4xl">
        {proyecto.nombre_proyecto}{" "}
        <span className="text-texto-suave dark:text-texto-suave-dark">
          — {cap(proyecto.mineral)}
        </span>
      </h1>

      <p className="mt-2 flex flex-wrap items-center gap-3 text-texto-suave dark:text-texto-suave-dark">
        <span className="inline-flex items-center gap-1">
          <MapPin size={15} strokeWidth={2} aria-hidden />
          {cap(proyecto.region)}, Perú
        </span>
        {proyecto.ubicacion_maps && (
          <a
            href={proyecto.ubicacion_maps}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full bg-acento/10 px-3 py-1 text-xs font-semibold text-acento hover:bg-acento/20"
          >
            <MapIcon size={14} strokeWidth={2.25} aria-hidden />
            Ver ubicación en Google Maps
          </a>
        )}
        <button
          onClick={compartir}
          className="inline-flex items-center gap-1 rounded-full bg-secundario/10 px-3 py-1 text-xs font-semibold text-secundario hover:bg-secundario/20"
        >
          {enlaceCopiado ? (
            <>
              <Check size={14} strokeWidth={2.25} aria-hidden />
              Enlace copiado
            </>
          ) : (
            <>
              <ArrowUpRight size={14} strokeWidth={2.25} aria-hidden />
              Compartir
            </>
          )}
        </button>
      </p>

      {/* GALERÍA */}
      <div className="mt-6">
        <GaleriaProyecto fotos={proyecto.fotos} />
      </div>

      {/* LAYOUT 2 COLUMNAS */}
      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-[7fr_3fr]">
        {/* CONTENIDO PRINCIPAL — ordenado igual que las barras del panel
            lateral: Formalización primero, luego las 5 dimensiones del
            Score de Atractivo de Inversión, para que el orden de lectura
            coincida con el orden del puntaje. */}
        <div className="flex flex-col gap-6">
          {/* RESUMEN EJECUTIVO */}
          <Card acento>
            <h2 className="text-lg font-semibold">Resumen Ejecutivo</h2>
            <p className="mt-2">{partesResumen.join(" ")}</p>
            {proyecto.descripcion_operacion && (
              <p className="mt-3 border-l-2 border-acento/40 pl-3 text-sm italic text-texto-suave dark:text-texto-suave-dark">
                "{proyecto.descripcion_operacion}"
              </p>
            )}
            {puntosAFavor.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {puntosAFavor.map((texto) => (
                  <span
                    key={texto}
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400"
                  >
                    <Check size={12} strokeWidth={2.5} aria-hidden />
                    {texto}
                  </span>
                ))}
              </div>
            )}
          </Card>

          {/* FORMALIZACIÓN — un solo checklist con la foto de respaldo de
              cada ítem, sin tarjetas repetidas para lo mismo. */}
          <Card>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Formalización</h2>
              <span className={`text-sm font-semibold ${semLegal.claseTexto}`}>
                {trackLegalTexto}
              </span>
            </div>
            <p className="mt-1 text-xs text-texto-suave dark:text-texto-suave-dark">
              Autodeclarado por el titular — un ✓ solo cuenta cuando además
              hay una foto de respaldo verificable, sin foto queda como
              pendiente aunque haya declarado que sí.
            </p>
            <div className="mt-4 flex flex-col gap-5">
              {BLOQUES_FORMALIZACION.map(({ dim, conReinfo }) => {
                const items = itemsFormalizacion.filter((item) => item.dim === dim);
                if (items.length === 0 && !conReinfo) return null;
                return (
                  <div key={dim}>
                    <h3 className="text-sm font-semibold uppercase text-texto-suave dark:text-texto-suave-dark">
                      {NOMBRES_DIMENSION[dim]}
                    </h3>
                    <ul className="mt-2 grid grid-cols-1 gap-2.5 md:grid-cols-2">
                      {conReinfo && (
                        <li className="flex items-center gap-2.5 text-sm">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
                            <BadgeCheck
                              size={14}
                              strokeWidth={1.75}
                              className="text-texto-suave dark:text-texto-suave-dark"
                              aria-hidden
                            />
                          </span>
                          <span className="flex-1">REINFO vigente</span>
                          {!proyecto.bloqueado_actual ? (
                            <Check size={15} strokeWidth={2.5} className="shrink-0 text-emerald-500" aria-hidden />
                          ) : (
                            <Minus
                              size={15}
                              strokeWidth={2.5}
                              className="shrink-0 text-texto-suave dark:text-texto-suave-dark"
                              aria-hidden
                            />
                          )}
                        </li>
                      )}
                      {items.map((item) => (
                        <ItemChecklistFoto
                          key={item.etiqueta}
                          etiqueta={item.etiqueta}
                          fotos={item.fotos}
                          completo={item.completo}
                          onVer={(url, etiqueta) => setFotoAbierta({ url, etiqueta })}
                        />
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* OPORTUNIDAD DE INVERSIÓN — las respuestas públicas del Módulo
              INV: lo que el inversionista necesita para decidir. Reemplaza
              al perfil informativo del modelo viejo (julio 2026). */}
          {(filasOportunidad.length > 0 || proyecto.capital_buscado) && (
            <Card>
              <h2 className="text-lg font-semibold">Oportunidad de inversión</h2>
              <p className="mt-1 text-xs text-texto-suave dark:text-texto-suave-dark">
                Declarado por el titular en su perfil de inversión.
              </p>
              <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                {proyecto.capital_buscado && (
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-texto-suave dark:text-texto-suave-dark">
                      Capital buscado
                    </dt>
                    <dd className="text-sm font-medium">
                      {formatearMonto(proyecto.capital_buscado)}
                      {proyecto.uso_fondos ? ` — ${proyecto.uso_fondos}` : ""}
                    </dd>
                  </div>
                )}
                {filasOportunidad
                  .filter((f) => !(f.id === "INV_0_1" && proyecto.capital_buscado))
                  .map((f) => (
                    <div key={f.id}>
                      <dt className="text-xs text-texto-suave dark:text-texto-suave-dark">
                        {f.etiqueta}
                      </dt>
                      <dd
                        className={`text-sm font-medium ${
                          f.id === "INV_0_11" && inv.INV_0_11 === "sin_deudas"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : ""
                        }`}
                      >
                        {f.valor}
                      </dd>
                    </div>
                  ))}
              </dl>
            </Card>
          )}

          {/* DATOS DE LA OPERACIÓN — cifras estructuradas que el minero
              escribe junto a sus archivos de respaldo. */}
          {filasOperacion.length > 0 && (
            <Card>
              <h2 className="text-lg font-semibold">Datos de la operación</h2>
              <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                {filasOperacion.map((f) => (
                  <div key={f.etiqueta}>
                    <dt className="text-xs text-texto-suave dark:text-texto-suave-dark">
                      {f.etiqueta}
                    </dt>
                    <dd className="text-sm font-medium">{f.valor}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          )}

          {/* MAPA */}
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Ubicación</h2>
              {proyecto.ubicacion_maps && (
                <a
                  href={proyecto.ubicacion_maps}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-acento underline"
                >
                  Abrir en Google Maps
                </a>
              )}
            </div>
            {proyecto.ubicacion_coords ? (
              <>
                <div className="mt-3 overflow-hidden rounded-lg">
                  <iframe
                    title="Ubicación del proyecto"
                    src={`https://maps.google.com/maps?q=${proyecto.ubicacion_coords}&z=14&t=h&output=embed`}
                    className="h-72 w-full border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allowFullScreen
                  />
                </div>
                <p className="mt-2 text-xs text-texto-suave dark:text-texto-suave-dark">
                  Zona aproximada declarada por el titular del proyecto.
                </p>
              </>
            ) : (
              <div className="mt-3 flex h-56 items-center justify-center rounded-lg border border-dashed border-black/10 text-sm text-texto-suave dark:border-white/10 dark:text-texto-suave-dark">
                El titular aún no registró la ubicación de su operación
              </div>
            )}
          </Card>
        </div>

        {/* SIDEBAR */}
        <div className="h-fit md:sticky md:top-6">
          <div className="flex flex-col gap-4 rounded-lg bg-tarjeta p-6 shadow-sm dark:bg-tarjeta-dark">
            <div className="flex flex-col gap-4">
              {(typeof proyecto.score_formalizacion === "number" ||
                typeof proyecto.score_inversion === "number") && (
                <div className="flex flex-col gap-2 border-b border-black/5 pb-4 dark:border-white/10">
                  <FilaScore etiqueta="Formalización" valor={proyecto.score_formalizacion} />
                  <FilaScore etiqueta="Inversión" valor={proyecto.score_inversion} />
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-texto-suave dark:text-texto-suave-dark">
                  Track Legal
                </p>
                <p className={`text-lg font-bold ${semLegal.claseTexto}`}>{trackLegalTexto}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-texto-suave dark:text-texto-suave-dark">
                  Madurez técnica
                </p>
                {madurez != null ? (
                  <>
                    <div className="mt-1 flex items-center gap-1.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <span
                          key={n}
                          className={`h-2.5 w-6 rounded-full ${
                            n <= madurez ? semTecnico.claseBarra : "bg-black/10 dark:bg-white/10"
                          }`}
                        />
                      ))}
                    </div>
                    <p className={`mt-1 text-sm font-semibold ${semTecnico.claseTexto}`}>
                      Nivel {madurez}/5
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-texto-suave dark:text-texto-suave-dark">
                    Aún sin operación que medir
                  </p>
                )}
              </div>
              {/* Señales verificadas: el HECHO derivado de documentos
                  privados (liquidaciones, estados financieros, OPEX) —
                  nunca el documento en sí. Un ✓ = archivo subido. */}
              {proyecto.indicadores?.ventas_liquidacion_verificada ? (
                <div>
                  <p className="text-sm font-medium text-texto-suave dark:text-texto-suave-dark">
                    Ventas con liquidación
                  </p>
                  <p className="text-sm font-semibold text-emerald-500">
                    ✓ Verificado — {proyecto.indicadores.ventas_liquidacion_docs} doc
                    {proyecto.indicadores.ventas_liquidacion_docs !== 1 ? "s" : ""}
                    {proyecto.indicadores.ventas_liquidacion_ultima
                      ? ` · último: ${proyecto.indicadores.ventas_liquidacion_ultima}`
                      : ""}
                  </p>
                </div>
              ) : proyecto.vende_liquidacion != null ? (
                <div>
                  <p className="text-sm font-medium text-texto-suave dark:text-texto-suave-dark">
                    Producción con liquidación
                  </p>
                  <p className={`text-sm font-semibold ${proyecto.vende_liquidacion ? "text-emerald-500" : "text-amber-500"}`}>
                    {proyecto.vende_liquidacion
                      ? "Declarada (sin respaldo aún)"
                      : "Sin liquidación formal"}
                  </p>
                </div>
              ) : null}
              {proyecto.indicadores?.contabilidad && (
                <div>
                  <p className="text-sm font-medium text-texto-suave dark:text-texto-suave-dark">
                    Finanzas
                  </p>
                  <p
                    className={`text-sm font-semibold ${
                      proyecto.indicadores.contabilidad_verificada
                        ? "text-emerald-500"
                        : ""
                    }`}
                  >
                    {proyecto.indicadores.contabilidad_verificada ? "✓ " : ""}
                    {{
                      auditados: "Estados financieros auditados",
                      contabilidad_formal: "Contabilidad formal (contador)",
                      registro_interno: "Registro interno ordenado",
                    }[proyecto.indicadores.contabilidad] ?? proyecto.indicadores.contabilidad}
                  </p>
                </div>
              )}
              {proyecto.indicadores?.opex_verificado && (
                <div>
                  <p className="text-sm font-medium text-texto-suave dark:text-texto-suave-dark">
                    Costos operativos
                  </p>
                  <p className="text-sm font-semibold text-emerald-500">
                    ✓ Documentados
                    {proyecto.indicadores.opex_costo_aprox
                      ? ` · ~S/ ${proyecto.indicadores.opex_costo_aprox} por TN`
                      : ""}
                  </p>
                </div>
              )}
              {proyecto.capital_buscado && (
                <div>
                  <p className="text-sm font-medium text-texto-suave dark:text-texto-suave-dark">
                    Busca
                  </p>
                  <p className="text-sm font-semibold">
                    {formatearMonto(proyecto.capital_buscado)}
                    {proyecto.uso_fondos ? ` — ${proyecto.uso_fondos}` : ""}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-2 flex flex-col gap-2.5">
              <button
                onClick={() => setModalMensaje("Quiero más información sobre este proyecto.")}
                className="min-h-[44px] rounded-lg bg-acento font-semibold text-white transition duration-200 hover:opacity-90"
              >
                Me interesa este proyecto
              </button>
              <button
                onClick={async () => {
                  setGenerandoPdf(true);
                  try {
                    await generarPdfProyecto(proyecto);
                  } finally {
                    setGenerandoPdf(false);
                  }
                }}
                disabled={generandoPdf}
                className="min-h-[44px] rounded-lg border border-black/10 font-semibold transition duration-200 disabled:opacity-50 dark:border-white/10"
              >
                {generandoPdf ? "Generando PDF..." : "Descargar Información (PDF)"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {modalMensaje !== null && (
        <InteresInversionModal
          operacionId={id}
          mensajeInicial={modalMensaje}
          onCerrar={() => setModalMensaje(null)}
        />
      )}

      {fotoAbierta && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4"
          onClick={() => setFotoAbierta(null)}
        >
          <button
            onClick={() => setFotoAbierta(null)}
            className="absolute right-4 top-4 min-h-[44px] rounded-lg bg-white/10 px-4 font-semibold text-white"
          >
            Cerrar
          </button>
          <img
            src={fotoAbierta.url}
            alt={fotoAbierta.etiqueta}
            className="max-h-[85vh] max-w-full rounded-lg object-contain"
          />
          <p className="mt-3 text-sm text-white/80">{fotoAbierta.etiqueta}</p>
        </div>
      )}
    </div>
  );
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Fila de score 0-100 del panel lateral — mismos umbrales de color que la
 * tarjeta de la cartera y la cuenta del minero (≥70 verde, ≥40 ámbar). */
function FilaScore({ etiqueta, valor }: { etiqueta: string; valor?: number | null }) {
  if (typeof valor !== "number") return null;
  const clase =
    valor >= 70
      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
      : valor >= 40
        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
        : "bg-red-500/15 text-red-500";
  return (
    <div className="flex items-center justify-between gap-2">
      <p className="text-sm font-medium text-texto-suave dark:text-texto-suave-dark">
        {etiqueta}
      </p>
      <span className={`rounded-full px-2.5 py-0.5 text-sm font-bold ${clase}`}>
        {valor}/100
      </span>
    </div>
  );
}

function Card({ children, acento }: { children: React.ReactNode; acento?: boolean }) {
  return (
    <div
      className={`rounded-lg bg-tarjeta p-6 shadow-sm dark:bg-tarjeta-dark ${
        acento ? "border-l-4 border-secundario" : ""
      }`}
    >
      {children}
    </div>
  );
}

const MAX_MINIATURAS_VISIBLES = 3;

/** Ítem de checklist con sus miniaturas de respaldo (o un icono si
 * todavía no se subió ninguna foto) — reemplaza los recuadros aparte de
 * "Documentación Técnica" y "Documentos legales presentados": las mismas
 * fotos que verifican el ✓ se ven aquí mismo. El minero puede subir más
 * de una foto por categoría (ej. varios ángulos del catastro); se
 * muestran todas, no solo la primera — máximo 3 miniaturas visibles, con
 * un contador "+N" si hay más. */
function ItemChecklistFoto({
  etiqueta,
  fotos,
  completo,
  onVer,
}: {
  etiqueta: string;
  fotos: FotoPublica[];
  completo: boolean;
  onVer: (url: string, etiqueta: string) => void;
}) {
  const visibles = fotos.slice(0, MAX_MINIATURAS_VISIBLES);
  const restantes = fotos.length - visibles.length;
  return (
    <li className="flex items-center gap-2.5 text-sm">
      {visibles.length > 0 ? (
        <span className="flex shrink-0 -space-x-2">
          {visibles.map((foto, i) => (
            <button
              key={foto.id}
              type="button"
              onClick={() => onVer(`${BASE_URL}${foto.url}`, etiqueta)}
              className="relative block h-8 w-8 overflow-hidden rounded-md border-2 border-tarjeta bg-black/5 dark:border-tarjeta-dark dark:bg-white/5"
              style={{ zIndex: visibles.length - i }}
            >
              <img src={`${BASE_URL}${foto.url}`} alt={etiqueta} className="h-full w-full object-cover" />
              {i === visibles.length - 1 && restantes > 0 && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-[10px] font-semibold text-white">
                  +{restantes}
                </span>
              )}
            </button>
          ))}
        </span>
      ) : (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
          <ImageIcon
            size={14}
            strokeWidth={1.75}
            className="text-texto-suave dark:text-texto-suave-dark"
            aria-hidden
          />
        </span>
      )}
      <span className={`flex-1 ${completo ? "" : "text-texto-suave dark:text-texto-suave-dark"}`}>
        {etiqueta}
      </span>
      {completo ? (
        <Check size={15} strokeWidth={2.5} className="shrink-0 text-emerald-500" aria-hidden />
      ) : (
        <Minus size={15} strokeWidth={2.5} className="shrink-0 text-texto-suave dark:text-texto-suave-dark" aria-hidden />
      )}
    </li>
  );
}
