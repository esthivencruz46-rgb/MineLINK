import { useEffect, useState } from "react";
import { useMineroAuth } from "../context/MineroAuthContext";
import { POR_ID_INV, type RespuestasInversion } from "../data/preguntasInversion";

function etiquetaRespuesta(id: string, valor: string): string {
  return POR_ID_INV[id]?.opciones?.find((o) => o.valor === valor)?.etiqueta ?? valor;
}

/** Muestra lo que el minero respondió en el Módulo INV — mismo tratamiento
 *  que "Marcaste: X" en DocumentosMinero.tsx, para que la columna de
 *  Inversión, igual que la de Formalización, recuerde lo declarado justo
 *  al lado de donde se suben los documentos de sustento. Solo aparece una
 *  vez enviado (antes de eso, las respuestas se responden en el modal). */
export function ResumenInversionRespuestas() {
  const { authFetch } = useMineroAuth();
  const [respuestas, setRespuestas] = useState<RespuestasInversion | null>(null);

  useEffect(() => {
    authFetch("/mineros/inversion")
      .then((r) => (r.ok ? r.json() : null))
      .then((inv) => setRespuestas(inv?.respuestas ?? null))
      .catch(() => {});
  }, [authFetch]);

  const entradas = Object.entries(respuestas ?? {});
  if (entradas.length === 0) return null;

  return (
    <div className="rounded-lg bg-tarjeta p-5 dark:bg-tarjeta-dark">
      <h2 className="font-semibold">Tu perfil de inversión</h2>
      <p className="mt-1 text-sm text-texto-suave dark:text-texto-suave-dark">
        Esto fue lo que respondiste.
      </p>
      <dl className="mt-3 flex flex-col gap-2">
        {entradas.map(([id, valor]) => {
          const pregunta = POR_ID_INV[id];
          if (!pregunta) return null;
          const texto = Array.isArray(valor)
            ? valor.map((v) => etiquetaRespuesta(id, v)).join(", ")
            : pregunta.tipo === "texto_corto"
              ? valor
              : etiquetaRespuesta(id, valor);
          return (
            <div key={id} className="text-sm">
              <dt className="text-texto-suave dark:text-texto-suave-dark">{pregunta.texto}</dt>
              <dd className="font-semibold">{texto}</dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
