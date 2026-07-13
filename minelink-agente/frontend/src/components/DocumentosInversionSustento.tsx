import { useEffect, useMemo, useRef, useState } from "react";
import { ImageIcon } from "lucide-react";
import { useMineroAuth } from "../context/MineroAuthContext";
import { INFO_BRECHA } from "../data/brechas";
import { ETIQUETA_CATEGORIA_INV, POR_ID_INV } from "../data/preguntasInversion";
import type { DocumentoOperacion } from "../types/documento";
import type { MineroPerfil } from "../types/minero";

const ACCEPT_FOTO_O_PDF = "application/pdf,image/jpeg,image/png,image/webp";
const ACCEPT_SOLO_FOTO = "image/jpeg,image/png,image/webp";
const FORMATOS_FOTO_O_PDF = "Formato: PDF o una foto del documento (JPG, PNG, WEBP)";
const FORMATOS_SOLO_FOTO = "Formato: JPG, PNG o WEBP";

// Categorías que son FOTOS de algo físico (no un documento): el backend
// solo les acepta imagen (ver uploads_config.CATEGORIAS_INVERSION), así
// que el selector de archivo debe coincidir para no invitar a subir un
// PDF que el servidor va a rechazar.
const CATEGORIAS_SOLO_FOTO = new Set([
  "fotos_equipo_maquinaria",
  "fotos_trabajadores",
  "muestreo_propio",
  "fotos_area_petitorio",
  "fotos_labores_antiguas",
]);

// Qué es cada documento, en lenguaje simple — mismo tratamiento que la
// descripción por categoría de "Respalda tu declaración" (INFO_BRECHA
// cubre los estudios compartidos con formalización; esto, los propios
// del Módulo INV).
const DESCRIPCION_CATEGORIA_INV: Record<string, string> = {
  titulo_concesion: "La resolución que te acredita como titular de la concesión.",
  liquidaciones_venta: "Las liquidaciones que te dio tu comprador al venderle mineral.",
  estados_financieros_libros: "Tus estados financieros o libros contables más recientes.",
  certificado_ley: "El análisis o certificado que indica la ley de tu mineral.",
  fotos_equipo_maquinaria: "Fotos de la maquinaria y el equipo que declaraste aportar.",
  fotos_trabajadores: "Fotos de tu gente trabajando en la operación.",
  muestreo_propio: "Fotos del muestreo que hiciste en el área.",
  fotos_area_petitorio: "Fotos del área de tu petitorio.",
  fotos_labores_antiguas: "Fotos de las labores antiguas que demuestran la producción anterior.",
  registro_opex: "Tu registro de costos operativos mensuales.",
  contratos_offtake: "El contrato de venta u offtake que tienes vigente.",
};

interface CategoriaSustento {
  categoria: string;
  etiqueta: string;
  declarado?: string;
  descripcion: string;
  accept: string;
  formatos: string;
}

interface Props {
  perfil: MineroPerfil;
  onGuardado: (perfil: MineroPerfil) => void;
  /** Evidencia puntual de lo que el minero RESPONDIÓ en el Módulo INV (ej.
   *  "aporto maquinaria" → foto de la maquinaria) — cada slot existe
   *  porque hay una respuesta suya detrás y la muestra como "Marcaste: X"
   *  (ver MineroPerfil.respaldos_declarados_inversion). Lo que no declaró
   *  no se le pide. */
  declarados: { codigo: string; pregunta_id: string; valor: string }[];
}

// Slots donde el archivo trae leyes de elementos (certificado de ley,
// análisis de laboratorio): al costado se declaran hasta 3 leyes
// (elemento + valor + unidad) que se guardan compuestas en
// Operacion.ley_promedio (ej. "Au: 2.5 g/TN · Cu: 1.2 %").
const CATEGORIAS_CON_LEYES = new Set(["certificado_ley", "analisis_laboratorio"]);

const UNIDADES_LEY = ["g/TN", "%", "oz/TN", "g/m³"];

interface FilaLey {
  elemento: string;
  valor: string;
  unidad: string;
}

const FILA_LEY_VACIA: FilaLey = { elemento: "", valor: "", unidad: UNIDADES_LEY[0] };

function parsearLeyes(texto: string): FilaLey[] {
  const filas: FilaLey[] = [];
  for (const parte of texto.split("·")) {
    const m = parte.trim().match(/^(.+?):\s*([\d.,]+)\s*(.*)$/);
    if (m) {
      filas.push({ elemento: m[1].trim(), valor: m[2], unidad: m[3].trim() || UNIDADES_LEY[0] });
    }
  }
  return filas;
}

