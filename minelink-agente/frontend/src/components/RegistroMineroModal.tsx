import { RegistroMineroForm, type DatosRegistroMinero } from "./RegistroMineroForm";

interface Props {
  situacion?: string;
  codigoReinfoInicial?: string;
  enviando: boolean;
  error?: string;
  onCerrar: () => void;
  onEnviar: (datos: DatosRegistroMinero) => void;
}

export function RegistroMineroModal({
  situacion,
  codigoReinfoInicial,
  enviando,
  error,
  onCerrar,
  onEnviar,
}: Props) {
  const esConcesionario = situacion === "concesionario";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 md:items-center md:p-4">
      <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-tarjeta p-6 dark:bg-tarjeta-dark md:max-h-[90vh] md:rounded-2xl">
        <h2 className="text-lg font-semibold">
          {esConcesionario
            ? "Regístrate para que te ayudemos con tu concesión"
            : "Regístrate para que te ayudemos"}
        </h2>
        <p className="mt-1 text-sm text-texto-suave dark:text-texto-suave-dark">
          No compartimos tus datos con nadie más. Crea un usuario y contraseña
          para volver a ver tus datos cuando quieras.
        </p>

        <RegistroMineroForm
          situacion={situacion}
          codigoReinfoInicial={codigoReinfoInicial}
          enviando={enviando}
          error={error}
          onEnviar={onEnviar}
          onCancelar={onCerrar}
        />
      </div>
    </div>
  );
}
