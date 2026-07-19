import { Link } from "react-router-dom";
import { MARCA } from "../config/marca";
import { WHATSAPP_ADMIN, enlaceWhatsApp } from "../config/whatsapp";

/** Pie de página público (julio 2026) — antes la web no tenía footer, y
 *  con él llegan los enlaces legales exigibles (privacidad/términos) y un
 *  contacto visible. No se muestra en /admin (ver App.tsx). */
export function Footer() {
  return (
    <footer className="mt-12 border-t border-black/10 dark:border-white/10">
      <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-8 text-sm">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="font-semibold text-acento">{MARCA}</span>
          <Link to="/como-funciona" className="text-texto-suave hover:text-acento dark:text-texto-suave-dark">
            Cómo funciona
          </Link>
          <Link to="/proyectos" className="text-texto-suave hover:text-acento dark:text-texto-suave-dark">
            Proyectos
          </Link>
          <Link to="/postular" className="text-texto-suave hover:text-acento dark:text-texto-suave-dark">
            Soy consultor
          </Link>
          <a
            href={enlaceWhatsApp(WHATSAPP_ADMIN, `Hola ${MARCA} 👋`)}
            target="_blank"
            rel="noreferrer"
            className="text-texto-suave hover:text-acento dark:text-texto-suave-dark"
          >
            Contacto
          </a>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-texto-suave dark:text-texto-suave-dark">
          <Link to="/privacidad" className="underline underline-offset-2 hover:text-acento">
            Política de Privacidad
          </Link>
          <Link to="/terminos" className="underline underline-offset-2 hover:text-acento">
            Términos y Condiciones
          </Link>
          <span>
            © {new Date().getFullYear()} {MARCA} · Formalización minera artesanal · Perú
          </span>
        </div>
      </div>
    </footer>
  );
}
