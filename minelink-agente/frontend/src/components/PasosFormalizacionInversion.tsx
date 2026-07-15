import { useRef, useState } from "react";
import { Check } from "lucide-react";
import { useMineroAuth } from "../context/MineroAuthContext";
import { NOMBRE_PERFIL } from "../data/preguntas";
import type { MineroPerfil } from "../types/minero";

function Item({
  titulo,
  subtitulo,
  hecho,
}: {
  titulo: string;
  subtitulo: string;
  hecho: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
          hecho ? "bg-emerald-500 text-white" : "bg-acento text-white"
        }`}
      >
        {hecho ? <Check size={16} strokeWidth={3} aria-hidden /> : "•"}
      </div>
      <div>
        <p className="text-sm font-semibold">{titulo}</p>
        <p className="text-xs text-texto-suave dark:text-texto-suave-dark">{subtitulo}</p>
      </div>
    </div>
  );
}

/** Código REINFO editable — si no se dejó en el registro, se completa
 *  aquí (activa el cotejo automático contra el padrón del MINEM). Guarda
 *  al salir del campo (blur/Enter), NUNCA con debounce: el botón verde
 *  "Guardar" del header remonta toda la cuenta con `key={recarga}`, y un
 *  guardado a medio temporizador quedaba cancelado por ese remount (mismo
 *  bug ya corregido en las fechas de DocumentosMinero — el blur ya
 *  disparó el guardado ANTES de que el clic en "Guardar" llegue a
 *  ejecutarse, así que no hay carrera posible). */
function CodigoReinfo({
  valorInicial,
  onGuardado,
}: {
  valorInicial: string;
  onGuardado: (perfil: MineroPerfil) => void;
}) {
  const { authFetch } = useMineroAuth();
  const [valor, setValor] = useState(valorInicial);
  const [estado, setEstado] = useState<"idle" | "guardando" | "ok" | "error">("idle");
  const inputRef = useRef<HTMLInputElement>(null);
  const ultimoGuardado = useRef(valorInicial);

  async function guardar() {
    const limpio = valor.trim();
    if (limpio === ultimoGuardado.current) return;
    setEstado("guardando");
    try {
      const resp = await authFetch("/mineros/perfil-inversion", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo_reinfo: limpio }),
      });
      if (!resp.ok) {
        const detalle = await resp.json().catch(() => null);
        throw new Error(detalle?.detail ?? "No se pudo guardar.");
      }
      ultimoGuardado.current = limpio;
      onGuardado(await resp.json());
      setEstado("ok");
    } catch {
      setEstado("error");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs font-medium text-texto-suave dark:text-texto-suave-dark">
        Código REINFO
      </label>
      <input
        ref={inputRef}
        className="min-h-[32px] w-32 rounded-lg border border-black/10 bg-transparent px-2 text-xs dark:border-white/10"
        placeholder="Ej: 010656208"
        value={valor}
        onChange={(e) => {
          setValor(e.target.value);
          setEstado("idle");
        }}
        onBlur={guardar}
        onKeyDown={(e) => {
          if (e.key === "Enter") inputRef.current?.blur();
        }}
      />
      {estado === "guardando" && (
        <span className="text-xs text-texto-suave dark:text-texto-suave-dark">Guardando...</span>
      )}
      {estado === "ok" && <span className="text-xs font-semibold text-emerald-500">Guardado ✓</span>}
      {estado === "error" && (
        <span className="text-xs font-semibold text-red-500">Ese código ya está en uso</span>
      )}
    </div>
  );
}

/** Resumen de las dos partes que hay que enviar antes de publicar el
 *  proyecto en la cartera pública — Formalización e Inversión se pueden
 *  completar en paralelo, en la misma sesión, sin esperar una a la otra;
 *  no hay aprobación manual del admin: la publicación es automática en
 *  cuanto ambas están enviadas (ver apto_inversionistas). */
export function PasosFormalizacionInversion({
  perfil,
  onGuardado,
}: {
  perfil: MineroPerfil;
  onGuardado: (perfil: MineroPerfil) => void;
}) {
  const totalBrechas = perfil.brechas.length;
  const resueltas = perfil.brechas_resueltas.length;
  const formalizacionHecha = perfil.documentos_enviados;
  const inversionHecha = perfil.inv_enviado;
  const publicado = perfil.apto_inversionistas;

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-tarjeta p-4 dark:bg-tarjeta-dark">
      <div className="flex flex-wrap items-center gap-4 sm:gap-6">
        <Item
          titulo="Formalización"
          subtitulo={
            formalizacionHecha
              ? "Enviada"
              : totalBrechas > 0
                ? `${resueltas}/${totalBrechas} completos`
                : "En curso"
          }
          hecho={formalizacionHecha}
        />
        <Item
          titulo="Inversión"
          subtitulo={inversionHecha ? "Enviada" : "Puedes completarla ahora"}
          hecho={inversionHecha}
        />
        {perfil.perfil && (
          <span className="rounded-full bg-acento/15 px-4 py-1 text-sm font-semibold text-acento sm:ml-auto">
            {NOMBRE_PERFIL[perfil.perfil] ?? perfil.perfil}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CodigoReinfo valorInicial={perfil.codigo_reinfo ?? ""} onGuardado={onGuardado} />
      </div>
      <p className="text-xs text-texto-suave dark:text-texto-suave-dark">
        {publicado
          ? "Tu proyecto ya está publicado en la cartera para inversionistas."
          : "Puedes completar las dos partes sin esperar una a la otra — se publica sola en cuanto envíes ambas."}
      </p>
    </div>
  );
}
