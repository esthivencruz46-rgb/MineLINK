import { useEffect, useState } from "react";
import { useTitulo } from "../hooks/useTitulo";
import { MARCA } from "../config/marca";
import { Link } from "react-router-dom";
import { ArrowRight, BadgeCheck, MapPin, Pickaxe, ShieldCheck } from "lucide-react";
import { Autocomplete } from "../components/Autocomplete";
import { HeroFranja } from "../components/HeroFranja";
import { TarjetaProyectoSkeleton } from "../components/Skeleton";
import { DEPARTAMENTOS } from "../data/departamentos";
import { BASE_URL, obtenerProyectos, registrarEvento } from "../services/api";
import { semaforoDesdeColor } from "../utils/semaforo";
import { formatearMonto } from "../utils/formato";
import type { ProyectoPublico } from "../types/proyecto";

const ELEMENTOS = [
  "Oro", "Plata", "Cobre", "Zinc", "Plomo", "Estaño", "Hierro", "Polimetálico",
];

const ETIQUETA_TRACK_LEGAL: Record<string, string> = {
  B: "Concesión titulada",
  C: "REINFO vigente",
  D: "Formal — autorización DREM/GREM",
};

// Perfil de riesgo del spec: B = potencial sin operación probada;
// C/D = operación en marcha con riesgo más controlado.
const PERFIL_RIESGO: Record<string, string> = {
  B: "Alto potencial",
  C: "Operación probada",
  D: "Operación probada",
};

type OrdenCartera = "inversion" | "formalizacion" | "recientes";

const ETIQUETA_ORDEN: Record<OrdenCartera, string> = {
  inversion: "Mejor perfil de inversión",
  formalizacion: "Más formalizados",
  recientes: "Más recientes",
};

