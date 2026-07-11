import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { enviarLead } from "../services/api";
import { useMineroAuth } from "../context/MineroAuthContext";
import { limpiarDiagnostico } from "../services/storage";
import type { DatosRegistroMinero } from "../components/RegistroMineroForm";

/** Envío del registro del minero (POST /leads) con el mapeo de errores en
 * lenguaje simple. Lo comparten la página /registro y el modal de /empresas.
 * Tras registrarse, entra directo a su cuenta (auto-login) en vez de una
 * pantalla de agradecimiento — ahí es donde sube sus fotos de respaldo. */
export function useRegistroMinero(operacionId: string | undefined) {
  const navigate = useNavigate();
  const { login } = useMineroAuth();
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
      // El registro ya se guardó — si el auto-login falla por lo que sea,
      // no lo mostramos como error: lo mandamos a /ingresar en vez de
      // romper con un mensaje falso de "no pudimos enviar tus datos".
      try {
        await login(datos.username, datos.password);
        limpiarDiagnostico();
        // MiCuenta redirige sola a /mi-concesion si la situación es
        // "concesionario" — no hace falta decidir la ruta aquí. El state
        // "bienvenida" solo vive en esta navegación (se pierde si recarga
        // o vuelve más tarde) — exactamente el efecto de "primera vez".
        navigate("/mi-cuenta", { state: { bienvenida: true } });
      } catch {
        navigate("/ingresar");
      }
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
