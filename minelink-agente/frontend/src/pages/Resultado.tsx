import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { AlertTriangle, PartyPopper, UserPlus } from "lucide-react";
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
      {guardado.estadoWizard && (
        <button
          onClick={() => navigate("/diagnostico", { state: { volver: true } })}
          className="self-start text-sm text-texto-suave underline dark:text-texto-suave-dark"
        >
          ← Volver a la última pregunta
        </button>
      )}

      {/* Encabezado de resultado: antes era un <h1> genérico igual al de
          cualquier pantalla del wizard — ahora marca claramente que el
          diagnóstico TERMINÓ y entrega algo concreto (julio 2026). */}
      <div className="text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-acento/15 text-acento">
          <PartyPopper size={22} strokeWidth={2} aria-hidden />
        </span>
        <h1 className="mt-3 text-xl font-bold">Este es tu diagnóstico</h1>
        <p className="mt-1 text-sm text-texto-suave dark:text-texto-suave-dark">
          Basado en lo que nos contaste, así está tu situación hoy.
        </p>
        <span className="mt-3 inline-block rounded-full bg-acento/15 px-4 py-1 text-sm font-semibold text-acento">
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

      <SalidasList salidas={respuesta.salidas} onBuscarAyuda={() => navigate("/empresas")} />

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
            brechasEnProceso={respuesta.brechas_en_proceso}
            dimensiones={{}}
            onBuscarAyuda={() => navigate("/empresas")}
          />
        </div>
      )}

      {/* Registro: la caja gris de antes competía visualmente con todo lo
          demás; ahora es la tarjeta con más peso de la página —
          intencional, es la acción que más nos importa que tome. */}
      <div className="rounded-xl border-2 border-acento bg-acento/5 p-5 text-center dark:bg-acento/10">
        <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-acento/15 text-acento">
          <UserPlus size={20} strokeWidth={2} aria-hidden />
        </span>
        <p className="mt-3 text-sm font-medium text-texto-suave dark:text-texto-suave-dark">
          {respuesta.perfil === "A" || respuesta.perfil === "A_avanzado"
            ? "Guarda tu avance con una cuenta: cuando tengas tu concesión, ya estarás dentro."
            : "Guarda este diagnóstico y desbloquea tu cuenta: sube tus respaldos, resuelve tus brechas y conecta con inversionistas."}
        </p>
        <button
          onClick={() => navigate("/registro")}
          className="mt-4 min-h-[44px] w-full rounded-lg bg-acento px-6 py-3 font-semibold text-white transition hover:opacity-90"
        >
          Registrarme gratis
        </button>
      </div>
    </div>
  );
}
