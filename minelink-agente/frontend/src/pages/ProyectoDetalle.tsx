import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowUpRight,
  BadgeCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  Images,
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
  // Visor de documentos con navegación: todas las fotos del ítem abierto,
  // no una sola — el inversionista pasa entre ángulos con las flechas.
  const [visor, setVisor] = useState<{
    fotos: FotoPublica[];
    indice: number;
    etiqueta: string;
  } | null>(null);
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

  // Solo los estudios que APLICAN a este perfil (julio 2026): antes se
  // pintaba el catálogo completo (~29 filas) y un formal pleno veía vacíos
  // trámites que su autorización DREM/GREM ya engloba. Un estudio fuera de
  // la lista solo entra si tiene foto subida (respaldo real que sí aporta).
  // "Contrato de explotación" se oculta cuando ES titular — el título de
  // concesión ya cubre eso (mismo criterio que en su propia cuenta).
  const aplicables = new Set(proyecto.estudios_aplicables ?? []);
  const estudiosDe = (dim: NombreDimension) =>
    Object.keys(INFO_BRECHA).filter(
      (e) =>
        DIMENSION_POR_ESTUDIO[e] === dim &&
        !(proyecto.es_titular_concesion === true && e === "contrato_explotacion") &&
        (aplicables.size === 0 || // filas del modelo viejo: sin lista, se muestra todo
          aplicables.has(e) ||
          (proyecto.documentos_estudios[e]?.length ?? 0) > 0)
    );

  // Un solo checklist cubre TODO el diagnóstico de formalización (antes
  // "Estado de Formalización" solo mostraba legal/ambiental/seguridad/
  // social y dejaba técnico y operativo en una tarjeta aparte con las
  // mismas fotos repetidas — julio 2026: se unificó en un solo lugar, cada
  // ítem con su propia miniatura, sin recuadros redundantes).
  // La fila "REINFO vigente" solo aplica al perfil C — un formal pleno (D)
  // ya salió del REINFO y un concesionario (B) todavía no entra a él.
  const BLOQUES_FORMALIZACION: { dim: NombreDimension; conReinfo?: boolean }[] = [
    { dim: "legal", conReinfo: proyecto.perfil === "C" },
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

      {/* MOSAICO SUPERIOR: ubicación satelital en la parte ancha + fotos
          del proyecto al costado (la tarjeta "Ubicación" aparte se
          eliminó — vivía abajo y dejaba este espacio a medio usar). El
          recuadro de puntuación (antes solo en el sidebar, más abajo) sube
          al costado del mapa (pedido explícito, julio 2026): el mapa queda
          menos ancho y las miniaturas se corren más a la izquierda. */}
      <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-stretch">
        <div className="md:w-2/3">
          <GaleriaProyecto
            fotos={proyecto.fotos}
            ubicacionCoords={proyecto.ubicacion_coords}
            geocatmin={proyecto.geocatmin}
          />
        </div>
        {(() => {
          const hayScores =
            typeof proyecto.score_formalizacion === "number" ||
            typeof proyecto.score_inversion === "number";
          return (
          <div className="flex flex-col gap-3 rounded-xl bg-tarjeta p-4 shadow-sm dark:bg-tarjeta-dark md:w-1/3">
            {hayScores && (
              <div className="flex flex-col gap-2 border-b border-black/5 pb-3 dark:border-white/10">
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
            {/* Madurez técnica (antes en el sidebar de abajo, dejaba un
                espacio en blanco acá) — pedido explícito, julio 2026. */}
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

            {/* Señales verificadas + acciones (antes en el sidebar de más
                abajo, quedaba un espacio en blanco acá) — pedido
                explícito, julio 2026. El HECHO derivado de documentos
                privados (liquidaciones, estados financieros, OPEX), nunca
                el documento en sí. Un ✓ = archivo subido. */}
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
                    proyecto.indicadores.contabilidad_verificada ? "text-emerald-500" : ""
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
          );
        })()}
      </div>

      {/* CONTENIDO PRINCIPAL — el panel lateral (indicadores + botones)
          subió al recuadro de puntuación junto al mapa (pedido explícito,
          julio 2026), así que esto ya no necesita ser un grid de 2
          columnas — todo el contenido va a ancho completo. */}
      <div className="mt-8">
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
            <div className="mt-4 flex flex-col gap-6">
              {BLOQUES_FORMALIZACION.map(({ dim, conReinfo }) => {
                const items = itemsFormalizacion.filter((item) => item.dim === dim);
                if (items.length === 0 && !conReinfo) return null;
                // Lo respaldado con foto se luce en tarjetas grandes; lo
                // que aún no tiene foto se compacta en chips discretos.
                const conFoto = items.filter((item) => item.fotos.length > 0);
                const sinFoto = items.filter((item) => item.fotos.length === 0);
                return (
                  <div key={dim}>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-texto-suave dark:text-texto-suave-dark">
                      {NOMBRES_DIMENSION[dim]}
                    </h3>
                    {conFoto.length > 0 && (
                      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
                        {conFoto.map((item) => (
                          <TarjetaDocumento
                            key={item.etiqueta}
                            etiqueta={item.etiqueta}
                            fotos={item.fotos}
                            completo={item.completo}
                            onVer={() =>
                              setVisor({ fotos: item.fotos, indice: 0, etiqueta: item.etiqueta })
                            }
                          />
                        ))}
                      </div>
                    )}
                    {(sinFoto.length > 0 || conReinfo) && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {conReinfo && (
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                              !proyecto.bloqueado_actual
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "border border-dashed border-black/15 text-texto-suave dark:border-white/15 dark:text-texto-suave-dark"
                            }`}
                          >
                            {!proyecto.bloqueado_actual ? (
                              <Check size={13} strokeWidth={2.5} aria-hidden />
                            ) : (
                              <Minus size={13} strokeWidth={2.5} aria-hidden />
                            )}
                            REINFO vigente
                          </span>
                        )}
                        {sinFoto.map((item) => (
                          <span
                            key={item.etiqueta}
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs ${
                              item.completo
                                ? "bg-emerald-500/10 font-semibold text-emerald-600 dark:text-emerald-400"
                                : "border border-dashed border-black/15 text-texto-suave dark:border-white/15 dark:text-texto-suave-dark"
                            }`}
                          >
                            {item.completo ? (
                              <Check size={13} strokeWidth={2.5} aria-hidden />
                            ) : (
                              <Minus size={13} strokeWidth={2.5} aria-hidden />
                            )}
                            {item.etiqueta}
                          </span>
                        ))}
                      </div>
                    )}
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

          {/* COTEJO CON REGISTROS PÚBLICOS — datos oficiales de GEOCATMIN
              (INGEMMET) consultados automáticamente con el pin declarado:
              la concesión del catastro minero y la geología del punto. */}
          {(proyecto.reinfo ||
            proyecto.reinfo_verificado_manual ||
            (proyecto.geocatmin &&
              (proyecto.geocatmin.concesion ||
                proyecto.geocatmin.geologia ||
                proyecto.geocatmin.anp ||
                (proyecto.geocatmin.restricciones?.length ?? 0) > 0))) && (
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">Cotejo con registros públicos</h2>
                <span className="rounded-full bg-black/5 px-2.5 py-0.5 text-[11px] font-semibold text-texto-suave dark:bg-white/10 dark:text-texto-suave-dark">
                  INGEMMET · MINEM · SERNANP
                </span>
              </div>

              {/* Verificación MANUAL del código REINFO por el equipo de
                  MineLink — el cotejo automático de abajo está desactivado
                  (ver backend/reinfo.py), así que esta es la fuente real
                  hoy. */}
              {proyecto.reinfo_verificado_manual && (
                <div className="mt-3 rounded-lg bg-emerald-500/10 p-4 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  <p className="flex items-center gap-1.5">
                    <BadgeCheck size={16} strokeWidth={2.25} aria-hidden />
                    Código REINFO verificado por el equipo de MineLink
                  </p>
                  {proyecto.codigo_reinfo && (
                    <p className="mt-1 text-xs font-normal">
                      Código: {proyecto.codigo_reinfo}
                    </p>
                  )}
                </div>
              )}

              {/* REINFO cotejado contra el padrón oficial del MINEM */}
              {proyecto.reinfo && (
                <div
                  className={`mt-3 rounded-lg p-4 text-sm font-semibold ${
                    proyecto.reinfo.estado === "VIGENTE"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : proyecto.reinfo.estado === "SUSPENDIDO"
                        ? "bg-red-500/10 text-red-600 dark:text-red-400"
                        : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                  }`}
                >
                  {proyecto.reinfo.estado === "VIGENTE" ? (
                    <p className="flex items-center gap-1.5">
                      <BadgeCheck size={16} strokeWidth={2.25} aria-hidden />
                      REINFO verificado en el padrón del MINEM: VIGENTE
                    </p>
                  ) : proyecto.reinfo.estado === "SUSPENDIDO" ? (
                    <p>REINFO en el padrón del MINEM: SUSPENDIDO</p>
                  ) : (
                    <p>
                      El código REINFO declarado no aparece en el padrón del MINEM —
                      verificar con el titular.
                    </p>
                  )}
                  {proyecto.reinfo.derecho && (
                    <p className="mt-1 text-xs font-normal">
                      Derecho: {proyecto.reinfo.derecho}
                      {[proyecto.reinfo.distrito, proyecto.reinfo.provincia, proyecto.reinfo.departamento]
                        .filter(Boolean)
                        .join(", ") &&
                        ` · ${[proyecto.reinfo.distrito, proyecto.reinfo.provincia, proyecto.reinfo.departamento]
                          .filter(Boolean)
                          .join(", ")}`}
                      {` · código ${proyecto.reinfo.codigo}`}
                    </p>
                  )}
                  {/* El RUC ya es público de por sí (las fotos de "Documentos
                      legales" con RUC también lo son) — el nombre del
                      declarante NO se muestra, se queda como en el resto
                      de la ficha (privacidad del contacto). */}
                  {proyecto.reinfo.ruc && (
                    <p className="mt-0.5 text-xs font-normal">RUC: {proyecto.reinfo.ruc}</p>
                  )}
                </div>
              )}

              {/* Alertas de zona: ANP (SERNANP) y áreas restringidas.
                  "fuera" es una confirmación explícita (se consultó y el
                  punto está limpio), no solo ausencia de alerta — por eso
                  se muestra en verde en vez de omitirse. */}
              {proyecto.geocatmin?.anp && (
                <p
                  className={`mt-3 flex items-center gap-1.5 rounded-lg p-4 text-sm font-semibold ${
                    proyecto.geocatmin.anp.zona === "dentro"
                      ? "bg-red-500/10 text-red-600 dark:text-red-400"
                      : proyecto.geocatmin.anp.zona === "amortiguamiento"
                        ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                        : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {proyecto.geocatmin.anp.zona === "dentro" ? (
                    `⚠ El punto cae dentro de un Área Natural Protegida (${proyecto.geocatmin.anp.categoria ?? "ANP"} ${proyecto.geocatmin.anp.nombre ?? ""}) — la actividad minera está prohibida ahí.`
                  ) : proyecto.geocatmin.anp.zona === "amortiguamiento" ? (
                    `El punto cae en la zona de amortiguamiento del ${proyecto.geocatmin.anp.categoria ?? "ANP"} ${proyecto.geocatmin.anp.nombre ?? ""} — la actividad tiene condiciones especiales.`
                  ) : (
                    <>
                      <BadgeCheck size={16} strokeWidth={2.25} aria-hidden />
                      El punto NO cae en ningún Área Natural Protegida (SERNANP) ni su
                      zona de amortiguamiento.
                    </>
                  )}
                </p>
              )}
              {(proyecto.geocatmin?.restricciones?.length ?? 0) > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {proyecto.geocatmin!.restricciones!.map((r) => (
                    <span
                      key={`${r.tipo}-${r.nombre}`}
                      className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400"
                    >
                      {r.tipo}
                      {r.nombre ? `: ${r.nombre}` : ""}
                    </span>
                  ))}
                </div>
              )}

              {proyecto.geocatmin?.concesion ? (
                <div className="mt-3 rounded-lg bg-emerald-500/10 p-4">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                    <BadgeCheck size={16} strokeWidth={2.25} aria-hidden />
                    El punto declarado cae dentro de una concesión registrada en el
                    catastro minero
                  </p>
                  <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-texto-suave dark:text-texto-suave-dark">
                        Concesión
                      </dt>
                      <dd className="text-sm font-medium">
                        {proyecto.geocatmin.concesion.nombre}
                        {proyecto.geocatmin.concesion.codigo
                          ? ` (código ${proyecto.geocatmin.concesion.codigo})`
                          : ""}
                      </dd>
                    </div>
                    {proyecto.geocatmin.concesion.leyenda && (
                      <div>
                        <dt className="text-xs text-texto-suave dark:text-texto-suave-dark">
                          Estado en el catastro
                        </dt>
                        <dd className="text-sm font-medium capitalize">
                          {proyecto.geocatmin.concesion.leyenda.toLowerCase()}
                        </dd>
                      </div>
                    )}
                    {proyecto.geocatmin.concesion.hectareas != null && (
                      <div>
                        <dt className="text-xs text-texto-suave dark:text-texto-suave-dark">
                          Extensión
                        </dt>
                        <dd className="text-sm font-medium">
                          {Math.round(proyecto.geocatmin.concesion.hectareas)} hectáreas
                        </dd>
                      </div>
                    )}
                    {proyecto.geocatmin.concesion.titular && (
                      <div>
                        <dt className="text-xs text-texto-suave dark:text-texto-suave-dark">
                          Titular registrado
                        </dt>
                        <dd className="text-sm font-medium">
                          {proyecto.geocatmin.concesion.titular}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              ) : proyecto.geocatmin ? (
                <p className="mt-3 rounded-lg bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400">
                  El punto declarado no cae dentro de una concesión registrada en el
                  catastro minero. El pin es aproximado, así que esto no descarta que la
                  operación esté amparada — verificar con el titular.
                </p>
              ) : null}

              {proyecto.geocatmin?.geologia && (
                <div className="mt-3">
                  <p className="text-xs text-texto-suave dark:text-texto-suave-dark">
                    Geología a escala 1:100,000
                  </p>
                  <p className="mt-0.5 text-sm font-medium">
                    {[proyecto.geocatmin.geologia.unidad, proyecto.geocatmin.geologia.descripcion]
                      .filter(Boolean)
                      .join(" — ")}
                  </p>
                </div>
              )}

              {/* Escala 1:50,000 (más detalle): solo existe donde INGEMMET
                  tiene carta a esa escala — si no hay cobertura, esta línea
                  simplemente no aparece (la de 100K de arriba ya cubre el
                  dato base en todo el país). */}
              {proyecto.geocatmin?.geologia_50k && (
                <div className="mt-3">
                  <p className="text-xs text-texto-suave dark:text-texto-suave-dark">
                    Geología a escala 1:50,000
                  </p>
                  <p className="mt-0.5 text-sm font-medium">
                    {[
                      proyecto.geocatmin.geologia_50k.unidad,
                      proyecto.geocatmin.geologia_50k.litologia ??
                        proyecto.geocatmin.geologia_50k.descripcion,
                    ]
                      .filter(Boolean)
                      .join(" — ")}
                  </p>
                </div>
              )}

              {/* Solo se nombran las fuentes que de verdad aportaron un dato
                  esta vez — antes decía siempre "GEOCATMIN, MINEM, SERNANP"
                  aunque, por ejemplo, REINFO todavía no tuviera resultado
                  cacheado: prometía algo que la tarjeta no mostraba arriba
                  (julio 2026, reportado por el dueño). */}
              {(() => {
                const fuentes = [
                  proyecto.geocatmin ? "GEOCATMIN/INGEMMET" : null,
                  proyecto.reinfo ? "el padrón REINFO del MINEM" : null,
                  proyecto.geocatmin?.anp ? "SERNANP" : null,
                ].filter((f): f is string => f !== null);
                const listaFuentes =
                  fuentes.length <= 1
                    ? fuentes[0]
                    : `${fuentes.slice(0, -1).join(", ")} y ${fuentes[fuentes.length - 1]}`;
                const fecha = proyecto.geocatmin?.consultado_en ?? proyecto.reinfo?.consultado_en;
                return (
                  <p className="mt-3 text-[11px] leading-relaxed text-texto-suave dark:text-texto-suave-dark">
                    {fuentes.length > 0 && (
                      <>
                        Consulta automática a {listaFuentes} según lo declarado por el titular
                        {fecha ? ` · ${fecha}` : ""}.{" "}
                      </>
                    )}
                    {proyecto.reinfo_verificado_manual && (
                      <>
                        El código REINFO fue verificado a mano por el equipo de MineLink
                        {proyecto.reinfo_verificado_en
                          ? ` · ${new Date(proyecto.reinfo_verificado_en).toLocaleDateString("es-PE")}`
                          : ""}
                        .{" "}
                      </>
                    )}
                    Dato referencial: el titular registrado puede diferir de quien opera
                    (contratos de explotación son legales y comunes).
                  </p>
                );
              })()}
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

          {/* La ubicación ya no tiene tarjeta propia: vive en el mosaico
              superior (vista satelital) y el enlace a Google Maps sigue en
              el encabezado. */}
        </div>
      </div>

      {modalMensaje !== null && (
        <InteresInversionModal
          operacionId={id}
          mensajeInicial={modalMensaje}
          onCerrar={() => setModalMensaje(null)}
        />
      )}

      {visor && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4"
          onClick={() => setVisor(null)}
        >
          <button
            onClick={() => setVisor(null)}
            className="absolute right-4 top-4 min-h-[44px] rounded-lg bg-white/10 px-4 font-semibold text-white"
          >
            Cerrar
          </button>
          <img
            src={`${BASE_URL}${visor.fotos[visor.indice].url}`}
            alt={visor.etiqueta}
            className="max-h-[80vh] max-w-full rounded-lg object-contain"
          />
          {visor.fotos.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setVisor({
                    ...visor,
                    indice: (visor.indice - 1 + visor.fotos.length) % visor.fotos.length,
                  });
                }}
                aria-label="Foto anterior"
                className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/25"
              >
                <ChevronLeft size={22} strokeWidth={2.25} aria-hidden />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setVisor({ ...visor, indice: (visor.indice + 1) % visor.fotos.length });
                }}
                aria-label="Foto siguiente"
                className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/25"
              >
                <ChevronRight size={22} strokeWidth={2.25} aria-hidden />
              </button>
            </>
          )}
          <p className="mt-3 text-sm font-medium text-white/90">
            {visor.etiqueta}
            {visor.fotos.length > 1 ? ` — ${visor.indice + 1} de ${visor.fotos.length}` : ""}
          </p>
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

/** Tarjeta grande de documento (julio 2026): reemplaza las miniaturas de
 * 32px del checklist. Foto en grande con degradado y el nombre encima,
 * sello "Verificado" cuando el respaldo cuenta, y contador de fotos si el
 * minero subió varios ángulos — clic abre el visor con navegación. */
function TarjetaDocumento({
  etiqueta,
  fotos,
  completo,
  onVer,
}: {
  etiqueta: string;
  fotos: FotoPublica[];
  completo: boolean;
  onVer: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onVer}
      className="group relative block overflow-hidden rounded-xl shadow-sm ring-1 ring-black/5 transition duration-200 hover:shadow-md dark:ring-white/10"
    >
      <img
        src={`${BASE_URL}${fotos[0].url}`}
        alt={etiqueta}
        loading="lazy"
        className="h-36 w-full object-cover transition duration-300 group-hover:scale-105 md:h-44"
      />
      {/* degradado inferior con el nombre del documento */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent p-2.5 pt-10 text-left">
        <p className="text-xs font-semibold leading-snug text-white drop-shadow">{etiqueta}</p>
      </div>
      {completo && (
        <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white shadow">
          <BadgeCheck size={11} strokeWidth={2.5} aria-hidden />
          Verificado
        </span>
      )}
      {fotos.length > 1 && (
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-white">
          <Images size={11} strokeWidth={2.25} aria-hidden />
          {fotos.length}
        </span>
      )}
    </button>
  );
}
