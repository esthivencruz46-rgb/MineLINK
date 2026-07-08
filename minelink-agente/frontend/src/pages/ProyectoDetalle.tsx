import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { GaleriaProyecto } from "../components/proyecto/GaleriaProyecto";
import { InteresInversionModal } from "../components/proyecto/InteresInversionModal";
import { INFO_BRECHA } from "../data/brechas";
import { DIMENSION_POR_ESTUDIO } from "../data/estudioDimension";
import { NOMBRES_DIMENSION } from "../data/preguntas";
import { obtenerProyecto } from "../services/api";
import { calcularSemaforo } from "../utils/semaforo";
import { ETIQUETAS_DOCUMENTO_LEGAL } from "../types/proyecto";
import type { ProyectoDetalle as ProyectoDetalleType } from "../types/proyecto";
import type { NombreDimension } from "../types/diagnostico";

const COLOR_BARRA_DIMENSION: Record<NombreDimension, string> = {
  legal: "bg-acento",
  ambiental: "bg-blue-500",
  operativo: "bg-secundario",
  tecnico: "bg-purple-500",
  seguridad: "bg-amber-500",
};

const NO_ESPECIFICADO = "No especificado";

function colorRiesgo(porcentaje: number): { texto: string; etiqueta: string } {
  if (porcentaje >= 80) return { texto: "text-emerald-500", etiqueta: "Riesgo bajo" };
  if (porcentaje >= 50) return { texto: "text-amber-500", etiqueta: "Riesgo medio" };
  return { texto: "text-red-500", etiqueta: "Riesgo alto" };
}