function componerLeyes(filas: FilaLey[]): string {
  return filas
    .filter((f) => f.elemento.trim() && f.valor.trim())
    .map((f) => `${f.elemento.trim()}: ${f.valor.trim()} ${f.unidad}`)
    .join(" · ");
}

function etiquetaCategoria(codigo: string): string {
  return ETIQUETA_CATEGORIA_INV[codigo] ?? INFO_BRECHA[codigo]?.texto ?? codigo;
}

function etiquetaValorDeclarado(preguntaId: string, valor: string): string | undefined {
  return POR_ID_INV[preguntaId]?.opciones?.find((o) => o.valor === valor)?.etiqueta;
}

/** Editor de leyes del mineral al costado del slot del archivo: hasta 3
 *  filas de elemento + valor + unidad. El minero declara por escrito lo
 *  que su certificado/análisis dice, y el inversionista lo ve como texto
 *  sin tener que abrir la foto. */
function LeyesMineralEditor({
  valorInicial,
  onCambiar,
}: {
  valorInicial: string;
  onCambiar: (compuesto: string) => void;
}) {
  const [filas, setFilas] = useState<FilaLey[]>(() => {
    const parseadas = parsearLeyes(valorInicial);
    return parseadas.length > 0 ? parseadas : [{ ...FILA_LEY_VACIA }];
  });

  function actualizar(indice: number, cambios: Partial<FilaLey>) {
    const nuevas = filas.map((f, i) => (i === indice ? { ...f, ...cambios } : f));
    setFilas(nuevas);
    onCambiar(componerLeyes(nuevas));
  }

  return (
    <div className="mt-1.5 flex flex-col gap-1.5">
      {filas.map((fila, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input
            className="min-h-[36px] w-16 rounded-lg border border-black/10 bg-transparent px-2 text-xs dark:border-white/10"
            placeholder={`Ej: ${["Au", "Ag", "Cu"][i] ?? "Zn"}`}
            value={fila.elemento}
            onChange={(e) => actualizar(i, { elemento: e.target.value })}
          />
          <input
            className="min-h-[36px] w-20 rounded-lg border border-black/10 bg-transparent px-2 text-xs dark:border-white/10"
            placeholder="Ej: 2.5"
            inputMode="decimal"
            value={fila.valor}
            onChange={(e) => actualizar(i, { valor: e.target.value.replace(/[^\d.,]/g, "") })}
          />
          <select
            className="min-h-[36px] rounded-lg border border-black/10 bg-tarjeta px-1.5 text-xs text-texto dark:border-white/10 dark:bg-tarjeta-dark dark:text-texto-dark"
            value={fila.unidad}
            onChange={(e) => actualizar(i, { unidad: e.target.value })}
          >
            {UNIDADES_LEY.map((u) => (
              <option key={u} value={u} className="bg-white text-black">
                {u}
              </option>
            ))}
          </select>
        </div>
      ))}
      {filas.length < 3 && (
        <button
          onClick={() => setFilas([...filas, { ...FILA_LEY_VACIA }])}
          className="self-start text-xs font-semibold text-acento"
        >
          + Otra ley
        </button>
      )}
    </div>
  );
}

function parsearGeo(texto: string): { minerales: string; litologia: string } {
  if (texto.startsWith("Litología: ")) {
    return { minerales: "", litologia: texto.slice("Litología: ".length) };
  }
  const [minerales, litologia] = texto.split(" · Litología: ");
  return { minerales: minerales?.trim() ?? "", litologia: litologia?.trim() ?? "" };
}

function componerGeo(minerales: string, litologia: string): string {
  const m = minerales.trim();
  const l = litologia.trim();
  if (!m && !l) return "";
  if (!l) return m;
  return m ? `${m} · Litología: ${l}` : `Litología: ${l}`;
}

/** Datos geológicos al costado del slot del informe geológico: minerales
 *  de interés + litología — se guardan compuestos en
 *  Operacion.especie_mineral, que la ficha pública ya muestra. */
