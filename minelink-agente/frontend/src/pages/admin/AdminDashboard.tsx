import { useEffect, useState } from "react";
import { AdminLayout } from "../../components/AdminLayout";
import { useAuth } from "../../context/AuthContext";
import { INFO_BRECHA } from "../../data/brechas";
import { NOMBRE_PERFIL } from "../../data/preguntas";
import type { DashboardOut } from "../../types/admin";

function Tarjeta({ titulo, valor }: { titulo: string; valor: string | number }) {
  return (
    <div className="bg-tarjeta p-4 dark:bg-tarjeta-dark">
      <p className="text-sm text-texto-suave dark:text-texto-suave-dark">{titulo}</p>
      <p className="mt-1 font-mono text-3xl font-semibold">{valor}</p>
    </div>
  );
}

export function AdminDashboard() {
  const { authFetch } = useAuth();
  const [datos, setDatos] = useState<DashboardOut | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authFetch("/admin/dashboard")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setDatos)
      .catch(() => setError("No pudimos cargar el dashboard."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AdminLayout>
      <h1 className="mb-5 text-2xl font-semibold">Dashboard</h1>

      {error && <p className="text-red-500">{error}</p>}
      {!datos && !error && <p>Cargando...</p>}

      {datos && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tarjeta
              titulo="Diagnósticos (hoy / total)"
              valor={`${datos.diagnosticos_hoy} / ${datos.diagnosticos_total}`}
            />
            <Tarjeta
              titulo="Leads (hoy / total)"
              valor={`${datos.leads_hoy} / ${datos.leads_total}`}
            />
            <Tarjeta titulo="Brechas distintas" valor={datos.top_brechas.length} />
            {/* Conteo por perfil del pipeline — reemplaza al "Score
                promedio" legacy, que promediaba el score viejo (0 en
                todas las filas del modelo A/B/C/D) y siempre mostraba un
                número sin sentido (julio 2026). */}
            <div className="bg-tarjeta p-4 dark:bg-tarjeta-dark">
              <p className="text-sm text-texto-suave dark:text-texto-suave-dark">
                Diagnósticos por perfil
              </p>
              {Object.keys(datos.conteo_por_perfil).length === 0 ? (
                <p className="mt-1 font-mono text-3xl font-semibold">0</p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {Object.entries(datos.conteo_por_perfil)
                    .sort(([, a], [, b]) => b - a)
                    .map(([perfil, conteo]) => (
                      <span
                        key={perfil}
                        title={NOMBRE_PERFIL[perfil] ?? perfil}
                        className="bg-acento/10 px-2.5 py-0.5 text-sm font-semibold text-acento"
                      >
                        {perfil === "modelo_viejo" ? "viejo" : perfil}: {conteo}
                      </span>
                    ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-semibold">Embudo: dónde se caen los usuarios</h2>
            <div className="grid grid-cols-3 gap-3">
              <Tarjeta titulo="Empezaron el diagnóstico" valor={datos.diagnosticos_iniciados} />
              <Tarjeta
                titulo={`Lo terminaron${
                  datos.diagnosticos_iniciados > 0
                    ? ` (${Math.round(
                        (datos.diagnosticos_total / datos.diagnosticos_iniciados) * 100
                      )}%)`
                    : ""
                }`}
                valor={datos.diagnosticos_total}
              />
              <Tarjeta
                titulo={`Se registraron${
                  datos.diagnosticos_total > 0
                    ? ` (${Math.round((datos.leads_total / datos.diagnosticos_total) * 100)}%)`
                    : ""
                }`}
                valor={datos.leads_total}
              />
            </div>
            <p className="mt-2 text-xs text-texto-suave dark:text-texto-suave-dark">
              El conteo de "empezaron" se mide desde hoy (los diagnósticos antiguos no
              lo registraban), así que los porcentajes serán confiables de aquí en adelante.
            </p>
          </div>

          {/* Embudo del inversionista (julio 2026): antes esta mitad de la
              plataforma era una caja negra — solo se sabía cuántos
              intereses se dejaban, nunca cuántos vieron la cartera o
              abrieron una ficha para comparar contra eso. */}
          <div>
            <h2 className="mb-3 text-lg font-semibold">
              Embudo del inversionista: dónde se caen
            </h2>
            <div className="grid grid-cols-3 gap-3">
              <Tarjeta titulo="Vieron la cartera" valor={datos.carteras_vistas} />
              <Tarjeta
                titulo={`Abrieron una ficha${
                  datos.carteras_vistas > 0
                    ? ` (${Math.round((datos.fichas_vistas / datos.carteras_vistas) * 100)}%)`
                    : ""
                }`}
                valor={datos.fichas_vistas}
              />
              <Tarjeta
                titulo={`Dejaron su interés${
                  datos.fichas_vistas > 0
                    ? ` (${Math.round(
                        (datos.intereses_inversion_total / datos.fichas_vistas) * 100
                      )}%)`
                    : ""
                }`}
                valor={datos.intereses_inversion_total}
              />
            </div>
            <p className="mt-2 text-xs text-texto-suave dark:text-texto-suave-dark">
              "Vieron la cartera" y "Abrieron una ficha" se miden desde hoy — el conteo de
              "Dejaron su interés" sí es el total real desde siempre.
            </p>
          </div>

          {/* Salud del asesor conversacional (julio 2026): agregado tras un
              incidente real donde una clave de API incompleta en Render
              pasó desapercibida varios días — esto le permite a Esthiven
              notar un problema sin tener que probar el chat a mano. */}
          <div>
            <h2 className="mb-3 text-lg font-semibold">Asesor conversacional (hoy)</h2>
            <div className="grid grid-cols-2 gap-3">
              <Tarjeta titulo="Preguntas respondidas" valor={datos.asesor_preguntas_hoy} />
              <div
                className={`p-4 ${
                  datos.asesor_fallas_hoy > 0
                    ? "bg-red-500/10 text-red-600 dark:text-red-400"
                    : "bg-tarjeta dark:bg-tarjeta-dark"
                }`}
              >
                <p className="text-sm text-texto-suave dark:text-texto-suave-dark">
                  Preguntas que fallaron
                </p>
                <p className="mt-1 font-mono text-3xl font-semibold">
                  {datos.asesor_fallas_hoy}
                </p>
                {datos.asesor_fallas_hoy > 0 && (
                  <p className="mt-1 text-xs">
                    Revisa las claves de API en Render — puede que el proveedor configurado
                    no esté respondiendo.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-semibold">Top 5 brechas más comunes</h2>
            {datos.top_brechas.length === 0 ? (
              <p className="text-texto-suave dark:text-texto-suave-dark">
                Aún no hay diagnósticos.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {datos.top_brechas.map((b) => (
                  <div
                    key={b.estudio}
                    className="flex items-center justify-between bg-tarjeta p-3 dark:bg-tarjeta-dark"
                  >
                    <span>{INFO_BRECHA[b.estudio]?.texto ?? b.estudio}</span>
                    <span className="font-mono font-semibold">{b.conteo}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="mb-3 text-lg font-semibold">Últimos 10 leads</h2>
            {datos.ultimos_leads.length === 0 ? (
              <p className="text-texto-suave dark:text-texto-suave-dark">
                Aún no hay leads.
              </p>
            ) : (
              <div className="overflow-x-auto bg-tarjeta dark:bg-tarjeta-dark">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-black/10 dark:border-white/10">
                      <th className="p-3">Nombre</th>
                      <th className="p-3">Región</th>
                      <th className="p-3">Perfil</th>
                      <th className="p-3">Hora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.ultimos_leads.map((l, i) => (
                      <tr key={i} className="border-b border-black/5 dark:border-white/5">
                        <td className="p-3">{l.nombre}</td>
                        <td className="p-3 capitalize">{l.region}</td>
                        <td className="p-3">
                          {l.perfil ? (
                            <span
                              title={NOMBRE_PERFIL[l.perfil] ?? l.perfil}
                              className="bg-acento/10 px-2.5 py-0.5 text-xs font-semibold text-acento"
                            >
                              {l.perfil}
                            </span>
                          ) : (
                            <span className="text-xs text-texto-suave dark:text-texto-suave-dark">
                              modelo viejo
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          {new Date(l.created_at).toLocaleString("es-PE")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
