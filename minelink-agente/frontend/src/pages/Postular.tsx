import { useState } from "react";
import { useTitulo } from "../hooks/useTitulo";
import { MARCA } from "../config/marca";
import { DEPARTAMENTOS } from "../data/departamentos";
import { INFO_BRECHA } from "../data/brechas";
import { NOMBRES_DIMENSION } from "../data/preguntas";
import {
  ESTUDIOS_POR_DIMENSION_CON_PREGUNTA,
  ORDEN_DIMENSIONES,
} from "../data/estudiosPorDimension";
import { postularConsultor } from "../services/api";
import { CampoTelefono } from "../components/CampoTelefono";
import { AceptaLegal } from "../components/AceptaLegal";
import { HeroFranja } from "../components/HeroFranja";

interface Formulario {
  nombre: string;
  colegiatura: string;
  whatsapp: string;
  email: string;
  regiones_json: string[];
  estudios_json: string[];
}

const VACIO: Formulario = {
  nombre: "",
  colegiatura: "",
  whatsapp: "",
  email: "",
  regiones_json: [],
  estudios_json: [],
};

const CV_TAMANO_MAXIMO_BYTES = 5 * 1024 * 1024; // 5 MB, igual que el backend

function validar(f: Formulario, cv: File | null): Record<string, string> {
  const errores: Record<string, string> = {};
  if (!f.nombre.trim()) errores.nombre = "Tu nombre es obligatorio";
  if (!/^\d+$/.test(f.colegiatura.trim()))
    errores.colegiatura = "Ingresa solo el número de tu colegiatura (ej. 123456)";
  if (!/^\d{9}$/.test(f.whatsapp))
    errores.whatsapp = "Ingresa los 9 dígitos de tu número (sin el +51)";
  if (!/^\S+@\S+\.\S+$/.test(f.email.trim()))
    errores.email = "Ingresa un email válido — es obligatorio para contactarte";
  if (f.regiones_json.length === 0)
    errores.regiones_json = "Marca al menos 1 departamento";
  if (f.estudios_json.length === 0)
    errores.estudios_json = "Marca al menos 1 estudio en el que ayudas";
  if (!cv) errores.cv = "Debes adjuntar tu CV en PDF";
  else if (cv.type !== "application/pdf") errores.cv = "El CV debe ser un archivo PDF";
  else if (cv.size > CV_TAMANO_MAXIMO_BYTES) errores.cv = "El CV no debe superar 5MB";
  return errores;
}

