import { useEffect, useState } from "react";
import { Check, Mail, MapPin, Phone, Pickaxe } from "lucide-react";
import { AdminLayout } from "../../components/AdminLayout";
import { enlaceWhatsApp } from "../../config/whatsapp";
import { useAuth } from "../../context/AuthContext";
import { DEPARTAMENTOS } from "../../data/departamentos";
import { INFO_BRECHA } from "../../data/brechas";
import { CATEGORIAS_DOCUMENTO } from "../../types/documento";
import type { DocumentoOperacion } from "../../types/documento";
import { POR_ID_INV } from "../../data/preguntasInversion";
import { calcularSemaforo } from "../../utils/semaforo";
import { formatearMonto } from "../../utils/formato";
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

interface InteresEmpresa {
  id: number;
  empresa_id: number;
  empresa_nombre: string;
  empresa_whatsapp: string;
  nombre: string;
  whatsapp: string;
  brecha?: string | null;
  mensaje?: string | null;
  estado_contacto: string;
  created_at: string;
}

function etiquetaCategoria(categoria: string): string {
  return (
    CATEGORIAS_DOCUMENTO.find((c) => c.categoria === categoria)?.etiqueta ??
    INFO_BRECHA[categoria]?.texto ??
    categoria
  );
}

interface CategoriaRequerida {
  categoria: string;
  etiqueta: string;
  aprobado: boolean;
}

interface AlertaInversion {
  codigo: string;
  texto: string;
}

interface InversionAdmin {
  respuestas: Record<string, string | string[]>;
  enviado: boolean;
  visto_bueno: boolean;
  alertas: AlertaInversion[];
  categorias_requeridas: CategoriaRequerida[];
}

/** Traduce una respuesta cruda del Módulo INV (string o lista de valores)
 * a su etiqueta legible, usando el mismo catálogo que ve el minero. */
function etiquetaRespuestaInv(id: string, valor: string | string[]): string {
  const pregunta = POR_ID_INV[id];
  const etiquetaDe = (v: string) => pregunta?.opciones?.find((o) => o.valor === v)?.etiqueta ?? v;
  return Array.isArray(valor) ? valor.map(etiquetaDe).join(", ") : etiquetaDe(valor);
}

/** Perfil informativo del diagnóstico (bloques 1-8 del cuestionario): se
 * muestra genéricamente en vez de un <p> hardcodeado por campo — evita
 * repetir el mismo patrón ~40 veces. Solo se listan los que tengan valor. */
