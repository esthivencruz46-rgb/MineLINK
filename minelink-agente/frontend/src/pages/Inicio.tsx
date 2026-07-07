import { Link, useNavigate } from "react-router-dom";

export function Inicio() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-3xl font-bold md:text-4xl">
        Descubre gratis qué te falta para formalizarte
      </h1>
      <p className="max-w-md text-texto-suave dark:text-texto-suave-dark">
        Responde el cuestionario y sabrás exactamente qué te falta y quién te
        puede ayudar. Es anónimo hasta que tú decidas dejar tu contacto.
      </p>
      <button
        onClick={() => navigate("/diagnostico")}
        className="min-h-[44px] rounded-lg bg-acento px-8 py-3 text-lg font-semibold text-white active:opacity-90"
      >
        Empezar mi diagnóstico
      </button>

      <Link
        to="/proyectos"
        className="min-h-[44px] rounded-lg border border-acento px-8 py-3 text-lg font-semibold text-acento"
      >
        Ver proyectos mineros
      </Link>

      <p className="mt-2 text-sm text-texto-suave dark:text-texto-suave-dark">
        ¿Eres ingeniero, geólogo o profesional colegiado?{" "}
        <Link to="/postular" className="font-semibold text-acento underline">
          Postula tus servicios como consultor
        </Link>
      </p>

      <p className="text-sm text-texto-suave dark:text-texto-suave-dark">
        ¿Ya te registraste antes?{" "}
        <Link to="/ingresar" className="font-semibold text-acento underline">
          Inicia sesión para ver tus datos
        </Link>
      </p>

      <p className="text-sm text-texto-suave dark:text-texto-suave-dark">
        ¿Dejaste tu interés en un proyecto?{" "}
        <Link to="/ingresar-inversionista" className="font-semibold text-acento underline">
          Iniciar sesión para inversionistas
        </Link>
      </p>
    </div>
  );
}
