import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Clock, AlertTriangle, ChevronRight } from "lucide-react";
import { ListaBrechas } from "../components/ListaBrechas";
import { SemaforoCard } from "../components/SemaforoCard";
import { guardarDiagnostico, leerDiagnostico } from "../services/storage";
import { semaforoDesdeColor } from "../utils/semaforo";
import { NOMBRE_PERFIL } from "../data/preguntas";

const TEXTO_SALIDA: Record<string, { titulo: string; descripcion: string }> = {
  area_no_concesionable: {
    titulo: "Tu área no se puede concesionar",
    descripcion:
      "El área que elegiste tiene una restricción que impide obtener una concesión minera. Revisa otras zonas o busca asesoría.",
  },
  verificar_area: {
    titulo: "Verifica tu área antes de avanzar",
    descripcion:
      "Hay información pendiente sobre tu área (frontera, disponibilidad, etc.). Confirma que no tiene restricciones.",
  },
  checklist_petitorio: {
    titulo: "Arma tu petitorio",
    descripcion:
      "Tu área parece viable. El siguiente paso es juntar los documentos para el petitorio ante INGEMMET.",
  },
  ruta_inversionista: {
    titulo: "Busca un inversionista",
    descripcion:
      "Un inversionista puede financiar los trámites y estudios que necesitas para formalizarte.",
  },
  alerta_caducidad: {
    titulo: "⚠️ Riesgo de caducidad",
    descripcion:
      "Debes 2 o más años de vigencia. Si no regularizas, puedes perder tu concesión.",
  },
  alerta_produccion_minima: {
    titulo: "⚠️ Debes poner tu mina en producción",
    descripcion:
      "Tu plazo para cumplir con la producción mínima ya venció. Paga la penalidad y pon tu operación en marcha.",
  },
  checklist_permisos: {
    titulo: "Checklist de permisos para operar",
    descripcion:
      "Necesitas varios permisos antes de empezar a sacar mineral. Te mostramos cuáles.",
  },
  guia_cesion: {
    titulo: "Guía para ceder tu contrato",
    descripcion:
      "Si quieres ceder tu concesión a alguien más, aquí te explicamos los pasos.",
  },
  subsanar_suspension: {
    titulo: "Subsana la suspensión de tu REINFO",
    descripcion:
      "Tu REINFO está suspendido. Debes atender la observación para reactivarlo.",
  },
  ruta_critica_documentos: {
    titulo: "Ruta crítica de documentos",
    descripcion:
      "Tienes documentos pendientes que debes completar antes del 31/12/2026. Prioriza los más urgentes.",
  },
  asesoria_legal_titular: {
    titulo: "Busca asesoría legal",
    descripcion:
      "El titular de la concesión no coopera. Necesitas un abogado que te ayude a resolver la situación.",
  },
  alertas_cumplimiento: {
    titulo: "Atiende tus alertas de cumplimiento",
    descripcion:
      "Hay observaciones o multas pendientes en tu fiscalización. Subsana antes de seguir avanzando.",
  },
};

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

      {/* Urgencia REINFO (Perfil C) */}
      {respuesta.urgencia && (
        <div className="rounded-lg bg-amber-50 p-4 dark:bg-amber-900/20">
          <h3 className="mb-2 flex items-center gap-2 font-semibold">
            <Clock size={18} /> Reloj REINFO
          </h3>
          <p className="text-sm">
            Quedan <strong>{respuesta.urgencia.dias_restantes}</strong> días al
            31/12/2026. Tienes {respuesta.urgencia.docs_completados}/
            {respuesta.urgencia.docs_totales} documentos listos.
          </p>
          {respuesta.urgencia.alerta_roja && (
            <p className="mt-2 text-sm font-semibold text-red-600">
              ¡No alcanzas al ritmo actual! Necesitas{" "}
              {respuesta.urgencia.dias_necesarios} días y solo quedan{" "}
              {respuesta.urgencia.dias_restantes}.
            </p>
          )}
        </div>
      )}

      {/* Reloj de producción (Perfil B) */}
      {respuesta.reloj_produccion && (
        <div className="rounded-lg bg-amber-50 p-4 dark:bg-amber-900/20">
          <h3 className="mb-2 flex items-center gap-2 font-semibold">
            <Clock size={18} /> Reloj de producción mínima
          </h3>
          <p className="text-sm">
            Tu título tiene {respuesta.reloj_produccion.anios_titulo} años.{" "}
            {respuesta.reloj_produccion.vencido
              ? "El plazo ya venció — debes poner tu mina en producción o pagar la penalidad."
              : `Te quedan ${respuesta.reloj_produccion.anios_restantes} años para cumplir la producción mínima.`}
          </p>
        </div>
      )}

      {/* Salidas */}
      {respuesta.salidas.length > 0 && (
        <div>
          <h3 className="mb-3 text-lg font-bold">¿Qué sigue?</h3>
          <div className="flex flex-col gap-2">
            {respuesta.salidas.map((codigo) => {
              const info = TEXTO_SALIDA[codigo];
              return (
                <div
                  key={codigo}
                  className="flex items-center justify-between rounded-lg bg-tarjeta p-4 dark:bg-tarjeta-dark"
                >
                  <div>
                    <p className="font-semibold">{info?.titulo ?? codigo}</p>
                    {info?.descripcion && (
                      <p className="mt-1 text-sm text-texto-suave dark:text-texto-suave-dark">
                        {info.descripcion}
                      </p>
                    )}
                  </div>
                  <ChevronRight size={18} className="shrink-0 text-texto-suave" />
                </div>
              );
            })}
          </div>
        </div>
      )}

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
      <div>
        <h2 className="mb-3 text-lg font-bold">Estudios que te faltan</h2>
        <ListaBrechas
          brechas={respuesta.brechas}
          dimensiones={{}}
          onBuscarAyuda={() => navigate("/empresas")}
        />
      </div>

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
