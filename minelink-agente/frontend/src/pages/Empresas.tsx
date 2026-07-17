import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Building2, MapPin, SearchX, SlidersHorizontal, Wrench } from "lucide-react";
import { RegistroMineroModal } from "../components/RegistroMineroModal";
import { EmpresaCard } from "../components/EmpresaCard";
import { TarjetaEmpresaSkeleton } from "../components/Skeleton";
import { DEPARTAMENTOS } from "../data/departamentos";
import { INFO_BRECHA } from "../data/brechas";
import { obtenerEmpresas } from "../services/api";
import { leerDiagnostico } from "../services/storage";
import { useRegistroMinero } from "../hooks/useRegistroMinero";
import type { EmpresaPublica } from "../types/empresa";

const TODOS_LOS_ESTUDIOS = Object.keys(INFO_BRECHA);

/** Llega aquí de dos formas: recién terminado el diagnóstico (sessionStorage,
 * `leerDiagnostico()`) o desde una cuenta ya autenticada — MiConcesion.tsx
 * manda esto por `navigate("/empresas", { state })` cuando el minero hace
 * clic en un pendiente de "Lo que te falta" (sessionStorage ya se limpió
 * al loguearse, ver useRegistroMinero). */
interface EstadoDesdeCuenta {
  region?: string;
  estudios?: string[];
  operacionId?: string;
}

