import { useState } from "react";
import { OPCIONES_UNIDAD_PRODUCCION } from "../data/preguntasPerfil";

interface Props {
  /** Texto ya compuesto, ej. "50 toneladas de mineral/mes. Reservas
   * estimadas: Entre 3 y 5 años." (o vacío). */
  value: string;
  onChange: (valor: string) => void;
}

const OPCIONES_RESERVAS = [
  "Menos de 1 año",
  "Entre 1 y 3 años",
  "Entre 3 y 5 años",
  "Más de 5 años",
  "Aún no lo sé",
];

function parsear(value: string): { numero: string; unidad: string; reservas: string } {
  const match = value.match(/^(\d+(?:\.\d+)?)\s+(.+?)\/mes\.?\s*(?:Reservas estimadas:\s*(.+))?$/i);
  if (!match) return { numero: "", unidad: "", reservas: "" };
  return { numero: match[1], unidad: match[2], reservas: match[3] ?? "" };
}

function componer(numero: string, unidad: string, reservas: string): string {
  const partes: string[] = [];
  if (numero.trim() && unidad) partes.push(`${numero.trim()} ${unidad}/mes`);
  if (reservas) partes.push(`Reservas estimadas: ${reservas}`);
  return partes.join(". ");
}

/** "¿Cuánto produces y cuánto mineral te queda?": número + unidad (misma
 * lista que usa el diagnóstico) + reservas por rango, en vez de texto
 * libre — evita errores de redacción en la descripción pública. */
export function CampoProduccion({ value, onChange }: Props) {
  const inicial = parsear(value);
  const [numero, setNumero] = useState(inicial.numero);
  const [unidad, setUnidad] = useState(inicial.unidad || OPCIONES_UNIDAD_PRODUCCION[0].valor);
  const [reservas, setReservas] = useState(inicial.reservas);

  function actualizar(n: string, u: string, r: string) {
    setNumero(n);
    setUnidad(u);
    setReservas(r);
    onChange(componer(n, u, r));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          type="text"
          inputMode="decimal"
          className="min-h-[44px] w-28 shrink-0 rounded-lg border border-black/10 bg-transparent px-3 text-sm dark:border-white/10"
          placeholder="Ej. 50"
          value={numero}
          onChange={(e) => actualizar(e.target.value.replace(/[^\d.]/g, ""), unidad, reservas)}
        />
        <select
          className="min-h-[44px] flex-1 rounded-lg border border-black/10 bg-tarjeta px-3 text-sm text-texto dark:border-white/10 dark:bg-tarjeta-dark dark:text-texto-dark"
          value={unidad}
          onChange={(e) => actualizar(numero, e.target.value, reservas)}
        >
          {OPCIONES_UNIDAD_PRODUCCION.map((op) => (
            <option key={op.valor} value={op.valor} className="bg-white text-black">
              {op.etiqueta} / mes
            </option>
          ))}
        </select>
      </div>
      <select
        className="min-h-[44px] w-full rounded-lg border border-black/10 bg-tarjeta px-3 text-sm text-texto dark:border-white/10 dark:bg-tarjeta-dark dark:text-texto-dark"
        value={reservas}
        onChange={(e) => actualizar(numero, unidad, e.target.value)}
      >
        <option value="" className="bg-white text-black">
          ¿Reservas estimadas? (opcional)
        </option>
        {OPCIONES_RESERVAS.map((op) => (
          <option key={op} value={op} className="bg-white text-black">
            {op}
          </option>
        ))}
      </select>
    </div>
  );
}