function GeologiaEditor({
  valorInicial,
  onCambiar,
}: {
  valorInicial: string;
  onCambiar: (compuesto: string) => void;
}) {
  const inicial = parsearGeo(valorInicial);
  const [minerales, setMinerales] = useState(inicial.minerales);
  const [litologia, setLitologia] = useState(inicial.litologia);

  return (
    <div className="mt-1.5 flex flex-col gap-1.5">
      <input
        className="min-h-[36px] w-full rounded-lg border border-black/10 bg-transparent px-2 text-xs dark:border-white/10"
        placeholder="Minerales de interés (Ej: calcopirita, oro nativo)"
        value={minerales}
        onChange={(e) => {
          setMinerales(e.target.value);
          onCambiar(componerGeo(e.target.value, litologia));
        }}
      />
      <input
        className="min-h-[36px] w-full rounded-lg border border-black/10 bg-transparent px-2 text-xs dark:border-white/10"
        placeholder="Litología (Ej: vetas de cuarzo en andesita)"
        value={litologia}
        onChange={(e) => {
          setLitologia(e.target.value);
          onCambiar(componerGeo(minerales, e.target.value));
        }}
      />
    </div>
  );
}

const UNIDADES_RESERVAS = ["TN", "m³", "kg", "oz"];

function parsearReservas(texto: string): { cantidad: string; unidad: string } {
  const m = texto.match(/^([\d.,]+)\s*(.*)$/);
  if (!m) return { cantidad: "", unidad: UNIDADES_RESERVAS[0] };
  return { cantidad: m[1].replace(/,/g, ""), unidad: m[2].trim() || UNIDADES_RESERVAS[0] };
}

/** Cantidad de reservas al costado del slot de estimación de recursos —
 *  se guarda como "50,000 TN" en Operacion.toneladas_estimadas, que la
 *  ficha pública ya muestra. */
function ReservasEditor({
  valorInicial,
  onCambiar,
}: {
  valorInicial: string;
  onCambiar: (compuesto: string) => void;
}) {
  const inicial = parsearReservas(valorInicial);
  const [cantidad, setCantidad] = useState(inicial.cantidad);
  const [unidad, setUnidad] = useState(inicial.unidad);

  function emitir(c: string, u: string) {
    const digitos = c.replace(/[^\d.]/g, "");
    onCambiar(digitos ? `${Number(digitos).toLocaleString("es-PE")} ${u}` : "");
  }

  return (
    <div className="mt-1.5 flex items-center gap-1.5">
      <input
        className="min-h-[36px] w-28 rounded-lg border border-black/10 bg-transparent px-2 text-xs dark:border-white/10"
        placeholder="Ej: 50000"
        inputMode="decimal"
        value={cantidad}
        onChange={(e) => {
          const v = e.target.value.replace(/[^\d.]/g, "");
          setCantidad(v);
          emitir(v, unidad);
        }}
      />
      <select
        className="min-h-[36px] rounded-lg border border-black/10 bg-tarjeta px-1.5 text-xs text-texto dark:border-white/10 dark:bg-tarjeta-dark dark:text-texto-dark"
        value={unidad}
        onChange={(e) => {
          setUnidad(e.target.value);
          emitir(cantidad, e.target.value);
        }}
      >
        {UNIDADES_RESERVAS.map((u) => (
          <option key={u} value={u} className="bg-white text-black">
            {u}
          </option>
        ))}
      </select>
    </div>
  );
}

/** "Respalda tu inversión" — mismo tratamiento visual que "Respalda tu
 *  declaración" en DocumentosMinero.tsx: un slot de subida por cada cosa
 *  que el minero declaró tener en el Módulo INV, con su "Marcaste: X". */
