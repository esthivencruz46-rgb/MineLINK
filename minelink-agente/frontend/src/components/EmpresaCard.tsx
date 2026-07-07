import type { Empresa } from "../types/empresa";
import { INFO_BRECHA } from "../data/brechas";

interface Props {
  empresa: Empresa;
  brechasMinero: string[];
  demo?: boolean;
}

export function EmpresaCard({ empresa, brechasMinero, demo }: Props) {
  const setBrechas = new Set(brechasMinero);
  const coincidentes = empresa.estudios_json.filter((e) => setBrechas.has(e));
  const otros = empresa.estudios_json.filter((e) => !setBrechas.has(e));

  const mensaje =
    coincidentes.length > 0
      ? `Hola, vengo de MineLink. Mi diagnóstico dice que necesito: ${coincidentes
          .map((e) => INFO_BRECHA[e]?.texto ?? e)
          .join(", ")}. ¿Me pueden orientar?`
      : "Hola, vengo de MineLink. ¿Me pueden orientar?";

  const linkWhatsApp = `https://wa.me/${empresa.whatsapp.replace("+", "")}?text=${encodeURIComponent(
    mensaje
  )}`;

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

      <a
        href={linkWhatsApp}
        target="_blank"
        rel="noreferrer"
        className="mt-4 flex min-h-[44px] items-center justify-center rounded-lg bg-acento px-4 font-semibold text-white active:opacity-90"
      >
        Escribir por WhatsApp
      </a>
    </div>
  );
}
