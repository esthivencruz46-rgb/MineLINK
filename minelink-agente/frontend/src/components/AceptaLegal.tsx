import { Link } from "react-router-dom";

/** Checkbox de consentimiento (julio 2026): la Ley 29733 exige informar y
 *  pedir aceptación antes de recopilar datos personales — compartido por
 *  los registros de minero, inversionista y consultor. */
export function AceptaLegal({
  aceptado,
  onCambiar,
  error,
}: {
  aceptado: boolean;
  onCambiar: (v: boolean) => void;
  error?: string;
}) {
  return (
    <div>
      <label className="flex cursor-pointer items-start gap-2 text-xs text-texto-suave dark:text-texto-suave-dark">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={aceptado}
          onChange={(e) => onCambiar(e.target.checked)}
        />
        <span>
          Acepto la{" "}
          <Link to="/privacidad" target="_blank" className="text-acento underline">
            Política de Privacidad
          </Link>{" "}
          y los{" "}
          <Link to="/terminos" target="_blank" className="text-acento underline">
            Términos y Condiciones
          </Link>
          .
        </span>
      </label>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
