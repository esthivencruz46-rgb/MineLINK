import { useEffect, useState } from "react";
import { Newspaper } from "lucide-react";
import { obtenerNoticias } from "../services/api";
import type { Noticia } from "../types/noticia";

function formatearFecha(fecha: string): string {
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-PE", { day: "numeric", month: "short" });
}

/** Noticias del sector minero peruano en la portada (julio 2026, pedido
 * explícito de Esthiven) — título + descripción corta + enlace al
 * artículo original (nunca se republica el contenido, mismo criterio
 * que cualquier lector de RSS). Si no hay noticias cacheadas todavía
 * (primera visita tras un deploy) o el feed externo está caído, la
 * sección simplemente no se muestra — nunca un hueco vacío ni un error
 * visible en el Inicio. */
export function NoticiasSection() {
  const [noticias, setNoticias] = useState<Noticia[]>([]);

  useEffect(() => {
    obtenerNoticias().then(setNoticias);
  }, []);

  if (noticias.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Newspaper size={18} strokeWidth={1.75} className="text-acento" aria-hidden />
        <h2 className="text-lg font-semibold">Noticias del sector</h2>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {noticias.map((n) => (
          <a
            key={n.enlace}
            href={n.enlace}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col gap-1.5 border border-black/10 p-4 transition hover:border-acento/40 dark:border-white/10"
          >
            {formatearFecha(n.fecha) && (
              <p className="text-[11px] uppercase tracking-wide text-texto-suave dark:text-texto-suave-dark">
                {formatearFecha(n.fecha)}
              </p>
            )}
            <h3 className="text-sm font-semibold leading-snug">{n.titulo}</h3>
            <p className="line-clamp-2 text-xs text-texto-suave dark:text-texto-suave-dark">
              {n.descripcion}
            </p>
          </a>
        ))}
      </div>
    </div>
  );
}
