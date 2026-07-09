import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Building2, Wrench } from "lucide-react";
import { RegistroMineroModal } from "../components/RegistroMineroModal";
import { EmpresaCard } from "../components/EmpresaCard";
import { DEPARTAMENTOS } from "../data/departamentos";
import { INFO_BRECHA } from "../data/brechas";
import { obtenerEmpresas } from "../services/api";
import { enviarLead } from "../services/api";
import { leerDiagnostico } from "../services/storage";
import type { EmpresaPublica } from "../types/empresa";

const TODOS_LOS_ESTUDIOS = Object.keys(INFO_BRECHA);

export function Empresas() {
  const navigate = useNavigate();
  const guardado = leerDiagnostico();

  const [region, setRegion] = useState(guardado?.region ?? "");
  const [estudiosFiltro, setEstudiosFiltro] = useState<string[]>(
    guardado?.respuesta.brechas ?? []
  );
  const [empresas, setEmpresas] = useState<EmpresaPublica[]>([]);
  const [esDemo, setEsDemo] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [enviandoLead, setEnviandoLead] = useState(false);
  const [errorLead, setErrorLead] = useState<string | undefined>();

  useEffect(() => {
    setCargando(true);
    obtenerEmpresas(estudiosFiltro, region).then(({ empresas, demo }) => {
      setEmpresas(empresas);
      setEsDemo(demo);
      setCargando(false);
    });
  }, [region, estudiosFiltro]);

  if (!guardado) {
    return <Navigate to="/" replace />;
  }

  function alternarEstudio(estudio: string) {
    setEstudiosFiltro((actuales) =>
      actuales.includes(estudio)
        ? actuales.filter((e) => e !== estudio)
        : [...actuales, estudio]
    );
  }

  async function enviarRegistro(datos: {
    nombre: string;
    whatsapp: string;
    region: string;
    email: string;
    nombreOperacion: string;
    codigoReinfo: string;
    username: string;
    password: string;
    preguntaSeguridad: string;
    respuestaSeguridad: string;
  }) {
    if (!guardado) return;
    setEnviandoLead(true);
    setErrorLead(undefined);
    try {
      await enviarLead({
        nombre: datos.nombre,
        whatsapp: datos.whatsapp,
        region: datos.region,
        operacion_id: guardado.respuesta.id,
        username: datos.username,
        password: datos.password,
        pregunta_seguridad: datos.preguntaSeguridad,
        respuesta_seguridad: datos.respuestaSeguridad,
        email: datos.email || undefined,
        nombre_operacion: datos.nombreOperacion || undefined,
        codigo_reinfo: datos.codigoReinfo || undefined,
      });
      navigate("/gracias");
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : "";
      if (mensaje.includes("409") && mensaje.toLowerCase().includes("usuario")) {
        setErrorLead("Ese nombre de usuario ya está en uso, elige otro.");
      } else if (mensaje.includes("409") && mensaje.toLowerCase().includes("whatsapp")) {
        setErrorLead("Ese número de WhatsApp ya está registrado.");
      } else if (mensaje.includes("409")) {
        setErrorLead("Ese código REINFO ya está registrado.");
      } else {
        setErrorLead("No pudimos enviar tus datos. Intenta de nuevo.");
      }
    } finally {
      setEnviandoLead(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-8">
      <h1 className="text-2xl font-bold">Empresas que te pueden ayudar</h1>

      {esDemo && (
        <p className="rounded-lg bg-secundario/15 p-3 text-sm text-secundario">
          No pudimos conectar con el servidor. Estas son empresas de ejemplo.
        </p>
      )}

      <div className="flex flex-col gap-3 md:flex-row">
        <select
          className="min-h-[44px] rounded-lg border border-black/10 bg-tarjeta px-3 text-texto dark:border-white/10 dark:bg-tarjeta-dark dark:text-texto-dark"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
        >
          <option value="" className="bg-white text-black">
            Todos los departamentos
          </option>
          {DEPARTAMENTOS.map((d) => (
            <option key={d} value={d.toLowerCase()} className="bg-white text-black">
              {d}
            </option>
          ))}
        </select>

        <details className="relative min-h-[44px] rounded-lg border border-black/10 px-3 py-2 dark:border-white/10">
          <summary className="cursor-pointer select-none">
            Tipo de estudio ({estudiosFiltro.length})
          </summary>
          <div className="absolute left-0 top-full z-10 mt-2 flex max-h-52 w-72 max-w-[90vw] flex-col gap-1 overflow-y-auto rounded-lg border border-black/10 bg-tarjeta p-3 shadow-lg dark:border-white/10 dark:bg-tarjeta-dark">
            {TODOS_LOS_ESTUDIOS.map((e) => (
              <label key={e} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={estudiosFiltro.includes(e)}
                  onChange={() => alternarEstudio(e)}
                />
                {INFO_BRECHA[e].texto}
              </label>
            ))}
          </div>
        </details>
      </div>

      {cargando && <p>Buscando empresas...</p>}

      {!cargando && empresas.length === 0 && (
        <div className="rounded-lg bg-tarjeta p-6 text-center dark:bg-tarjeta-dark">
          <p>Aún no tenemos empresas registradas para esto en tu departamento.</p>
          <button
            onClick={() => setMostrarModal(true)}
            className="mt-4 min-h-[44px] rounded-lg bg-acento px-6 font-semibold text-white"
          >
            Avísenme cuando haya
          </button>
        </div>
      )}

      {/* Bloques: primero empresas, luego consultores independientes.
          Dentro de cada bloque, de mejor a peor rating (los sin rating al
          final) — el rating en sí no se muestra al público por ahora. */}
      {(["empresa", "consultor"] as const).map((tipo) => {
        const bloque = empresas
          .filter((e) => e.tipo === tipo)
          .sort(
            (a, b) =>
              (b.rating ?? -1) - (a.rating ?? -1) ||
              (b.num_resenas ?? 0) - (a.num_resenas ?? 0)
          );
        if (bloque.length === 0) return null;
        return (
          <div key={tipo} className="flex flex-col gap-4">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              {tipo === "empresa" ? (
                <Building2 size={19} strokeWidth={2} className="text-acento" aria-hidden />
              ) : (
                <Wrench size={19} strokeWidth={2} className="text-acento" aria-hidden />
              )}
              {tipo === "empresa" ? "Empresas" : "Consultores independientes"}
              <span className="text-sm font-normal text-texto-suave dark:text-texto-suave-dark">
                ({bloque.length})
              </span>
            </h2>
            {bloque.map((empresa) => (
              <EmpresaCard
                key={empresa.id}
                empresa={empresa}
                brechasMinero={guardado.respuesta.brechas}
                operacionId={guardado.respuesta.id}
                demo={esDemo}
              />
            ))}
          </div>
        );
      })}

      {!cargando && empresas.length > 0 && (
        <button
          onClick={() => setMostrarModal(true)}
          className="min-h-[44px] rounded-lg border border-acento px-6 font-semibold text-acento"
        >
          Registrarme para que me ayuden
        </button>
      )}

      {mostrarModal && (
        <RegistroMineroModal
          situacion={guardado.respuesta.situacion}
          codigoReinfoInicial={guardado.codigoReinfo}
          enviando={enviandoLead}
          error={errorLead}
          onCerrar={() => setMostrarModal(false)}
          onEnviar={enviarRegistro}
        />
      )}
    </div>
  );
}