export function DocumentosInversionSustento({ perfil, onGuardado, declarados }: Props) {
  const { authFetch } = useMineroAuth();
  const [documentos, setDocumentos] = useState<DocumentoOperacion[]>([]);
  const [miniaturas, setMiniaturas] = useState<Record<number, string>>({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [vistaUrl, setVistaUrl] = useState<string | null>(null);
  const [vistaTipo, setVistaTipo] = useState("");
  const [leyPromedio, setLeyPromedio] = useState(perfil.ley_promedio ?? "");
  const [especieMineral, setEspecieMineral] = useState(perfil.especie_mineral ?? "");
  const [toneladasEstimadas, setToneladasEstimadas] = useState(
    perfil.toneladas_estimadas ?? ""
  );
  const inputsRef = useRef<Record<string, HTMLInputElement | null>>({});
  const debouncesRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => () => {
    Object.values(debouncesRef.current).forEach(clearTimeout);
  }, []);

  /** Guarda un campo de la operación con pausa corta — el endpoint es de
   *  actualización parcial, cada campo viaja solo sin pisar a los demás. */
  function guardarCampo(campo: string, valor: string) {
    if (debouncesRef.current[campo]) clearTimeout(debouncesRef.current[campo]);
    debouncesRef.current[campo] = setTimeout(async () => {
      const resp = await authFetch("/mineros/perfil-inversion", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [campo]: valor.trim() || null }),
      });
      if (resp.ok) onGuardado(await resp.json());
    }, 800);
  }

  function onCambiarLey(valor: string) {
    setLeyPromedio(valor);
    guardarCampo("ley_promedio", valor);
  }

  useEffect(() => {
    authFetch("/mineros/documentos")
      .then((r) => (r.ok ? r.json() : []))
      .then(setDocumentos)
      .catch(() => setError("No pudimos cargar tus archivos."))
      .finally(() => setCargando(false));
  }, [authFetch]);

  useEffect(() => {
    let cancelado = false;
    const urls: string[] = [];
    Promise.all(
      documentos.map(async (doc) => {
        if (!doc.content_type.startsWith("image/")) return null;
        const resp = await authFetch(`/mineros/documentos/${doc.id}/archivo`);
        if (!resp.ok) return null;
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        urls.push(url);
        return [doc.id, url] as const;
      })
    ).then((pares) => {
      if (cancelado) return;
      const mapa: Record<number, string> = {};
      for (const par of pares) if (par) mapa[par[0]] = par[1];
      setMiniaturas(mapa);
    });
    return () => {
      cancelado = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentos]);

  async function subir(categoria: string, archivo: File) {
    setSubiendo(categoria);
    setError(null);
    try {
      const form = new FormData();
      form.set("categoria", categoria);
      form.set("archivo", archivo);
      const resp = await authFetch("/mineros/documentos", { method: "POST", body: form });
      if (!resp.ok) {
        const detalle = await resp.json().catch(() => null);
        throw new Error(detalle?.detail ?? "No se pudo subir el archivo");
      }
      const doc = await resp.json();
      setDocumentos((actuales) => [doc, ...actuales]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir el archivo");
    } finally {
      setSubiendo(null);
    }
  }

  async function eliminar(doc: DocumentoOperacion) {
    if (!window.confirm(`¿Eliminar "${doc.nombre_original}"?`)) return;
    await authFetch(`/mineros/documentos/${doc.id}`, { method: "DELETE" });
    setDocumentos((actuales) => actuales.filter((d) => d.id !== doc.id));
  }

  async function ver(doc: DocumentoOperacion) {
    const resp = await authFetch(`/mineros/documentos/${doc.id}/archivo`);
    if (!resp.ok) {
      setError("No se pudo abrir el archivo.");
      return;
    }
    const blob = await resp.blob();
    setVistaUrl(URL.createObjectURL(blob));
    setVistaTipo(doc.content_type);
  }

  const slots = useMemo(() => {
    const mapa = new Map<string, CategoriaSustento>();
    for (const d of declarados) {
      if (mapa.has(d.codigo)) continue;
      const soloFoto = CATEGORIAS_SOLO_FOTO.has(d.codigo);
      mapa.set(d.codigo, {
        categoria: d.codigo,
        etiqueta: etiquetaCategoria(d.codigo),
        declarado: etiquetaValorDeclarado(d.pregunta_id, d.valor),
        descripcion:
          DESCRIPCION_CATEGORIA_INV[d.codigo] ?? INFO_BRECHA[d.codigo]?.resuelve ?? "",
        accept: soloFoto ? ACCEPT_SOLO_FOTO : ACCEPT_FOTO_O_PDF,
        formatos: soloFoto ? FORMATOS_SOLO_FOTO : FORMATOS_FOTO_O_PDF,
      });
    }
    return [...mapa.values()];
  }, [declarados]);

  if (slots.length === 0) return null;

  return (
    <div className="rounded-lg bg-tarjeta p-5 dark:bg-tarjeta-dark">
      <h2 className="font-semibold">Respalda tu inversión</h2>
      <p className="mt-1 text-sm text-texto-suave dark:text-texto-suave-dark">
        Sube un archivo por cada cosa que declaraste en tu perfil de inversión. Se guardan solos
        al subirlos — puedes actualizarlos cuando quieras.
      </p>

      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      {cargando && <p className="mt-2 text-sm">Cargando...</p>}

      {!cargando && (
        <div className="mt-4 flex flex-col gap-4">
          {slots.map((cat) => {
            const archivos = documentos.filter((d) => d.categoria === cat.categoria);
            const conLeyes = CATEGORIAS_CON_LEYES.has(cat.categoria);
            return (
              <div
                key={cat.categoria}
                className="rounded-lg border border-black/10 p-3 dark:border-white/10"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{cat.etiqueta}</p>
                    {cat.declarado && (
                      <p className="mt-0.5 text-xs font-semibold text-acento">
                        Marcaste: {cat.declarado}
                      </p>
                    )}
                    {cat.descripcion && (
                      <p className="text-xs text-texto-suave dark:text-texto-suave-dark">
                        {cat.descripcion}
                      </p>
                    )}
                    <p className="mt-0.5 text-xs text-texto-suave dark:text-texto-suave-dark">
                      {cat.formatos}
                    </p>
                    {conLeyes && (
                      <>
                        <p className="mt-1.5 text-xs text-texto-suave dark:text-texto-suave-dark">
                          Escribe las leyes que indica tu documento:
                        </p>
                        <LeyesMineralEditor
                          valorInicial={leyPromedio}
                          onCambiar={onCambiarLey}
                        />
                      </>
                    )}
                    {cat.categoria === "informe_geologico" && (
                      <>
                        <p className="mt-1.5 text-xs text-texto-suave dark:text-texto-suave-dark">
                          Cuéntanos de tu geología:
                        </p>
                        <GeologiaEditor
                          valorInicial={especieMineral}
                          onCambiar={(v) => {
                            setEspecieMineral(v);
                            guardarCampo("especie_mineral", v);
                          }}
                        />
                      </>
                    )}
                    {cat.categoria === "estimacion_recursos" && (
                      <>
                        <p className="mt-1.5 text-xs text-texto-suave dark:text-texto-suave-dark">
                          ¿Cuántas reservas estima tu documento?
                        </p>
                        <ReservasEditor
                          valorInicial={toneladasEstimadas}
                          onCambiar={(v) => {
                            setToneladasEstimadas(v);
                            guardarCampo("toneladas_estimadas", v);
                          }}
                        />
                      </>
                    )}
                  </div>
                  <button
                    onClick={() => inputsRef.current[cat.categoria]?.click()}
                    disabled={subiendo === cat.categoria}
                    className="min-h-[36px] shrink-0 rounded-lg border border-acento px-3 text-xs font-semibold text-acento disabled:opacity-50"
                  >
                    {subiendo === cat.categoria
                      ? "Subiendo..."
                      : archivos.length > 0
                        ? "Actualizar"
                        : "+ Agregar"}
                  </button>
                  <input
                    ref={(el) => {
                      inputsRef.current[cat.categoria] = el;
                    }}
                    type="file"
                    accept={cat.accept}
                    className="hidden"
                    onChange={(e) => {
                      const archivo = e.target.files?.[0];
                      if (archivo) subir(cat.categoria, archivo);
                      e.target.value = "";
                    }}
                  />
                </div>

                {archivos.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-3">
                    {archivos.map((doc) => (
                      <div key={doc.id} className="flex w-24 flex-col items-center gap-1">
                        <button
                          onClick={() => ver(doc)}
                          title={doc.nombre_original}
                          className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5"
                        >
                          {miniaturas[doc.id] ? (
                            <img
                              src={miniaturas[doc.id]}
                              className="h-full w-full object-cover"
                              alt={doc.nombre_original}
                            />
                          ) : (
                            <ImageIcon
                              size={22}
                              strokeWidth={1.75}
                              className="text-texto-suave dark:text-texto-suave-dark"
                              aria-hidden
                            />
                          )}
                        </button>
                        {doc.estado_revision === "aprobado" && (
                          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            Aprobado
                          </span>
                        )}
                        {/* "pendiente" no muestra texto — solo se etiquetan
                            aprobado/rechazado. */}
                        {doc.estado_revision === "rechazado" && (
                          <span
                            className="text-center text-xs font-semibold text-red-500"
                            title={doc.motivo_rechazo ?? undefined}
                          >
                            Rechazado{doc.motivo_rechazo ? `: ${doc.motivo_rechazo}` : ""}
                          </span>
                        )}
                        {doc.estado_revision !== "aprobado" && (
                          <button
                            onClick={() => eliminar(doc)}
                            className="text-xs font-semibold text-red-500"
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {vistaUrl && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/70 p-2 md:p-6">
          <div className="mb-2 flex items-center justify-between text-white">
            <p className="font-medium">Vista previa</p>
            <button
              onClick={() => setVistaUrl(null)}
              className="min-h-[44px] rounded-lg bg-white/10 px-4 font-semibold"
            >
              Cerrar
            </button>
          </div>
          {vistaTipo.startsWith("image/") ? (
            <img src={vistaUrl} className="mx-auto max-h-full max-w-full object-contain" />
          ) : (
            <iframe src={vistaUrl} title="Vista previa" className="flex-1 rounded-lg bg-white" />
          )}
        </div>
      )}
    </div>
  );
}
