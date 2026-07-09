import { useState } from "react";

interface Props {
  /** Texto ya compuesto: una de las OPCIONES tal cual, o texto libre si el
   * minero eligió "Otro". */
  value: string;
  onChange: (valor: string) => void;
}

const OPCIONES = [
  "Comprar maquinaria o equipos",
  "Construir o mejorar planta de beneficio",
  "Capital de trabajo (insumos, combustible, planilla)",
  "Trámites de formalización (estudios, permisos)",
  "Compra o alquiler de terreno o concesión",
  "Ampliar la producción",
  "Asesoría técnica",
];

/** "¿Para qué buscas el dinero?": selector de opciones comunes + "Otro" con
 * texto libre, para evitar errores de ortografía/redacción en la
 * descripción pública. Compone y guarda un único string, igual que
 * CampoMonto — no requiere cambios de esquema. */
export function CampoUsoFondos({ value, onChange }: Props) {
  const esConocida = OPCIONES.includes(value);
  const [seleccion, setSeleccion] = useState(
    value === "" ? "" : esConocida ? value : "otro"
  );
  const [otro, setOtro] = useState(esConocida || value === "" ? "" : value);

  function elegir(nueva: string) {
    setSeleccion(nueva);
    onChange(nueva === "otro" ? otro : nueva);
  }

  function escribirOtro(texto: string) {
    setOtro(texto);
    onChange(texto);
  }

  return (
    <div className="flex flex-col gap-2">
      <select
        className="min-h-[44px] w-full rounded-lg border border-black/10 bg-tarjeta px-3 text-sm text-texto dark:border-white/10 dark:bg-tarjeta-dark dark:text-texto-dark"
        value={seleccion}
        onChange={(e) => elegir(e.target.value)}
      >
        <option value="" className="bg-white text-black">
          Selecciona una opción
        </option>
        {OPCIONES.map((op) => (
          <option key={op} value={op} className="bg-white text-black">
            {op}
          </option>
        ))}
        <option value="otro" className="bg-white text-black">
          Otro
        </option>
      </select>
      {seleccion === "otro" && (
        <input
          className="min-h-[44px] w-full rounded-lg border border-black/10 bg-transparent px-3 text-sm dark:border-white/10"
          placeholder="Especifica para qué buscas el dinero"
          value={otro}
          onChange={(e) => escribirOtro(e.target.value)}
        />
      )}
    </div>
  );
}
