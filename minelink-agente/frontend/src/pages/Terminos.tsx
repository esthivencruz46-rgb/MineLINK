import { MARCA } from "../config/marca";
import { useTitulo } from "../hooks/useTitulo";

/** Términos y condiciones (julio 2026) — BORRADOR alineado a lo que la
 *  plataforma hace de verdad (orientación + intermediación; no asesoría
 *  legal ni corretaje). Esthiven debe revisarlo antes de darlo por
 *  definitivo; se edita solo texto aquí. */
export function Terminos() {
  useTitulo("Términos y Condiciones");
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Términos y Condiciones</h1>
        <p className="mt-1 text-sm text-texto-suave dark:text-texto-suave-dark">
          Última actualización: julio de 2026
        </p>
      </div>

      <Seccion titulo={`Qué es ${MARCA} (y qué no es)`}>
        {MARCA} es una plataforma de <strong>orientación e intermediación</strong>: te
        ayuda a entender en qué etapa de la formalización minera estás, qué te falta, y te
        conecta con consultores, empresas e inversionistas. {MARCA} <strong>no es</strong>{" "}
        un estudio de abogados, no tramita expedientes ante el Estado, no es corredor de
        inversiones y no reemplaza la asesoría de un profesional colegiado. El diagnóstico
        es referencial — la decisión final sobre cualquier trámite o negocio es tuya.
      </Seccion>

      <Seccion titulo="Gratuidad">
        El diagnóstico, la cuenta del minero y la publicación de tu proyecto son gratuitos
        para mineros. La postulación de consultores también es gratuita.
      </Seccion>

      <Seccion titulo="Veracidad de la información">
        Lo que declares en el diagnóstico y en tu perfil es tu responsabilidad. La
        plataforma distingue claramente entre lo <em>declarado</em> por cada usuario y lo
        <em> verificado</em>: el sello "Con respaldo" solo aparece en documentos que el
        equipo de {MARCA} revisó, y los cotejos con registros públicos (INGEMMET, MINEM,
        SERNANP) son siempre referenciales. Declarar información falsa puede llevar a la
        suspensión de tu cuenta o al retiro de tu proyecto de la cartera.
      </Seccion>

      <Seccion titulo="Sobre los proyectos publicados">
        Publicar tu proyecto en la cartera es automático cuando cumples los requisitos
        (perfil aplicable, sin bloqueantes legales activos, documentos y perfil de
        inversión enviados). {MARCA} puede retirar de la cartera un proyecto con
        información falsa o con un problema legal sobreviniente. Un proyecto publicado no
        constituye una oferta de valores ni una recomendación de inversión: cada
        inversionista debe hacer su propia verificación (due diligence) antes de
        comprometer capital.
      </Seccion>

      <Seccion titulo="Sobre consultores y empresas del directorio">
        Los consultores que se postulan pasan por una revisión de colegiatura y CV antes
        de aparecer públicamente. Aun así, {MARCA} no es parte de los contratos que
        celebres con ellos ni garantiza el resultado de sus servicios — la relación
        comercial es directamente entre tú y el profesional.
      </Seccion>

      <Seccion titulo="Intermediación de contactos">
        Para proteger a todos, los datos de contacto no se muestran públicamente: el
        equipo de {MARCA} realiza las presentaciones. Al dejar tu interés (como
        inversionista o como minero interesado en un servicio), autorizas a {MARCA} a
        compartir tu contacto con la otra parte para ese fin específico.
      </Seccion>

      <Seccion titulo="Cuentas">
        Eres responsable de mantener tu contraseña segura. Puedes pedir la eliminación de
        tu cuenta y tus datos en cualquier momento (ver la Política de Privacidad).
      </Seccion>

      <Seccion titulo="Ley aplicable">
        Estos términos se rigen por las leyes de la República del Perú.
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
