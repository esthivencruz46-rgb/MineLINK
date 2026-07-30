import { useNavigate } from "react-router-dom";
import { MARCA } from "../config/marca";
import { RecuperarPasswordForm } from "../components/RecuperarPasswordForm";
import { WHATSAPP_ADMIN, enlaceWhatsApp } from "../config/whatsapp";
import { useMineroAuth } from "../context/MineroAuthContext";

export function RecuperarPasswordMinero() {
  const { establecerToken } = useMineroAuth();
  const navigate = useNavigate();

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-sm flex-col justify-center gap-4 px-4">
      <h1 className="text-xl font-semibold">Recuperar tu contraseña</h1>
      <p className="text-sm text-texto-suave dark:text-texto-suave-dark">
        Escribe tu usuario, responde tu pregunta de seguridad (tienes 4
        intentos) y elige una contraseña nueva.
      </p>
      <RecuperarPasswordForm
        apiPrefix="/mineros"
        onExito={(token) => {
          establecerToken(token);
          navigate("/mi-cuenta");
        }}
      />
      <a
        href={enlaceWhatsApp(
          WHATSAPP_ADMIN,
          `Hola ${MARCA} 👋 No pude recuperar mi contraseña de minero. Mi usuario es: `
        )}
        target="_blank"
        rel="noopener noreferrer"
        className="text-center text-sm text-texto-suave underline dark:text-texto-suave-dark"
      >
        ¿No configuraste una pregunta de seguridad? Escríbenos por WhatsApp
      </a>
    </div>
  );
}
