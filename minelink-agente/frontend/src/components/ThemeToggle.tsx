import { useTheme } from "../hooks/useTheme";

export function ThemeToggle() {
  const { tema, alternar } = useTheme();

  return (
    <button
      onClick={alternar}
      className="min-h-[44px] min-w-[44px] rounded-full text-xl leading-none
        text-texto-suave hover:text-texto dark:text-texto-suave-dark dark:hover:text-texto-dark"
      aria-label="Cambiar tema"
      title="Cambiar tema"
    >
      {tema === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
