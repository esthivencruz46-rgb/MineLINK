import { useState } from "react";
import type { PreguntaPerfil } from "../data/preguntasPerfil";

interface Props {
  pregunta: PreguntaPerfil;
  valorActual: unknown;
  onResponder: (valor: unknown) => void;
  onVolver?: () => void;
}

const VALOR_OTRO = "__otro__";

/** Una pantalla por pregunta de perfil, soporta los 6 tipos (opciones,
 * opciones_multi, texto, numero, numero_con_unidad, booleano) — mismo
 * estilo de botones que ya usa el resto del cuestionario. */
export function PreguntaPerfilScreen({ pregunta, valorActual, onResponder, onVolver }: Props) {
  const [texto, setTexto] = useState(typeof valorActual === "string" ? valorActual : "");
  const [seleccion, setSeleccion] = useState<string[]>(
    Array.isArray(valorActual) ? (valorActual as string[]) : []
  );
  const [mostrarOtro, setMostrarOtro] = useState(false);
  const [textoOtro, setTextoOtro] = useState("");
  const [numeroValor, setNumeroValor] = useState("");
  const [unidad, setUnidad] = useState(pregunta.opciones?.[0]?.valor ?? "");
  const [mostrarOtraUnidad, setMostrarOtraUnidad] = useState(false);
  const [otraUnidad, setOtraUnidad] = useState("");

  function elegirOpcion(valor: string) {
    if (valor === VALOR_OTRO) {
      setMostrarOtro(true);
      return;
    }
    onResponder(valor);
  }

  function confirmarOtro() {
    if (!textoOtro.trim()) return;
    onResponder(textoOtro.trim());
  }

  function alternarMulti(valor: string) {
    setSeleccion((actual) =>
      actual.includes(valor) ? actual.filter((v) => v !== valor) : [...actual, valor]
    );
  }

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center gap-6 px-4">
      {onVolver && (
        <button
          onClick={onVolver}
          className="self-start text-sm text-texto-suave underline dark:text-texto-suave-dark"
        >
          ← Volver
        </button>
      )}
      <p className="text-xs text-texto-suave dark:text-texto-suave-dark">
        Este dato no afecta tu puntaje, ayuda a describir mejor tu proyecto.
      </p>
      <h2 className="text-xl font-semibold">{pregunta.texto}</h2>

      {pregunta.tipo === "booleano" && (
        <div className="flex flex-col gap-3">
          <button
            onClick={() => onResponder(true)}
            className="min-h-[44px] rounded-lg bg-acento px-6 py-3 font-semibold text-white"
          >
            Sí
          </button>
          <button
            onClick={() => onResponder(false)}
            className="min-h-[44px] rounded-lg bg-secundario px-6 py-3 font-semibold text-white"
          >
            No
          </button>
        </div>
      )}

      {pregunta.tipo === "opciones" && !mostrarOtro && (
        <div className="flex flex-col gap-2">
          {pregunta.opciones?.map((o) => (
            <button
              key={o.valor}
              onClick={() => elegirOpcion(o.valor)}
              className="min-h-[44px] rounded-lg border border-black/10 px-4 py-2 text-left font-medium dark:border-white/10"
            >
              {o.etiqueta}
            </button>
          ))}
          {pregunta.permiteOtro && (
            <button
              onClick={() => elegirOpcion(VALOR_OTRO)}
              className="min-h-[44px] rounded-lg border border-dashed border-black/20 px-4 py-2 text-left font-medium dark:border-white/20"
            >
              Otro
            </button>
          )}
        </div>
      )}

      {pregunta.tipo === "opciones" && mostrarOtro && (
        <div className="flex flex-col gap-3">
          <input
            autoFocus
            className="min-h-[44px] w-full rounded-lg border border-black/10 bg-transparent px-3 dark:border-white/10"
            placeholder="Especifica"
            value={textoOtro}
            onChange={(e) => setTextoOtro(e.target.value)}
          />
          <button
            disabled={!textoOtro.trim()}
            onClick={confirmarOtro}
            className="min-h-[44px] rounded-lg bg-acento px-6 py-3 font-semibold text-white disabled:opacity-50"
          >
            Continuar
          </button>
        </div>
      )}

      {pregunta.tipo === "opciones_multi" && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            {pregunta.opciones?.map((o) => (
              <label
                key={o.valor}
                className="flex min-h-[44px] items-center gap-2 rounded-lg border border-black/10 px-4 py-2 dark:border-white/10"
              >
                <input
                  type="checkbox"
                  checked={seleccion.includes(o.valor)}
                  onChange={() => alternarMulti(o.valor)}
                />
                {o.etiqueta}
              </label>
            ))}
          </div>
          <button
            disabled={seleccion.length === 0}
            onClick={() => onResponder(seleccion)}
            className="min-h-[44px] rounded-lg bg-acento px-6 py-3 font-semibold text-white disabled:opacity-50"
          >
            Continuar
          </button>
        </div>
      )}

      {pregunta.tipo === "numero_con_unidad" && (
        <div className="flex flex-col gap-3">
          <input
            type="number"
            inputMode="decimal"
            className="min-h-[44px] w-full rounded-lg border border-black/10 bg-transparent px-3 dark:border-white/10"
            placeholder={pregunta.placeholder}
            value={numeroValor}
            onChange={(e) => setNumeroValor(e.target.value)}
            autoFocus
          />
          {!mostrarOtraUnidad ? (
            <select
              className="min-h-[44px] w-full rounded-lg border border-black/10 bg-transparent px-3 dark:border-white/10"
              value={unidad}
              onChange={(e) => {
                if (e.target.value === VALOR_OTRO) {
                  setMostrarOtraUnidad(true);
                } else {
                  setUnidad(e.target.value);
                }
              }}
            >
              {pregunta.opciones?.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.etiqueta}
                </option>
              ))}
              {pregunta.permiteOtro && <option value={VALOR_OTRO}>Otra unidad</option>}
            </select>
          ) : (
            <input
              className="min-h-[44px] w-full rounded-lg border border-black/10 bg-transparent px-3 dark:border-white/10"
              placeholder="Especifica la unidad"
              value={otraUnidad}
              onChange={(e) => setOtraUnidad(e.target.value)}
            />
          )}
          <button
            disabled={!numeroValor.trim() || (mostrarOtraUnidad && !otraUnidad.trim())}
            onClick={() =>
              onResponder(`${numeroValor.trim()} ${mostrarOtraUnidad ? otraUnidad.trim() : unidad}`)
            }
            className="min-h-[44px] rounded-lg bg-acento px-6 py-3 font-semibold text-white disabled:opacity-50"
          >
            Continuar
          </button>
          <button
            onClick={() => onResponder(undefined)}
            className="min-h-[44px] rounded-lg border border-black/10 px-6 py-3 font-semibold dark:border-white/10"
          >
            Prefiero no decirlo
          </button>
        </div>
      )}

      {(pregunta.tipo === "texto" || pregunta.tipo === "numero") && (
        <div className="flex flex-col gap-3">
          <input
            type={pregunta.tipo === "numero" ? "number" : "text"}
            inputMode={pregunta.tipo === "numero" ? "decimal" : undefined}
            className="min-h-[44px] w-full rounded-lg border border-black/10 bg-transparent px-3 dark:border-white/10"
            placeholder={pregunta.placeholder}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          <button
            onClick={() => onResponder(texto.trim() || undefined)}
            className="min-h-[44px] rounded-lg bg-acento px-6 py-3 font-semibold text-white"
          >
            Continuar
          </button>
          <button
            onClick={() => onResponder(undefined)}
            className="min-h-[44px] rounded-lg border border-black/10 px-6 py-3 font-semibold dark:border-white/10"
          >
            Prefiero no decirlo
          </button>
        </div>
      )}
    </div>
  );
}
