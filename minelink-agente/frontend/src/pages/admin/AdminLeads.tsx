import { useEffect, useState } from "react";
import { AdminLayout } from "../../components/AdminLayout";
import { enlaceWhatsApp } from "../../config/whatsapp";
import { useAuth } from "../../context/AuthContext";
import { DEPARTAMENTOS } from "../../data/departamentos";
import { INFO_BRECHA } from "../../data/brechas";
import { CATEGORIAS_DOCUMENTO } from "../../types/documento";
import type { DocumentoOperacion } from "../../types/documento";
import { calcularSemaforo } from "../../utils/semaforo";
import type { LeadConDiagnostico } from "../../types/admin";

interface InteresInversion {
  id: number;
  nombre: string;
  telefono?: string | null;
  email?: string | null;
  motivo_inversion?: string | null;
  monto?: string | null;
  informacion_requerida?: string | null;
  mensaje?: string | null;
  created_at: string;
}

function etiquetaCategoria(categoria: string): string {
  return (
    CATEGORIAS_DOCUMENTO.find((c) => c.categoria === categoria)?.etiqueta ??
    INFO_BRECHA[categoria]?.texto ??
    categoria
  );
}

function exportarCSV(leads: LeadConDiagnostico[]) {
  const encabezados = [
    "fecha",
    "nombre",
    "whatsapp",
    "email",
    "nombre_operacion",
    "region",
    "score_original",
    "score_actual",
    "bloqueado_actual",
    "brechas_pendientes",
    "brechas_resueltas",
    "codigo_reinfo",
  ];
  const filas = leads.map((l) =>
    [
      new Date(l.created_at).toLocaleString("es-PE"),
      l.nombre,
      l.whatsapp,
      l.email ?? "",
      l.nombre_operacion ?? "",
      l.region,
      l.score_total,
      l.score_actual,
      l.bloqueado_actual ? "sí" : "no",
      l.brechas_pendientes.map((b) => INFO_BRECHA[b]?.texto ?? b).join(" | "),
      l.brechas_resueltas.map((b) => INFO_BRECHA[b]?.texto ?? b).join(" | "),
      l.codigo_reinfo ?? "",
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  );
  const csv = [encabezados.join(","), ...filas].join("\r\n");

  // BOM UTF-8 para que Excel en Windows lea tildes/ñ correctamente
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = `leads_minelink_${new Date().toISOString().slice(0, 10)}.csv`;
  enlace.click();
  URL.revokeObjectURL(url);
}

export function AdminLeads() {
  const { authFetch } = useAuth();
  const [leads, setLeads] = useState<LeadConDiagnostico[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [region, setRegion] = useState("");
  const [situacion, setSituacion] = useState("");
  const [expandido, setExpandido] = useState<number | null>(null);
  const [actualizando, setActualizando] = useState<string | null>(null);
  const [leadDetalle, setLeadDetalle] = useState<LeadConDiagnostico | null>(null);
  const [docs, setDocs] = useState<DocumentoOperacion[]>([]);
  const [cargandoDocs, setCargandoDocs] = useState(false);
  const [leadIntereses, setLeadIntereses] = useState<LeadConDiagnostico | null>(null);
  const [intereses, setIntereses] = useState<InteresInversion[]>([]);
  const [cargandoIntereses, setCargandoIntereses] = useState(false);
  const [vistaUrl, setVistaUrl] = useState<string | null>(null);
  const [vistaTipo, setVistaTipo] = useState("");

  function cargar() {
    setCargando(true);
    const params = new URLSearchParams();
    if (desde) params.set("desde", desde);
    if (hasta) params.set("hasta", hasta);
    if (region) params.set("region", region);
    if (situacion) params.set("situacion", situacion);

    authFetch(`/admin/leads?${params.toString()}`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => {
        setLeads(data);
        setError(null);
      })
      .catch(() => setError("No pudimos cargar los leads."))
      .finally(() => setCargando(false));
  }

  useEffect(cargar, [desde, hasta, region, situacion]); // eslint-disable-line react-hooks/exhaustive-deps

  async function alternarBrechaResuelta(lead: LeadConDiagnostico, estudio: string) {
    const yaResuelta = lead.brechas_resueltas.includes(estudio);
    const nuevasResueltas = yaResuelta
      ? lead.brechas_resueltas.filter((b) => b !== estudio)
      : [...lead.brechas_resueltas, estudio];

    setActualizando(lead.operacion_id);
    try {
      const resp = await authFetch(
        `/admin/operaciones/${lead.operacion_id}/brechas-resueltas`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brechas_resueltas: nuevasResueltas }),
        }
      );
      if (!resp.ok) throw new Error();
      const actualizado = await resp.json();
      setLeads((actuales) =>
        actuales.map((l) =>
          l.operacion_id === lead.operacion_id
            ? {
                ...l,
                brechas_resueltas: actualizado.brechas_resueltas,
                brechas_pendientes: actualizado.brechas_pendientes,
                score_actual: actualizado.score_actual,
                bloqueado_actual: actualizado.bloqueado_actual,
              }
            : l
        )
      );
    } catch {
      setError("No pudimos actualizar esa brecha. Intenta de nuevo.");
    } finally {
      setActualizando(null);
    }
  }

  async function eliminarLead(lead: LeadConDiagnostico) {
    if (
      !window.confirm(
        `¿Eliminar la cuenta y el diagnóstico de "${lead.nombre}"? Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }
    const resp = await authFetch(`/admin/leads/${lead.id}`, { method: "DELETE" });
    if (!resp.ok) {
      setError("No pudimos eliminar ese lead. Intenta de nuevo.");
      return;
    }
    setLeads((actuales) => actuales.filter((l) => l.id !== lead.id));
  }

  async function resetearPassword(lead: LeadConDiagnostico) {
    if (
      !window.confirm(
        `¿Generar una contraseña nueva para "${lead.nombre}"? La anterior dejará de funcionar.`
      )
    ) {
      return;
    }
    const resp = await authFetch(`/admin/leads/${lead.id}/resetear-password`, {
      method: "POST",
    });
    if (!resp.ok) {
      const detalle = await resp.json().catch(() => null);
      setError(detalle?.detail ?? "No pudimos resetear la contraseña.");
      return;
    }
    const datos = await resp.json();
    const mensaje = `Hola ${lead.nombre.split(" ")[0]} 👋 Te escribe el equipo de MineLink. Tu nueva contraseña es: ${datos.password_temporal} (tu usuario sigue siendo: ${datos.username}). Entra en https://mine-link-seven.vercel.app/ingresar`;
    if (
      window.confirm(
        `Contraseña nueva de ${lead.nombre}: ${datos.password_temporal}\n\n(usuario: ${datos.username})\n\n¿Abrir WhatsApp para enviársela?`
      )
    ) {
      window.open(enlaceWhatsApp(lead.whatsapp, mensaje), "_blank");
    }
  }

  async function cambiarEstadoContacto(lead: LeadConDiagnostico, estado: string) {
    const resp = await authFetch(`/admin/leads/${lead.id}/estado-contacto`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado_contacto: estado }),
    });
    if (!resp.ok) return;
    setLeads((actuales) =>
      actuales.map((l) => (l.id === lead.id ? { ...l, estado_contacto: estado } : l))
    );
  }

  function verDocumentos(lead: LeadConDiagnostico) {
    setLeadDetalle(lead);
    setCargandoDocs(true);
    authFetch(`/admin/operaciones/${lead.operacion_id}/documentos`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setDocs)
      .catch(() => setError("No pudimos cargar los documentos."))
      .finally(() => setCargandoDocs(false));
  }

  function verInversionistas(lead: LeadConDiagnostico) {
    setLeadIntereses(lead);
    setCargandoIntereses(true);
    authFetch(`/admin/operaciones/${lead.operacion_id}/intereses`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setIntereses)
      .catch(() => setError("No pudimos cargar los inversionistas."))
      .finally(() => setCargandoIntereses(false));
  }

  async function verArchivo(doc: DocumentoOperacion) {
    const resp = await authFetch(`/admin/documentos/${doc.id}/archivo`);
    if (!resp.ok) {
      setError("No se pudo abrir el archivo.");
      return;
    }
    const blob = await resp.blob();
    setVistaUrl(URL.createObjectURL(blob));
    setVistaTipo(doc.content_type);
  }

  function cerrarVista() {
    if (vistaUrl) URL.revokeObjectURL(vistaUrl);
    setVistaUrl(null);
    setVistaTipo("");
  }

  return (
    <AdminLayout>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Leads</h1>
        <div className="flex gap-2">
          <button
            onClick={cargar}
            className="min-h-[44px] rounded-lg border border-black/10 px-4 font-semibold dark:border-white/10"
          >
            Actualizar
          </button>
          <button
            disabled={leads.length === 0}
            onClick={() => exportarCSV(leads)}
            className="min-h-[44px] rounded-lg bg-acento px-4 font-semibold text-white disabled:opacity-50"
          >
            Exportar CSV
          </button>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-3">
        <input
          type="date"
          className="min-h-[44px] rounded-lg border border-black/10 bg-tarjeta px-3 text-texto dark:border-white/10 dark:bg-tarjeta-dark dark:text-texto-dark"
          value={desde}
          onChange={(e) => setDesde(e.target.value)}
        />
        <input
          type="date"
          className="min-h-[44px] rounded-lg border border-black/10 bg-tarjeta px-3 text-texto dark:border-white/10 dark:bg-tarjeta-dark dark:text-texto-dark"
          value={hasta}
          onChange={(e) => setHasta(e.target.value)}
        />
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
        <select
          className="min-h-[44px] rounded-lg border border-black/10 bg-tarjeta px-3 text-texto dark:border-white/10 dark:bg-tarjeta-dark dark:text-texto-dark"
          value={situacion}
          onChange={(e) => setSituacion(e.target.value)}
        >
          <option value="" className="bg-white text-black">
            Mineros artesanales y concesionarios
          </option>
          <option value="minero_artesanal" className="bg-white text-black">
            ⛏️ Solo mineros artesanales
          </option>
          <option value="concesionario" className="bg-white text-black">
            📍 Solo concesionarios
          </option>
        </select>
      </div>

      {error && <p className="text-red-500">{error}</p>}
      {cargando && <p>Cargando...</p>}

      {!cargando && leads.length === 0 && (
        <p className="text-texto-suave dark:text-texto-suave-dark">
          No hay leads para estos filtros.
        </p>
      )}

      {!cargando && leads.length > 0 && (
        <div className="overflow-x-auto rounded-lg bg-tarjeta dark:bg-tarjeta-dark">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-black/10 dark:border-white/10">
                <th className="p-3">Fecha</th>
                <th className="p-3">Nombre</th>
                <th className="p-3">WhatsApp</th>
                <th className="p-3">Departamento</th>
                <th className="p-3">Score</th>
                <th className="p-3">Brechas</th>
                <th className="p-3">REINFO</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => {
                const semaforo = calcularSemaforo(lead.score_actual, lead.bloqueado_actual);
                const expandidoAqui = expandido === lead.id;
                const hayCambios = lead.score_actual !== lead.score_total;
                return (
                  <tr key={lead.id} className="border-b border-black/5 align-top dark:border-white/5">
                    <td className="p-3 whitespace-nowrap">
                      {new Date(lead.created_at).toLocaleString("es-PE")}
                    </td>
                    <td className="p-3">
                      <span title={lead.situacion === "concesionario" ? "Concesionario" : "Minero artesanal"}>
                        {lead.situacion === "concesionario" ? "📍" : "⛏️"}
                      </span>{" "}
                      {lead.nombre}
                      {lead.nombre_operacion && (
                        <p className="text-xs text-texto-suave dark:text-texto-suave-dark">
                          {lead.nombre_operacion}
                        </p>
                      )}
                    </td>
                    <td className="p-3">
                      <a
                        href={`https://wa.me/${lead.whatsapp.replace("+", "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-acento underline"
                      >
                        {lead.whatsapp}
                      </a>
                      {lead.email && (
                        <p className="text-xs text-texto-suave dark:text-texto-suave-dark">
                          {lead.email}
                        </p>
                      )}
                    </td>
                    <td className="p-3 capitalize">{lead.region}</td>
                    <td className="p-3">
                      <span className={`font-mono font-semibold ${semaforo.claseTexto}`}>
                        {lead.score_actual}
                      </span>
                      {hayCambios && (
                        <span className="ml-1 text-xs text-texto-suave line-through dark:text-texto-suave-dark">
                          {lead.score_total}
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => setExpandido(expandidoAqui ? null : lead.id)}
                        className="text-xs font-semibold text-acento underline"
                      >
                        {lead.brechas_pendientes.length} pendiente
                        {lead.brechas_pendientes.length !== 1 ? "s" : ""}
                        {lead.brechas_resueltas.length > 0 &&
                          ` · ${lead.brechas_resueltas.length} resuelta${
                            lead.brechas_resueltas.length !== 1 ? "s" : ""
                          }`}
                      </button>
                      {expandidoAqui && (
                        <ul className="mt-1 flex flex-col gap-1 text-xs">
                          {lead.brechas.map((b) => {
                            const resuelta = lead.brechas_resueltas.includes(b);
                            return (
                              <li key={b} className="flex items-center gap-1.5">
                                <input
                                  type="checkbox"
                                  checked={resuelta}
                                  disabled={actualizando === lead.operacion_id}
                                  onChange={() => alternarBrechaResuelta(lead, b)}
                                />
                                <span
                                  className={
                                    resuelta
                                      ? "text-texto-suave line-through dark:text-texto-suave-dark"
                                      : ""
                                  }
                                >
                                  {INFO_BRECHA[b]?.texto ?? b}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </td>
                    <td className="p-3">
                      {lead.codigo_reinfo ? (
                        <a
                          href="https://pad.minem.gob.pe"
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-xs text-acento underline"
                        >
                          {lead.codigo_reinfo}
                        </a>
                      ) : (
                        <span className="text-xs text-texto-suave dark:text-texto-suave-dark">
                          —
                        </span>
                      )}
                    </td>
                    <td className="flex gap-2 p-3">
                      <a
                        href={enlaceWhatsApp(
                          lead.whatsapp,
                          [
                            `Hola ${lead.nombre.split(" ")[0]} 👋 Te escribe el equipo de MineLink.`,
                            `Tu diagnóstico de formalización salió con ${lead.score_actual}/100.`,
                            lead.brechas_pendientes.length > 0
                              ? `Te falta: ${lead.brechas_pendientes
                                  .map((b) => INFO_BRECHA[b]?.texto ?? b)
                                  .join(", ")}.`
                              : "¡No tienes brechas pendientes!",
                            "Tenemos profesionales de confianza que hacen exactamente esos estudios y pueden ayudarte. ¿Te interesa que te los presentemos?",
                          ].join(" ")
                        )}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => cambiarEstadoContacto(lead, "contactado")}
                        className="flex min-h-[32px] items-center rounded bg-[#25D366] px-2 text-xs font-semibold text-white"
                      >
                        Enviar resultado
                      </a>
                      <button
                        onClick={() =>
                          cambiarEstadoContacto(
                            lead,
                            lead.estado_contacto === "contactado" ? "buscando" : "contactado"
                          )
                        }
                        title="Clic para cambiar el estado"
                        className={`min-h-[32px] rounded px-2 text-xs font-semibold ${
                          lead.estado_contacto === "contactado"
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                        }`}
                      >
                        {lead.estado_contacto === "contactado" ? "✓ Contactado" : "En cola"}
                      </button>
                      <button
                        onClick={() => verDocumentos(lead)}
                        className="min-h-[32px] rounded border border-acento/30 px-2 text-xs font-semibold text-acento"
                      >
                        Documentos
                      </button>
                      <button
                        onClick={() => verInversionistas(lead)}
                        className="min-h-[32px] rounded border border-secundario/30 px-2 text-xs font-semibold text-secundario"
                      >
                        Inversionistas
                      </button>
                      <button
                        onClick={() => resetearPassword(lead)}
                        className="min-h-[32px] rounded border border-black/10 px-2 text-xs font-semibold dark:border-white/10"
                      >
                        Resetear clave
                      </button>
                      <button
                        onClick={() => eliminarLead(lead)}
                        className="min-h-[32px] rounded bg-red-500 px-2 text-xs font-semibold text-white"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {leadDetalle && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-8 w-full max-w-md rounded-xl bg-tarjeta p-6 dark:bg-tarjeta-dark">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">Datos del minero</h2>
              <button
                onClick={() => setLeadDetalle(null)}
                className="text-sm font-semibold text-acento underline"
              >
                Cerrar
              </button>
            </div>

            <div className="mb-4 flex flex-col gap-2 rounded-lg border border-black/10 p-3 text-sm dark:border-white/10">
              <p className="text-xs font-semibold uppercase text-texto-suave dark:text-texto-suave-dark">
                Perfil del diagnóstico ({leadDetalle.situacion === "concesionario" ? "concesión que inicia" : "operación activa"})
              </p>
              {leadDetalle.estado_operacion && (
                <p><span className="font-medium">Estado de la operación:</span> {leadDetalle.estado_operacion}</p>
              )}
              {leadDetalle.tipo_explotacion && (
                <p><span className="font-medium">Tipo de explotación:</span> {leadDetalle.tipo_explotacion}</p>
              )}
              {leadDetalle.material_comercializado && (
                <p><span className="font-medium">Material comercializado:</span> {leadDetalle.material_comercializado}</p>
              )}
              {leadDetalle.forma_comercializacion && (
                <p><span className="font-medium">Forma de comercialización:</span> {leadDetalle.forma_comercializacion}</p>
              )}
              {leadDetalle.tiempo_operacion && (
                <p><span className="font-medium">Tiempo operando:</span> {leadDetalle.tiempo_operacion}</p>
              )}
              {leadDetalle.ley_promedio && (
                <p><span className="font-medium">Ley promedio:</span> {leadDetalle.ley_promedio} ({leadDetalle.ley_como_obtenida ?? "sin especificar cómo se obtuvo"})</p>
              )}
              {leadDetalle.tiene_resultados_laboratorio != null && (
                <p><span className="font-medium">Resultados de laboratorio:</span> {leadDetalle.tiene_resultados_laboratorio ? "Sí" : "No"}</p>
              )}
              {leadDetalle.concesion_vigente != null && (
                <p><span className="font-medium">Concesión vigente:</span> {leadDetalle.concesion_vigente ? "Sí" : "No"}</p>
              )}
              {leadDetalle.tipo_deposito && (
                <p><span className="font-medium">Tipo de depósito:</span> {leadDetalle.tipo_deposito}</p>
              )}
              {leadDetalle.etapa_proyecto && (
                <p><span className="font-medium">Etapa del proyecto:</span> {leadDetalle.etapa_proyecto}</p>
              )}
              {leadDetalle.trabajos_exploracion_json && leadDetalle.trabajos_exploracion_json.length > 0 && (
                <p><span className="font-medium">Trabajos de exploración:</span> {leadDetalle.trabajos_exploracion_json.join(", ")}</p>
              )}
              {leadDetalle.info_geologica_disponible != null && (
                <p><span className="font-medium">Información geológica disponible:</span> {leadDetalle.info_geologica_disponible ? "Sí" : "No"}</p>
              )}
              {leadDetalle.tiene_estimaciones_leyes != null && (
                <p><span className="font-medium">Estimaciones de leyes:</span> {leadDetalle.tiene_estimaciones_leyes ? "Sí" : "No"}</p>
              )}
              {leadDetalle.documento_autorizacion && (
                <p><span className="font-medium">Documento de autorización:</span> {leadDetalle.documento_autorizacion}</p>
              )}
              {leadDetalle.tipo_apoyo_json && leadDetalle.tipo_apoyo_json.length > 0 && (
                <p><span className="font-medium">Apoyo que busca:</span> {leadDetalle.tipo_apoyo_json.join(", ")}</p>
              )}
            </div>

            {(leadDetalle.descripcion_operacion ||
              leadDetalle.capacidad_produccion ||
              leadDetalle.capital_buscado ||
              leadDetalle.uso_fondos) && (
              <div className="mb-4 flex flex-col gap-2 rounded-lg border border-black/10 p-3 text-sm dark:border-white/10">
                <p className="text-xs font-semibold uppercase text-texto-suave dark:text-texto-suave-dark">
                  Perfil de inversión
                </p>
                {leadDetalle.descripcion_operacion && (
                  <p><span className="font-medium">Operación:</span> {leadDetalle.descripcion_operacion}</p>
                )}
                {leadDetalle.capacidad_produccion && (
                  <p><span className="font-medium">Producción/reservas:</span> {leadDetalle.capacidad_produccion}</p>
                )}
                {leadDetalle.capital_buscado && (
                  <p><span className="font-medium">Capital buscado:</span> {leadDetalle.capital_buscado}</p>
                )}
                {leadDetalle.uso_fondos && (
                  <p><span className="font-medium">Uso de fondos:</span> {leadDetalle.uso_fondos}</p>
                )}
              </div>
            )}

            <p className="mb-2 text-xs font-semibold uppercase text-texto-suave dark:text-texto-suave-dark">
              Documentos
            </p>
            {cargandoDocs && <p className="text-sm">Cargando...</p>}
            {!cargandoDocs && docs.length === 0 && (
              <p className="text-sm text-texto-suave dark:text-texto-suave-dark">
                Este minero no ha subido documentos todavía.
              </p>
            )}
            {!cargandoDocs && docs.length > 0 && (
              <ul className="flex flex-col gap-2">
                {docs.map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{doc.nombre_original}</p>
                      <p className="text-xs text-texto-suave dark:text-texto-suave-dark">
                        {etiquetaCategoria(doc.categoria)}
                      </p>
                    </div>
                    <button
                      onClick={() => verArchivo(doc)}
                      className="shrink-0 rounded border border-acento/30 px-2 py-1 text-xs font-semibold text-acento"
                    >
                      Ver
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {leadIntereses && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-8 w-full max-w-md rounded-xl bg-tarjeta p-6 dark:bg-tarjeta-dark">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">Inversionistas interesados</h2>
              <button
                onClick={() => setLeadIntereses(null)}
                className="text-sm font-semibold text-acento underline"
              >
                Cerrar
              </button>
            </div>

            {cargandoIntereses && <p className="text-sm">Cargando...</p>}
            {!cargandoIntereses && intereses.length === 0 && (
              <p className="text-sm text-texto-suave dark:text-texto-suave-dark">
                Nadie ha dejado su interés en este proyecto todavía.
              </p>
            )}
            {!cargandoIntereses && intereses.length > 0 && (
              <ul className="flex flex-col gap-3">
                {intereses.map((interes) => (
                  <li
                    key={interes.id}
                    className="rounded-lg border border-black/10 p-3 text-sm dark:border-white/10"
                  >
                    <p className="font-medium">{interes.nombre}</p>
                    {interes.telefono && <p>📱 {interes.telefono}</p>}
                    {interes.email && <p>✉️ {interes.email}</p>}
                    {interes.motivo_inversion && (
                      <p>
                        <span className="font-medium">Motivo:</span> {interes.motivo_inversion}
                      </p>
                    )}
                    {interes.monto && (
                      <p>
                        <span className="font-medium">Capital:</span> {interes.monto}
                      </p>
                    )}
                    {interes.informacion_requerida && (
                      <p>
                        <span className="font-medium">Necesita:</span>{" "}
                        {interes.informacion_requerida}
                      </p>
                    )}
                    {interes.mensaje && (
                      <p>
                        <span className="font-medium">Mensaje:</span> {interes.mensaje}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-texto-suave dark:text-texto-suave-dark">
                      {new Date(interes.created_at).toLocaleString("es-PE")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {vistaUrl && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/70 p-2 md:p-6">
          <div className="mb-2 flex items-center justify-between text-white">
            <p className="font-medium">Vista previa</p>
            <button
              onClick={cerrarVista}
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
    </AdminLayout>
  );
}
