import { useEffect, useState } from "react";
import { AdminLayout } from "../../components/AdminLayout";
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
};

const FORMULARIO_VACIO: Formulario = {
  tipo: "empresa",
  nombre: "",
  ruc: "",
  colegiatura: "",
  anios_servicio: "",
  whatsapp: "+51",
  email: "",
  regiones_json: [],
  estudios_json: [],
  activa: true,
};

function validar(f: Formulario): Record<string, string> {
  const errores: Record<string, string> = {};
  if (!f.nombre.trim()) errores.nombre = "El nombre es obligatorio";
  if (f.tipo === "empresa" && !/^\d{11}$/.test(f.ruc))
    errores.ruc = "El RUC debe tener 11 dígitos numéricos";
  if (f.tipo === "consultor" && !f.colegiatura.trim())
    errores.colegiatura = "La colegiatura es obligatoria";
  if (!f.anios_servicio || Number(f.anios_servicio) < 0)
    errores.anios_servicio = "Ingresa un número válido de años";
  if (!/^\+51\d{9}$/.test(f.whatsapp))
    errores.whatsapp = "El WhatsApp debe tener formato +51987654321";
  if (f.regiones_json.length === 0)
    errores.regiones_json = "Marca al menos 1 departamento";
  if (f.estudios_json.length === 0)
    errores.estudios_json = "Marca al menos 1 estudio";
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
      whatsapp: empresa.whatsapp,
      email: empresa.email ?? "",
      regiones_json: empresa.regiones_json,
      estudios_json: empresa.estudios_json,
      activa: empresa.activa,
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
    const erroresValidacion = validar(form);
    setErrores(erroresValidacion);
    if (Object.keys(erroresValidacion).length > 0) return;

    setGuardando(true);
    const cuerpo = {
      tipo: form.tipo,
      nombre: form.nombre.trim(),
      ruc: form.tipo === "empresa" ? form.ruc : null,
      colegiatura: form.tipo === "consultor" ? form.colegiatura.trim() : null,
      anios_servicio: Number(form.anios_servicio),
      whatsapp: form.whatsapp,
      email: form.email.trim() || null,
      regiones_json: form.regiones_json,
      estudios_json: form.estudios_json,
      activa: form.activa,
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

  const pendientes = empresas.filter((e) => e.tipo === "consultor" && !e.activa);

  return (
    <AdminLayout>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Empresas y consultores</h1>
        <button
          onClick={abrirNueva}
          className="min-h-[44px] rounded-lg bg-acento px-4 font-semibold text-white"
        >
          + Nuevo
        </button>
      </div>

      {pendientes.length > 0 && (
        <p className="mb-4 rounded-lg bg-secundario/15 p-3 text-sm text-secundario">
          Tienes {pendientes.length} postulación(es) de consultor independiente pendiente(s)
          de revisión (aparecen como "Inactiva" abajo).
        </p>
      )}

      {errorGeneral && <p className="text-red-500">{errorGeneral}</p>}
      {cargando && <p>Cargando...</p>}

      {!cargando && (
        <div className="overflow-x-auto rounded-lg bg-tarjeta dark:bg-tarjeta-dark">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-black/10 dark:border-white/10">
                <th className="p-3">Tipo</th>
                <th className="p-3">Nombre</th>
                <th className="p-3">RUC / Colegiatura</th>
                <th className="p-3">Años</th>
                <th className="p-3">Departamentos</th>
                <th className="p-3">Estado</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {empresas.map((e) => (
                <tr key={e.id} className="border-b border-black/5 dark:border-white/5">
                  <td className="p-3">
                    <span className="rounded-full bg-acento/15 px-2 py-0.5 text-xs font-semibold text-acento">
                      {e.tipo === "consultor" ? "Consultor" : "Empresa"}
                    </span>
                  </td>
                  <td className="p-3">{e.nombre}</td>
                  <td className="p-3 font-mono text-xs">{e.ruc ?? e.colegiatura}</td>
                  <td className="p-3">{e.anios_servicio}</td>
                  <td className="p-3 capitalize">{e.regiones_json.join(", ")}</td>
                  <td className="p-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        e.activa
                          ? "bg-emerald-500/15 text-emerald-500"
                          : "bg-red-500/15 text-red-500"
                      }`}
                    >
                      {e.activa ? "Activa" : "Inactiva"}
                    </span>
                  </td>
                  <td className="flex gap-2 p-3">
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
                      className="min-h-[32px] rounded bg-red-500 px-2 text-xs font-semibold text-white"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {mostrarForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-8 w-full max-w-lg rounded-xl bg-tarjeta p-6 dark:bg-tarjeta-dark">
            <h2 className="mb-4 text-lg font-bold">
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
                  className="min-h-[44px] w-full rounded-lg border border-black/10 bg-transparent px-3 dark:border-white/10"
                  placeholder={form.tipo === "empresa" ? "Nombre de la empresa" : "Nombre del consultor"}
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                />
                {errores.nombre && <p className="mt-1 text-xs text-red-500">{errores.nombre}</p>}
              </div>

              {form.tipo === "empresa" ? (
                <div>
                  <input
                    className="min-h-[44px] w-full rounded-lg border border-black/10 bg-transparent px-3 dark:border-white/10"
                    placeholder="RUC (11 dígitos)"
                    value={form.ruc}
                    onChange={(e) => setForm({ ...form, ruc: e.target.value })}
                  />
                  {errores.ruc && <p className="mt-1 text-xs text-red-500">{errores.ruc}</p>}
                </div>
              ) : (
                <div>
                  <input
                    className="min-h-[44px] w-full rounded-lg border border-black/10 bg-transparent px-3 dark:border-white/10"
                    placeholder="Colegiatura (ej. CIP 123456)"
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
                  className="min-h-[44px] w-full rounded-lg border border-black/10 bg-transparent px-3 dark:border-white/10"
                  placeholder="Años de servicio"
                  value={form.anios_servicio}
                  onChange={(e) => setForm({ ...form, anios_servicio: e.target.value })}
                />
                {errores.anios_servicio && (
                  <p className="mt-1 text-xs text-red-500">{errores.anios_servicio}</p>
                )}
              </div>

              <div>
                <input
                  className="min-h-[44px] w-full rounded-lg border border-black/10 bg-transparent px-3 dark:border-white/10"
                  placeholder="+51987654321"
                  value={form.whatsapp}
                  onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                />
                {errores.whatsapp && (
                  <p className="mt-1 text-xs text-red-500">{errores.whatsapp}</p>
                )}
              </div>

              <input
                className="min-h-[44px] w-full rounded-lg border border-black/10 bg-transparent px-3 dark:border-white/10"
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
                <div className="flex max-h-64 flex-col gap-3 overflow-y-auto rounded-lg border border-black/10 p-3 dark:border-white/10">
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
                className="min-h-[44px] flex-1 rounded-lg border border-black/10 font-semibold dark:border-white/10"
              >
                Cancelar
              </button>
              <button
                disabled={guardando}
                onClick={guardar}
                className="min-h-[44px] flex-1 rounded-lg bg-acento font-semibold text-white disabled:opacity-50"
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
              className="min-h-[44px] rounded-lg bg-white/10 px-4 font-semibold"
            >
              Cerrar
            </button>
          </div>
          <iframe
            src={cvUrl}
            title={`CV de ${cvNombre}`}
            className="flex-1 rounded-lg bg-white"
          />
        </div>
      )}
    </AdminLayout>
  );
}