export function ProyectoDetalle() {
  const { id } = useParams<{ id: string }>();
  const [proyecto, setProyecto] = useState<ProyectoDetalleType | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalMensaje, setModalMensaje] = useState<string | null>(null);
  const [enlaceCopiado, setEnlaceCopiado] = useState(false);

  async function compartir() {
    if (!proyecto) return;
    const url = window.location.href;
    const texto = `Mira este proyecto minero en MineLink: ${proyecto.nombre_proyecto} (${proyecto.mineral}, ${proyecto.region}) — MineScore ${proyecto.score_actual}/100`;
    // En celular abre el menú nativo de compartir (WhatsApp, etc.);
    // en PC copia el enlace al portapapeles.
    if (navigator.share) {
      try {
        await navigator.share({ title: proyecto.nombre_proyecto, text: texto, url });
        return;
      } catch {
        // usuario canceló el menú — no hacer nada
        return;
      }
    }
    await navigator.clipboard.writeText(`${texto}\n${url}`);
    setEnlaceCopiado(true);
    setTimeout(() => setEnlaceCopiado(false), 2500);
  }

  useEffect(() => {
    if (!id) return;
    setCargando(true);
    obtenerProyecto(id)
      .then((data) => {
        setProyecto(data);
        setError(null);
      })
      .catch(() => setError("No pudimos cargar este proyecto."))
      .finally(() => setCargando(false));
  }, [id]);

  if (cargando) {
    return <p className="p-8 text-center text-texto-suave dark:text-texto-suave-dark">Cargando...</p>;
  }

  if (error || !proyecto || !id) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-8 text-center">
        <p className="text-red-500">{error ?? "Proyecto no encontrado."}</p>
        <Link to="/proyectos" className="text-sm font-semibold text-acento underline">
          Volver a proyectos
        </Link>
      </div>
    );
  }

  const semaforo = calcularSemaforo(proyecto.score_actual, false);
  const destacado = proyecto.score_actual >= 85;

  const dims = proyecto.dimensiones;
  const pendientes = new Set(proyecto.brechas_pendientes);

  const estudiosDe = (dim: NombreDimension) =>
    Object.keys(INFO_BRECHA).filter((e) => DIMENSION_POR_ESTUDIO[e] === dim);

  const estudiosFormalizacion = [
    ...estudiosDe("legal"),
    ...estudiosDe("ambiental"),
    ...estudiosDe("seguridad"),
  ];
  const estudiosTecnicos = estudiosDe("tecnico");

  // Resumen ejecutivo generado a partir de datos reales del proyecto,
  // no texto inventado por dimensión/proyecto.
  const partesResumen: string[] = [
    `${proyecto.nombre_proyecto} es un proyecto de ${proyecto.mineral} en ${cap(proyecto.region)}, con un MineScore de ${proyecto.score_actual}/100 (${semaforo.etiqueta}).`,
  ];
  if (proyecto.descripcion_operacion) partesResumen.push(proyecto.descripcion_operacion);
  if (proyecto.capital_buscado) {
    partesResumen.push(
      `Actualmente busca ${proyecto.capital_buscado}${
        proyecto.uso_fondos ? ` para ${proyecto.uso_fondos.toLowerCase()}` : ""
      }.`
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link to="/proyectos" className="text-sm font-semibold text-acento underline">
        ← Volver a proyectos
      </Link>

      {/* HEADER */}
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-500">
          ✓ Proyecto Verificado
        </span>
        <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-semibold text-texto-suave dark:bg-white/10 dark:text-texto-suave-dark">
          {semaforo.etiqueta}
        </span>
        {destacado && (
          <span className="rounded-full bg-secundario/15 px-3 py-1 text-xs font-semibold text-secundario">
            ★ Destacado
          </span>
        )}
      </div>

      <h1 className="mt-3 text-3xl font-bold md:text-4xl">
        {proyecto.nombre_proyecto}{" "}
        <span className="text-texto-suave dark:text-texto-suave-dark">
          — {cap(proyecto.mineral)}
        </span>
      </h1>

      <p className="mt-2 flex flex-wrap items-center gap-3 text-texto-suave dark:text-texto-suave-dark">
        <span>📍 {cap(proyecto.region)}, Perú</span>
        {proyecto.ubicacion_maps && (
          <a
            href={proyecto.ubicacion_maps}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full bg-acento/10 px-3 py-1 text-xs font-semibold text-acento hover:bg-acento/20"
          >
            🗺 Ver ubicación en Google Maps
          </a>
        )}
        <button
          onClick={compartir}
          className="inline-flex items-center gap-1 rounded-full bg-secundario/10 px-3 py-1 text-xs font-semibold text-secundario hover:bg-secundario/20"
        >
          {enlaceCopiado ? "✓ Enlace copiado" : "↗ Compartir"}
        </button>
      </p>

      {/* GALERÍA */}
      <div className="mt-6">
        <GaleriaProyecto fotos={proyecto.fotos} />
      </div>

      {/* LAYOUT 2 COLUMNAS */}
      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-[7fr_3fr]">
        {/* CONTENIDO PRINCIPAL */}
        <div className="flex flex-col gap-6">
          {/* INFORMACIÓN GENERAL */}
          <Card>
            <h2 className="text-lg font-semibold">Información General</h2>
            <p className="mt-2">
              {proyecto.descripcion_generada ?? proyecto.descripcion_operacion ?? (
                <span className="text-texto-suave dark:text-texto-suave-dark">
                  Aún no se agregó una descripción.
                </span>
              )}
            </p>
            {proyecto.descripcion_generada && proyecto.descripcion_operacion && (
              <p className="mt-3 border-l-2 border-acento/40 pl-3 text-sm italic text-texto-suave dark:text-texto-suave-dark">
                "{proyecto.descripcion_operacion}" — descripción del minero
              </p>
            )}

            <div className="mt-5 grid grid-cols-2 gap-5 md:grid-cols-4">
              <Campo etiqueta="Mineral principal" valor={cap(proyecto.mineral)} />
              <Campo etiqueta="Etapa" valor={semaforo.etiqueta} />
              <Campo
                etiqueta="Tipo de mina"
                valor={proyecto.tipo_mina === "subterranea" ? "Subterránea" : "Tajo abierto"}
              />
              <Campo
                etiqueta="Producción / reservas"
                valor={proyecto.capacidad_produccion ?? NO_ESPECIFICADO}
              />
            </div>
          </Card>

          {/* INFORMACIÓN FINANCIERA */}
          <Card>
            <h2 className="text-lg font-semibold">Información Financiera</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-black/10 text-texto-suave dark:border-white/10 dark:text-texto-suave-dark">
                    <th className="py-2 font-medium">Indicador</th>
                    <th className="py-2 font-medium">Valor</th>
                    <th className="py-2 font-medium">Notas</th>
                  </tr>
                </thead>
                <tbody>
                  <FilaFinanciera
                    indicador="Capital buscado"
                    valor={proyecto.capital_buscado}
                    notas={proyecto.uso_fondos}
                  />
                  <FilaFinanciera indicador="Producción mensual" valor={proyecto.capacidad_produccion} />
                  <FilaFinanciera indicador="CAPEX" valor={null} />
                  <FilaFinanciera indicador="OPEX" valor={null} />
                  <FilaFinanciera indicador="Valor Neto Presente (VPN)" valor={null} />
                  <FilaFinanciera indicador="TIR" valor={null} />
                  <FilaFinanciera indicador="Payback" valor={null} />
                </tbody>
              </table>
            </div>
          </Card>

          {/* RESUMEN EJECUTIVO */}
          <Card acento>
            <h2 className="text-lg font-semibold">Resumen Ejecutivo</h2>
            <p className="mt-2">{partesResumen.join(" ")}</p>
          </Card>

          {/* ESTADO DE FORMALIZACIÓN */}
          <Card>
            <h2 className="text-lg font-semibold">Estado de Formalización</h2>
            <ul className="mt-3 grid grid-cols-1 gap-2.5 md:grid-cols-2">
              <ItemChecklist etiqueta="REINFO vigente" completo />
              {estudiosFormalizacion.map((estudio) => (
                <ItemChecklist
                  key={estudio}
                  etiqueta={INFO_BRECHA[estudio]?.texto ?? estudio}
                  completo={!pendientes.has(estudio)}
                />
              ))}
            </ul>
          </Card>

          {/* DOCUMENTACIÓN TÉCNICA */}
          <Card>
            <h2 className="text-lg font-semibold">Documentación Técnica</h2>
            <p className="mt-1 text-xs text-texto-suave dark:text-texto-suave-dark">
              Refleja lo que el proyecto declaró en su diagnóstico de formalización.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              {estudiosTecnicos.map((estudio) => {
                const disponible = !pendientes.has(estudio);
                return (
                  <div
                    key={estudio}
                    className="flex items-center gap-3 rounded-lg border border-black/10 px-4 py-3 dark:border-white/10"
                  >
                    <span className="text-xl">📄</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {INFO_BRECHA[estudio]?.texto ?? estudio}
                      </p>
                      <p
                        className={`text-xs ${
                          disponible
                            ? "text-emerald-500"
                            : "text-texto-suave dark:text-texto-suave-dark"
                        }`}
                      >
                        {disponible ? "Disponible" : "Pendiente"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {Object.keys(ETIQUETAS_DOCUMENTO_LEGAL).length > 0 && (
              <>
                <h3 className="mt-5 text-sm font-semibold">Documentos legales presentados</h3>
                <ul className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                  {Object.entries(ETIQUETAS_DOCUMENTO_LEGAL).map(([categoria, etiqueta]) => (
                    <ItemChecklist
                      key={categoria}
                      etiqueta={etiqueta}
                      completo={!!proyecto.documentos_presentados[categoria]}
                    />
                  ))}
                </ul>
              </>
            )}
          </Card>

          {/* MAPA */}
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Ubicación</h2>
              {proyecto.ubicacion_maps && (
                <a
                  href={proyecto.ubicacion_maps}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-acento underline"
                >
                  Abrir en Google Maps
                </a>
              )}
            </div>
            {proyecto.ubicacion_coords ? (
              <>
                <div className="mt-3 overflow-hidden rounded-lg">
                  <iframe
                    title="Ubicación del proyecto"
                    src={`https://maps.google.com/maps?q=${proyecto.ubicacion_coords}&z=14&t=h&output=embed`}
                    className="h-72 w-full border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allowFullScreen
                  />
                </div>
                <p className="mt-2 text-xs text-texto-suave dark:text-texto-suave-dark">
                  Zona aproximada declarada por el titular del proyecto.
                </p>
              </>
            ) : (
              <div className="mt-3 flex h-56 items-center justify-center rounded-lg border border-dashed border-black/10 text-sm text-texto-suave dark:border-white/10 dark:text-texto-suave-dark">
                El titular aún no registró la ubicación de su operación
              </div>
            )}
          </Card>

          {/* CRONOLOGÍA */}
          <Card>
            <h2 className="text-lg font-semibold">Cronología</h2>
            <div className="mt-4 flex flex-col gap-4 border-l-2 border-black/10 pl-4 dark:border-white/10">
              <PuntoCronologia titulo="Registro en MineLink" fecha={proyecto.created_at} />
              <PuntoCronologia
                titulo="Diagnóstico de formalización completado"
                fecha={proyecto.created_at}
              />
            </div>
          </Card>

          {/* FACTORES DE RIESGO */}
          {dims && (
            <Card>
              <h2 className="text-lg font-semibold">Factores de Riesgo</h2>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                {dims.legal && <FactorRiesgo etiqueta="Riesgo legal" dimension={dims.legal} />}
                {dims.ambiental && (
                  <FactorRiesgo etiqueta="Riesgo ambiental" dimension={dims.ambiental} />
                )}
                {(dims.operativo || dims.tecnico) && (
                  <FactorRiesgo
                    etiqueta="Riesgo operacional"
                    dimension={{
                      puntaje: (dims.operativo?.puntaje ?? 0) + (dims.tecnico?.puntaje ?? 0),
                      maximo: (dims.operativo?.maximo ?? 0) + (dims.tecnico?.maximo ?? 0),
                    }}
                  />
                )}
                <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
                  <p className="text-sm font-medium">Riesgo financiero</p>
                  <p className="mt-1 text-sm text-texto-suave dark:text-texto-suave-dark">
                    {proyecto.capital_buscado ? "Información parcial disponible" : "No evaluado"}
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* OPORTUNIDADES */}
          <Card>
            <h2 className="text-lg font-semibold">Oportunidades</h2>
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {!proyecto.bloqueado_actual && (
                <li>✓ REINFO vigente — habilitado para operar formalmente.</li>
              )}
              {dims?.legal && dims.legal.puntaje / dims.legal.maximo >= 0.8 && (
                <li>✓ Alto avance en formalización legal.</li>
              )}
              {dims?.ambiental && dims.ambiental.puntaje / dims.ambiental.maximo >= 0.8 && (
                <li>✓ Buen desempeño en gestión ambiental.</li>
              )}
              {proyecto.brechas_resueltas.length > 0 && (
                <li>
                  ✓ {proyecto.brechas_resueltas.length} estudio(s) resuelto(s) desde el diagnóstico
                  inicial.
                </li>
              )}
              {proyecto.capital_buscado && <li>✓ Busca activamente capital para crecer.</li>}
            </ul>
          </Card>
        </div>

        {/* SIDEBAR */}
        <div className="h-fit md:sticky md:top-6">
          <div className="flex flex-col gap-4 rounded-lg bg-tarjeta p-6 shadow-sm dark:bg-tarjeta-dark">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-texto-suave dark:text-texto-suave-dark">
                  MineScore™
                </p>
                <p className="text-4xl font-bold">{proyecto.score_actual}</p>
                <p className="text-xs text-texto-suave dark:text-texto-suave-dark">de 100 puntos</p>
              </div>
              <span className={`rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold ${semaforo.claseTexto}`}>
                {semaforo.etiqueta.toUpperCase()}
              </span>
            </div>

            {dims && (
              <div className="flex flex-col gap-3">
                {(Object.keys(dims) as NombreDimension[]).map((dim) => {
                  const { puntaje, maximo } = dims[dim];
                  const porcentaje = maximo > 0 ? Math.round((puntaje / maximo) * 100) : 0;
                  return (
                    <div key={dim}>
                      <div className="flex justify-between text-xs text-texto-suave dark:text-texto-suave-dark">
                        <span>{NOMBRES_DIMENSION[dim]}</span>
                        <span className="font-semibold text-texto dark:text-texto-dark">
                          {porcentaje}
                        </span>
                      </div>
                      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                        <div
                          className={`h-full rounded-full transition-all duration-[250ms] ${COLOR_BARRA_DIMENSION[dim]}`}
                          style={{ width: `${porcentaje}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-2 flex flex-col gap-2.5">
              <button
                onClick={() => setModalMensaje("Quiero más información sobre este proyecto.")}
                className="min-h-[44px] rounded-lg bg-acento font-semibold text-white transition duration-200 hover:opacity-90"
              >
                Me interesa este proyecto
              </button>
              <button
                onClick={() => window.print()}
                className="min-h-[44px] rounded-lg border border-black/10 font-semibold transition duration-200 dark:border-white/10"
              >
                Descargar Información
              </button>
            </div>
          </div>
        </div>
      </div>

      {modalMensaje !== null && (
        <InteresInversionModal
          operacionId={id}
          mensajeInicial={modalMensaje}
          onCerrar={() => setModalMensaje(null)}
        />
      )}
    </div>
  );
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Card({ children, acento }: { children: React.ReactNode; acento?: boolean }) {
  return (
    <div
      className={`rounded-lg bg-tarjeta p-6 shadow-sm dark:bg-tarjeta-dark ${
        acento ? "border-l-4 border-secundario" : ""
      }`}
    >
      {children}
    </div>
  );
}

function Campo({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <p className="text-xs text-texto-suave dark:text-texto-suave-dark">{etiqueta}</p>
      <p className="mt-0.5 text-lg font-bold">{valor}</p>
    </div>
  );
}

function FilaFinanciera({
  indicador,
  valor,
  notas,
}: {
  indicador: string;
  valor?: string | null;
  notas?: string | null;
}) {
  return (
    <tr className="border-b border-black/5 dark:border-white/5">
      <td className="py-3">{indicador}</td>
      <td
        className={`py-3 font-medium ${
          valor ? "" : "text-texto-suave dark:text-texto-suave-dark"
        }`}
      >
        {valor ?? NO_ESPECIFICADO}
      </td>
      <td className="py-3 text-texto-suave dark:text-texto-suave-dark">{notas ?? "—"}</td>
    </tr>
  );
}

function ItemChecklist({ etiqueta, completo }: { etiqueta: string; completo: boolean }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <span className={completo ? "text-emerald-500" : "text-texto-suave dark:text-texto-suave-dark"}>
        {completo ? "✓" : "—"}
      </span>
      <span className={completo ? "" : "text-texto-suave dark:text-texto-suave-dark"}>{etiqueta}</span>
    </li>
  );
}

function PuntoCronologia({ titulo, fecha }: { titulo: string; fecha: string }) {
  return (
    <div className="relative">
      <span className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-acento" />
      <p className="text-sm font-medium">{titulo}</p>
      <p className="text-xs text-texto-suave dark:text-texto-suave-dark">
        {new Date(fecha).toLocaleDateString("es-PE", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      </p>
    </div>
  );
}

function FactorRiesgo({
  etiqueta,
  dimension,
}: {
  etiqueta: string;
  dimension: { puntaje: number; maximo: number };
}) {
  const porcentaje = dimension.maximo > 0 ? Math.round((dimension.puntaje / dimension.maximo) * 100) : 0;
  const { texto, etiqueta: nivel } = colorRiesgo(porcentaje);
  return (
    <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
      <p className="text-sm font-medium">{etiqueta}</p>
      <p className={`mt-1 text-sm font-semibold ${texto}`}>
        {nivel} ({porcentaje}%)
      </p>
    </div>
  );
}
