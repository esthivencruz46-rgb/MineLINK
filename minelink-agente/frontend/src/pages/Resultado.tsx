import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { DimensionBars } from "../components/DimensionBars";
import { ListaBrechas } from "../components/ListaBrechas";
import { ScoreBadge } from "../components/ScoreBadge";
import { WHATSAPP_ADMIN, enlaceWhatsApp } from "../config/whatsapp";
import { INFO_BRECHA } from "../data/brechas";
import { guardarDiagnostico, leerDiagnostico } from "../services/storage";

export function Resultado() {
  const navigate = useNavigate();
  const guardado = leerDiagnostico();
  const [codigoReinfo, setCodigoReinfo] = useState(guardado?.codigoReinfo ?? "");

  useEffect(() => {
    if (guardado) {
      guardarDiagnostico({ ...guardado, codigoReinfo });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigoReinfo]);

  if (!guardado) {
    return <Navigate to="/" replace />;
  }

  const { respuesta } = guardado;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-8">
      <ScoreBadge scoreTotal={respuesta.score_total} bloqueado={respuesta.bloqueado} />

      <DimensionBars dimensiones={respuesta.dimensiones} />

      <div>
        <label className="mb-1 block text-sm font-medium">
          Código REINFO (opcional)
        </label>
        <input
          className="min-h-[44px] w-full rounded-lg border border-black/10 bg-transparent px-3 dark:border-white/10"
          placeholder="Tu código REINFO, si lo tienes"
          value={codigoReinfo}
          onChange={(e) => setCodigoReinfo(e.target.value)}
        />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-bold">Esto es lo que te falta</h2>
        <ListaBrechas
          brechas={respuesta.brechas}
          dimensiones={respuesta.dimensiones}
          onBuscarAyuda={() => navigate("/empresas")}
        />
      </div>

      <a
        href={enlaceWhatsApp(
          WHATSAPP_ADMIN,
          [
            "Hola MineLink 👋 Acabo de hacer mi diagnóstico de formalización.",
            `Mi puntaje: ${respuesta.score_total}/100.`,
            respuesta.brechas.length > 0
              ? `Me falta: ${respuesta.brechas
                  .map((b) => INFO_BRECHA[b]?.texto ?? b)
                  .join(", ")}.`
              : "No tengo brechas pendientes.",
            "Quisiera saber quién me puede ayudar.",
          ].join(" ")
        )}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-[#25D366] px-6 font-semibold text-white transition duration-200 hover:opacity-90"
      >
        💬 Recibir mi resultado por WhatsApp
      </a>
      <p className="-mt-3 text-center text-xs text-texto-suave dark:text-texto-suave-dark">
        Se abre tu WhatsApp con el mensaje listo — el equipo de MineLink te
        responde con quién puede ayudarte.
      </p>
    </div>
  );
}
