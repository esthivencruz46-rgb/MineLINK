import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { DimensionBars } from "../components/DimensionBars";
import { ListaBrechas } from "../components/ListaBrechas";
import { ScoreBadge } from "../components/ScoreBadge";
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
    </div>
  );
}
