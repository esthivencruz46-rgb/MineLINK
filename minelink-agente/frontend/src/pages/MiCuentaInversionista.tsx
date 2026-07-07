import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useInversionistaAuth } from "../context/InversionistaAuthContext";

interface PerfilInversionista {
  nombre: string;
  telefono?: string | null;
  email?: string | null;
  motivo_inversion?: string | null;
  monto?: string | null;
  informacion_requerida?: string | null;
  mensaje?: string | null;
  operacion_id: string;
  created_at: string;
}

export function MiCuentaInversionista() {
  const { authFetch, logout } = useInversionistaAuth();
  const navigate = useNavigate();
  const [perfil, setPerfil] = useState<PerfilInversionista | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authFetch("/inversionistas/me")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => {
        setPerfil(data);
        setError(null);
      })
      .catch(() => setError("No pudimos cargar tus datos."))
      .finally(() => setCargando(false));
  }, [authFetch]);

  function cerrarSesion() {
    logout();
    navigate("/");
  }

  if (cargando) {
    return <p className="p-8 text-center">Cargando...</p>;
  }

  if (error || !perfil) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-8 text-center">
        <p className="text-red-500">{error ?? "No encontramos tus datos."}</p>
        <button onClick={cerrarSesion} className="text-sm text-acento underline">
          Volver a intentar
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Hola, {perfil.nombre}</h1>
        <button
          onClick={cerrarSesion}
          className="min-h-[44px] rounded-lg border border-black/10 px-4 text-sm font-semibold dark:border-white/10"
        >
          Cerrar sesión
        </button>
      </div>

      <div className="rounded-lg bg-tarjeta p-6 text-center dark:bg-tarjeta-dark">
        <p className="font-semibold">Estamos preparando esta sección</p>
        <p className="mt-2 text-sm text-texto-suave dark:text-texto-suave-dark">
          Pronto podrás ver aquí el estado de tu interés en proyectos y
          conectar directamente con nuevas oportunidades mineras. Por ahora,
          esto es lo que dejaste registrado:
        </p>
      </div>

      <div className="flex flex-col gap-2 rounded-lg bg-tarjeta p-5 text-sm dark:bg-tarjeta-dark">
        {perfil.telefono && (
          <p>
            <span className="font-medium">Teléfono:</span> {perfil.telefono}
          </p>
        )}
        {perfil.email && (
          <p>
            <span className="font-medium">Email:</span> {perfil.email}
          </p>
        )}
        {perfil.motivo_inversion && (
          <p>
            <span className="font-medium">Motivo de inversión:</span> {perfil.motivo_inversion}
          </p>
        )}
        {perfil.monto && (
          <p>
            <span className="font-medium">Capital:</span> {perfil.monto}
          </p>
        )}
        {perfil.informacion_requerida && (
          <p>
            <span className="font-medium">Información solicitada:</span>{" "}
            {perfil.informacion_requerida}
          </p>
        )}
        {perfil.mensaje && (
          <p>
            <span className="font-medium">Mensaje:</span> {perfil.mensaje}
          </p>
        )}
        <p className="text-texto-suave dark:text-texto-suave-dark">
          Registrado el {new Date(perfil.created_at).toLocaleDateString("es-PE")}
        </p>
      </div>
    </div>
  );
}
