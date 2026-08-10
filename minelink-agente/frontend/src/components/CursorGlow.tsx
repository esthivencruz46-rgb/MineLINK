import { useEffect, useRef, useState } from "react";

/** Resplandor suave que sigue al cursor en las páginas públicas (estilo
 * Originkit, agosto 2026): un halo verde muy tenue, con seguimiento
 * amortiguado para que no sea brusco. No se monta en pantallas táctiles
 * (no hay cursor) ni con prefers-reduced-motion. Es solo decorativo:
 * pointer-events: none, no bloquea ningún clic. */
export function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const punteroFino = window.matchMedia("(pointer: fine)").matches;
    if (reducido || !punteroFino) return;
    setMontado(true);

    let frame = 0;
    const objetivo = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const actual = { x: objetivo.x, y: objetivo.y };

    const enMovimiento = (e: PointerEvent) => {
      objetivo.x = e.clientX;
      objetivo.y = e.clientY;
      setVisible(true);
    };

    const enBucle = () => {
      actual.x += (objetivo.x - actual.x) * 0.12;
      actual.y += (objetivo.y - actual.y) * 0.12;
      const el = ref.current;
      if (el) {
        el.style.transform = `translate3d(${actual.x}px, ${actual.y}px, 0) translate(-50%, -50%)`;
      }
      frame = requestAnimationFrame(enBucle);
    };

    window.addEventListener("pointermove", enMovimiento, { passive: true });
    frame = requestAnimationFrame(enBucle);
    return () => {
      window.removeEventListener("pointermove", enMovimiento);
      cancelAnimationFrame(frame);
    };
  }, []);

  if (!montado) return null;
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={`cursor-brillo ${visible ? "visible" : ""}`}
    />
  );
}
