import { Moon, Sun } from "lucide-react";
import { useTheme } from "../hooks/useTheme";

export function ThemeToggle() {
  const { tema, alternar } = useTheme();

  return (
    <button
      onClick={alternar}
      className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full
        text-texto-suave hover:text-texto dark:text-texto-suave-dark dark:hover:text-texto-dark"
      aria-label="Cambiar tema"
      title="Cambiar tema"
    >
      {tema === "dark" ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}
