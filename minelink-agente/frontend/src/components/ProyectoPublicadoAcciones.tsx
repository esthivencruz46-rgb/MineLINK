import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Download, Eye, Users } from "lucide-react";
import { obtenerProyecto } from "../services/api";
import { generarPdfProyecto } from "../utils/pdfProyecto";
import type { MineroPerfil } from "../types/minero";

/** Franja del proyecto publicado (junto a "Tus datos"): confirma la
 *  visibilidad, muestra cuántos inversionistas dejaron interés, y da dos
 *  acciones — ver la ficha pública tal como la ve el inversionista, y
 *  descargar esa misma ficha en PDF (útil para mostrarla en persona o
 *  imprimirla donde no llega la señal). Solo se renderiza cuando el
 *  proyecto ya está publicado (apto_inversionistas). */
export function ProyectoPublicadoAcciones({ perfil }: { perfil: MineroPerfil }) {
  const [descargando, setDescargando] = useState(false);
  const [errorPdf, setErrorPdf] = useState(false);
  const intereses = perfil.intereses_recibidos ?? 0;

  async function descargarPdf() {
    setDescargando(true);
    setErrorPdf(false);
    try {
      // La ficha pública ya existe (el proyecto está publicado) — se
      // reusa el mismo generador de PDF que usa el inversionista.
      const proyecto = await obtenerProyecto(perfil.operacion_id);
      await generarPdfProyecto(proyecto);
    } catch {
      setErrorPdf(true);
    } finally {
      setDescargando(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-2 rounded-lg bg-emerald-500/10 px-5 py-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 size={18} strokeWidth={2} className="shrink-0" aria-hidden />
        Tu perfil ya es visible para inversionistas
      </div>
      {intereses > 0 && (
        <p className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400">
          <Users size={15} strokeWidth={2} className="shrink-0" aria-hidden />
          {intereses === 1
            ? "1 inversionista mostró interés en tu proyecto — te contactaremos para coordinarlo."
            : `${intereses} inversionistas mostraron interés en tu proyecto — te contactaremos para coordinarlo.`}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Link
          to={`/proyectos/${perfil.operacion_id}`}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-emerald-600/40 px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400"
        >
          <Eye size={14} strokeWidth={2.25} aria-hidden />
          Ver mi proyecto como lo ve el inversionista
        </Link>
        <button
          onClick={descargarPdf}
          disabled={descargando}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-emerald-600/40 px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-500/10 disabled:opacity-50 dark:text-emerald-400"
        >
          <Download size={14} strokeWidth={2.25} aria-hidden />
          {descargando ? "Generando..." : "Descargar mi ficha (PDF)"}
        </button>
      </div>
      {errorPdf && (
        <p className="text-xs text-red-500">No pudimos generar el PDF. Intenta de nuevo.</p>
      )}
    </div>
  );
}
