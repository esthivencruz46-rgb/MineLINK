import { useEffect, useState } from "react";
import { useMineroAuth } from "../context/MineroAuthContext";
import { POR_ID_INV, type RespuestasInversion } from "../data/preguntasInversion";

function etiquetaRespuesta(id: string, valor: string): string {
  return POR_ID_INV[id]?.opciones?.find((o) => o.valor === valor)?.etiqueta ?? valor;
}

interface Props {
  /** Respuestas que YA tienen su propio slot de foto en "Respalda tu
   *  inversión" (ver MineroPerfil.respaldos_declarados_inversion) — se
   *  excluyen de esta lista para no mostrarlas dos veces: quedan junto al
   *  slot de subida, con su "Marcaste: X" ahí en vez de aquí. */
  declarados: { pregunta_id: string; valor: string }[];
}

/** Muestra lo que el minero respondió en el Módulo INV, salvo lo que ya se
 *  muestra al costado del slot de subida correspondiente en "Respalda tu
 *  inversión" — evita repetir la misma respuesta en dos tarjetas. Solo
 *  aparece una vez enviado (antes de eso, las respuestas se responden en
 *  el modal). */
export function ResumenInversionRespuestas({ declarados }: Props) {
  const { authFetch } = useMineroAuth();
  const [respuestas, setRespuestas] = useState<RespuestasInversion | null>(null);

  useEffect(() => {
    authFetch("/mineros/inversion")
      .then((r) => (r.ok ? r.json() : null))
      .then((inv) => setRespuestas(inv?.respuestas ?? null))
      .catch(() => {});
  }, [authFetch]);

  const cubiertos = new Set(declarados.map((d) => `${d.pregunta_id}:${d.valor}`));

  const entradas = Object.entries(respuestas ?? {})
    .map(([id, valor]): [string, string | string[]] => {
      if (Array.isArray(valor)) {
        return [id, valor.filter((v) => !cubiertos.has(`${id}:${v}`))];
      }
      return [id, valor];
    })
    .filter(([id, valor]) => {
      if (Array.isArray(valor)) return valor.length > 0;
      return !cubiertos.has(`${id}:${valor}`);
    });

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
