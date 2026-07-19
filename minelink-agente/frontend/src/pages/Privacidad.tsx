import { MARCA } from "../config/marca";
import { useTitulo } from "../hooks/useTitulo";
import { WHATSAPP_ADMIN, enlaceWhatsApp } from "../config/whatsapp";

/** Política de privacidad (julio 2026) — BORRADOR redactado describiendo
 *  lo que la plataforma realmente hace (privacidad por diseño: contactos
 *  nunca públicos, financieros privados para siempre). Esthiven debe
 *  revisarla antes de considerarla definitiva; se edita solo texto aquí. */
export function Privacidad() {
  useTitulo("Política de Privacidad");
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Política de Privacidad</h1>
        <p className="mt-1 text-sm text-texto-suave dark:text-texto-suave-dark">
          Última actualización: julio de 2026
        </p>
      </div>

      <Seccion titulo="Quién es el responsable">
        {MARCA} es una plataforma peruana de orientación para la formalización minera
        artesanal y de conexión entre mineros, consultores e inversionistas. Para
        cualquier consulta sobre tus datos puedes escribirnos por{" "}
        <a
          href={enlaceWhatsApp(WHATSAPP_ADMIN, `Hola ${MARCA}, tengo una consulta sobre mis datos personales.`)}
          target="_blank"
          rel="noreferrer"
          className="text-acento underline"
        >
          WhatsApp
        </a>
        .
      </Seccion>

      <Seccion titulo="Qué datos recopilamos y para qué">
        <ul className="mt-1 flex list-disc flex-col gap-2 pl-5">
          <li>
            <strong>Respuestas del diagnóstico</strong> (situación legal de tu operación,
            región, mineral): para calcular tu resultado y mostrarte qué te falta. El
            diagnóstico es anónimo — no pide tu nombre ni tu contacto.
          </li>
          <li>
            <strong>Datos de registro</strong> (nombre, WhatsApp, departamento, usuario y
            contraseña): solo si decides crear una cuenta, para guardar tu avance y poder
            contactarte. La contraseña se guarda cifrada — nadie puede leerla, ni nosotros.
          </li>
          <li>
            <strong>Documentos y fotos que subes</strong>: para respaldar tu declaración
            ante posibles inversionistas. Tú decides qué subir.
          </li>
          <li>
            <strong>Datos de inversionistas y consultores</strong> (contacto, motivo de
            interés, CV y colegiatura): para intermediar el contacto y verificar
            credenciales.
          </li>
        </ul>
      </Seccion>

      <Seccion titulo="Qué se muestra públicamente y qué no — nuestra regla central">
        <ul className="mt-1 flex list-disc flex-col gap-2 pl-5">
          <li>
            <strong>Tu contacto NUNCA es público.</strong> Ni tu nombre, ni tu WhatsApp, ni
            tu correo aparecen en la web. Cuando un inversionista se interesa en tu
            proyecto, el equipo de {MARCA} intermedia la presentación — nadie recibe tu
            número directamente.
          </li>
          <li>
            <strong>Documentos financieros son privados para siempre:</strong> liquidaciones
            de venta, estados financieros, registros de costos y fotos de trabajadores no
            se muestran nunca. Públicamente solo aparece el hecho verificado (por ejemplo:
            "ventas con respaldo — 3 documentos").
          </li>
          <li>
            Si tu proyecto se publica en la cartera, lo visible es: el nombre del proyecto,
            fotos de la operación, documentos legales/técnicos que subiste como respaldo,
            la ubicación aproximada del punto que marcaste, y los datos de inversión que
            declaraste para ese fin (capital buscado, porcentaje a ceder, etc.).
          </li>
        </ul>
      </Seccion>

      <Seccion titulo="Dónde se guardan tus datos">
        En servidores en la nube (Supabase/Amazon Web Services) con acceso restringido.
        Los archivos se almacenan en un depósito privado — solo se sirven a través de la
        plataforma, nunca por enlaces directos. Hacemos copias de seguridad diarias.
      </Seccion>

      <Seccion titulo="Con quién compartimos datos">
        Con nadie fuera de la mecánica de la plataforma. No vendemos ni alquilamos datos.
        El equipo de {MARCA} (administración) es el único que ve los datos de contacto, y
        los usa exclusivamente para intermediar entre mineros, consultores e
        inversionistas dentro de la plataforma.
      </Seccion>

      <Seccion titulo="Tus derechos">
        Conforme a la Ley de Protección de Datos Personales del Perú (Ley N° 29733),
        puedes pedir en cualquier momento acceder, corregir o eliminar tus datos y tu
        cuenta. Escríbenos por WhatsApp y lo gestionamos sin costo.
      </Seccion>

      <Seccion titulo="Cambios a esta política">
        Si esta política cambia, actualizaremos la fecha de arriba. Los cambios
        importantes se avisarán dentro de la plataforma.
      </Seccion>
    </div>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="border border-black/10 p-5 dark:border-white/10">
      <h2 className="font-semibold">{titulo}</h2>
      <div className="mt-2 text-sm leading-relaxed text-texto-suave dark:text-texto-suave-dark">
        {children}
      </div>
    </section>
  );
}
