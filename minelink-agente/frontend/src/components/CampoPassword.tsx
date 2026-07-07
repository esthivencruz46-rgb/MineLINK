import { useState } from "react";

interface Props {
  placeholder: string;
  value: string;
  onChange: (valor: string) => void;
  autoFocus?: boolean;
}

export function CampoPassword({ placeholder, value, onChange, autoFocus }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        className="min-h-[44px] w-full rounded-lg border border-black/10 bg-transparent px-3 pr-12 dark:border-white/10"
        placeholder={placeholder}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-texto-suave dark:text-texto-suave-dark"
        tabIndex={-1}
      >
        {visible ? "Ocultar" : "Ver"}
      </button>
    </div>
  );
}
