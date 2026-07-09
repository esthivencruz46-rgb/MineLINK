import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, MapPin, Pickaxe } from "lucide-react";
import { Autocomplete } from "../components/Autocomplete";
import { DEPARTAMENTOS } from "../data/departamentos";
import { OPCIONES_ELEMENTO_VALOR } from "../data/preguntasPerfil";
import { BASE_URL, obtenerProyectos } from "../services/api";
import { calcularSemaforo } from "../utils/semaforo";
import type { ProyectoPublico } from "../types/proyecto";

const ELEMENTOS = OPCIONES_ELEMENTO_VALOR.map((o) => cap(o.valor));

export function Proyectos() {
  const [proyectos, setProyectos] = useState<ProyectoPublico[]>([]);
  const [mineral, setMineral] = useState("");
  const [region, setRegion] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCargando(true);
    obtenerProyectos(mineral, region)
      .then((data) => {
        setProyectos(data);
        setError(null);
      })
      .catch(() => setError("No pudimos cargar los proyectos."))
      .finally(() => setCargando(false));
  }, [mineral, region]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-8">
      <h1 className="text-2xl font-bold">Proyectos mineros</h1>
      <p className="text-texto-suave dark:text-texto-suave-dark">
        Operaciones formalizándose en Perú, en camino a REINFO. Búscalas por
        elemento o departamento.
      </p>

      <div className="flex flex-col gap-3 md:flex-row">
        <Autocomplete
          opciones={ELEMENTOS}
          value={mineral}
          onChange={setMineral}
          placeholder="Buscar elemento (ej. Oro)"
        />
        <Autocomplete
          opciones={DEPARTAMENTOS}
          value={region}
          onChange={setRegion}
          placeholder="Buscar departamento"
        />
      </div>

      {error && <p className="text-red-500">{error}</p>}
      {cargando && <p>Buscando proyectos...</p>}

      {!cargando && proyectos.length === 0 && (
        <p className="rounded-lg bg-tarjeta p-6 text-center dark:bg-tarjeta-dark">
          Todavía no hay proyectos que calcen con esta búsqueda.
        </p>
      )}

      {!cargando && proyectos.length > 0 && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {(["minero_artesanal", "concesionario"] as const).map((sit) => {
            const grupo = proyectos
              .filter((p) => p.situacion === sit)
              .sort((a, b) => b.score_actual - a.score_actual);
            return (
              <div key={sit} className="flex flex-col gap-4">
                <h2 className="flex items-center gap-2 text-lg font-bold">
                  {sit === "minero_artesanal" ? (
                    <Pickaxe size={19} strokeWidth={2} className="text-acento" aria-hidden />
                  ) : (
                    <MapPin size={19} strokeWidth={2} className="text-acento" aria-hidden />
                  )}
                  {sit === "minero_artesanal" ? "Operaciones activas" : "Concesiones en preparación"}
                  <span className="text-sm font-normal text-texto-suave dark:text-texto-suave-dark">
                    ({grupo.length})
                  </span>
                </h2>
                {grupo.length === 0 ? (
                  <p className="rounded-lg bg-tarjeta p-4 text-sm text-texto-suave dark:bg-tarjeta-dark dark:text-texto-suave-dark">
                    Todavía no hay proyectos en este grupo.
                  </p>
                ) : (
                  <div className="flex flex-col gap-4">
                    {grupo.map((p) => (
                      <ProyectoCard key={p.operacion_id} proyecto={p} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProyectoCard({ proyecto: p }: { proyecto: ProyectoPublico }) {
  const semaforo = calcularSemaforo(p.score_actual, false);
  return (
    <Link
      to={`/proyectos/${p.operacion_id}`}
      className="flex gap-4 rounded-lg bg-tarjeta p-5 transition hover:opacity-90 dark:bg-tarjeta-dark"
    >
      {p.foto_portada_url ? (
        <img
          src={`${BASE_URL}${p.foto_portada_url}`}
          alt={`Foto de ${p.nombre_proyecto}`}
          loading="lazy"
          className="h-24 w-24 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg bg-black/5 dark:bg-white/5">
          <Pickaxe size={28} strokeWidth={1.75} className="text-texto-suave dark:text-texto-suave-dark" aria-hidden />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-semibold">{p.nombre_proyecto}</h2>
          <span className={`shrink-0 font-mono text-sm font-bold ${semaforo.claseTexto}`}>
            {p.score_actual}
          </span>
        </div>
        <p className="text-sm capitalize text-texto-suave dark:text-texto-suave-dark">
          {p.mineral} · {p.region}
          {p.situacion === "minero_artesanal" &&
            ` · ${p.tipo_mina === "subterranea" ? "subterránea" : "tajo abierto"}`}
        </p>

        {p.descripcion_operacion && (
          <p className="mt-2 line-clamp-2 text-sm">{p.descripcion_operacion}</p>
        )}

        <p className="mt-3 flex items-center gap-1 text-sm font-semibold text-acento">
          Ver detalle <ArrowRight size={15} strokeWidth={2.25} aria-hidden />
        </p>
      </div>
    </Link>
  );
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