export function Empresas() {
  const location = useLocation();
  const navigate = useNavigate();
  const estadoCuenta = location.state as EstadoDesdeCuenta | null;
  const guardado = leerDiagnostico();
  // Ya tiene cuenta (llegó desde /mi-concesion): no tiene sentido pedirle
  // que se registre de nuevo.
  const yaTieneCuenta = Boolean(estadoCuenta);

  // "no especificado" es el placeholder que guarda el diagnóstico cuando
  // el departamento aún no se preguntó (ver Cuestionario.tsx) — nunca es
  // un departamento real, así que debe tratarse como "sin filtro" (""),
  // igual que cuando el usuario elige "Todos los departamentos" a mano.
  function regionValida(r: string | undefined): string {
    return r && r !== "no especificado" ? r : "";
  }

  const [region, setRegion] = useState(
    regionValida(estadoCuenta?.region) || regionValida(guardado?.region)
  );
  const [estudiosFiltro, setEstudiosFiltro] = useState<string[]>(
    estadoCuenta?.estudios ?? guardado?.respuesta.brechas ?? []
  );
  const [empresas, setEmpresas] = useState<EmpresaPublica[]>([]);
  const [esDemo, setEsDemo] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [mostrarModal, setMostrarModal] = useState(false);
  const operacionId = estadoCuenta?.operacionId ?? guardado?.respuesta.id;
  const brechasMinero = estadoCuenta?.estudios ?? guardado?.respuesta.brechas ?? [];
  const {
    enviando: enviandoLead,
    error: errorLead,
    enviar: enviarRegistro,
  } = useRegistroMinero(guardado?.respuesta.id);

  useEffect(() => {
    setCargando(true);
    obtenerEmpresas(estudiosFiltro, region).then(({ empresas, demo }) => {
      setEmpresas(empresas);
      setEsDemo(demo);
      setCargando(false);
    });
  }, [region, estudiosFiltro]);

  // Sin diagnóstico reciente NI llegada desde una cuenta: no hay contexto
  // (ej. alguien escribió la URL directo) — a la portada.
  if (!guardado && !estadoCuenta) {
    return <Navigate to="/" replace />;
  }

  function alternarEstudio(estudio: string) {
    setEstudiosFiltro((actuales) =>
      actuales.includes(estudio)
        ? actuales.filter((e) => e !== estudio)
        : [...actuales, estudio]
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-8">
      <button
        onClick={() => navigate(-1)}
        className="self-start text-sm text-texto-suave underline dark:text-texto-suave-dark"
      >
        ← Volver
      </button>

      <div>
        <h1 className="text-2xl font-bold">Empresas que te pueden ayudar</h1>
        <p className="mt-1 text-sm text-texto-suave dark:text-texto-suave-dark">
          Filtradas por lo que a ti te falta — contacta directo o deja tu
          interés y nosotros intermediamos.
        </p>
      </div>

      {esDemo && (
        <p className="rounded-lg bg-secundario/15 p-3 text-sm text-secundario">
          No pudimos conectar con el servidor. Estas son empresas de ejemplo.
        </p>
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-black/10 bg-tarjeta p-3 dark:border-white/10 dark:bg-tarjeta-dark md:flex-row">
        <div className="flex min-h-[44px] flex-1 items-center gap-2 rounded-lg border border-black/10 px-3 dark:border-white/10">
          <MapPin size={16} strokeWidth={2} className="shrink-0 text-texto-suave dark:text-texto-suave-dark" aria-hidden />
          <select
            className="min-h-[44px] w-full bg-transparent text-texto dark:text-texto-dark"
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

        <details className="relative min-h-[44px] flex-1 rounded-lg border border-black/10 px-3 py-2 dark:border-white/10">
          <summary className="flex cursor-pointer select-none items-center gap-2">
            <SlidersHorizontal size={16} strokeWidth={2} className="shrink-0 text-texto-suave dark:text-texto-suave-dark" aria-hidden />
            Tipo de estudio ({estudiosFiltro.length})
          </summary>
          <div className="absolute left-0 top-full z-10 mt-2 flex max-h-52 w-72 max-w-[90vw] flex-col gap-1 overflow-y-auto rounded-lg border border-black/10 bg-tarjeta p-3 shadow-lg dark:border-white/10 dark:bg-tarjeta-dark">
            {TODOS_LOS_ESTUDIOS.map((e) => (
              <label key={e} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={estudiosFiltro.includes(e)}
                  onChange={() => alternarEstudio(e)}
                />
                {INFO_BRECHA[e].texto}
              </label>
            ))}
          </div>
        </details>
      </div>

      {cargando && (
        <div className="flex flex-col gap-4">
          <TarjetaEmpresaSkeleton />
          <TarjetaEmpresaSkeleton />
        </div>
      )}

      {!cargando && empresas.length === 0 && (
        <div className="rounded-lg bg-tarjeta p-6 text-center dark:bg-tarjeta-dark">
          <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-acento/10 text-acento">
            <SearchX size={20} strokeWidth={2} aria-hidden />
          </span>
          <p className="mt-3">Aún no tenemos empresas registradas para esto en tu departamento.</p>
          {!yaTieneCuenta && (
            <button
              onClick={() => setMostrarModal(true)}
              className="mt-4 min-h-[44px] rounded-lg bg-acento px-6 font-semibold text-white"
            >
              Avísenme cuando haya
            </button>
          )}
        </div>
      )}

      {/* Bloques: primero empresas, luego consultores independientes.
          Dentro de cada bloque, de mejor a peor rating (los sin rating al
          final) — el rating en sí no se muestra al público por ahora. */}
      {(["empresa", "consultor"] as const).map((tipo) => {
        const bloque = empresas
          .filter((e) => e.tipo === tipo)
          .sort(
            (a, b) =>
              (b.rating ?? -1) - (a.rating ?? -1) ||
              (b.num_resenas ?? 0) - (a.num_resenas ?? 0)
          );
        if (bloque.length === 0) return null;
        return (
          <div key={tipo} className="flex flex-col gap-4">
            <h2 className="flex items-center gap-2 border-b border-black/10 pb-2 text-lg font-bold dark:border-white/10">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-acento/10 text-acento">
                {tipo === "empresa" ? (
                  <Building2 size={17} strokeWidth={2} aria-hidden />
                ) : (
                  <Wrench size={17} strokeWidth={2} aria-hidden />
                )}
              </span>
              {tipo === "empresa" ? "Empresas" : "Consultores independientes"}
              <span className="text-sm font-normal text-texto-suave dark:text-texto-suave-dark">
                ({bloque.length})
              </span>
            </h2>
            {bloque.map((empresa) => (
              <EmpresaCard
                key={empresa.id}
                empresa={empresa}
                brechasMinero={brechasMinero}
                operacionId={operacionId}
                demo={esDemo}
              />
            ))}
          </div>
        );
      })}

      {!yaTieneCuenta && !cargando && empresas.length > 0 && (
        <button
          onClick={() => setMostrarModal(true)}
          className="min-h-[44px] rounded-lg border border-acento px-6 font-semibold text-acento"
        >
          Registrarme para que me ayuden
        </button>
      )}

      {mostrarModal && guardado && (
        <RegistroMineroModal
          situacion={guardado.situacion}
          codigoReinfoInicial={guardado.codigoReinfo}
          enviando={enviandoLead}
          error={errorLead}
          onCerrar={() => setMostrarModal(false)}
          onEnviar={enviarRegistro}
        />
      )}
    </div>
  );
}
