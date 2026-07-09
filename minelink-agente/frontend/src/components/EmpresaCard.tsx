import { useState } from "react";
import { Check } from "lucide-react";
import type { EmpresaPublica } from "../types/empresa";
import { INFO_BRECHA } from "../data/brechas";
import { enviarInteresEmpresa } from "../services/api";

interface Props {
  empresa: EmpresaPublica;
  brechasMinero: string[];
  operacionId?: string;
  demo?: boolean;
}

export function EmpresaCard({ empresa, brechasMinero, operacionId, demo }: Props) {
  const [nombre, setNombre] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [mostrarForm, setMostrarForm] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setBrechas = new Set(brechasMinero);
  const coincidentes = empresa.estudios_json.filter((e) => setBrechas.has(e));
  const otros = empresa.estudios_json.filter((e) => !setBrechas.has(e));

  async function enviar() {
    if (!operacionId || demo) return;
    if (!nombre.trim() || !whatsapp.trim()) {
      setError("Completa tu nombre y WhatsApp.");
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      await enviarInteresEmpresa(empresa.id, {
        operacion_id: operacionId,
        nombre: nombre.trim(),
        whatsapp: whatsapp.trim(),
        brecha: coincidentes[0],
        mensaje:
          coincidentes.length > 0
            ? `Necesita: ${coincidentes.map((e) => INFO_BRECHA[e]?.texto ?? e).join(", ")}`
            : undefined,
      });
      setEnviado(true);
    } catch {
      setError("No pudimos enviar tu interés. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="rounded-xl bg-tarjeta p-4 shadow-sm dark:bg-tarjeta-dark">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        {demo && (
          <span className="inline-block rounded bg-secundario px-2 py-0.5 text-xs font-semibold text-white">
            EJEMPLO
          </span>
        )}
        <span className="inline-block rounded bg-acento/15 px-2 py-0.5 text-xs font-semibold text-acento">
          {empresa.tipo === "consultor" ? "Consultor independiente" : "Empresa"}
        </span>
      </div>
      <h3 className="text-lg font-bold">{empresa.nombre}</h3>
      <p className="font-mono text-xs text-texto-suave dark:text-texto-suave-dark">
        {empresa.tipo === "consultor"
          ? `Colegiatura ${empresa.colegiatura}`
          : `RUC ${empresa.ruc}`}
      </p>
      <p className="mt-1 text-sm">
        {empresa.anios_servicio} años {empresa.tipo === "consultor" ? "de experiencia" : "en el rubro"}
      </p>

      {coincidentes.length > 0 && (
        <span className="mt-2 inline-block rounded-full bg-acento/15 px-3 py-1 text-sm font-semibold text-acento">
          Resuelve {coincidentes.length} de tus {brechasMinero.length} pendientes
        </span>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {coincidentes.map((e) => (
          <span
            key={e}
            className="rounded-full bg-acento px-2.5 py-1 text-xs font-medium text-white"
          >
            {INFO_BRECHA[e]?.texto ?? e}
          </span>
        ))}
        {otros.map((e) => (
          <span
            key={e}
            className="rounded-full bg-black/5 px-2.5 py-1 text-xs text-texto-suave dark:bg-white/10 dark:text-texto-suave-dark"
          >
            {INFO_BRECHA[e]?.texto ?? e}
          </span>
        ))}
      </div>

      <p className="mt-3 text-xs text-texto-suave dark:text-texto-suave-dark">
        Trabaja en: {empresa.regiones_json.join(", ")}
      </p>

      {enviado ? (
        <p className="mt-4 flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500/15 px-4 py-2.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
          <Check size={16} strokeWidth={2.5} aria-hidden />
          Listo, te contactamos pronto
        </p>
      ) : mostrarForm ? (
        <div className="mt-4 flex flex-col gap-2">
          <input
            type="text"
            placeholder="Tu nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="min-h-[40px] rounded-lg border border-black/10 bg-tarjeta px-3 text-sm dark:border-white/10 dark:bg-tarjeta-dark"
          />
          <input
            type="tel"
            placeholder="Tu WhatsApp"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            className="min-h-[40px] rounded-lg border border-black/10 bg-tarjeta px-3 text-sm dark:border-white/10 dark:bg-tarjeta-dark"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            onClick={enviar}
            disabled={enviando}
            className="min-h-[44px] rounded-lg bg-acento px-4 font-semibold text-white disabled:opacity-50"
          >
            {enviando ? "Enviando..." : "Enviar"}
          </button>
        </div>
      ) : (
        <button
          onClick={() => setMostrarForm(true)}
          disabled={demo || !operacionId}
          className="mt-4 flex min-h-[44px] w-full items-center justify-center rounded-lg bg-acento px-4 font-semibold text-white disabled:opacity-50"
        >
          Me interesa
        </button>
      )}
    </div>
  );
}