const CAMPOS_PERFIL_DIAGNOSTICO: { campo: keyof LeadConDiagnostico; etiqueta: string }[] = [
  { campo: "estado_operacion", etiqueta: "Estado de la operación" },
  { campo: "tipo_explotacion", etiqueta: "Tipo de explotación" },
  { campo: "material_comercializado", etiqueta: "Material comercializado" },
  { campo: "forma_comercializacion", etiqueta: "Forma de comercialización" },
  { campo: "tiempo_operacion", etiqueta: "Tiempo operando" },
  { campo: "especie_mineral", etiqueta: "Especie mineralógica" },
  { campo: "tiene_resultados_laboratorio", etiqueta: "Resultados de laboratorio" },
  { campo: "num_trabajadores", etiqueta: "Nº de trabajadores" },
  { campo: "modalidad_trabajadores", etiqueta: "Modalidad de trabajadores" },
  { campo: "maquinaria", etiqueta: "Maquinaria principal" },
  { campo: "provincia", etiqueta: "Provincia" },
  { campo: "sustancias_toxicas", etiqueta: "Mercurio/cianuro/relaves" },
  { campo: "gestion_sustancias", etiqueta: "Gestión de esas sustancias" },
  { campo: "acceso_agua", etiqueta: "Acceso a agua" },
  { campo: "acceso_energia", etiqueta: "Acceso a energía" },
  { campo: "tipo_apoyo", etiqueta: "Apoyo que busca primordialmente" },
  { campo: "monto_requerido", etiqueta: "Monto aproximado que necesita" },
  { campo: "plazo_capital", etiqueta: "Plazo para usar el capital" },
  { campo: "uso_fondos_diagnostico", etiqueta: "Para qué lo usaría primero" },
  { campo: "motivo_capital", etiqueta: "Por qué necesita capital ahora" },
  { campo: "produccion_objetivo", etiqueta: "Producción objetivo" },
  { campo: "incidentes_previos", etiqueta: "Incidentes en los últimos 2 años" },
  { campo: "conflictividad_social", etiqueta: "Conflictividad con comunidades" },
  { campo: "permisos_comunitarios", etiqueta: "Permisos/relaciones comunitarias" },
  { campo: "acceso_logistico", etiqueta: "Acceso logístico" },
  { campo: "experiencia_operador", etiqueta: "Experiencia del operador" },
  { campo: "capacitacion_operador", etiqueta: "Capacitación/colegiatura" },
  { campo: "documentacion_disponible", etiqueta: "Documentación disponible (fotos/reportes)" },
  { campo: "estructura_propiedad", etiqueta: "Estructura de propiedad" },
  { campo: "plan_formalizacion", etiqueta: "Plan de formalización" },
  { campo: "prioridad_crecimiento", etiqueta: "Prioridad para crecer" },
  { campo: "concesion_vigente", etiqueta: "Concesión vigente" },
  { campo: "pagos_vigencia_al_dia", etiqueta: "Pagos de vigencia al día" },
  { campo: "tipo_deposito", etiqueta: "Tipo de depósito" },
  { campo: "toneladas_estimadas", etiqueta: "Toneladas estimadas del depósito" },
  { campo: "ley_esperada", etiqueta: "Ley esperada" },
  { campo: "etapa_proyecto", etiqueta: "Etapa del proyecto" },
  { campo: "info_geologica_disponible", etiqueta: "Información geológica disponible" },
  { campo: "tiene_estimaciones_leyes", etiqueta: "Estimaciones de leyes" },
  { campo: "capital_disponible", etiqueta: "Capital ya disponible" },
  { campo: "estudio_previo", etiqueta: "Estudio de prefactibilidad/factibilidad" },
  { campo: "historial_operacion", etiqueta: "Operada previamente" },
  { campo: "pasivos_ambientales", etiqueta: "Pasivos ambientales heredados" },
  { campo: "experiencia_titular", etiqueta: "Experiencia del titular" },
  { campo: "background_titular", etiqueta: "Background profesional del titular" },
  { campo: "equipo_tecnico", etiqueta: "Equipo técnico definido" },
  { campo: "tipo_socio_buscado", etiqueta: "Tipo de socio buscado" },
  { campo: "siguiente_hito", etiqueta: "Siguiente hito" },
  { campo: "timeline_operacion", etiqueta: "Timeline esperado hasta operación" },
  { campo: "motivo_inicio", etiqueta: "Por qué inició el proyecto" },
  { campo: "documento_autorizacion", etiqueta: "Documento de autorización" },
];

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
  const [actualizandoDoc, setActualizandoDoc] = useState<number | null>(null);
  const [rechazandoDoc, setRechazandoDoc] = useState<number | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [actualizandoVistoBueno, setActualizandoVistoBueno] = useState(false);
  const [errorVistoBueno, setErrorVistoBueno] = useState<string | null>(null);
  const [leadInversion, setLeadInversion] = useState<LeadConDiagnostico | null>(null);
  const [inversion, setInversion] = useState<InversionAdmin | null>(null);
  const [cargandoInversion, setCargandoInversion] = useState(false);
  const [actualizandoVistoBuenoInv, setActualizandoVistoBuenoInv] = useState(false);
  const [errorVistoBuenoInv, setErrorVistoBuenoInv] = useState<string | null>(null);
  const [leadIntereses, setLeadIntereses] = useState<LeadConDiagnostico | null>(null);
  const [intereses, setIntereses] = useState<InteresInversion[]>([]);
  const [cargandoIntereses, setCargandoIntereses] = useState(false);
  const [leadInteresesEmpresas, setLeadInteresesEmpresas] = useState<LeadConDiagnostico | null>(null);
  const [interesesEmpresas, setInteresesEmpresas] = useState<InteresEmpresa[]>([]);
  const [cargandoInteresesEmpresas, setCargandoInteresesEmpresas] = useState(false);
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
    setRechazandoDoc(null);
    setMotivoRechazo("");
    setErrorVistoBueno(null);
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

  function verInteresesEmpresas(lead: LeadConDiagnostico) {
    setLeadInteresesEmpresas(lead);
    setCargandoInteresesEmpresas(true);
    authFetch(`/admin/operaciones/${lead.operacion_id}/intereses-empresas`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setInteresesEmpresas)
      .catch(() => setError("No pudimos cargar los intereses en empresas."))
      .finally(() => setCargandoInteresesEmpresas(false));
  }

  async function cambiarEstadoContactoEmpresa(interes: InteresEmpresa, estado: string) {
    const resp = await authFetch(`/admin/intereses-empresas/${interes.id}/estado-contacto`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado_contacto: estado }),
    });
    if (!resp.ok) return;
    setInteresesEmpresas((actuales) =>
      actuales.map((i) => (i.id === interes.id ? { ...i, estado_contacto: estado } : i))
    );
  }

  async function revisarDocumento(
    doc: DocumentoOperacion,
    estado_revision: "aprobado" | "rechazado",
    motivo_rechazo?: string
  ) {
    setActualizandoDoc(doc.id);
    try {
      const resp = await authFetch(`/admin/documentos/${doc.id}/revision`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado_revision, motivo_rechazo }),
      });
      if (!resp.ok) {
        setError("No pudimos actualizar la revisión de ese documento.");
        return;
      }
      const actualizado = await resp.json();
      setDocs((actuales) => actuales.map((d) => (d.id === doc.id ? actualizado : d)));
      setRechazandoDoc(null);
      setMotivoRechazo("");
    } finally {
      setActualizandoDoc(null);
    }
  }

  const todosLosDocumentosAprobados =
    docs.length > 0 && docs.every((d) => d.estado_revision === "aprobado");

  async function darVistoBueno(lead: LeadConDiagnostico, visto_bueno: boolean) {
    setActualizandoVistoBueno(true);
    setErrorVistoBueno(null);
    try {
      const resp = await authFetch(
        `/admin/operaciones/${lead.operacion_id}/visto-bueno-documentos`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visto_bueno }),
        }
      );
      if (!resp.ok) {
        const detalle = await resp.json().catch(() => null);
        setErrorVistoBueno(detalle?.detail ?? "No pudimos actualizar el visto bueno.");
        return;
      }
      const actualizado = await resp.json();
      setLeadDetalle((actual) =>
        actual ? { ...actual, visto_bueno_documentos: actualizado.visto_bueno_documentos } : actual
      );
      setLeads((actuales) =>
        actuales.map((l) =>
          l.operacion_id === lead.operacion_id
            ? { ...l, visto_bueno_documentos: actualizado.visto_bueno_documentos }
            : l
        )
      );
    } finally {
      setActualizandoVistoBueno(false);
    }
  }

  function verInversion(lead: LeadConDiagnostico) {
    setLeadInversion(lead);
    setErrorVistoBuenoInv(null);
    setCargandoInversion(true);
    authFetch(`/admin/operaciones/${lead.operacion_id}/inversion`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setInversion)
      .catch(() => setError("No pudimos cargar el perfil de inversión."))
      .finally(() => setCargandoInversion(false));
  }

  async function darVistoBuenoInversion(lead: LeadConDiagnostico, visto_bueno: boolean) {
    setActualizandoVistoBuenoInv(true);
    setErrorVistoBuenoInv(null);
    try {
      const resp = await authFetch(
        `/admin/operaciones/${lead.operacion_id}/visto-bueno-inversion`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visto_bueno }),
        }
      );
      if (!resp.ok) {
        const detalle = await resp.json().catch(() => null);
        setErrorVistoBuenoInv(detalle?.detail ?? "No pudimos actualizar el visto bueno.");
        return;
      }
      const actualizado = await resp.json();
      setInversion((actual) =>
        actual ? { ...actual, visto_bueno: actualizado.inv_visto_bueno } : actual
      );
    } finally {
      setActualizandoVistoBuenoInv(false);
    }
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
            Solo mineros artesanales
          </option>
          <option value="concesionario" className="bg-white text-black">
            Solo concesionarios
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
                      <span
                        className="inline-flex align-middle text-texto-suave dark:text-texto-suave-dark"
                        title={lead.situacion === "concesionario" ? "Concesionario" : "Minero artesanal"}
                      >
                        {lead.situacion === "concesionario" ? (
                          <MapPin size={14} strokeWidth={2} />
                        ) : (
                          <Pickaxe size={14} strokeWidth={2} />
                        )}
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
                        {lead.estado_contacto === "contactado" ? (
                          <span className="inline-flex items-center gap-1">
                            <Check size={13} strokeWidth={2.5} aria-hidden />
                            Contactado
                          </span>
                        ) : (
                          "En cola"
                        )}
                      </button>
                      <button
                        onClick={() => verDocumentos(lead)}
                        className="min-h-[32px] rounded border border-acento/30 px-2 text-xs font-semibold text-acento"
                      >
                        Documentos
                      </button>
                      <button
                        onClick={() => verInversion(lead)}
                        className="min-h-[32px] rounded border border-secundario/30 px-2 text-xs font-semibold text-secundario"
                      >
                        Inversión
                      </button>
                      <button
                        onClick={() => verInversionistas(lead)}
                        className="min-h-[32px] rounded border border-secundario/30 px-2 text-xs font-semibold text-secundario"
                      >
                        Inversionistas
                      </button>
                      <button
                        onClick={() => verInteresesEmpresas(lead)}
                        className="min-h-[32px] rounded border border-acento/30 px-2 text-xs font-semibold text-acento"
                      >
                        Empresas
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
              {leadDetalle.ley_promedio && (
                <p>
                  <span className="font-medium">Ley promedio:</span> {leadDetalle.ley_promedio}{" "}
                  ({leadDetalle.ley_como_obtenida ?? "sin especificar cómo se obtuvo"})
                </p>
              )}
              {leadDetalle.trabajos_exploracion_json && leadDetalle.trabajos_exploracion_json.length > 0 && (
                <p>
                  <span className="font-medium">Trabajos de exploración:</span>{" "}
                  {leadDetalle.trabajos_exploracion_json.join(", ")}
                </p>
              )}
              {leadDetalle.tipo_apoyo_json && leadDetalle.tipo_apoyo_json.length > 0 && (
                <p>
                  <span className="font-medium">Apoyo que busca (declaración anterior):</span>{" "}
                  {leadDetalle.tipo_apoyo_json.join(", ")}
                </p>
              )}
              {CAMPOS_PERFIL_DIAGNOSTICO.map(({ campo, etiqueta }) => {
                const valor = leadDetalle[campo];
                if (!valor || (Array.isArray(valor) && valor.length === 0)) return null;
                return (
                  <p key={campo}>
                    <span className="font-medium">{etiqueta}:</span> {formatearMonto(String(valor))}
                  </p>
                );
              })}
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
                  <p><span className="font-medium">Capital buscado:</span> {formatearMonto(leadDetalle.capital_buscado)}</p>
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
              <ul className="flex flex-col gap-3">
                {docs.map((doc) => (
                  <li key={doc.id} className="rounded-lg border border-black/10 p-2 text-sm dark:border-white/10">
                    <div className="flex items-center justify-between gap-2">
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
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      {doc.estado_revision === "aprobado" && (
                        <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          Aprobado
                        </span>
                      )}
                      {doc.estado_revision === "pendiente" && (
                        <span className="rounded bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                          Pendiente
                        </span>
                      )}
                      {doc.estado_revision === "rechazado" && (
                        <span className="rounded bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-500">
                          Rechazado{doc.motivo_rechazo ? `: ${doc.motivo_rechazo}` : ""}
                        </span>
                      )}
                      {doc.estado_revision !== "aprobado" && (
                        <button
                          disabled={actualizandoDoc === doc.id}
                          onClick={() => revisarDocumento(doc, "aprobado")}
                          className="rounded border border-emerald-500/30 px-2 py-0.5 text-xs font-semibold text-emerald-600 disabled:opacity-50 dark:text-emerald-400"
                        >
                          Aprobar
                        </button>
                      )}
                      {doc.estado_revision !== "rechazado" && (
                        <button
                          disabled={actualizandoDoc === doc.id}
                          onClick={() => {
                            setRechazandoDoc(doc.id);
                            setMotivoRechazo("");
                          }}
                          className="rounded border border-red-500/30 px-2 py-0.5 text-xs font-semibold text-red-500 disabled:opacity-50"
                        >
                          Rechazar
                        </button>
                      )}
                    </div>

                    {rechazandoDoc === doc.id && (
                      <div className="mt-2 flex gap-2">
                        <input
                          type="text"
                          autoFocus
                          value={motivoRechazo}
                          onChange={(e) => setMotivoRechazo(e.target.value)}
                          placeholder="Motivo del rechazo (ej. foto borrosa)"
                          className="min-h-[36px] flex-1 rounded border border-black/10 bg-tarjeta px-2 text-xs dark:border-white/10 dark:bg-tarjeta-dark"
                        />
                        <button
                          disabled={!motivoRechazo.trim() || actualizandoDoc === doc.id}
                          onClick={() => revisarDocumento(doc, "rechazado", motivoRechazo.trim())}
                          className="shrink-0 rounded bg-red-500 px-2 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          Confirmar
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {!cargandoDocs && docs.length > 0 && (
              <div className="mt-4 border-t border-black/10 pt-3 dark:border-white/10">
                {errorVistoBueno && <p className="mb-2 text-xs text-red-500">{errorVistoBueno}</p>}
                {leadDetalle.visto_bueno_documentos ? (
                  <button
                    disabled={actualizandoVistoBueno}
                    onClick={() => darVistoBueno(leadDetalle, false)}
                    className="min-h-[40px] w-full rounded-lg border border-emerald-500/30 text-sm font-semibold text-emerald-600 disabled:opacity-50 dark:text-emerald-400"
                  >
                    Visto bueno dado — revocar
                  </button>
                ) : (
                  <button
                    disabled={!todosLosDocumentosAprobados || actualizandoVistoBueno}
                    onClick={() => darVistoBueno(leadDetalle, true)}
                    title={
                      todosLosDocumentosAprobados
                        ? undefined
                        : "Aprueba todos los documentos primero"
                    }
                    className="min-h-[40px] w-full rounded-lg bg-acento text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {actualizandoVistoBueno ? "Guardando..." : "Dar visto bueno"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {leadInversion && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-8 w-full max-w-md rounded-xl bg-tarjeta p-6 dark:bg-tarjeta-dark">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">Perfil de inversión</h2>
              <button
                onClick={() => setLeadInversion(null)}
                className="text-sm font-semibold text-acento underline"
              >
                Cerrar
              </button>
            </div>

            {cargandoInversion && <p className="text-sm">Cargando...</p>}

            {!cargandoInversion && inversion && !inversion.enviado && (
              <p className="text-sm text-texto-suave dark:text-texto-suave-dark">
                Este minero todavía no envió su Módulo INV.
              </p>
            )}

            {!cargandoInversion && inversion && inversion.enviado && (
              <>
                {inversion.alertas.length > 0 && (
                  <div className="mb-4 flex flex-col gap-1 rounded-lg bg-amber-500/10 p-3">
                    <p className="text-xs font-semibold uppercase text-amber-600 dark:text-amber-400">
                      Alertas
                    </p>
                    {inversion.alertas.map((a) => (
                      <p key={a.codigo} className="text-xs text-amber-700 dark:text-amber-400">
                        <span className="font-semibold">{a.codigo}:</span> {a.texto}
                      </p>
                    ))}
                  </div>
                )}

                <p className="mb-2 text-xs font-semibold uppercase text-texto-suave dark:text-texto-suave-dark">
                  Respuestas
                </p>
                <ul className="mb-4 flex flex-col gap-1 text-sm">
                  {Object.entries(inversion.respuestas).map(([id, valor]) => (
                    <li key={id}>
                      <span className="text-texto-suave dark:text-texto-suave-dark">
                        {POR_ID_INV[id]?.texto ?? id}:
                      </span>{" "}
                      {etiquetaRespuestaInv(id, valor)}
                    </li>
                  ))}
                </ul>

                {inversion.categorias_requeridas.length > 0 && (
                  <>
                    <p className="mb-2 text-xs font-semibold uppercase text-texto-suave dark:text-texto-suave-dark">
                      Documentos de sustento requeridos
                    </p>
                    <ul className="mb-4 flex flex-col gap-1 text-sm">
                      {inversion.categorias_requeridas.map((c) => (
                        <li key={c.categoria} className="flex items-center justify-between">
                          <span>{c.etiqueta}</span>
                          <span
                            className={`text-xs font-semibold ${
                              c.aprobado ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                            }`}
                          >
                            {c.aprobado ? "Aprobado" : "Pendiente"}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="mb-4 text-xs text-texto-suave dark:text-texto-suave-dark">
                      Aprueba estos documentos desde el botón "Documentos" de este mismo lead.
                    </p>
                  </>
                )}

                <div className="border-t border-black/10 pt-3 dark:border-white/10">
                  {errorVistoBuenoInv && (
                    <p className="mb-2 text-xs text-red-500">{errorVistoBuenoInv}</p>
                  )}
                  {inversion.visto_bueno ? (
                    <button
                      disabled={actualizandoVistoBuenoInv}
                      onClick={() => darVistoBuenoInversion(leadInversion, false)}
                      className="min-h-[40px] w-full rounded-lg border border-emerald-500/30 text-sm font-semibold text-emerald-600 disabled:opacity-50 dark:text-emerald-400"
                    >
                      Visto bueno dado — revocar
                    </button>
                  ) : (
                    <button
                      disabled={
                        actualizandoVistoBuenoInv ||
                        inversion.categorias_requeridas.some((c) => !c.aprobado)
                      }
                      onClick={() => darVistoBuenoInversion(leadInversion, true)}
                      className="min-h-[40px] w-full rounded-lg bg-acento text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {actualizandoVistoBuenoInv ? "Guardando..." : "Dar visto bueno"}
                    </button>
                  )}
                </div>
              </>
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
                    {interes.telefono && (
                      <p className="flex items-center gap-1.5">
                        <Phone size={13} strokeWidth={2} className="text-texto-suave dark:text-texto-suave-dark" aria-hidden />
                        {interes.telefono}
                      </p>
                    )}
                    {interes.email && (
                      <p className="flex items-center gap-1.5">
                        <Mail size={13} strokeWidth={2} className="text-texto-suave dark:text-texto-suave-dark" aria-hidden />
                        {interes.email}
                      </p>
                    )}
                    {interes.motivo_inversion && (
                      <p>
                        <span className="font-medium">Motivo:</span> {interes.motivo_inversion}
                      </p>
                    )}
                    {interes.monto && (
                      <p>
                        <span className="font-medium">Capital:</span> {formatearMonto(interes.monto)}
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

      {leadInteresesEmpresas && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-8 w-full max-w-md rounded-xl bg-tarjeta p-6 dark:bg-tarjeta-dark">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">Empresas de interés</h2>
              <button
                onClick={() => setLeadInteresesEmpresas(null)}
                className="text-sm font-semibold text-acento underline"
              >
                Cerrar
              </button>
            </div>
            <p className="mb-3 text-xs text-texto-suave dark:text-texto-suave-dark">
              El minero marcó "Me interesa" en vez de escribirle directo a la
              empresa. Escríbele tú desde tu WhatsApp dándole el contacto
              del minero.
            </p>

            {cargandoInteresesEmpresas && <p className="text-sm">Cargando...</p>}
            {!cargandoInteresesEmpresas && interesesEmpresas.length === 0 && (
              <p className="text-sm text-texto-suave dark:text-texto-suave-dark">
                Este minero no ha marcado interés en ninguna empresa todavía.
              </p>
            )}
            {!cargandoInteresesEmpresas && interesesEmpresas.length > 0 && (
              <ul className="flex flex-col gap-3">
                {interesesEmpresas.map((interes) => (
                  <li
                    key={interes.id}
                    className="rounded-lg border border-black/10 p-3 text-sm dark:border-white/10"
                  >
                    <p className="font-medium">{interes.empresa_nombre}</p>
                    <p className="text-xs text-texto-suave dark:text-texto-suave-dark">
                      Minero: {interes.nombre} ·{" "}
                      <a
                        href={`https://wa.me/${interes.whatsapp.replace("+", "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-acento underline"
                      >
                        {interes.whatsapp}
                      </a>
                    </p>
                    {interes.brecha && (
                      <p>
                        <span className="font-medium">Necesita:</span>{" "}
                        {INFO_BRECHA[interes.brecha]?.texto ?? interes.brecha}
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
                    <div className="mt-2 flex gap-2">
                      <a
                        href={enlaceWhatsApp(
                          interes.empresa_whatsapp,
                          `Hola, les escribe el equipo de MineLink. Tenemos un minero (${interes.nombre}, WhatsApp ${interes.whatsapp}) interesado en sus servicios${
                            interes.brecha
                              ? ` para ${INFO_BRECHA[interes.brecha]?.texto ?? interes.brecha}`
                              : ""
                          }. ¿Pueden contactarlo?`
                        )}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => cambiarEstadoContactoEmpresa(interes, "contactado")}
                        className="flex min-h-[32px] items-center rounded bg-[#25D366] px-2 text-xs font-semibold text-white"
                      >
                        Escribir a la empresa
                      </a>
                      <button
                        onClick={() =>
                          cambiarEstadoContactoEmpresa(
                            interes,
                            interes.estado_contacto === "contactado" ? "buscando" : "contactado"
                          )
                        }
                        title="Clic para cambiar el estado"
                        className={`min-h-[32px] rounded px-2 text-xs font-semibold ${
                          interes.estado_contacto === "contactado"
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                        }`}
                      >
                        {interes.estado_contacto === "contactado" ? (
                          <span className="inline-flex items-center gap-1">
                            <Check size={13} strokeWidth={2.5} aria-hidden />
                            Contactado
                          </span>
                        ) : (
                          "En cola"
                        )}
                      </button>
                    </div>
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
