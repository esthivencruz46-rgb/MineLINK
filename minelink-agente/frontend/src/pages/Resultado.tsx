import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { ListaBrechas } from "../components/ListaBrechas";
import { SalidasList } from "../components/SalidasList";
import { SemaforoCard } from "../components/SemaforoCard";
import { UrgenciaYReloj } from "../components/UrgenciaYReloj";
import { guardarDiagnostico, leerDiagnostico } from "../services/storage";
import { semaforoDesdeColor } from "../utils/semaforo";
import { NOMBRE_PERFIL } from "../data/preguntas";

export function Resultado() {
  const navigate = useNavigate();
  const guardado = leerDiagnostico();
  const [codigoReinfo, setCodigoReinfo] = useState(guardado?.codigoReinfo ?? "");

  if (!guardado) {
    return <Navigate to="/" replace />;
  }

  const { respuesta } = guardado;
  const semLegal = semaforoDesdeColor(respuesta.semaforo_legal);
  const semTecnico = semaforoDesdeColor(respuesta.semaforo_tecnico);
  // Perfil A/A_avanzado todavía no tiene concesión — no tiene sentido
  // decirle "no te falta ningún estudio, vas muy bien": no hay nada que
  // medir todavía. Esa sección solo aplica desde que ya tiene concesión.
  const muestraEstudios = respuesta.perfil !== "A" && respuesta.perfil !== "A_avanzado";

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-8">
      <h1 className="text-center text-lg font-bold">Tu diagnóstico de formalización</h1>

      {guardado.estadoWizard && (
        <button
          onClick={() => navigate("/diagnostico", { state: { volver: true } })}
          className="self-start text-sm text-texto-suave underline dark:text-texto-suave-dark"
        >
          ← Volver a la última pregunta
        </button>
      )}

      {/* Perfil */}
      <div className="text-center">
        <span className="rounded-full bg-acento/15 px-4 py-1 text-sm font-semibold text-acento">
          {NOMBRE_PERFIL[respuesta.perfil] ?? respuesta.perfil}
        </span>
        {respuesta.clasificacion && (
          <p className="mt-2 text-sm text-texto-suave dark:text-texto-suave-dark">
            Clasificación:{" "}
            <span className="font-semibold uppercase">{respuesta.clasificacion}</span>
          </p>
        )}
      </div>

      {/* Semáforos: Track Técnico está en pausa (no se pregunta), así que
          Track Legal ocupa todo el ancho en vez de verse apachurrado en
          media grilla. Si algún día Track Técnico vuelve, aquí se parte
          en dos columnas otra vez. */}
      <div className={respuesta.semaforo_tecnico ? "grid grid-cols-2 gap-4" : ""}>
        <SemaforoCard
          titulo="Track Legal"
          semaforo={semLegal}
          grande={!respuesta.semaforo_tecnico}
        />
        {respuesta.semaforo_tecnico && (
          <SemaforoCard
            titulo="Track Técnico"
            semaforo={semTecnico}
            subtitulo={`Índice de madurez: ${respuesta.indice_madurez ?? 0}/5`}
          />
        )}
      </div>

      {/* Bloqueantes */}
      {respuesta.etiquetas_bloqueantes.length > 0 && (
        <div className="rounded-lg bg-red-900/10 p-4">
          <h3 className="mb-2 flex items-center gap-2 font-semibold text-red-600">
            <AlertTriangle size={18} /> Primero resolvamos esto
          </h3>
          <ul className="flex flex-col gap-1 text-sm">
            {respuesta.etiquetas_bloqueantes.map((b, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                {b}
              </li>
            ))}
          </ul>
        </div>
      )}

      <UrgenciaYReloj urgencia={respuesta.urgencia} relojProduccion={respuesta.reloj_produccion} />

      <SalidasList salidas={respuesta.salidas} />

      {/* Código REINFO */}
      <div>
        <label className="mb-1 block text-sm font-medium">
          Código REINFO (opcional)
        </label>
        <input
          className="min-h-[44px] w-full rounded-lg border border-black/10 bg-transparent px-3 dark:border-white/10"
          placeholder="Tu código REINFO, si lo tienes"
          value={codigoReinfo}
          onChange={(e) => {
            setCodigoReinfo(e.target.value);
            guardarDiagnostico({ ...guardado, codigoReinfo: e.target.value });
          }}
        />
      </div>

      {/* Brechas */}
      {muestraEstudios && (
        <div>
          <h2 className="mb-3 text-lg font-bold">Estudios que te faltan</h2>
          <ListaBrechas
            brechas={respuesta.brechas}
            dimensiones={{}}
            onBuscarAyuda={() => navigate("/empresas")}
          />
        </div>
      )}

      {/* Registro */}
      <div className="rounded-lg bg-acento/5 p-4 text-center dark:bg-acento/10">
        <p className="text-sm text-texto-suave dark:text-texto-suave-dark">
          {respuesta.perfil === "A" || respuesta.perfil === "A_avanzado"
            ? "Guarda tu avance con una cuenta: cuando tengas tu concesión, ya estarás dentro."
            : "¿Quieres guardar tu diagnóstico y acceder a más opciones?"}
        </p>
        <button
          onClick={() => navigate("/registro")}
          className="mt-3 min-h-[44px] rounded-lg bg-acento px-6 py-3 font-semibold text-white"
        >
          Registrarme
        </button>
      </div>
    </div>
  );
}
