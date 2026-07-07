import { useEffect, useState } from "react";

type Tema = "dark" | "light";

const CLAVE = "minelink_tema";

function temaInicial(): Tema {
  const guardado = localStorage.getItem(CLAVE);
  return guardado === "light" ? "light" : "dark";
}

export function useTheme() {
  const [tema, setTema] = useState<Tema>(temaInicial);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", tema === "dark");
    localStorage.setItem(CLAVE, tema);
  }, [tema]);

  const alternar = () => setTema((t) => (t === "dark" ? "light" : "dark"));

  return { tema, alternar };
}
