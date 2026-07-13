import { useEffect, useRef, useState } from "react";
import { useMineroAuth } from "../context/MineroAuthContext";
import { CampoMonto } from "./CampoMonto";
import { CampoProduccion } from "./CampoProduccion";
import { POR_ID_INV, type RespuestasInversion } from "../data/preguntasInversion";
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
 *  muestra junto al slot de subida correspondiente, para no repetir). En
 *  la fila de INV_0_1 ("¿Cuánto capital buscas?") el rango marcado lleva
 *  al costado un campo para precisar el monto EXACTO; al final hay una
 *  fila más para producción/reservas (solo Ruta 1 — quien todavía no
 *  opera no tiene nada que producir). Ambos guardan solos al escribir. */
export function ResumenInversionRespuestas({ perfil, onGuardado, declarados }: Props) {
  const { authFetch } = useMineroAuth();
  const [respuestas, setRespuestas] = useState<RespuestasInversion | null>(null);
  const [capitalBuscado, setCapitalBuscado] = useState(perfil.capital_buscado ?? "");
  const [capacidadProduccion, setCapacidadProduccion] = useState(
    perfil.capacidad_produccion ?? ""
  );
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

  /** Guarda un campo del perfil de inversión con una pausa corta — el
   *  endpoint es de actualización parcial, así que cada campo viaja solo
   *  sin pisar a los demás. */
  function guardarCampo(campo: "capital_buscado" | "capacidad_produccion", valor: string) {
    setGuardadoOk(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const resp = await authFetch("/mineros/perfil-inversion", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [campo]: valor.trim() || null }),
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
      return !cubiertos.has(`${id}:${valor}`);
    });

  const esRuta1 = perfil.situacion !== "concesionario";

  return (
    <div className="rounded-lg bg-tarjeta p-5 dark:bg-tarjeta-dark">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Tu perfil de inversión</h2>
        {guardadoOk && <span className="text-xs text-emerald-500">Guardado ✓</span>}
      </div>

      <dl className="mt-3 flex flex-col gap-3">
        {entradas.map(([id, valor]) => {
          const pregunta = POR_ID_INV[id];
          if (!pregunta) return null;
          const texto = Array.isArray(valor)
            ? valor.map((v) => etiquetaRespuesta(id, v)).join(", ")
            : pregunta.tipo === "texto_corto"
              ? valor
              : etiquetaRespuesta(id, valor);

          // INV_0_1: el rango marcado + campo de monto exacto al costado.
          if (id === "INV_0_1") {
            return (
              <div key={id} className="text-sm">
                <dt className="text-texto-suave dark:text-texto-suave-dark">{pregunta.texto}</dt>
                <dd className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{texto}</span>
                  <span className="text-xs text-texto-suave dark:text-texto-suave-dark">
                    Monto exacto:
                  </span>
                  <div className="w-56">
                    <CampoMonto
                      value={capitalBuscado}
                      onChange={(v) => {
                        setCapitalBuscado(v);
                        guardarCampo("capital_buscado", v);
                      }}
                      monedaFija={monedaFijaDe(perfil)}
                    />
                  </div>
                </dd>
              </div>
            );
          }

          return (
            <div key={id} className="text-sm">
              <dt className="text-texto-suave dark:text-texto-suave-dark">{pregunta.texto}</dt>
              <dd className="font-semibold">{texto}</dd>
            </div>
          );
        })}

        {esRuta1 && (
          <div className="text-sm">
            <dt className="text-texto-suave dark:text-texto-suave-dark">
              ¿Cuánto produces y cuánto mineral te queda (reservas)?
            </dt>
            <dd className="mt-1">
              <CampoProduccion
                value={capacidadProduccion}
                onChange={(v) => {
                  setCapacidadProduccion(v);
                  guardarCampo("capacidad_produccion", v);
                }}
              />
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}
