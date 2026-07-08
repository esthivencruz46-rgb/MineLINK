interface Props {
  pregunta: string;
  onPreguntaChange: (v: string) => void;
  respuesta: string;
  onRespuestaChange: (v: string) => void;
}

/** Pregunta y respuesta de seguridad que el usuario elige al registrarse,
 * para poder recuperar su contraseña él mismo (4 intentos) sin depender
 * de que el admin la resetee manualmente. */
export function CampoPreguntaSeguridad({
  pregunta,
  onPreguntaChange,
  respuesta,
  onRespuestaChange,
}: Props) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-black/15 p-3 dark:border-white/15">
      <p className="text-xs text-texto-suave dark:text-texto-suave-dark">
        Si olvidas tu contraseña, te haremos esta pregunta para
        recuperarla (tendrás 4 intentos).
      </p>
      <input
        className="min-h-[44px] rounded-lg border border-black/10 bg-transparent px-3 dark:border-white/10"
        placeholder="Escribe tu pregunta (ej. ¿Nombre de tu primera mascota?)"
        value={pregunta}
        onChange={(e) => onPreguntaChange(e.target.value)}
      />
      <input
        className="min-h-[44px] rounded-lg border border-black/10 bg-transparent px-3 dark:border-white/10"
        placeholder="Tu respuesta"
        value={respuesta}
        onChange={(e) => onRespuestaChange(e.target.value)}
      />
    </div>
  );
}
