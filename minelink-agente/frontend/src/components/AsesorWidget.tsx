import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, X } from "lucide-react";
import { preguntarAsesor } from "../services/api";
import { MARCA } from "../config/marca";
import type { MensajeAsesor } from "../types/minero";

const PREGUNTAS_SUGERIDAS = [
  "¿Qué es el REINFO?",
  "¿Qué perfiles existen en MineLink?",
  "¿Qué es un IGAFOM?",
];

// julio 2026, pedido explícito: mostrar el límite de entrada, antes de que
// alguien lo choque sin saber que existía. Debe coincidir con
// security.MAX_PREGUNTAS_ASESOR_HORA del backend -- no hay un endpoint que
// lo exponga (es un solo número que casi nunca cambia), así que si se
// ajusta ahí, hay que actualizar este valor a mano también.
const MAX_PREGUNTAS_POR_HORA = 15;

/** Widget flotante del asesor conversacional PÚBLICO (julio 2026, pedido
 * explícito del dueño: que esté disponible "en cualquier parte", pegado
 * al lado derecho, SIN navegar a otra pantalla). Se monta una sola vez en
 * App.tsx, fuera de las rutas, así persiste entre páginas — abrir/cerrar
 * solo cambia un panel pequeño, nunca ocupa toda la pantalla. Genérico a
 * propósito: no conoce el caso de nadie en particular, solo el spec de
 * negocio de MineLink. El historial vive solo en esta sesión del
 * navegador (no se persiste en la base). */
export function AsesorWidget() {
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState<MensajeAsesor[]>([]);
  const [borrador, setBorrador] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (abierto) finalRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes, enviando, abierto]);

  async function enviar(pregunta: string) {
    const texto = pregunta.trim();
    if (!texto || enviando) return;
    setError(null);
    setBorrador("");
    const historialParaEnviar = mensajes.slice(-6);
    setMensajes((previos) => [...previos, { rol: "usuario", contenido: texto }]);
    setEnviando(true);
    try {
      const respuesta = await preguntarAsesor(texto, historialParaEnviar);
      setMensajes((previos) => [...previos, { rol: "asesor", contenido: respuesta }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos responder tu pregunta.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {abierto && (
        <div className="flex h-[70vh] max-h-[520px] w-[92vw] max-w-sm flex-col border border-black/10 bg-tarjeta shadow-lg dark:border-white/10 dark:bg-tarjeta-dark">
          <div className="flex items-center justify-between gap-2 border-b border-black/10 px-3 py-2.5 dark:border-white/10">
            <div className="flex min-w-0 items-center gap-1.5">
              <Sparkles size={15} strokeWidth={1.75} className="shrink-0 text-acento" aria-hidden />
              <p className="truncate text-sm font-semibold">Pregúntale a {MARCA}</p>
            </div>
            <button
              onClick={() => setAbierto(false)}
              aria-label="Cerrar asesor"
              className="flex h-7 w-7 shrink-0 items-center justify-center text-texto-suave hover:text-texto dark:text-texto-suave-dark dark:hover:text-texto-dark"
            >
              <X size={16} strokeWidth={1.75} aria-hidden />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3">
            {mensajes.length === 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-texto-suave dark:text-texto-suave-dark">
                  Orientación general, no asesoría legal. Pregúntame, por ejemplo:
                </p>
                <div className="flex flex-col gap-1.5">
                  {PREGUNTAS_SUGERIDAS.map((p) => (
                    <button
                      key={p}
                      onClick={() => enviar(p)}
                      className="border border-black/10 p-2 text-left text-xs transition hover:border-acento/40 dark:border-white/10"
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-texto-suave dark:text-texto-suave-dark">
                  Hasta {MAX_PREGUNTAS_POR_HORA} preguntas por hora.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2">
              {mensajes.map((m, i) => (
                <div
                  key={i}
                  className={`max-w-[85%] whitespace-pre-wrap p-2.5 text-xs ${
                    m.rol === "usuario"
                      ? "ml-auto bg-acento text-white"
                      : "border border-black/10 dark:border-white/10"
                  }`}
                >
                  {m.contenido}
                </div>
              ))}
              {enviando && (
                <div className="max-w-[85%] border border-black/10 p-2.5 text-xs text-texto-suave dark:border-white/10 dark:text-texto-suave-dark">
                  Pensando...
                </div>
              )}
            </div>
            <div ref={finalRef} />
          </div>

          {error && <p className="px-3 pb-1 text-xs text-red-500">{error}</p>}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              enviar(borrador);
            }}
            className="flex gap-2 border-t border-black/10 p-2 dark:border-white/10"
          >
            <input
              className="min-h-[38px] flex-1 border border-black/10 bg-transparent px-2.5 text-xs dark:border-white/10"
              placeholder="Escribe tu pregunta..."
              value={borrador}
              onChange={(e) => setBorrador(e.target.value)}
              disabled={enviando}
            />
            <button
              type="submit"
              disabled={enviando || !borrador.trim()}
              className="flex min-h-[38px] w-9 shrink-0 items-center justify-center bg-acento text-white disabled:opacity-50"
              aria-label="Enviar pregunta"
            >
              <Send size={15} strokeWidth={1.75} aria-hidden />
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setAbierto((a) => !a)}
        aria-label={abierto ? "Cerrar asesor" : "Pregúntale a " + MARCA}
        title={abierto ? "Cerrar" : `Pregúntale a ${MARCA}`}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-acento text-white shadow-lg"
      >
        {abierto ? (
          <X size={20} strokeWidth={1.75} aria-hidden />
        ) : (
          <Sparkles size={20} strokeWidth={1.75} aria-hidden />
        )}
      </button>
    </div>
  );
}
