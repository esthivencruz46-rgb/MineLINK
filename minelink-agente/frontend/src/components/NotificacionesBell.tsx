import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useMineroAuth } from "../context/MineroAuthContext";
import type { Notificacion } from "../types/minero";

const INTERVALO_POLL_MS = 60_000;

/** Campanita de notificaciones para la cuenta del minero (MiCuenta.tsx /
 *  MiConcesion.tsx) — avisa cuando el admin rechaza un documento o da un
 *  visto bueno. No es push real (eso quedó pospuesto, requiere Firebase);
 *  esto es un panel que el minero revisa al entrar, con polling cada
 *  minuto mientras la cuenta está abierta. */
export function NotificacionesBell() {
  const { authFetch } = useMineroAuth();
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef<HTMLDivElement | null>(null);

  function cargar() {
    authFetch("/mineros/notificaciones")
      .then((r) => (r.ok ? r.json() : []))
      .then(setNotificaciones)
      .catch(() => {});
  }

  useEffect(() => {
    cargar();
    const intervalo = setInterval(cargar, INTERVALO_POLL_MS);
    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authFetch]);

  useEffect(() => {
    function alHacerClicFuera(e: MouseEvent) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    }
    document.addEventListener("mousedown", alHacerClicFuera);
    return () => document.removeEventListener("mousedown", alHacerClicFuera);
  }, []);

  async function alAbrir() {
    const yaEstaAbierto = abierto;
    setAbierto(!yaEstaAbierto);
    if (yaEstaAbierto) return;

    const hayNoLeidas = notificaciones.some((n) => !n.leida);
    if (!hayNoLeidas) return;
    setNotificaciones((actuales) => actuales.map((n) => ({ ...n, leida: true })));
    try {
      await authFetch("/mineros/notificaciones/marcar-leidas", { method: "POST" });
    } catch {
      // La próxima carga (poll o recarga) vuelve a intentar; no es crítico.
    }
  }

  const noLeidas = notificaciones.filter((n) => !n.leida).length;

  return (
    <div ref={contenedorRef} className="relative">
      <button
        onClick={alAbrir}
        aria-label="Notificaciones"
        className="relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-black/10 dark:border-white/10"
      >
        <Bell size={18} strokeWidth={2} />
        {noLeidas > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {noLeidas > 9 ? "9+" : noLeidas}
          </span>
        )}
      </button>

      {abierto && (
        <div className="absolute right-0 top-full z-10 mt-2 flex max-h-80 w-80 max-w-[90vw] flex-col gap-1 overflow-y-auto rounded-lg border border-black/10 bg-tarjeta p-3 shadow-lg dark:border-white/10 dark:bg-tarjeta-dark">
          {notificaciones.length === 0 ? (
            <p className="p-2 text-sm text-texto-suave dark:text-texto-suave-dark">
              No tienes notificaciones.
            </p>
          ) : (
            notificaciones.map((n) => (
              <div
                key={n.id}
                className="rounded-lg p-2 text-sm hover:bg-black/5 dark:hover:bg-white/5"
              >
                <p>{n.mensaje}</p>
                <p className="mt-0.5 text-xs text-texto-suave dark:text-texto-suave-dark">
                  {new Date(n.created_at).toLocaleDateString("es-PE")}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
