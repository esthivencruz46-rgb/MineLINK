import { useEffect, useRef, useState } from "react";

interface Props {
  opciones: string[];
  /** Valor actual en minúsculas (o vacío = sin filtro/selección). */
  value: string;
  onChange: (valorLowerCase: string) => void;
  placeholder?: string;
}

function sinTildes(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Input de texto con sugerencias que se filtran mientras escribes — en vez
 * de un <select> largo, más rápido cuando hay muchas opciones (departamentos,
 * elementos, etc.). */
export function Autocomplete({ opciones, value, onChange, placeholder }: Props) {
  const inicial = opciones.find((o) => o.toLowerCase() === value) ?? "";
  const [texto, setTexto] = useState(inicial);
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTexto(opciones.find((o) => o.toLowerCase() === value) ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const sugerencias = opciones.filter((o) =>
    sinTildes(o.toLowerCase()).includes(sinTildes(texto.toLowerCase()))
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

  function elegir(opcion: string) {
    setTexto(opcion);
    onChange(opcion.toLowerCase());
    setAbierto(false);
  }

  return (
    <div ref={contenedorRef} className="relative w-full">
      <input
        className="min-h-[44px] w-full rounded-lg border border-black/10 bg-tarjeta px-3 text-texto dark:border-white/10 dark:bg-tarjeta-dark dark:text-texto-dark"
        placeholder={placeholder ?? "Buscar..."}
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
          {sugerencias.map((o) => (
            <li key={o}>
              <button
                type="button"
                onClick={() => elegir(o)}
                className="block min-h-[44px] w-full px-3 text-left hover:bg-acento/10"
              >
                {o}
              </button>
            </li>
          ))}
        </ul>
      )}
      {abierto && texto && sugerencias.length === 0 && (
        <p className="absolute left-0 top-full z-10 mt-1 w-full rounded-lg border border-black/10 bg-tarjeta px-3 py-2 text-sm text-texto-suave dark:border-white/10 dark:bg-tarjeta-dark dark:text-texto-suave-dark">
          Sin resultados
        </p>
      )}
    </div>
  );
}
