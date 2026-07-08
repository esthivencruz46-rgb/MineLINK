import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DEPARTAMENTOS } from "../data/departamentos";
import { BASE_URL, obtenerMineralesDisponibles, obtenerProyectos } from "../services/api";
import { calcularSemaforo } from "../utils/semaforo";
import type { ProyectoPublico } from "../types/proyecto";

export function Proyectos() {
  const [proyectos, setProyectos] = useState<ProyectoPublico[]>([]);
  const [minerales, setMinerales] = useState<string[]>([]);
  const [mineral, setMineral] = useState("");
  const [region, setRegion] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    obtenerMineralesDisponibles().then(setMinerales).catch(() => setMinerales([]));
  }, []);

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
    <div className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-8">
      <h1 className="text-2xl font-bold">Proyectos mineros</h1>
      <p className="text-texto-suave dark:text-texto-suave-dark">
        Operaciones formalizándose en Perú, en camino a REINFO. Búscalas por
        mineral o departamento.
      </p>

      <div className="flex flex-col gap-3 md:flex-row">
        <select
          className="min-h-[44px] rounded-lg border border-black/10 bg-tarjeta px-3 text-texto dark:border-white/10 dark:bg-tarjeta-dark dark:text-texto-dark"
          value={mineral}
          onChange={(e) => setMineral(e.target.value)}
        >
          <option value="" className="bg-white text-black">
            Todos los minerales
          </option>
          {minerales.map((m) => (
            <option key={m} value={m} className="bg-white text-black capitalize">
              {m}
            </option>
          ))}
        </select>

        <select
          className="min-h-[44px] rounded-lg border border-black/10 bg-tarjeta px-3 text-texto dark:border-white/10 dark:bg-tarjeta-dark dark:text-texto-dark"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
        >
          <option value="" className="bg-white text-black">
            Todos los departamentos
          </option>
          {DEPARTAMENTOS.map((d) => (
            <option key={d} value={d.toLowerCase()} className="bg-white text-black">
              {d}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-red-500">{error}</p>}
      {cargando && <p>Buscando proyectos...</p>}

      {!cargando && proyectos.length === 0 && (
        <p className="rounded-lg bg-tarjeta p-6 text-center dark:bg-tarjeta-dark">
          Todavía no hay proyectos que calcen con esta búsqueda.
        </p>
      )}

      {!cargando &&
        (["minero_artesanal", "concesionario"] as const).map((sit) => {
          const grupo = proyectos.filter((p) => p.situacion === sit);
          if (grupo.length === 0) return null;
          return (
            <div key={sit} className="flex flex-col gap-4">
              <h2 className="text-lg font-bold">
                {sit === "minero_artesanal" ? "⛏️ Operaciones activas" : "📍 Concesiones en preparación"}
                <span className="ml-2 text-sm font-normal text-texto-suave dark:text-texto-suave-dark">
                  ({grupo.length})
                </span>
              </h2>
              <div className="flex flex-col gap-4">
                {grupo.map((p) => (
                  <ProyectoCard key={p.operacion_id} proyecto={p} />
                ))}
              </div>
            </div>
          );
        })}
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
        <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg bg-black/5 text-3xl dark:bg-white/5">
          ⛏️
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

        <p className="mt-3 text-sm font-semibold text-acento">Ver detalle →</p>
      </div>
    </Link>
  );
}