export function Postular() {
  useTitulo("Postular como consultor");
  const [form, setForm] = useState<Formulario>(VACIO);
  const [cv, setCv] = useState<File | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [aceptaLegal, setAceptaLegal] = useState(false);

  function alternarLista(campo: "regiones_json" | "estudios_json", valor: string) {
    setForm((f) => ({
      ...f,
      [campo]: f[campo].includes(valor)
        ? f[campo].filter((v) => v !== valor)
        : [...f[campo], valor],
    }));
  }

  const TODOS_LOS_DEPARTAMENTOS = DEPARTAMENTOS.map((d) => d.toLowerCase());
  const todosMarcados = TODOS_LOS_DEPARTAMENTOS.every((d) => form.regiones_json.includes(d));

  function alternarTodosDepartamentos() {
    setForm((f) => ({
      ...f,
      regiones_json: todosMarcados ? [] : TODOS_LOS_DEPARTAMENTOS,
    }));
  }

  async function enviar() {
    const erroresValidacion = validar(form, cv);
    if (!aceptaLegal) erroresValidacion.legal = "Debes aceptar la Política de Privacidad y los Términos para postular.";
    setErrores(erroresValidacion);
    if (Object.keys(erroresValidacion).length > 0 || !cv) return;

    setEnviando(true);
    try {
      await postularConsultor({
        nombre: form.nombre.trim(),
        colegiatura: form.colegiatura.trim(),
        whatsapp: `+51${form.whatsapp}`,
        email: form.email.trim(),
        regiones_json: form.regiones_json,
        estudios_json: form.estudios_json,
        cv,
      });
      setEnviado(true);
    } catch {
      setErrores({ general: "No pudimos enviar tu postulación. Intenta de nuevo." });
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <div className="mx-auto flex min-h-[80vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">¡Gracias por postular!</h1>
        <p className="text-texto-suave dark:text-texto-suave-dark">
          Esthiven revisará tus datos y credenciales. Si todo está en orden, tu perfil
          se activará y los mineros podrán contactarte por WhatsApp.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <HeroFranja
        eyebrow="Soy consultor o empresa"
        titulo={`Quiero ser consultor en ${MARCA}`}
        subtitulo="Para postular necesitas colegiatura vigente y tu CV actualizado. Tu perfil queda pendiente de revisión antes de aparecer públicamente."
        ancho="max-w-4xl"
      />
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-8">
      {/* Web ancha: dos columnas (tus datos a la izquierda, en qué ayudas a
          la derecha) — en celular/APK se apilan en una sola. */}
      <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-5">
      <div>
        <input
          className="min-h-[44px] w-full border border-black/10 bg-tarjeta px-3 text-texto dark:border-white/10 dark:bg-tarjeta-dark dark:text-texto-dark"
          placeholder="Tu nombre completo"
          value={form.nombre}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
        />
        {errores.nombre && <p className="mt-1 text-xs text-red-500">{errores.nombre}</p>}
      </div>

      <div>
        <input
          className="min-h-[44px] w-full border border-black/10 bg-tarjeta px-3 text-texto dark:border-white/10 dark:bg-tarjeta-dark dark:text-texto-dark"
          placeholder="N° de colegiatura (solo el número, ej. 123456)"
          value={form.colegiatura}
          onChange={(e) => setForm({ ...form, colegiatura: e.target.value })}
        />
        {errores.colegiatura && (
          <p className="mt-1 text-xs text-red-500">{errores.colegiatura}</p>
        )}
      </div>

      <div>
        <CampoTelefono
          value={form.whatsapp}
          onChange={(v) => setForm({ ...form, whatsapp: v })}
          placeholder="Tu WhatsApp (9 dígitos)"
        />
        {errores.whatsapp && <p className="mt-1 text-xs text-red-500">{errores.whatsapp}</p>}
      </div>

      <div>
        <input
          type="email"
          className="min-h-[44px] w-full border border-black/10 bg-tarjeta px-3 text-texto dark:border-white/10 dark:bg-tarjeta-dark dark:text-texto-dark"
          placeholder="Tu email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        {errores.email && <p className="mt-1 text-xs text-red-500">{errores.email}</p>}
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="text-sm font-medium">Departamentos donde puedes atender</p>
          <button
            type="button"
            onClick={alternarTodosDepartamentos}
            className="text-xs font-semibold text-acento underline"
          >
            {todosMarcados ? "Quitar todos" : "Todos los departamentos"}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 border border-black/10 p-3 dark:border-white/10 sm:grid-cols-3 md:grid-cols-4">
          {DEPARTAMENTOS.map((d) => (
            <label key={d} className="flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                className="h-3.5 w-3.5"
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
        <p className="mb-1 text-sm font-medium">Tu CV (PDF, máx. 5MB)</p>
        <label className="flex min-h-[44px] w-full cursor-pointer items-center border border-dashed border-black/20 bg-tarjeta px-3 text-sm dark:border-white/20 dark:bg-tarjeta-dark">
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => setCv(e.target.files?.[0] ?? null)}
          />
          <span className={cv ? "" : "text-texto-suave dark:text-texto-suave-dark"}>
            {cv ? cv.name : "Elegir archivo PDF..."}
          </span>
        </label>
        <p className="mt-1 text-xs text-texto-suave dark:text-texto-suave-dark">
          Esthiven revisa cada CV antes de aprobar tu perfil — es lo que le da confianza
          al minero de que hablará con alguien calificado.
        </p>
        {errores.cv && <p className="mt-1 text-xs text-red-500">{errores.cv}</p>}
      </div>
        </div>

        <div>
          <p className="mb-1 text-sm font-medium">¿En qué puedes ayudar?</p>
          <div className="flex flex-col gap-3">
            {/* Solo estudios con pregunta generadora en el diagnóstico o el
                Módulo INV — un estudio legacy nunca haría match con nadie. */}
            {ORDEN_DIMENSIONES.filter(
              (dim) => ESTUDIOS_POR_DIMENSION_CON_PREGUNTA[dim].length > 0
            ).map((dim) => (
              <div
                key={dim}
                className="border border-black/10 p-3 dark:border-white/10"
              >
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-acento">
                  {NOMBRES_DIMENSION[dim]}
                </p>
                <div className="flex flex-col gap-1.5">
                  {ESTUDIOS_POR_DIMENSION_CON_PREGUNTA[dim].map((estudio) => (
                    <label key={estudio} className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="mt-0.5"
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
      </div>

      <AceptaLegal aceptado={aceptaLegal} onCambiar={setAceptaLegal} error={errores.legal} />

      {errores.general && <p className="text-sm text-red-500">{errores.general}</p>}

      <button
        disabled={enviando}
        onClick={enviar}
        className="min-h-[44px] bg-acento px-6 py-3 font-semibold text-white transition hover:bg-acento/90 disabled:opacity-50"
      >
        {enviando ? "Enviando..." : "Enviar postulación"}
      </button>
      </div>
    </div>
  );
}
