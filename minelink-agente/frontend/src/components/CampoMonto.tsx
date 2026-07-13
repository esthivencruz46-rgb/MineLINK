import { useState } from "react";

type Moneda = "S/" | "USD";

interface Props {
  /** Texto ya compuesto, ej. "S/ 50000" o "USD 20000" (o vacío). */
  value: string;
  onChange: (valor: string) => void;
  /** Si viene fijada (porque el minero ya declaró la moneda en el
   * diagnóstico — ver Operacion.moneda_capital), no se muestra el
   * selector: evita que declare en una moneda y pida en otra. */
  monedaFija?: Moneda;
  /** Versión chica para vivir al costado de una respuesta (ver
   * ResumenInversionRespuestas): menos alto y la moneda sin su nombre
   * entre paréntesis. */
  compacto?: boolean;
}

function partir(value: string): { moneda: Moneda; cantidad: string } {
  if (value.startsWith("USD ")) return { moneda: "USD", cantidad: value.slice(4) };
  if (value.startsWith("S/ ")) return { moneda: "S/", cantidad: value.slice(3) };
  return { moneda: "S/", cantidad: "" };
}

/** Monto de inversión: selector de moneda (Soles / Dólares) + monto solo
 * numérico. Compone y guarda un único string ("S/ 50000") para no requerir
 * cambios de esquema — ya se mostraba como texto libre en todos lados. */
export function CampoMonto({ value, onChange, monedaFija, compacto }: Props) {
  const inicial = partir(value);
  const [moneda, setMoneda] = useState<Moneda>(monedaFija ?? inicial.moneda);

  const cantidad = partir(value).cantidad;
  const monedaActual = monedaFija ?? moneda;
  const altura = compacto ? "min-h-[36px]" : "min-h-[44px]";

  function actualizar(nuevaMoneda: Moneda, nuevaCantidadCruda: string) {
    setMoneda(nuevaMoneda);
    // Se guarda ya con separador de miles (250000 → 250,000) para que se
    // vea bien en todos lados donde se muestra este texto tal cual. Se
    // limpia primero por si nuevaCantidadCruda ya venía formateada (ej. al
    // cambiar de moneda se reenvía el valor actual, que puede traer comas).
    const digitos = nuevaCantidadCruda.replace(/\D/g, "");
    const formateada = digitos ? Number(digitos).toLocaleString("es-PE") : "";
    onChange(formateada ? `${nuevaMoneda} ${formateada}` : "");
  }

  return (
    <div
      className={`flex ${altura} w-full items-stretch overflow-hidden rounded-lg border border-black/10 dark:border-white/10 ${
        compacto ? "text-sm" : ""
      }`}
    >
      {monedaFija ? (
        <span className="flex items-center border-r border-black/10 bg-black/5 px-2 font-medium text-texto-suave dark:border-white/10 dark:bg-white/5 dark:text-texto-suave-dark">
          {compacto ? monedaFija : monedaFija === "S/" ? "S/ (soles)" : "USD (dólares)"}
        </span>
      ) : (
        <select
          value={monedaActual}
          onChange={(e) => actualizar(e.target.value as Moneda, cantidad)}
          className="border-r border-black/10 bg-black/5 px-2 font-medium text-texto-suave outline-none dark:border-white/10 dark:bg-white/5 dark:text-texto-suave-dark"
        >
          <option value="S/">{compacto ? "S/" : "S/ (soles)"}</option>
          <option value="USD">{compacto ? "USD" : "USD (dólares)"}</option>
        </select>
      )}
      <input
        type="text"
        inputMode="numeric"
        className="w-full bg-transparent px-3 outline-none"
        placeholder="Ej. 50000"
        value={cantidad}
        onChange={(e) => actualizar(monedaActual, e.target.value.replace(/\D/g, ""))}
      />
    </div>
  );
}
