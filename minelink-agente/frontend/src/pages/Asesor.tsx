import { useEffect, useRef, useState } from "react";
import { useTitulo } from "../hooks/useTitulo";
import { Link } from "react-router-dom";
import { ArrowLeft, Send, Sparkles } from "lucide-react";
import { preguntarAsesor } from "../services/api";
import { MARCA } from "../config/marca";
import type { MensajeAsesor } from "../types/minero";

const PREGUNTAS_SUGERIDAS = [
  "¿Qué es el REINFO?",
  "¿Qué perfiles existen en MineLink?",
  "¿Qué es un IGAFOM?",
];

/** Asesor conversacional PÚBLICO (julio 2026, decisión explícita del
 * dueño: "cualquier persona sin registrarse lo pueda usar"). Genérico a
 * propósito — no conoce el caso de nadie en particular, solo explica
 * conceptos generales de formalización minera y de MineLink. El
 * historial vive solo en esta sesión del navegador (no se persiste). */
export function Asesor() {
  useTitulo("Pregúntale a " + MARCA);
  const [mensajes, setMensajes] = useState<MensajeAsesor[]>([]);
  const [borrador, setBorrador] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    finalRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes, enviando]);

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
    <div className="mx-auto flex h-[calc(100dvh-56px)] max-w-2xl flex-col px-4 py-4">
      <div className="flex items-center gap-3 border-b border-black/10 pb-3 dark:border-white/10">
        <Link
          to="/"
          className="flex h-9 w-9 shrink-0 items-center justify-center border border-black/10 dark:border-white/10"
          aria-label="Volver al inicio"
        >
          <ArrowLeft size={17} strokeWidth={1.75} aria-hidden />
        </Link>
        <div className="min-w-0">
          <h1 className="flex items-center gap-1.5 font-semibold">
            <Sparkles size={16} strokeWidth={1.75} className="text-acento shrink-0" aria-hidden />
            Pregúntale a {MARCA}
          </h1>
          <p className="text-xs text-texto-suave dark:text-texto-suave-dark">
            Responde preguntas generales sobre formalización minera y sobre cómo funciona{" "}
            {MARCA}. Es orientación general, no asesoría legal.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        {mensajes.length === 0 && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-texto-suave dark:text-texto-suave-dark">
              Pregúntame, por ejemplo:
            </p>
            <div className="flex flex-col gap-2">
              {PREGUNTAS_SUGERIDAS.map((p) => (
                <button
                  key={p}
                  onClick={() => enviar(p)}
                  className="border border-black/10 p-3 text-left text-sm transition hover:border-acento/40 dark:border-white/10"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {mensajes.map((m, i) => (
            <div
              key={i}
              className={`max-w-[85%] whitespace-pre-wrap p-3 text-sm ${
                m.rol === "usuario"
                  ? "ml-auto bg-acento text-white"
                  : "border border-black/10 dark:border-white/10"
              }`}
            >
              {m.contenido}
            </div>
          ))}
          {enviando && (
            <div className="max-w-[85%] border border-black/10 p-3 text-sm text-texto-suave dark:border-white/10 dark:text-texto-suave-dark">
              Pensando...
            </div>
          )}
        </div>
        <div ref={finalRef} />
      </div>

      {error && <p className="mb-2 text-sm text-red-500">{error}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviar(borrador);
        }}
        className="flex gap-2 border-t border-black/10 pt-3 dark:border-white/10"
      >
        <input
          className="min-h-[44px] flex-1 border border-black/10 bg-transparent px-3 text-sm dark:border-white/10"
          placeholder="Escribe tu pregunta..."
          value={borrador}
          onChange={(e) => setBorrador(e.target.value)}
          disabled={enviando}
        />
        <button
          type="submit"
          disabled={enviando || !borrador.trim()}
          className="flex min-h-[44px] w-11 shrink-0 items-center justify-center bg-acento text-white disabled:opacity-50"
          aria-label="Enviar pregunta"
        >
          <Send size={17} strokeWidth={1.75} aria-hidden />
        </button>
      </form>
    </div>
  );
}
