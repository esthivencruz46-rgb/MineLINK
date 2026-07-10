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
}

function partir(value: string): { moneda: Moneda; cantidad: string } {
  if (value.startsWith("USD ")) return { moneda: "USD", cantidad: value.slice(4) };
  if (value.startsWith("S/ ")) return { moneda: "S/", cantidad: value.slice(3) };
  return { moneda: "S/", cantidad: "" };
}

/** Monto de inversión: selector de moneda (Soles / Dólares) + monto solo
 * numérico. Compone y guarda un único string ("S/ 50000") para no requerir
 * cambios de esquema — ya se mostraba como texto libre en todos lados. */
export function CampoMonto({ value, onChange, monedaFija }: Props) {
  const inicial = partir(value);
  const [moneda, setMoneda] = useState<Moneda>(monedaFija ?? inicial.moneda);

  const cantidad = partir(value).cantidad;
  const monedaActual = monedaFija ?? moneda;

  function actualizar(nuevaMoneda: Moneda, nuevaCantidad: string) {
    setMoneda(nuevaMoneda);
    onChange(nuevaCantidad ? `${nuevaMoneda} ${nuevaCantidad}` : "");
  }

  return (
    <div className="flex min-h-[44px] w-full items-stretch overflow-hidden rounded-lg border border-black/10 dark:border-white/10">
      {monedaFija ? (
        <span className="flex items-center border-r border-black/10 bg-black/5 px-2 font-medium text-texto-suave dark:border-white/10 dark:bg-white/5 dark:text-texto-suave-dark">
          {monedaFija === "S/" ? "S/ (soles)" : "USD (dólares)"}
        </span>
      ) : (
        <select
          value={monedaActual}
          onChange={(e) => actualizar(e.target.value as Moneda, cantidad)}
          className="border-r border-black/10 bg-black/5 px-2 font-medium text-texto-suave outline-none dark:border-white/10 dark:bg-white/5 dark:text-texto-suave-dark"
        >
          <option value="S/">S/ (soles)</option>
          <option value="USD">USD (dólares)</option>
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
