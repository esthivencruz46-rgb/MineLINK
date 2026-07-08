interface Props {
  /** Solo los 9 dígitos del número; el +51 es fijo y lo agrega el formulario al enviar. */
  value: string;
  onChange: (digitos: string) => void;
  placeholder?: string;
}

/** Campo de WhatsApp/teléfono peruano: muestra el prefijo +51 fijo y el
 * usuario escribe únicamente su número (9 dígitos). */
export function CampoTelefono({ value, onChange, placeholder = "987654321" }: Props) {
  return (
    <div className="flex min-h-[44px] w-full items-stretch overflow-hidden rounded-lg border border-black/10 dark:border-white/10">
      <span className="flex items-center border-r border-black/10 bg-black/5 px-3 font-medium text-texto-suave dark:border-white/10 dark:bg-white/5 dark:text-texto-suave-dark">
        +51
      </span>
      <input
        type="tel"
        inputMode="numeric"
        maxLength={9}
        className="w-full bg-transparent px-3 outline-none"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 9))}
      />
    </div>
  );
}
