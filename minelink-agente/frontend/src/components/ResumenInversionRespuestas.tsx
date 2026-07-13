import { useEffect, useRef, useState } from "react";
import { useMineroAuth } from "../context/MineroAuthContext";
import { CampoMonto } from "./CampoMonto";
import { POR_ID_INV, type RespuestasInversion } from "../data/preguntasInversion";
import { formatearMonto } from "../utils/formato";
import type { MineroPerfil } from "../types/minero";

function etiquetaRespuesta(id: string, valor: string): string {
  return POR_ID_INV[id]?.opciones?.find((o) => o.valor === valor)?.etiqueta ?? valor;
}

/** Si ya declaró la moneda en el diagnóstico, se fija acá — no puede
 * declarar en dólares y luego pedir en soles (o viceversa). */
function monedaFijaDe(perfil: MineroPerfil): "S/" | "USD" | undefined {
  if (perfil.moneda_capital === "soles") return "S/";
  if (perfil.moneda_capital === "dolares") return "USD";
  return undefined;
}

interface Props {
  perfil: MineroPerfil;
  onGuardado: (perfil: MineroPerfil) => void;
  /** Respuestas que YA tienen su propio slot de foto en "Respalda tu
   *  inversión" (ver MineroPerfil.respaldos_declarados_inversion) — se
   *  excluyen de esta lista para no mostrarlas dos veces: quedan junto al
   *  slot de subida, con su "Marcaste: X" ahí en vez de aquí. */
  declarados: { pregunta_id: string; valor: string }[];
}

/** Muestra lo que el minero respondió en el Módulo INV (salvo lo que ya se
 *  muestra junto al slot de subida correspondiente, para no repetir) y
 *  deja precisar el monto EXACTO de capital que busca — ya declaró un
 *  rango en INV_0_1, esto es solo para afinarlo si lo tiene claro. */
export function ResumenInversionRespuestas({ perfil, onGuardado, declarados }: Props) {
  const { authFetch } = useMineroAuth();
  const [respuestas, setRespuestas] = useState<RespuestasInversion | null>(null);
  const [capitalBuscado, setCapitalBuscado] = useState(perfil.capital_buscado ?? "");
  const [guardando, setGuardando] = useState(false);
  const [guardadoOk, setGuardadoOk] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    authFetch("/mineros/inversion")
      .then((r) => (r.ok ? r.json() : null))
      .then((inv) => setRespuestas(inv?.respuestas ?? null))
      .catch(() => {});
  }, [authFetch]);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  async function guardarCapital(valor: string): Promise<void> {
    setGuardando(true);
    setGuardadoOk(false);
    try {
      const resp = await authFetch("/mineros/perfil-inversion", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ capital_buscado: valor.trim() || null }),
      });
      if (resp.ok) {
        onGuardado(await resp.json());
        setGuardadoOk(true);
      }
    } finally {
      setGuardando(false);
    }
  }

  function onCambiarCapital(valor: string) {
    setCapitalBuscado(valor);
    setGuardadoOk(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => guardarCapital(valor), 800);
  }

  const cubiertos = new Set(declarados.map((d) => `${d.pregunta_id}:${d.valor}`));

  const entradas = Object.entries(respuestas ?? {})
    .map(([id, valor]): [string, string | string[]] => {
      if (Array.isArray(valor)) {
        return [id, valor.filter((v) => !cubiertos.has(`${id}:${v}`))];
      }
      return [id, valor];
    })
    .filter(([id, valor]) => {
      if (Array.isArray(valor)) return valor.length > 0;
      return !cubiertos.has(`${id}:${valor}`);
    });

  return (
    <div className="rounded-lg bg-tarjeta p-5 dark:bg-tarjeta-dark">
      <h2 className="font-semibold">Tu perfil de inversión</h2>

      <div className="mt-3">
        <label className="mb-1 block text-sm font-medium">¿Cuánto capital buscas? (monto exacto)</label>
        {perfil.moneda_capital === "no_se" && (
          <p className="mb-1 text-xs text-texto-suave dark:text-texto-suave-dark">
            En tu diagnóstico dijiste que aún no sabes cuánto capital necesitas — puedes dejarlo
            así, o precisar un monto cuando lo tengas más claro.
          </p>
        )}
        {perfil.monto_requerido && perfil.moneda_capital !== "no_se" && (
          <p className="mb-1 text-xs text-texto-suave dark:text-texto-suave-dark">
            Recordatorio: en tu diagnóstico marcaste{" "}
            <span className="font-medium">{formatearMonto(perfil.monto_requerido)}</span>. Aquí
            puedes precisar el monto exacto.
          </p>
        )}
        <CampoMonto
          value={capitalBuscado}
          onChange={onCambiarCapital}
          monedaFija={monedaFijaDe(perfil)}
        />
        {guardando && (
          <p className="mt-1 text-xs text-texto-suave dark:text-texto-suave-dark">Guardando...</p>
        )}
        {!guardando && guardadoOk && <p className="mt-1 text-xs text-emerald-500">Guardado.</p>}
      </div>

      {entradas.length > 0 && (
        <dl className="mt-4 flex flex-col gap-2 border-t border-black/10 pt-4 dark:border-white/10">
          {entradas.map(([id, valor]) => {
            const pregunta = POR_ID_INV[id];
            if (!pregunta) return null;
            const texto = Array.isArray(valor)
              ? valor.map((v) => etiquetaRespuesta(id, v)).join(", ")
              : pregunta.tipo === "texto_corto"
                ? valor
                : etiquetaRespuesta(id, valor);
            return (
              <div key={id} className="text-sm">
                <dt className="text-texto-suave dark:text-texto-suave-dark">{pregunta.texto}</dt>
                <dd className="font-semibold">{texto}</dd>
              </div>
            );
          })}
        </dl>
      )}
    </div>
  );
}
