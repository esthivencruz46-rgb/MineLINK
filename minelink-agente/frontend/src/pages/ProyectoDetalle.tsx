import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowUpRight,
  BadgeCheck,
  Check,
  ChevronLeft,
  ImageIcon,
  Map,
  MapPin,
  Minus,
  Star,
} from "lucide-react";
import { GaleriaProyecto } from "../components/proyecto/GaleriaProyecto";
import { InteresInversionModal } from "../components/proyecto/InteresInversionModal";
import { PerfilInformativoAgrupado } from "../components/PerfilInformativoAgrupado";
import { INFO_BRECHA } from "../data/brechas";
import { DIMENSION_POR_ESTUDIO } from "../data/estudioDimension";
import { NOMBRES_DIMENSION } from "../data/preguntas";
import { obtenerProyecto, BASE_URL } from "../services/api";
import { calcularSemaforo } from "../utils/semaforo";
import {
  COLOR_DIMENSION_INVERSION,
  NOMBRES_DIMENSION_INVERSION,
  ORDEN_DIMENSION_INVERSION,
} from "../types/proyecto";
import type { FotoPublica, ProyectoDetalle as ProyectoDetalleType } from "../types/proyecto";
import type { NombreDimension } from "../types/diagnostico";

export function ProyectoDetalle() {
  const { id } = useParams<{ id: string }>();
  const [proyecto, setProyecto] = useState<ProyectoDetalleType | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalMensaje, setModalMensaje] = useState<string | null>(null);
  const [enlaceCopiado, setEnlaceCopiado] = useState(false);

  async function compartir() {
    if (!proyecto) return;
    const url = window.location.href;
    const texto = `Mira este proyecto minero en MineLink: ${proyecto.nombre_proyecto} (${proyecto.mineral}, ${proyecto.region}) — Score de inversión ${proyecto.score_inversion}/100`;
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

  const semaforo = calcularSemaforo(proyecto.score_actual, false);
  const semaforoInversion = calcularSemaforo(proyecto.score_inversion, false);
  const destacado = proyecto.score_actual >= 85;

  const dims = proyecto.dimensiones;
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

  // Resumen ejecutivo: foco en el score y la oportunidad de inversión, con
  // los puntos a favor como chips cortos en vez de una lista/tarjeta aparte.
  const partesResumen: string[] = [
    `${proyecto.nombre_proyecto} tiene un Score de Atractivo de Inversión de ${proyecto.score_inversion}/100 (${semaforoInversion.etiqueta}).`,
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
      `Actualmente busca ${proyecto.capital_buscado}${
        proyecto.uso_fondos ? ` para ${proyecto.uso_fondos.toLowerCase()}` : ""
      }.`
    );
  }

  const puntosAFavor: string[] = [];
  if (!proyecto.bloqueado_actual) puntosAFavor.push("REINFO vigente");
  if (dims?.legal && dims.legal.puntaje / dims.legal.maximo >= 0.8) puntosAFavor.push("Alto avance legal");
  if (dims?.ambiental && dims.ambiental.puntaje / dims.ambiental.maximo >= 0.8) {
    puntosAFavor.push("Buen desempeño ambiental");
  }
  if (proyecto.brechas_resueltas.length > 0) {
    puntosAFavor.push(`${proyecto.brechas_resueltas.length} estudio(s) resuelto(s)`);
  }
  if (proyecto.capital_buscado) puntosAFavor.push("Busca capital activamente");

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
        <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-semibold text-texto-suave dark:bg-white/10 dark:text-texto-suave-dark">
          {semaforo.etiqueta}
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
            <Map size={14} strokeWidth={2.25} aria-hidden />
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
              <span className="text-sm font-semibold text-texto-suave dark:text-texto-suave-dark">
                {proyecto.score_actual}/100
              </span>
            </div>
            <p className="mt-1 text-xs text-texto-suave dark:text-texto-suave-dark">
              Autodeclarado por el titular — un ✓ solo cuenta cuando además
              hay una foto de respaldo verificable, sin foto queda como
              pendiente aunque haya declarado que sí.
            </p>
            <div className="mt-4 flex flex-col gap-5">
              {BLOQUES_FORMALIZACION.map(({ dim, conReinfo }) => {
                const estudios = estudiosDe(dim);
                if (estudios.length === 0 && !conReinfo) return null;
                const info = dims?.[dim];
                const porcentaje =
                  info && info.maximo > 0 ? Math.round((info.puntaje / info.maximo) * 100) : null;
                return (
                  <div key={dim}>
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold uppercase text-texto-suave dark:text-texto-suave-dark">
                        {NOMBRES_DIMENSION[dim]}
                      </h3>
                      {porcentaje !== null && (
                        <span className="text-xs font-semibold text-texto-suave dark:text-texto-suave-dark">
                          {porcentaje}%
                        </span>
                      )}
                    </div>
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
                      {estudios.map((estudio) => (
                        <ItemChecklistFoto
                          key={estudio}
                          etiqueta={INFO_BRECHA[estudio]?.texto ?? estudio}
                          foto={proyecto.documentos_estudios[estudio]?.[0]}
                          completo={verificadas.has(estudio)}
                        />
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* ESCALA ECONÓMICA · VIABILIDAD TÉCNICA · RIESGO AMBIENTAL/
              SOCIAL · CAPACIDAD DEL EQUIPO · CLARIDAD DE OPORTUNIDAD —
              una tarjeta por dimensión, mismo orden que el panel lateral. */}
          <PerfilInformativoAgrupado
            datos={proyecto as unknown as Record<string, unknown>}
            dimensiones={proyecto.dimensiones_inversion}
          />

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
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-texto-suave dark:text-texto-suave-dark">
                  Score de Atractivo de Inversión
                </p>
                <p className="text-4xl font-bold">{proyecto.score_inversion}</p>
                <p className="text-xs text-texto-suave dark:text-texto-suave-dark">de 100 puntos</p>
              </div>
              <span className={`rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold ${semaforoInversion.claseTexto}`}>
                {semaforoInversion.etiqueta.toUpperCase()}
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {ORDEN_DIMENSION_INVERSION.map((dim) => {
                const info = proyecto.dimensiones_inversion[dim];
                if (!info) return null;
                const { puntaje, maximo } = info;
                const porcentaje = maximo > 0 ? Math.round((puntaje / maximo) * 100) : 0;
                return (
                  <div key={dim}>
                    <div className="flex justify-between text-xs text-texto-suave dark:text-texto-suave-dark">
                      <span>{NOMBRES_DIMENSION_INVERSION[dim]}</span>
                      <span className="font-semibold text-texto dark:text-texto-dark">
                        {porcentaje}
                      </span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                      <div
                        className={`h-full rounded-full transition-all duration-[250ms] ${COLOR_DIMENSION_INVERSION[dim]}`}
                        style={{ width: `${porcentaje}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-2 flex flex-col gap-2.5">
              <button
                onClick={() => setModalMensaje("Quiero más información sobre este proyecto.")}
                className="min-h-[44px] rounded-lg bg-acento font-semibold text-white transition duration-200 hover:opacity-90"
              >
                Me interesa este proyecto
              </button>
              <button
                onClick={() => window.print()}
                className="min-h-[44px] rounded-lg border border-black/10 font-semibold transition duration-200 dark:border-white/10"
              >
                Descargar Información
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
    </div>
  );
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
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

/** Ítem de checklist con su propia miniatura de respaldo (o un icono si
 * todavía no se subió foto) — reemplaza los recuadros aparte de
 * "Documentación Técnica" y "Documentos legales presentados": la misma
 * foto que verifica el ✓ se ve aquí mismo. */
function ItemChecklistFoto({
  etiqueta,
  foto,
  completo,
}: {
  etiqueta: string;
  foto?: FotoPublica;
  completo: boolean;
}) {
  return (
    <li className="flex items-center gap-2.5 text-sm">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
        {foto ? (
          <a
            href={`${BASE_URL}${foto.url}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block h-full w-full"
          >
            <img src={`${BASE_URL}${foto.url}`} alt={etiqueta} className="h-full w-full object-cover" />
          </a>
        ) : (
          <ImageIcon
            size={14}
            strokeWidth={1.75}
            className="text-texto-suave dark:text-texto-suave-dark"
            aria-hidden
          />
        )}
      </span>
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
