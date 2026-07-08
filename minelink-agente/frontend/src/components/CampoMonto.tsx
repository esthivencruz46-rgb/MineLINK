import { useState } from "react";

type Moneda = "S/" | "USD";

interface Props {
  /** Texto ya compuesto, ej. "S/ 50000" o "USD 20000" (o vacío). */
  value: string;
  onChange: (valor: string) => void;
}

function partir(value: string): { moneda: Moneda; cantidad: string } {
  if (value.startsWith("USD ")) return { moneda: "USD", cantidad: value.slice(4) };
  if (value.startsWith("S/ ")) return { moneda: "S/", cantidad: value.slice(3) };
  return { moneda: "S/", cantidad: "" };
}

/** Monto de inversión: selector de moneda (Soles / Dólares) + monto solo
 * numérico. Compone y guarda un único string ("S/ 50000") para no requerir
 * cambios de esquema — ya se mostraba como texto libre en todos lados. */
export function CampoMonto({ value, onChange }: Props) {
  const inicial = partir(value);
  const [moneda, setMoneda] = useState<Moneda>(inicial.moneda);

  const cantidad = partir(value).cantidad;

  function actualizar(nuevaMoneda: Moneda, nuevaCantidad: string) {
    setMoneda(nuevaMoneda);
    onChange(nuevaCantidad ? `${nuevaMoneda} ${nuevaCantidad}` : "");
  }

  return (
    <div className="flex min-h-[44px] w-full items-stretch overflow-hidden rounded-lg border border-black/10 dark:border-white/10">
      <select
        value={moneda}
        onChange={(e) => actualizar(e.target.value as Moneda, cantidad)}
        className="border-r border-black/10 bg-black/5 px-2 font-medium text-texto-suave outline-none dark:border-white/10 dark:bg-white/5 dark:text-texto-suave-dark"
      >
        <option value="S/">S/ (soles)</option>
        <option value="USD">USD (dólares)</option>
      </select>
      <input
        type="text"
        inputMode="numeric"
        className="w-full bg-transparent px-3 outline-none"
        placeholder="Ej. 50000"
        value={cantidad}
        onChange={(e) => actualizar(moneda, e.target.value.replace(/\D/g, ""))}
      />
    </div>
  );
}
