import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { AdminLayout } from "../../components/AdminLayout";
import { CampoTelefono } from "../../components/CampoTelefono";
import { useAuth } from "../../context/AuthContext";
import { DEPARTAMENTOS } from "../../data/departamentos";
import { INFO_BRECHA } from "../../data/brechas";
import { NOMBRES_DIMENSION } from "../../data/preguntas";
import { ESTUDIOS_POR_DIMENSION, ORDEN_DIMENSIONES } from "../../data/estudiosPorDimension";
import type { Empresa, TipoProveedor } from "../../types/empresa";

type Formulario = {
  tipo: TipoProveedor;
  nombre: string;
  ruc: string;
  colegiatura: string;
  anios_servicio: string;
  whatsapp: string;
  email: string;
  regiones_json: string[];
  estudios_json: string[];
  activa: boolean;
  rating: string;
  num_resenas: string;
};

/** Criterios de ordenamiento dentro de cada bloque (pedido de Esthiven:
 * rating y nº de reseñas primero; sin rating van al final). */
type Orden = "rating" | "resenas" | "anios" | "nombre";

const ORDENES: { valor: Orden; etiqueta: string }[] = [
  { valor: "rating", etiqueta: "Mejor rating" },
  { valor: "resenas", etiqueta: "Más reseñas" },
  { valor: "anios", etiqueta: "Más años de servicio" },
  { valor: "nombre", etiqueta: "Nombre (A-Z)" },
];

function comparar(a: Empresa, b: Empresa, orden: Orden): number {
  if (orden === "nombre") return a.nombre.localeCompare(b.nombre);
  if (orden === "anios") return b.anios_servicio - a.anios_servicio;
  if (orden === "resenas")
    return (b.num_resenas ?? 0) - (a.num_resenas ?? 0) || (b.rating ?? -1) - (a.rating ?? -1);
  return (b.rating ?? -1) - (a.rating ?? -1) || (b.num_resenas ?? 0) - (a.num_resenas ?? 0);
}

const FORMULARIO_VACIO: Formulario = {
  tipo: "empresa",
  nombre: "",
  ruc: "",
  colegiatura: "",
  anios_servicio: "",
  whatsapp: "",
  email: "",
  regiones_json: [],
  estudios_json: [],
  activa: true,
  rating: "",
  num_resenas: "",
};

function validar(f: Formulario, esEdicion: boolean): Record<string, string> {
  const errores: Record<string, string> = {};
  if (!f.nombre.trim()) errores.nombre = "El nombre es obligatorio";
  // Al EDITAR se permite RUC/colegiatura vacíos (julio 2026): las empresas
  // importadas del CSV externo llegan sin esos datos, y exigirlos aquí
  // impediría corregirles cualquier otra cosa (estudios, región...) hasta
  // inventarles un RUC. Si se escribe algo, el formato sí se valida.
  if (f.tipo === "empresa" && !/^\d{11}$/.test(f.ruc) && !(esEdicion && !f.ruc.trim()))
    errores.ruc = "El RUC debe tener 11 dígitos numéricos";
  if (
    f.tipo === "consultor" &&
    !/^\d+$/.test(f.colegiatura.trim()) &&
    !(esEdicion && !f.colegiatura.trim())
  )
    errores.colegiatura = "Ingresa solo el número de colegiatura (ej. 123456)";
  if (!f.anios_servicio || Number(f.anios_servicio) < 0)
    errores.anios_servicio = "Ingresa un número válido de años";
  if (!/^\d{9}$/.test(f.whatsapp))
    errores.whatsapp = "Ingresa los 9 dígitos del número (sin el +51)";
  if (f.regiones_json.length === 0)
    errores.regiones_json = "Marca al menos 1 departamento";
  if (f.estudios_json.length === 0)
    errores.estudios_json = "Marca al menos 1 estudio";
  if (f.rating && (Number(f.rating) < 0 || Number(f.rating) > 5 || isNaN(Number(f.rating))))
    errores.rating = "El rating va de 0 a 5 (ej. 4.5)";
  return errores;
}

