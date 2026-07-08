import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { DimensionBars } from "../components/DimensionBars";
import { ListaBrechas } from "../components/ListaBrechas";
import { ScoreBadge } from "../components/ScoreBadge";
import { guardarDiagnostico, leerDiagnostico } from "../services/storage";
import type { NombreDimension } from "../types/diagnostico";

// Ruta 2 (concesionario) reutiliza los mismos ids "legal"/"tecnico" del
// motor de score, pero ahí significan algo distinto (no hay operación
// todavía) — se etiquetan y encabezan aparte para no confundir con el
// MineScore de una mina en producción.
const ETIQUETAS_CONCESIONARIO: Partial<Record<NombreDimension, string>> = {
  legal: "Situación legal y de la concesión",
  tecnico: "Información técnica y geológica",
};

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
  const esConcesionario = respuesta.situacion === "concesionario";

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-8">
      <h1 className="text-center text-lg font-bold">
        {esConcesionario
          ? "Score de preparación de tu concesión"
          : "Tu MineScore de formalización"}
      </h1>
      {esConcesionario && (
        <p className="-mt-4 text-center text-sm text-texto-suave dark:text-texto-suave-dark">
          Mide qué tan lista está tu concesión para empezar a operar y
          formalizarse — es distinto del MineScore de una mina que ya
          produce, que además evalúa producción y seguridad.
        </p>
      )}

      <ScoreBadge scoreTotal={respuesta.score_total} bloqueado={respuesta.bloqueado} />

      <DimensionBars
        dimensiones={respuesta.dimensiones}
        etiquetas={esConcesionario ? ETIQUETAS_CONCESIONARIO : undefined}
      />

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
    </div>
  );
}
