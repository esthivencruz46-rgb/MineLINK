import type { ReactNode } from "react";

/** Franja de encabezado compacta con la misma identidad visual del hero
 * de Inicio (degradado verde institucional + líneas topográficas en SVG
 * + entrada animada que se desactiva sola con reduced-motion) a una
 * altura menor — julio 2026, pedido explícito de extender esa identidad
 * a la pantalla de ENTRADA de cada uno de los 3 caminos desde Inicio
 * (Proyectos.tsx, Postular.tsx, la primera pregunta de Cuestionario.tsx)
 * sin repetir el peso visual del hero grande y centrado de la portada:
 * este va alineado a la izquierda, del mismo ancho que el contenido de
 * cada página, como reemplazo directo del `<h1>+<p>` plano que había
 * antes en cada una. */
export function HeroFranja({
  eyebrow,
  titulo,
  subtitulo,
  ancho = "max-w-5xl",
}: {
  eyebrow?: string;
  titulo: ReactNode;
  subtitulo?: ReactNode;
  ancho?: string;
}) {
  return (
    <section className="relative w-full overflow-hidden bg-gradient-to-br from-acento via-acento to-acento-profundo text-white">
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.14]"
        aria-hidden="true"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <pattern id="contornos-franja" width="240" height="150" patternUnits="userSpaceOnUse">
            <path
              d="M-20 30 Q 40 -20, 100 30 T 220 30 T 340 30"
              fill="none"
              stroke="white"
              strokeWidth="1"
            />
            <path
              d="M-20 75 Q 40 25, 100 75 T 220 75 T 340 75"
              fill="none"
              stroke="white"
              strokeWidth="1"
            />
            <path
              d="M-20 120 Q 40 70, 100 120 T 220 120 T 340 120"
              fill="none"
              stroke="white"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#contornos-franja)" />
      </svg>
      <div className={`relative mx-auto ${ancho} px-4 py-8 md:py-10`}>
        {eyebrow && (
          <p className="motion-safe:animate-[hero-entrada_0.6s_ease-out_both] text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
            {eyebrow}
          </p>
        )}
        <h1 className="motion-safe:animate-[hero-entrada_0.6s_ease-out_0.08s_both] mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
          {titulo}
        </h1>
        {subtitulo && (
          <p className="motion-safe:animate-[hero-entrada_0.6s_ease-out_0.16s_both] mt-2 max-w-2xl text-sm text-white/80">
            {subtitulo}
          </p>
        )}
      </div>
    </section>
  );
}
