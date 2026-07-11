import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { enviarLead } from "../services/api";
import type { DatosRegistroMinero } from "../components/RegistroMineroForm";

/** Envío del registro del minero (POST /leads) con el mapeo de errores en
 * lenguaje simple. Lo comparten la página /registro y el modal de /empresas. */
export function useRegistroMinero(operacionId: string | undefined) {
  const navigate = useNavigate();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function enviar(datos: DatosRegistroMinero) {
    if (!operacionId) return;
    setEnviando(true);
    setError(undefined);
    try {
      await enviarLead({
        nombre: datos.nombre,
        whatsapp: datos.whatsapp,
        region: datos.region,
        operacion_id: operacionId,
        username: datos.username,
        password: datos.password,
        pregunta_seguridad: datos.preguntaSeguridad,
        respuesta_seguridad: datos.respuestaSeguridad,
        email: datos.email || undefined,
        nombre_operacion: datos.nombreOperacion || undefined,
        codigo_reinfo: datos.codigoReinfo || undefined,
      });
      navigate("/gracias");
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : "";
      if (mensaje.includes("409") && mensaje.toLowerCase().includes("usuario")) {
        setError("Ese nombre de usuario ya está en uso, elige otro.");
      } else if (mensaje.includes("409") && mensaje.toLowerCase().includes("whatsapp")) {
        setError("Ese número de WhatsApp ya está registrado.");
      } else if (mensaje.includes("409")) {
        setError("Ese código REINFO ya está registrado.");
      } else {
        setError("No pudimos enviar tus datos. Intenta de nuevo.");
      }
    } finally {
      setEnviando(false);
    }
  }

  return { enviando, error, enviar };
}
