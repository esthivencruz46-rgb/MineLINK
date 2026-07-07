import { useEffect, useState } from "react";
import { AdminLayout } from "../../components/AdminLayout";
import { useAuth } from "../../context/AuthContext";
import { INFO_BRECHA } from "../../data/brechas";
import { calcularSemaforo } from "../../utils/semaforo";
import type { DashboardOut } from "../../types/admin";

function Tarjeta({ titulo, valor }: { titulo: string; valor: string | number }) {
  return (
    <div className="rounded-xl bg-tarjeta p-4 dark:bg-tarjeta-dark">
      <p className="text-sm text-texto-suave dark:text-texto-suave-dark">{titulo}</p>
      <p className="mt-1 font-mono text-3xl font-bold">{valor}</p>
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
      <h1 className="mb-5 text-2xl font-bold">Dashboard</h1>

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
            <Tarjeta titulo="Score promedio" valor={datos.score_promedio} />
            <Tarjeta titulo="Brechas distintas" valor={datos.top_brechas.length} />
          </div>

          <div>
            <h2 className="mb-3 text-lg font-bold">Top 5 brechas más comunes</h2>
            {datos.top_brechas.length === 0 ? (
              <p className="text-texto-suave dark:text-texto-suave-dark">
                Aún no hay diagnósticos.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {datos.top_brechas.map((b) => (
                  <div
                    key={b.estudio}
                    className="flex items-center justify-between rounded-lg bg-tarjeta p-3 dark:bg-tarjeta-dark"
                  >
                    <span>{INFO_BRECHA[b.estudio]?.texto ?? b.estudio}</span>
                    <span className="font-mono font-semibold">{b.conteo}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="mb-3 text-lg font-bold">Últimos 10 leads</h2>
            {datos.ultimos_leads.length === 0 ? (
              <p className="text-texto-suave dark:text-texto-suave-dark">
                Aún no hay leads.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg bg-tarjeta dark:bg-tarjeta-dark">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-black/10 dark:border-white/10">
                      <th className="p-3">Nombre</th>
                      <th className="p-3">Región</th>
                      <th className="p-3">Score</th>
                      <th className="p-3">Hora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.ultimos_leads.map((l, i) => {
                      const semaforo = calcularSemaforo(l.score_total, false);
                      return (
                        <tr key={i} className="border-b border-black/5 dark:border-white/5">
                          <td className="p-3">{l.nombre}</td>
                          <td className="p-3 capitalize">{l.region}</td>
                          <td className={`p-3 font-mono font-semibold ${semaforo.claseTexto}`}>
                            {l.score_total}
                          </td>
                          <td className="p-3">
                            {new Date(l.created_at).toLocaleString("es-PE")}
                          </td>
                        </tr>
                      );
                    })}
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
