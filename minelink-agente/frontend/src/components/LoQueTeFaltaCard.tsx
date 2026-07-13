import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload } from "lucide-react";
import { useMineroAuth } from "../context/MineroAuthContext";
import { INFO_BRECHA } from "../data/brechas";
import type { MineroPerfil } from "../types/minero";

const ACCEPT_FOTO_O_PDF = "application/pdf,image/jpeg,image/png,image/webp";

/** Un solo "Lo que te falta" para toda la cuenta (julio 2026 — antes había
 *  uno en cada columna y se veía repetido): agrupa las brechas de
 *  Formalización (del diagnóstico + seguimiento del admin) y las de
 *  Inversión (lo que declaró NO tener en el Módulo INV). Cada brecha tiene
 *  dos caminos: "¿Quién me ayuda?" (lleva a /empresas filtrado) y "Ya lo
 *  tengo" — el minero sube su propio respaldo y la brecha se resuelve sola
 *  con esa evidencia, sin esperar a que el admin la libere. */
export function LoQueTeFaltaCard({
  perfil,
  mostrarFormalizacion = true,
  onActualizado,
}: {
  perfil: MineroPerfil;
  /** false para perfil A/A_avanzado en MiConcesion — aún no tienen
   *  concesión, no hay brechas de formalización que medir. */
  mostrarFormalizacion?: boolean;
  /** Se llama después de auto-resolver una brecha subiendo respaldo, para
   *  que la página recargue el perfil (semáforos, listas, documentos). */
  onActualizado?: () => void;
}) {
  const navigate = useNavigate();
  const { authFetch } = useMineroAuth();
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputsRef = useRef<Record<string, HTMLInputElement | null>>({});

  const brechasFormalizacion = mostrarFormalizacion ? perfil.brechas_pendientes : [];
  // Si una brecha ya está listada en formalización, no se repite en
  // inversión (ej. analisis_laboratorio puede salir de ambos cuestionarios).
  const brechasInversion = (perfil.brechas_inversion ?? []).filter(
    (b) => !brechasFormalizacion.includes(b)
  );
  const resueltas = mostrarFormalizacion ? perfil.brechas_resueltas : [];

  async function subirRespaldo(categoria: string, archivo: File) {
    setSubiendo(categoria);
    setError(null);
    try {
      const form = new FormData();
      form.set("categoria", categoria);
      form.set("archivo", archivo);
      const resp = await authFetch("/mineros/documentos", { method: "POST", body: form });
      if (!resp.ok) {
        const detalle = await resp.json().catch(() => null);
        throw new Error(detalle?.detail ?? "No se pudo subir el archivo.");
      }
      onActualizado?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir el archivo.");
    } finally {
      setSubiendo(null);
    }
  }

  if (brechasFormalizacion.length === 0 && brechasInversion.length === 0 && resueltas.length === 0) {
    if (!mostrarFormalizacion) return null;
    return (
      <div className="rounded-lg bg-tarjeta p-5 dark:bg-tarjeta-dark">
        <h2 className="font-semibold">Lo que te falta</h2>
        <p className="mt-2 text-sm text-texto-suave dark:text-texto-suave-dark">
          No tienes brechas pendientes.
        </p>
      </div>
    );
  }

  function itemBrecha(b: string) {
    return (
      <li key={b} className="rounded-lg px-1 py-1.5 hover:bg-black/5 dark:hover:bg-white/5">
        <p className="text-sm">• {INFO_BRECHA[b]?.texto ?? b}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 pl-3">
          <button
            onClick={() =>
              navigate("/empresas", {
                state: {
                  region: perfil.region,
                  estudios: [b],
                  operacionId: perfil.operacion_id,
                },
              })
            }
            className="text-xs font-semibold text-acento"
          >
            ¿Quién me ayuda? →
          </button>
          <button
            onClick={() => inputsRef.current[b]?.click()}
            disabled={subiendo === b}
            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 disabled:opacity-50 dark:text-emerald-400"
          >
            <Upload size={12} strokeWidth={2.5} aria-hidden />
            {subiendo === b ? "Subiendo..." : "Ya lo tengo — subir respaldo"}
          </button>
          <input
            ref={(el) => {
              inputsRef.current[b] = el;
            }}
            type="file"
            accept={ACCEPT_FOTO_O_PDF}
            className="hidden"
            onChange={(e) => {
              const archivo = e.target.files?.[0];
              if (archivo) subirRespaldo(b, archivo);
              e.target.value = "";
            }}
          />
        </div>
      </li>
    );
  }

  return (
    <div className="rounded-lg bg-tarjeta p-5 dark:bg-tarjeta-dark">
      <h2 className="font-semibold">Lo que te falta</h2>
      <p className="mt-1 text-sm text-texto-suave dark:text-texto-suave-dark">
        ¿Ya conseguiste alguno? Sube tu respaldo (foto o PDF) y se marca como resuelto al
        instante.
      </p>

      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

      {brechasFormalizacion.length > 0 && (
        <>
          <h3 className="mt-3 text-xs font-semibold uppercase text-texto-suave dark:text-texto-suave-dark">
            Formalización
          </h3>
          <ul className="mt-1 flex flex-col gap-1">{brechasFormalizacion.map(itemBrecha)}</ul>
        </>
      )}

      {brechasInversion.length > 0 && (
        <>
          <h3 className="mt-3 text-xs font-semibold uppercase text-texto-suave dark:text-texto-suave-dark">
            Inversión
          </h3>
          <ul className="mt-1 flex flex-col gap-1">{brechasInversion.map(itemBrecha)}</ul>
        </>
      )}

      {resueltas.length > 0 && (
        <>
          <h3 className="mt-4 text-sm font-semibold text-texto-suave dark:text-texto-suave-dark">
            Ya resuelto
          </h3>
          <ul className="mt-1 flex flex-col gap-1 text-sm text-texto-suave line-through dark:text-texto-suave-dark">
            {resueltas.map((b) => (
              <li key={b}>{INFO_BRECHA[b]?.texto ?? b}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
