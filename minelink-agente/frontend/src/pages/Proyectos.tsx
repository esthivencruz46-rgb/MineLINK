import { useEffect, useState } from "react";
import { useTitulo } from "../hooks/useTitulo";
import { MARCA } from "../config/marca";
import { Link } from "react-router-dom";
import { ArrowRight, BadgeCheck, MapPin, Pickaxe, ShieldCheck } from "lucide-react";
import { Autocomplete } from "../components/Autocomplete";
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
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Proyectos mineros</h1>
        <p className="mt-1 text-texto-suave dark:text-texto-suave-dark">
          Proyectos con su situación legal en orden — los que tienen un
          bloqueante legal activo no se muestran hasta resolverlo. Búscalos por
          mineral o departamento.
        </p>
      </div>

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
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {[0, 1].map((col) => (
            <div key={col} className="flex flex-col gap-4">
              <TarjetaProyectoSkeleton />
              <TarjetaProyectoSkeleton />
            </div>
          ))}
        </div>
      )}

      {!cargando && proyectos.length === 0 && (
        <p className="border border-black/10 p-6 text-center dark:border-white/10">
          Todavía no hay proyectos que calcen con esta búsqueda.
        </p>
      )}

      {!cargando && proyectos.length > 0 && (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {[
            { titulo: "Operaciones en marcha", grupo: operando, icono: "pickaxe" },
            { titulo: "Concesiones en preparación", grupo: enPreparacion, icono: "mapa" },
          ].map(({ titulo, grupo, icono }) => (
            <div key={titulo} className="flex flex-col gap-4">
              <h2 className="flex items-center gap-2 border-b border-black/10 pb-2 font-semibold dark:border-white/10">
                {icono === "pickaxe" ? (
                  <Pickaxe size={17} strokeWidth={1.75} className="text-acento" aria-hidden />
                ) : (
                  <MapPin size={17} strokeWidth={1.75} className="text-acento" aria-hidden />
                )}
                {titulo}
                <span className="font-normal text-texto-suave dark:text-texto-suave-dark">
                  ({grupo.length})
                </span>
              </h2>
              {grupo.length === 0 ? (
                <p className="border border-black/10 p-4 text-sm text-texto-suave dark:border-white/10 dark:text-texto-suave-dark">
                  Todavía no hay proyectos en este grupo.
                </p>
              ) : (
                <div className="flex flex-col divide-y divide-black/10 border border-black/10 dark:divide-white/10 dark:border-white/10">
                  {grupo.map((p) => (
                    <ProyectoCard key={p.operacion_id} proyecto={p} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
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

/** Tarjeta de la cartera: Track Legal (semáforo + texto), scores 0-100 por
 * track, ventas verificadas con respaldo, monto buscado y perfil de riesgo. */
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
      className="flex gap-4 p-5 transition hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
    >
      {p.foto_portada_url ? (
        <img
          src={`${BASE_URL}${p.foto_portada_url}`}
          alt={`Foto de ${p.nombre_proyecto}`}
          loading="lazy"
          className="h-24 w-24 shrink-0 object-cover"
        />
      ) : (
        <div className="flex h-24 w-24 shrink-0 items-center justify-center bg-black/5 dark:bg-white/5">
          <Pickaxe size={28} strokeWidth={1.75} className="text-texto-suave dark:text-texto-suave-dark" aria-hidden />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-semibold">{p.nombre_proyecto}</h2>
          {PERFIL_RIESGO[perfil] && (
            <span className="shrink-0 border border-black/10 px-2 py-0.5 text-[11px] font-medium text-texto-suave dark:border-white/10 dark:text-texto-suave-dark">
              {PERFIL_RIESGO[perfil]}
            </span>
          )}
        </div>
        <p className="text-sm capitalize text-texto-suave dark:text-texto-suave-dark">
          {p.mineral} · {p.region}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
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

        {p.capital_buscado && (
          <p className="mt-2 line-clamp-1 text-sm">
            Busca {formatearMonto(p.capital_buscado)}
            {p.uso_fondos ? ` — ${p.uso_fondos}` : ""}
          </p>
        )}

        <p className="mt-3 flex items-center gap-1 text-sm font-semibold text-acento">
          Ver detalle <ArrowRight size={15} strokeWidth={2.25} aria-hidden />
        </p>
      </div>
    </Link>
  );
}
