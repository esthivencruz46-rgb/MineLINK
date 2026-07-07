import { useEffect, useRef, useState } from "react";
import { DEPARTAMENTOS } from "../data/departamentos";

interface Props {
  value: string;
  onChange: (valorLowerCase: string) => void;
  placeholder?: string;
}

function sinTildes(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function AutocompleteDepartamento({ value, onChange, placeholder }: Props) {
  const inicial = DEPARTAMENTOS.find((d) => d.toLowerCase() === value) ?? "";
  const [texto, setTexto] = useState(inicial);
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);

  const sugerencias = DEPARTAMENTOS.filter((d) =>
    sinTildes(d.toLowerCase()).includes(sinTildes(texto.toLowerCase()))
  );

  useEffect(() => {
    function alClickearFuera(e: MouseEvent) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    }
    document.addEventListener("mousedown", alClickearFuera);
    return () => document.removeEventListener("mousedown", alClickearFuera);
  }, []);

  function elegir(departamento: string) {
    setTexto(departamento);
    onChange(departamento.toLowerCase());
    setAbierto(false);
  }

  return (
    <div ref={contenedorRef} className="relative">
      <input
        className="min-h-[44px] w-full rounded-lg border border-black/10 bg-tarjeta px-3 text-texto dark:border-white/10 dark:bg-tarjeta-dark dark:text-texto-dark"
        placeholder={placeholder ?? "Escribe tu departamento"}
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          onChange("");
          setAbierto(true);
        }}
        onFocus={() => setAbierto(true)}
      />
      {abierto && sugerencias.length > 0 && (
        <ul className="absolute left-0 top-full z-10 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-black/10 bg-tarjeta shadow-lg dark:border-white/10 dark:bg-tarjeta-dark">
          {sugerencias.map((d) => (
            <li key={d}>
              <button
                type="button"
                onClick={() => elegir(d)}
                className="block min-h-[44px] w-full px-3 text-left hover:bg-acento/10"
              >
                {d}
              </button>
            </li>
          ))}
        </ul>
      )}
      {abierto && texto && sugerencias.length === 0 && (
        <p className="absolute left-0 top-full z-10 mt-1 w-full rounded-lg border border-black/10 bg-tarjeta px-3 py-2 text-sm text-texto-suave dark:border-white/10 dark:bg-tarjeta-dark dark:text-texto-suave-dark">
          No encontramos ese departamento
        </p>
      )}
    </div>
  );
}
