import { useEffect, useRef, useState, type ReactNode } from "react";

/** Aparición suave al hacer scroll (fade + leve subida), inspirada en los
 * fondos animados de Originkit (agosto 2026): se aplica a tarjetas de las
 * páginas públicas. Con prefers-reduced-motion el contenido se muestra
 * directo, sin animación, y nunca queda invisible. */
export function Reveal({
  children,
  retraso = 0,
}: {
  children: ReactNode;
  retraso?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entradas) => {
        if (entradas[0]?.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -32px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={visible ? "revelado" : "no-revelado"}
      style={retraso > 0 ? { transitionDelay: `${retraso}ms` } : undefined}
    >
      {children}
    </div>
  );
}
