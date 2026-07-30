import { useEffect, useRef, useState } from "react";
import { Newspaper } from "lucide-react";
import { obtenerNoticias } from "../services/api";
import type { Noticia } from "../types/noticia";

// julio 2026, pedido explícito: que aparezcan más noticias al hacer
// scroll en vez de una lista fija corta. El backend ya trae hasta 18 en
// una sola respuesta (ver noticias.py); esto solo revela de a LOTE sobre
// esa misma lista ya en memoria -- no dispara ningún pedido nuevo al
// backend ni a Rumbo Minero por cada scroll.
const LOTE = 6;

function formatearFecha(fecha: string): string {
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-PE", { day: "numeric", month: "short" });
}

/** Noticias del sector minero peruano en la portada (julio 2026, pedido
 * explícito de Esthiven) — imagen + título + descripción corta + enlace
 * al artículo original (nunca se republica el contenido, mismo criterio
 * que cualquier lector de RSS/vista previa). Lista vertical de tarjetas
 * horizontales (imagen a la izquierda), pedido explícito tras mostrar un
 * ejemplo de referencia. Si no hay noticias cacheadas todavía (primera
 * visita tras un deploy) o el feed externo está caído, la sección
 * simplemente no se muestra — nunca un hueco vacío ni un error visible
 * en el Inicio. */
export function NoticiasSection() {
  const [noticias, setNoticias] = useState<Noticia[]>([]);
  const [visibles, setVisibles] = useState(LOTE);
  const centinelaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    obtenerNoticias().then(setNoticias);
  }, []);

  useEffect(() => {
    const centinela = centinelaRef.current;
    if (!centinela) return;
    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) {
          setVisibles((actual) => Math.min(actual + LOTE, noticias.length));
        }
      },
      { rootMargin: "200px" }
    );
    observador.observe(centinela);
    return () => observador.disconnect();
  }, [noticias.length]);

  if (noticias.length === 0) return null;

  const mostradas = noticias.slice(0, visibles);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Newspaper size={18} strokeWidth={1.75} className="text-acento" aria-hidden />
        <h2 className="text-lg font-semibold">Noticias del sector</h2>
      </div>
      <div className="flex flex-col divide-y divide-black/10 border border-black/10 dark:divide-white/10 dark:border-white/10">
        {mostradas.map((n) => (
          <a
            key={n.enlace}
            href={n.enlace}
            target="_blank"
            rel="noopener noreferrer"
            className="flex gap-4 p-4 transition hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
          >
            {n.imagen ? (
              <img
                src={n.imagen}
                alt=""
                loading="lazy"
                className="h-20 w-28 shrink-0 rounded object-cover sm:h-24 sm:w-36"
              />
            ) : (
              <div className="flex h-20 w-28 shrink-0 items-center justify-center rounded bg-black/5 text-texto-suave dark:bg-white/5 dark:text-texto-suave-dark sm:h-24 sm:w-36">
                <Newspaper size={20} strokeWidth={1.5} aria-hidden />
              </div>
            )}
            <div className="flex min-w-0 flex-col justify-center gap-1">
              <h3 className="text-base font-semibold leading-snug sm:text-lg">{n.titulo}</h3>
              <p className="line-clamp-2 text-sm text-texto-suave dark:text-texto-suave-dark">
                {n.descripcion}
              </p>
              {formatearFecha(n.fecha) && (
                <p className="text-xs text-texto-suave dark:text-texto-suave-dark">
                  {formatearFecha(n.fecha)}
                </p>
              )}
            </div>
          </a>
        ))}
      </div>
      {visibles < noticias.length && <div ref={centinelaRef} className="h-1" aria-hidden />}
    </div>
  );
}
