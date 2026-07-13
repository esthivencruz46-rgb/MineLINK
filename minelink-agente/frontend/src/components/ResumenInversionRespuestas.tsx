import { useEffect, useRef, useState } from "react";
import { TrendingUp } from "lucide-react";
import { useMineroAuth } from "../context/MineroAuthContext";
import { CampoMonto } from "./CampoMonto";
import { POR_ID_INV, type RespuestasInversion } from "../data/preguntasInversion";
import type { MineroPerfil } from "../types/minero";

function etiquetaRespuesta(id: string, valor: string): string {
  return POR_ID_INV[id]?.opciones?.find((o) => o.valor === valor)?.etiqueta ?? valor;
}

// Respuestas que ya se muestran en "Lo que te falta" (como faltante con
// "¿Quién me ayuda?" o como "En proceso" con solo subir respaldo) — no se
// repiten aquí (espejo de _BRECHA_INV_POR_PREGUNTA y de los checklists
// "en_proceso" del backend).
const RESPUESTAS_NEGATIVAS: Record<string, string[]> = {
  INV_A1: ["ninguna"],
  INV_B1a: ["no_tengo", "en_proceso"],
  INV_B1b: ["no_tengo", "en_proceso"],
  INV_B1c: ["no_tengo", "en_proceso"],
  INV_C3: ["estimacion", "no_sabe"],
  INV_C4: ["estimacion", "no"],
  INV_D3a: ["no_tengo", "en_proceso"],
  INV_D3b: ["no_tengo", "en_proceso"],
  INV_D3c: ["no_tengo", "en_proceso"],
};

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
 *  muestra junto al slot de subida correspondiente, y salvo los "no
 *  tengo" que ya lista "Lo que te falta"). En la fila de INV_0_1
 *  ("¿Cuánto capital buscas?") el rango marcado lleva al costado un campo
 *  para precisar el monto EXACTO, que guarda solo al escribir. */
export function ResumenInversionRespuestas({ perfil, onGuardado, declarados }: Props) {
  const { authFetch } = useMineroAuth();
  const [respuestas, setRespuestas] = useState<RespuestasInversion | null>(null);
  const [capitalBuscado, setCapitalBuscado] = useState(perfil.capital_buscado ?? "");
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

  /** Guarda el monto exacto con una pausa corta — el endpoint es de
   *  actualización parcial, así que el campo viaja solo sin pisar nada. */
  function guardarCapital(valor: string) {
    setGuardadoOk(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const resp = await authFetch("/mineros/perfil-inversion", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ capital_buscado: valor.trim() || null }),
      });
      if (resp.ok) {
        onGuardado(await resp.json());
        setGuardadoOk(true);
      }
    }, 800);
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
      if (cubiertos.has(`${id}:${valor}`)) return false;
      // "No tengo X" ya aparece en "Lo que te falta" — no repetirlo aquí.
      if (RESPUESTAS_NEGATIVAS[id]?.includes(valor)) return false;
      return true;
    });

  return (
    <div className="rounded-lg bg-tarjeta p-5 dark:bg-tarjeta-dark">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-acento/15 text-acento">
            <TrendingUp size={15} strokeWidth={2.25} aria-hidden />
          </span>
          Tu perfil de inversión
        </h2>
        <span
          className={`text-xs font-semibold text-emerald-500 transition-opacity ${
            guardadoOk ? "opacity-100" : "opacity-0"
          }`}
        >
          Guardado ✓
        </span>
      </div>

      <dl className="mt-3 divide-y divide-black/5 dark:divide-white/5">
        {entradas.map(([id, valor]) => {
          const pregunta = POR_ID_INV[id];
          if (!pregunta) return null;
          const valores = Array.isArray(valor)
            ? valor.map((v) => etiquetaRespuesta(id, v))
            : [pregunta.tipo === "texto_corto" ? valor : etiquetaRespuesta(id, valor)];

          // INV_0_1: el rango marcado + campo de monto exacto, todo en la
          // misma fila que la pregunta (la pregunta se parte en varias
          // líneas si hace falta, la respuesta nunca baja).
          if (id === "INV_0_1") {
            return (
              <div
                key={id}
                className="flex items-center justify-between gap-3 py-2.5 text-sm first:pt-0 last:pb-0"
              >
                <dt className="min-w-0 flex-1 text-texto-suave dark:text-texto-suave-dark">
                  {pregunta.texto}
                </dt>
                <dd className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="rounded-full bg-acento/10 px-2.5 py-0.5 text-xs font-semibold text-acento">
                    {valores[0]}
                  </span>
                  <div className="w-48">
                    <CampoMonto
                      compacto
                      value={capitalBuscado}
                      onChange={(v) => {
                        setCapitalBuscado(v);
                        guardarCapital(v);
                      }}
                      monedaFija={monedaFijaDe(perfil)}
                    />
                  </div>
                </dd>
              </div>
            );
          }

          return (
            <div
              key={id}
              className="flex items-center justify-between gap-3 py-2.5 text-sm first:pt-0 last:pb-0"
            >
              <dt className="min-w-0 flex-1 text-texto-suave dark:text-texto-suave-dark">
                {pregunta.texto}
              </dt>
              <dd className="flex max-w-[55%] shrink-0 flex-wrap items-center justify-end gap-1.5">
                {valores.map((v) => (
                  <span
                    key={v}
                    className="rounded-full bg-acento/10 px-2.5 py-0.5 text-xs font-semibold text-acento"
                  >
                    {v}
                  </span>
                ))}
              </dd>
            </div>
          );
        })}

      </dl>
    </div>
  );
}