export function Proyectos() {
  useTitulo("Proyectos mineros");
  const [proyectos, setProyectos] = useState<ProyectoPublico[]>([]);
  const [mineral, setMineral] = useState("");
  const [region, setRegion] = useState("");
  const [orden, setOrden] = useState<OrdenCartera>("inversion");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Embudo del inversionista (julio 2026): una sola vez al entrar a la
  // cartera, no en cada cambio de filtro (useEffect([]) aparte del que
  // carga los proyectos, que sí depende de mineral/region).
  useEffect(() => {
    registrarEvento("cartera_vista");
  }, []);

  useEffect(() => {
    setCargando(true);
    obtenerProyectos({ mineral, region })
      .then((data) => {
        setProyectos(data);
        setError(null);
      })
      .catch(() => setError("No pudimos cargar los proyectos."))
      .finally(() => setCargando(false));
  }, [mineral, region]);

  // Orden de la cartera (julio 2026): semáforo legal siempre manda (verde
  // primero — regla de bloqueo del spec), y dentro de eso el criterio que
  // el inversionista elija: score de inversión, score de formalización o
  // fecha de registro. Empates se resuelven con el otro score y la fecha.
  const ordenados = [...proyectos].sort((a, b) => {
    const pesoSem = (p: ProyectoPublico) => (p.semaforo_legal === "verde" ? 0 : 1);
    if (pesoSem(a) !== pesoSem(b)) return pesoSem(a) - pesoSem(b);
    const inv = (p: ProyectoPublico) => p.score_inversion ?? -1;
    const form = (p: ProyectoPublico) => p.score_formalizacion ?? -1;
    const fecha = (p: ProyectoPublico) => new Date(p.created_at).getTime();
    if (orden === "inversion") {
      if (inv(a) !== inv(b)) return inv(b) - inv(a);
      if (form(a) !== form(b)) return form(b) - form(a);
    } else if (orden === "formalizacion") {
      if (form(a) !== form(b)) return form(b) - form(a);
      if (inv(a) !== inv(b)) return inv(b) - inv(a);
    }
    return fecha(b) - fecha(a);
  });

  const operando = ordenados.filter((p) => p.perfil === "C" || p.perfil === "D");
  const enPreparacion = ordenados.filter((p) => p.perfil !== "C" && p.perfil !== "D");

  return (
    <div className="flex flex-col items-center">
      <HeroFranja
        eyebrow="Inversionistas y curiosos"
        titulo="Proyectos mineros"
        subtitulo="Proyectos con su situación legal en orden — los que tienen un bloqueante legal activo no se muestran hasta resolverlo. Búscalos por mineral o departamento."
      />
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
        <div className="flex flex-col gap-3 border border-black/10 p-3 dark:border-white/10 md:flex-row">
          <Autocomplete
            opciones={ELEMENTOS}
            value={mineral}
            onChange={setMineral}
            placeholder="Buscar mineral (ej. Oro)"
          />
          <Autocomplete
            opciones={DEPARTAMENTOS}
            value={region}
            onChange={setRegion}
            placeholder="Buscar departamento"
          />
          <select
            value={orden}
            onChange={(e) => setOrden(e.target.value as OrdenCartera)}
            aria-label="Ordenar proyectos"
            className="min-h-[44px] border border-black/10 bg-transparent px-3 text-sm dark:border-white/10"
          >
            {(Object.keys(ETIQUETA_ORDEN) as OrdenCartera[]).map((o) => (
              <option key={o} value={o}>
                {ETIQUETA_ORDEN[o]}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="text-red-500">{error}</p>}

        {cargando && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <TarjetaProyectoSkeleton key={i} />
            ))}
          </div>
        )}

        {!cargando && proyectos.length === 0 && (
          <p className="border border-black/10 p-6 text-center dark:border-white/10">
            Todavía no hay proyectos que calcen con esta búsqueda.
          </p>
        )}

        {!cargando && proyectos.length > 0 && (
          <div className="flex flex-col gap-10">
            {[
              { titulo: "Operaciones en marcha", grupo: operando, icono: "pickaxe" },
              { titulo: "Concesiones en preparación", grupo: enPreparacion, icono: "mapa" },
            ].map(({ titulo, grupo, icono }) =>
              grupo.length === 0 ? null : (
                <section key={titulo} className="flex flex-col gap-4">
                  <h2 className="flex items-center gap-2 border-b border-black/10 pb-2 font-semibold dark:border-white/10">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-acento/10 text-acento">
                      {icono === "pickaxe" ? (
                        <Pickaxe size={15} strokeWidth={2} aria-hidden />
                      ) : (
                        <MapPin size={15} strokeWidth={2} aria-hidden />
                      )}
                    </span>
                    {titulo}
                    <span className="font-normal text-texto-suave dark:text-texto-suave-dark">
                      ({grupo.length})
                    </span>
                  </h2>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {grupo.map((p) => (
                      <ProyectoCard key={p.operacion_id} proyecto={p} />
                    ))}
                  </div>
                </section>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Chip de score 0-100 por track — mismos umbrales de color que la cuenta
 * del minero (≥70 verde, ≥40 ámbar, resto rojo). */
function ScoreChip({ etiqueta, valor }: { etiqueta: string; valor?: number | null }) {
  if (typeof valor !== "number") return null;
  const clase =
    valor >= 70
      ? "text-emerald-600 dark:text-emerald-400"
      : valor >= 40
        ? "text-amber-600 dark:text-amber-400"
        : "text-red-500";
  return (
    <span
      className={`inline-flex items-center gap-1 border border-current/25 px-1.5 py-0.5 text-[11px] font-medium ${clase}`}
      title={`${etiqueta}: ${valor} de 100`}
    >
      {etiqueta} {valor}
    </span>
  );
}

/** Tarjeta de la cartera: foto a todo el ancho (con el perfil de riesgo
 * flotando encima), Track Legal + madurez, scores, badges de verificación,
 * monto buscado y CTA — pensada como tarjeta independiente en una grilla,
 * no como fila de una lista (rediseño agosto 2026, pedido explícito de
 * hacer la cartera más estética). */
function ProyectoCard({ proyecto: p }: { proyecto: ProyectoPublico }) {
  const semLegal = semaforoDesdeColor(p.semaforo_legal);
  const perfil = p.perfil ?? "";
  const trackLegal =
    perfil === "C" && p.docs_completados != null && p.docs_totales != null
      ? `REINFO vigente · ${p.docs_completados}/${p.docs_totales} documentos`
      : ETIQUETA_TRACK_LEGAL[perfil] ?? "En evaluación";

  return (
    <Link
      to={`/proyectos/${p.operacion_id}`}
      className="group flex flex-col overflow-hidden border border-black/10 bg-tarjeta transition duration-200 hover:-translate-y-0.5 hover:border-acento/30 hover:shadow-sm dark:border-white/10 dark:bg-tarjeta-dark"
    >
      <div className="relative aspect-[16/10] shrink-0 overflow-hidden bg-black/5 dark:bg-white/5">
        {p.foto_portada_url ? (
          <img
            src={`${BASE_URL}${p.foto_portada_url}`}
            alt={`Foto de ${p.nombre_proyecto}`}
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Pickaxe size={30} strokeWidth={1.5} className="text-texto-suave dark:text-texto-suave-dark" aria-hidden />
          </div>
        )}
        {PERFIL_RIESGO[perfil] && (
          <span className="absolute right-2 top-2 border border-white/40 bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
            {PERFIL_RIESGO[perfil]}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h2 className="font-semibold leading-snug">{p.nombre_proyecto}</h2>
        <p className="text-sm capitalize text-texto-suave dark:text-texto-suave-dark">
          {p.mineral} · {p.region}
        </p>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className={`inline-flex items-center gap-1 font-semibold ${semLegal.claseTexto}`}>
            <ShieldCheck size={13} strokeWidth={2.25} aria-hidden />
            {trackLegal}
          </span>
          {p.indice_madurez != null && (
            <span
              className="text-texto-suave dark:text-texto-suave-dark"
              title="Índice de madurez técnica (0-5)"
            >
              Madurez {p.indice_madurez}/5
            </span>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <ScoreChip etiqueta="Formalización" valor={p.score_formalizacion} />
          <ScoreChip etiqueta="Inversión" valor={p.score_inversion} />
          {p.ventas_verificadas ? (
            <span
              className="inline-flex items-center gap-1 border border-emerald-500/25 px-1.5 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400"
              title={`Declaró ventas con liquidación y subió el respaldo (verificado por ${MARCA}; el documento es privado)`}
            >
              <BadgeCheck size={12} strokeWidth={2} aria-hidden />
              Ventas verificadas
            </span>
          ) : (
            p.vende_liquidacion && (
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                Vende con liquidación
              </span>
            )
          )}
        </div>

        {/* Prueba de existencia: mini-foto de la credencial del perfil
            (autorización DREM/GREM, título de concesión) — nunca un PDF,
            todo se convierte a foto al subirse. Solo si el titular la
            subió; en la ficha se ve completa. */}
        {p.credencial_url && p.credencial_etiqueta && (
          <div className="mt-2 inline-flex items-center gap-2 border border-emerald-500/25 px-2 py-1">
            <img
              src={`${BASE_URL}${p.credencial_url}`}
              alt={p.credencial_etiqueta}
              loading="lazy"
              className="h-9 w-9 object-cover"
            />
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
              <BadgeCheck size={12} strokeWidth={2} aria-hidden />
              {p.credencial_etiqueta} presentado
            </span>
          </div>
        )}

        {/* Empuja el capital + CTA al fondo de la tarjeta aunque el resto
            del contenido varíe en alto entre tarjetas de la misma fila. */}
        <div className="mt-auto pt-3">
          {p.capital_buscado && (
            <p className="line-clamp-1 text-sm font-medium">
              Busca {formatearMonto(p.capital_buscado)}
              {p.uso_fondos ? ` — ${p.uso_fondos}` : ""}
            </p>
          )}
          <p className="mt-2 flex items-center gap-1 border-t border-black/10 pt-2 text-sm font-semibold text-acento dark:border-white/10">
            Ver detalle
            <ArrowRight
              size={15}
              strokeWidth={2.25}
              className="transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </p>
        </div>
      </div>
    </Link>
  );
}