export function AdminEmpresas() {
  const { authFetch } = useAuth();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [form, setForm] = useState<Formulario>(FORMULARIO_VACIO);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [cvUrl, setCvUrl] = useState<string | null>(null);
  const [cvNombre, setCvNombre] = useState<string>("");
  const [vista, setVista] = useState<"bloques" | "lista">("bloques");
  const [orden, setOrden] = useState<Orden>("rating");

  function cargar() {
    setCargando(true);
    authFetch("/admin/empresas")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => {
        setEmpresas(data);
        setErrorGeneral(null);
      })
      .catch(() => setErrorGeneral("No pudimos cargar las empresas."))
      .finally(() => setCargando(false));
  }

  useEffect(cargar, []); // eslint-disable-line react-hooks/exhaustive-deps

  function abrirNueva() {
    setEditandoId(null);
    setForm(FORMULARIO_VACIO);
    setErrores({});
    setMostrarForm(true);
  }

  function abrirEdicion(empresa: Empresa) {
    setEditandoId(empresa.id);
    setForm({
      tipo: empresa.tipo,
      nombre: empresa.nombre,
      ruc: empresa.ruc ?? "",
      colegiatura: empresa.colegiatura ?? "",
      anios_servicio: String(empresa.anios_servicio),
      whatsapp: empresa.whatsapp.replace(/^\+51/, ""),
      email: empresa.email ?? "",
      regiones_json: empresa.regiones_json,
      estudios_json: empresa.estudios_json,
      activa: empresa.activa,
      rating: empresa.rating != null ? String(empresa.rating) : "",
      num_resenas: empresa.num_resenas != null ? String(empresa.num_resenas) : "",
    });
    setErrores({});
    setMostrarForm(true);
  }

  function alternarLista(campo: "regiones_json" | "estudios_json", valor: string) {
    setForm((f) => ({
      ...f,
      [campo]: f[campo].includes(valor)
        ? f[campo].filter((v) => v !== valor)
        : [...f[campo], valor],
    }));
  }

  async function guardar() {
    const erroresValidacion = validar(form, editandoId != null);
    setErrores(erroresValidacion);
    if (Object.keys(erroresValidacion).length > 0) return;

    setGuardando(true);
    const cuerpo = {
      tipo: form.tipo,
      nombre: form.nombre.trim(),
      // "|| null": un string vacío rompería la validación de formato del
      // backend — vacío significa "sin dato", no "RUC de 0 dígitos".
      ruc: form.tipo === "empresa" ? form.ruc.trim() || null : null,
      colegiatura: form.tipo === "consultor" ? form.colegiatura.trim() || null : null,
      anios_servicio: Number(form.anios_servicio),
      whatsapp: `+51${form.whatsapp}`,
      email: form.email.trim() || null,
      regiones_json: form.regiones_json,
      estudios_json: form.estudios_json,
      activa: form.activa,
      rating: form.rating ? Number(form.rating) : null,
      num_resenas: form.num_resenas ? Number(form.num_resenas) : null,
    };

    try {
      const resp = await authFetch(
        editandoId ? `/admin/empresas/${editandoId}` : "/admin/empresas",
        {
          method: editandoId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cuerpo),
        }
      );
      if (!resp.ok) {
        const detalle = await resp.json().catch(() => null);
        throw new Error(detalle?.detail ?? "No se pudo guardar la empresa");
      }
      setMostrarForm(false);
      cargar();
    } catch (e) {
      setErrores({ general: e instanceof Error ? e.message : "Error al guardar" });
    } finally {
      setGuardando(false);
    }
  }

  async function desactivar(empresa: Empresa) {
    await authFetch(`/admin/empresas/${empresa.id}`, { method: "DELETE" });
    cargar();
  }

  async function eliminar(empresa: Empresa) {
    if (
      !window.confirm(
        `¿Eliminar definitivamente a "${empresa.nombre}"? Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }
    await authFetch(`/admin/empresas/${empresa.id}/eliminar`, { method: "DELETE" });
    cargar();
  }

  async function activar(empresa: Empresa) {
    await authFetch(`/admin/empresas/${empresa.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: empresa.tipo,
        nombre: empresa.nombre,
        ruc: empresa.ruc,
        colegiatura: empresa.colegiatura,
        anios_servicio: empresa.anios_servicio,
        whatsapp: empresa.whatsapp,
        email: empresa.email,
        regiones_json: empresa.regiones_json,
        estudios_json: empresa.estudios_json,
        activa: true,
        rating: empresa.rating,
        num_resenas: empresa.num_resenas,
      }),
    });
    cargar();
  }

  async function verCV(empresa: Empresa) {
    const resp = await authFetch(`/admin/empresas/${empresa.id}/cv`);
    if (!resp.ok) {
      setErrorGeneral("No se pudo abrir el CV.");
      return;
    }
    // Se visualiza embebido en la misma página (un <iframe> con blob: URL);
    // abrir en pestaña nueva vía window.open es poco confiable: varios
    // navegadores lo bloquean por ser async o lo tratan como descarga.
    const blob = await resp.blob();
    setCvUrl(URL.createObjectURL(blob));
    setCvNombre(empresa.nombre);
  }

  function cerrarCV() {
    if (cvUrl) URL.revokeObjectURL(cvUrl);
    setCvUrl(null);
    setCvNombre("");
  }

  async function importarArchivo(archivo: File) {
    setErrorGeneral(null);
    const formData = new FormData();
    formData.set("archivo", archivo);
    const resp = await authFetch("/admin/empresas/importar", {
      method: "POST",
      body: formData,
    });
    if (!resp.ok) {
      const detalle = await resp.json().catch(() => null);
      setErrorGeneral(detalle?.detail ?? "No se pudo importar el archivo.");
      return;
    }
    const r = await resp.json();
    window.alert(
      `Importación terminada:\n• ${r.creadas} creadas\n• ${r.saltadas} saltadas (ya existían)` +
        (r.errores.length > 0
          ? `\n• ${r.errores.length} con error:\n${r.errores.slice(0, 10).join("\n")}`
          : "")
    );
    cargar();
  }

  const pendientes = empresas.filter((e) => e.tipo === "consultor" && !e.activa);

  const ordenadas = [...empresas].sort((a, b) => comparar(a, b, orden));

  // Vista por bloques: una empresa aparece en cada dimensión donde tenga
  // al menos un estudio marcado (puede repetirse en varios bloques).
  const bloques = ORDEN_DIMENSIONES.map((dim) => ({
    dim,
    titulo: NOMBRES_DIMENSION[dim],
    lista: ordenadas.filter((e) =>
      e.estudios_json.some((est) => ESTUDIOS_POR_DIMENSION[dim].includes(est))
    ),
  })).filter((b) => b.lista.length > 0);

  const sinClasificar = ordenadas.filter(
    (e) =>
      !ORDEN_DIMENSIONES.some((dim) =>
        e.estudios_json.some((est) => ESTUDIOS_POR_DIMENSION[dim].includes(est))
      )
  );

  return (
    <AdminLayout>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Empresas y consultores</h1>
        <div className="flex gap-2">
          <label className="flex min-h-[44px] cursor-pointer items-center border border-acento px-4 font-semibold text-acento">
            Importar CSV
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const archivo = e.target.files?.[0];
                if (archivo) importarArchivo(archivo);
                e.target.value = "";
              }}
            />
          </label>
          <button
            onClick={abrirNueva}
            className="min-h-[44px] bg-acento px-4 font-semibold text-white"
          >
            + Nuevo
          </button>
        </div>
      </div>
      <p className="-mt-3 mb-4 text-xs text-texto-suave dark:text-texto-suave-dark">
        Acepta dos formatos de CSV: el propio (tipo, nombre, ruc, colegiatura,
        anios_servicio, regiones, estudios, whatsapp, email, rating, num_resenas —
        listas separadas por ";") o directamente el archivo del scraper de Google
        Maps (name, address, phone, website...) tal cual, sin convertirlo. Todo lo
        importado entra como "Inactiva" hasta que lo revises. Los duplicados se
        saltan solos.
      </p>

      {pendientes.length > 0 && (
        <p className="mb-4 bg-secundario/15 p-3 text-sm text-secundario">
          Tienes {pendientes.length} postulación(es) de consultor independiente pendiente(s)
          de revisión (aparecen como "Inactiva" abajo).
        </p>
      )}

      {errorGeneral && <p className="text-red-500">{errorGeneral}</p>}
      {cargando && <p>Cargando...</p>}

      {!cargando && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex overflow-hidden border border-black/10 text-sm font-semibold dark:border-white/10">
            <button
              onClick={() => setVista("bloques")}
              className={`min-h-[36px] px-3 ${
                vista === "bloques" ? "bg-acento text-white" : ""
              }`}
            >
              Por bloques
            </button>
            <button
              onClick={() => setVista("lista")}
              className={`min-h-[36px] px-3 ${
                vista === "lista" ? "bg-acento text-white" : ""
              }`}
            >
              Lista completa
            </button>
          </div>
          <label className="flex items-center gap-2 text-sm">
            Ordenar por:
            <select
              value={orden}
              onChange={(e) => setOrden(e.target.value as Orden)}
              className="min-h-[36px] border border-black/10 bg-tarjeta px-2 dark:border-white/10 dark:bg-tarjeta-dark"
            >
              {ORDENES.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.etiqueta}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {!cargando && vista === "lista" && renderTabla(ordenadas)}

      {!cargando && vista === "bloques" && (
        <div className="flex flex-col gap-6">
          {bloques.map((b) => (
            <div key={b.dim}>
              <h2 className="mb-2 text-lg font-semibold">
                {b.titulo}{" "}
                <span className="text-sm font-normal text-texto-suave dark:text-texto-suave-dark">
                  ({b.lista.length})
                </span>
              </h2>
              {renderTabla(b.lista)}
            </div>
          ))}
          {sinClasificar.length > 0 && (
            <div>
              <h2 className="mb-2 text-lg font-semibold">
                Sin estudios asignados{" "}
                <span className="text-sm font-normal text-texto-suave dark:text-texto-suave-dark">
                  ({sinClasificar.length})
                </span>
              </h2>
              {renderTabla(sinClasificar)}
            </div>
          )}
          {bloques.length === 0 && sinClasificar.length === 0 && (
            <p className="text-sm text-texto-suave dark:text-texto-suave-dark">
              Todavía no hay empresas ni consultores registrados.
            </p>
          )}
        </div>
      )}

      {renderModales()}
    </AdminLayout>
  );

  // Tabla reutilizada por la vista de lista y por cada bloque de dimensión
  function renderTabla(lista: Empresa[]) {
    return (
      <div className="overflow-x-auto bg-tarjeta dark:bg-tarjeta-dark">
        <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-black/10 dark:border-white/10">
                <th className="p-3">Tipo</th>
                <th className="p-3">Nombre</th>
                <th className="p-3">RUC / Colegiatura</th>
                <th className="p-3">Años</th>
                <th className="p-3">Rating</th>
                <th className="p-3">Reseñas</th>
                <th className="p-3">Departamentos</th>
                <th className="p-3">Estado</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((e) => (
                <tr key={e.id} className="border-b border-black/5 align-top dark:border-white/5">
                  <td className="p-3 pt-3.5">
                    <span className="whitespace-nowrap bg-acento/15 px-2 py-0.5 text-xs font-semibold text-acento">
                      {e.tipo === "consultor" ? "Consultor" : "Empresa"}
                    </span>
                  </td>
                  {/* min-w generoso: sin él, la tabla estruja esta columna y
                      el nombre cae en vertical palabra por palabra (feo,
                      reportado julio 2026). El contexto va truncado a una
                      línea por dato — el detalle completo vive en Editar. */}
                  <td className="min-w-[20rem] max-w-[26rem] p-3">
                    <p className="font-medium leading-snug">{e.nombre}</p>
                    {(e.categoria || e.direccion || e.telefono || e.web) && (
                      <div className="mt-1 flex flex-col gap-0.5 text-xs text-texto-suave dark:text-texto-suave-dark">
                        {e.categoria && (
                          <span className="truncate">
                            {e.categoria}
                            {e.keyword ? ` · búsqueda: ${e.keyword}` : ""}
                          </span>
                        )}
                        {e.direccion && <span className="truncate">{e.direccion}</span>}
                        <span className="flex flex-wrap gap-x-2">
                          {e.telefono && <span className="whitespace-nowrap">Tel: {e.telefono}</span>}
                          {e.web && (
                            <a
                              href={e.web}
                              target="_blank"
                              rel="noreferrer"
                              className="whitespace-nowrap text-acento underline"
                            >
                              Sitio web
                            </a>
                          )}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap p-3 pt-4 font-mono text-xs">
                    {e.ruc ?? e.colegiatura ?? "—"}
                  </td>
                  <td className="p-3 pt-3.5">{e.anios_servicio}</td>
                  <td className="whitespace-nowrap p-3 pt-3.5">
                    {e.rating != null ? (
                      <span className="inline-flex items-center gap-1">
                        <Star size={13} strokeWidth={2} fill="currentColor" className="text-amber-500" aria-hidden />
                        {e.rating}
                      </span>
                    ) : (
                      <span className="text-texto-suave dark:text-texto-suave-dark">—</span>
                    )}
                  </td>
                  <td className="p-3 pt-3.5">{e.num_resenas ?? 0}</td>
                  <td className="max-w-[10rem] p-3 pt-3.5 capitalize">
                    <span className="truncate">{e.regiones_json.join(", ")}</span>
                  </td>
                  <td className="p-3 pt-3.5">
                    <span
                      className={`whitespace-nowrap px-2 py-0.5 text-xs font-semibold ${
                        e.activa
                          ? "bg-emerald-500/15 text-emerald-500"
                          : "bg-red-500/15 text-red-500"
                      }`}
                    >
                      {e.activa ? "Activa" : "Inactiva"}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-nowrap gap-2">
                    {e.cv_filename && (
                      <button
                        onClick={() => verCV(e)}
                        className="min-h-[32px] rounded border border-acento/30 px-2 text-xs font-semibold text-acento"
                      >
                        Ver CV
                      </button>
                    )}
                    <button
                      onClick={() => abrirEdicion(e)}
                      className="min-h-[32px] rounded border border-black/10 px-2 text-xs font-semibold dark:border-white/10"
                    >
                      Editar
                    </button>
                    {e.activa ? (
                      <button
                        onClick={() => desactivar(e)}
                        className="min-h-[32px] rounded border border-red-500/30 px-2 text-xs font-semibold text-red-500"
                      >
                        Desactivar
                      </button>
                    ) : (
                      <button
                        onClick={() => activar(e)}
                        className="min-h-[32px] rounded border border-emerald-500/30 px-2 text-xs font-semibold text-emerald-500"
                      >
                        Activar
                      </button>
                    )}
                    <button
                      onClick={() => eliminar(e)}
                      className="min-h-[32px] whitespace-nowrap rounded bg-red-500 px-2 text-xs font-semibold text-white"
                    >
                      Eliminar
                    </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
        </table>
      </div>
    );
  }

  // Modales (formulario de empresa y visor de CV)
  function renderModales() {
    return (
      <>
      {mostrarForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-8 w-full max-w-lg bg-tarjeta p-6 dark:bg-tarjeta-dark">
            <h2 className="mb-4 text-lg font-semibold">
              {editandoId ? "Editar" : "Nuevo"}
            </h2>

            <div className="flex flex-col gap-3">
              <div className="flex gap-4 text-sm font-medium">
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    checked={form.tipo === "empresa"}
                    onChange={() => setForm({ ...form, tipo: "empresa" })}
                  />
                  Empresa
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    checked={form.tipo === "consultor"}
                    onChange={() => setForm({ ...form, tipo: "consultor" })}
                  />
                  Consultor independiente
                </label>
              </div>

              <div>
                <input
                  className="min-h-[44px] w-full border border-black/10 bg-transparent px-3 dark:border-white/10"
                  placeholder={form.tipo === "empresa" ? "Nombre de la empresa" : "Nombre del consultor"}
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                />
                {errores.nombre && <p className="mt-1 text-xs text-red-500">{errores.nombre}</p>}
              </div>

              {form.tipo === "empresa" ? (
                <div>
                  <input
                    className="min-h-[44px] w-full border border-black/10 bg-transparent px-3 dark:border-white/10"
                    placeholder="RUC (11 dígitos)"
                    value={form.ruc}
                    onChange={(e) => setForm({ ...form, ruc: e.target.value })}
                  />
                  {errores.ruc && <p className="mt-1 text-xs text-red-500">{errores.ruc}</p>}
                </div>
              ) : (
                <div>
                  <input
                    className="min-h-[44px] w-full border border-black/10 bg-transparent px-3 dark:border-white/10"
                    placeholder="N° de colegiatura (solo el número, ej. 123456)"
                    value={form.colegiatura}
                    onChange={(e) => setForm({ ...form, colegiatura: e.target.value })}
                  />
                  {errores.colegiatura && (
                    <p className="mt-1 text-xs text-red-500">{errores.colegiatura}</p>
                  )}
                </div>
              )}

              <div>
                <input
                  type="number"
                  min={0}
                  className="min-h-[44px] w-full border border-black/10 bg-transparent px-3 dark:border-white/10"
                  placeholder="Años de servicio"
                  value={form.anios_servicio}
                  onChange={(e) => setForm({ ...form, anios_servicio: e.target.value })}
                />
                {errores.anios_servicio && (
                  <p className="mt-1 text-xs text-red-500">{errores.anios_servicio}</p>
                )}
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <input
                    type="number"
                    min={0}
                    max={5}
                    step={0.1}
                    className="min-h-[44px] w-full border border-black/10 bg-transparent px-3 dark:border-white/10"
                    placeholder="Rating 0-5 (ej. 4.5)"
                    value={form.rating}
                    onChange={(e) => setForm({ ...form, rating: e.target.value })}
                  />
                  {errores.rating && (
                    <p className="mt-1 text-xs text-red-500">{errores.rating}</p>
                  )}
                </div>
                <input
                  type="number"
                  min={0}
                  className="min-h-[44px] flex-1 border border-black/10 bg-transparent px-3 dark:border-white/10"
                  placeholder="N° de reseñas"
                  value={form.num_resenas}
                  onChange={(e) => setForm({ ...form, num_resenas: e.target.value })}
                />
              </div>

              <div>
                <CampoTelefono
                  value={form.whatsapp}
                  onChange={(v) => setForm({ ...form, whatsapp: v })}
                />
                {errores.whatsapp && (
                  <p className="mt-1 text-xs text-red-500">{errores.whatsapp}</p>
                )}
              </div>

              <input
                className="min-h-[44px] w-full border border-black/10 bg-transparent px-3 dark:border-white/10"
                placeholder="Email (opcional)"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />

              <div>
                <p className="mb-1 text-sm font-medium">Departamentos donde trabaja</p>
                <div className="flex flex-wrap gap-3">
                  {DEPARTAMENTOS.map((d) => (
                    <label key={d} className="flex items-center gap-1.5 text-sm">
                      <input
                        type="checkbox"
                        checked={form.regiones_json.includes(d.toLowerCase())}
                        onChange={() => alternarLista("regiones_json", d.toLowerCase())}
                      />
                      {d}
                    </label>
                  ))}
                </div>
                {errores.regiones_json && (
                  <p className="mt-1 text-xs text-red-500">{errores.regiones_json}</p>
                )}
              </div>

              <div>
                <p className="mb-1 text-sm font-medium">Estudios que realiza</p>
                <div className="flex max-h-64 flex-col gap-3 overflow-y-auto border border-black/10 p-3 dark:border-white/10">
                  {ORDEN_DIMENSIONES.map((dim) => (
                    <div key={dim}>
                      <p className="mb-1 text-xs font-semibold uppercase text-texto-suave dark:text-texto-suave-dark">
                        {NOMBRES_DIMENSION[dim]}
                      </p>
                      <div className="flex flex-col gap-1">
                        {ESTUDIOS_POR_DIMENSION[dim].map((estudio) => (
                          <label key={estudio} className="flex items-center gap-1.5 text-sm">
                            <input
                              type="checkbox"
                              checked={form.estudios_json.includes(estudio)}
                              onChange={() => alternarLista("estudios_json", estudio)}
                            />
                            {INFO_BRECHA[estudio].texto}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {errores.estudios_json && (
                  <p className="mt-1 text-xs text-red-500">{errores.estudios_json}</p>
                )}
              </div>

              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={form.activa}
                  onChange={(e) => setForm({ ...form, activa: e.target.checked })}
                />
                Activa (visible para los mineros)
              </label>

              {errores.general && <p className="text-sm text-red-500">{errores.general}</p>}
            </div>

            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setMostrarForm(false)}
                className="min-h-[44px] flex-1 border border-black/10 font-semibold dark:border-white/10"
              >
                Cancelar
              </button>
              <button
                disabled={guardando}
                onClick={guardar}
                className="min-h-[44px] flex-1 bg-acento font-semibold text-white disabled:opacity-50"
              >
                {guardando ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {cvUrl && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/70 p-2 md:p-6">
          <div className="mb-2 flex items-center justify-between text-white">
            <p className="font-medium">CV de {cvNombre}</p>
            <button
              onClick={cerrarCV}
              className="min-h-[44px] bg-white/10 px-4 font-semibold"
            >
              Cerrar
            </button>
          </div>
          <iframe
            src={cvUrl}
            title={`CV de ${cvNombre}`}
            className="flex-1 bg-white"
          />
        </div>
      )}
      </>
    );
  }
}
