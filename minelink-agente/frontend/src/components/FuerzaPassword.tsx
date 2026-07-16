/** Indicador simple de fuerza de contraseña — no bloquea el envío (el
 *  mínimo real sigue siendo 6 caracteres, validado donde ya se validaba),
 *  solo orienta al usuario para que elija algo más difícil de adivinar que
 *  su nombre o su fecha de nacimiento. */
function calcularFuerza(password: string): { nivel: 0 | 1 | 2 | 3; etiqueta: string } {
  if (password.length === 0) return { nivel: 0, etiqueta: "" };
  if (password.length < 6) return { nivel: 1, etiqueta: "Muy corta" };

  const tieneLetra = /[a-zA-Z]/.test(password);
  const tieneNumero = /[0-9]/.test(password);
  const tieneSimbolo = /[^a-zA-Z0-9]/.test(password);
  const variedad = [tieneLetra, tieneNumero, tieneSimbolo].filter(Boolean).length;

  if (password.length >= 10 && variedad >= 2) return { nivel: 3, etiqueta: "Segura" };
  if (password.length >= 8 && variedad >= 2) return { nivel: 2, etiqueta: "Aceptable" };
  return { nivel: 1, etiqueta: "Débil" };
}

const COLOR_POR_NIVEL = ["bg-black/10 dark:bg-white/10", "bg-red-500", "bg-amber-500", "bg-green-500"];

export function FuerzaPassword({ password }: { password: string }) {
  if (password.length === 0) return null;
  const { nivel, etiqueta } = calcularFuerza(password);

  return (
    <div className="-mt-1">
      <div className="flex gap-1">
        {[1, 2, 3].map((barra) => (
          <div
            key={barra}
            className={`h-1 flex-1 rounded-full ${
              barra <= nivel ? COLOR_POR_NIVEL[nivel] : "bg-black/10 dark:bg-white/10"
            }`}
          />
        ))}
      </div>
      <p className="mt-1 text-xs text-texto-suave dark:text-texto-suave-dark">
        {nivel <= 1
          ? `${etiqueta} — usa 8+ caracteres combinando letras y números para más seguridad`
          : etiqueta}
      </p>
    </div>
  );
}
