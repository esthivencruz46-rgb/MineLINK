import { Navigate, useNavigate } from "react-router-dom";
import { useTitulo } from "../hooks/useTitulo";
import { RegistroMineroForm } from "../components/RegistroMineroForm";
import { useRegistroMinero } from "../hooks/useRegistroMinero";
import { leerDiagnostico } from "../services/storage";

/** Copy del encabezado según el perfil del diagnóstico: todos pueden
 * registrarse, pero la promesa cambia (A guarda su avance; B/C/D además
 * pueden aparecer ante inversionistas cuando estén al día). */
const TEXTO_POR_PERFIL: Record<string, { titulo: string; descripcion: string }> = {
  A: {
    titulo: "Guarda tu avance",
    descripcion:
      "Crea tu cuenta para guardar tu diagnóstico y tu checklist del petitorio. Cuando tengas tu concesión, tu cuenta ya estará lista.",
  },
  A_avanzado: {
    titulo: "Guarda tu avance",
    descripcion:
      "Crea tu cuenta para guardar tu diagnóstico y seguir el estado de tu petitorio desde un solo lugar.",
  },
  B: {
    titulo: "Regístrate para que te ayudemos con tu concesión",
    descripcion:
      "Crea tu cuenta para guardar tu diagnóstico, subir tus documentos y presentar tu proyecto a inversionistas.",
  },
  C: {
    titulo: "Regístrate para que te ayudemos",
    descripcion:
      "Crea tu cuenta para guardar tu diagnóstico, seguir tus documentos REINFO y presentar tu operación a inversionistas.",
  },
  D: {
    titulo: "Regístrate para que te ayudemos",
    descripcion:
      "Crea tu cuenta para guardar tu diagnóstico, respaldar tus documentos y presentar tu operación a inversionistas.",
  },
};

export function Registro() {
  useTitulo("Crear cuenta");
  const navigate = useNavigate();
  const guardado = leerDiagnostico();
  const { enviando, error, enviar } = useRegistroMinero(guardado?.respuesta.id);

  if (!guardado) {
    return <Navigate to="/" replace />;
  }

  const texto =
    TEXTO_POR_PERFIL[guardado.respuesta.perfil] ?? TEXTO_POR_PERFIL.C;

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-8">
      <button
        onClick={() => navigate("/resultado")}
        className="self-start text-sm text-texto-suave underline dark:text-texto-suave-dark"
      >
        ← Volver a mi diagnóstico
      </button>

      <h1 className="mt-4 text-xl font-semibold">{texto.titulo}</h1>
      <p className="mt-1 text-sm text-texto-suave dark:text-texto-suave-dark">
        {texto.descripcion} No compartimos tus datos con nadie más.
      </p>

      <RegistroMineroForm
        situacion={guardado.situacion}
        codigoReinfoInicial={guardado.codigoReinfo}
        enviando={enviando}
        error={error}
        onEnviar={enviar}
      />
    </div>
  );
}
