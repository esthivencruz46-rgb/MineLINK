import { Suspense, lazy } from "react";
import { MARCA } from "./config/marca";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ProtectedRouteMinero } from "./components/ProtectedRouteMinero";
import { ProtectedRouteInversionista } from "./components/ProtectedRouteInversionista";
import { ThemeToggle } from "./components/ThemeToggle";
import { AuthProvider } from "./context/AuthContext";
import { MineroAuthProvider } from "./context/MineroAuthContext";
import { InversionistaAuthProvider } from "./context/InversionistaAuthContext";
// La portada se queda en el bundle principal: es lo primero que carga
// cualquier visitante y no debe esperar un segundo viaje a la red.
import { Inicio } from "./pages/Inicio";

// Code-splitting por ruta (julio 2026): el bundle único pesaba ~700 KB y
// un minero con internet de campo lo descargaba COMPLETO —incluyendo el
// panel admin, Leaflet del mapa y jsPDF— solo para ver la portada. Con
// lazy(), cada página baja recién cuando se navega a ella y Vite genera
// un archivo separado por ruta. Las páginas exportan funciones con nombre
// (no default), de ahí el .then() que adapta la forma que lazy() espera.
const ComoFunciona = lazy(() =>
  import("./pages/ComoFunciona").then((m) => ({ default: m.ComoFunciona }))
);
const Cuestionario = lazy(() =>
  import("./pages/Cuestionario").then((m) => ({ default: m.Cuestionario }))
);
const CuestionarioInversion = lazy(() =>
  import("./pages/CuestionarioInversion").then((m) => ({ default: m.CuestionarioInversion }))
);
const DocumentosEnviados = lazy(() =>
  import("./pages/DocumentosEnviados").then((m) => ({ default: m.DocumentosEnviados }))
);
const Empresas = lazy(() => import("./pages/Empresas").then((m) => ({ default: m.Empresas })));
const Gracias = lazy(() => import("./pages/Gracias").then((m) => ({ default: m.Gracias })));
const LoginMinero = lazy(() =>
  import("./pages/LoginMinero").then((m) => ({ default: m.LoginMinero }))
);
const LoginInversionista = lazy(() =>
  import("./pages/LoginInversionista").then((m) => ({ default: m.LoginInversionista }))
);
const MiCuenta = lazy(() => import("./pages/MiCuenta").then((m) => ({ default: m.MiCuenta })));
const MiConcesion = lazy(() =>
  import("./pages/MiConcesion").then((m) => ({ default: m.MiConcesion }))
);
const MiCuentaInversionista = lazy(() =>
  import("./pages/MiCuentaInversionista").then((m) => ({ default: m.MiCuentaInversionista }))
);
const Postular = lazy(() => import("./pages/Postular").then((m) => ({ default: m.Postular })));
const Proyectos = lazy(() =>
  import("./pages/Proyectos").then((m) => ({ default: m.Proyectos }))
);
const SinRuta = lazy(() => import("./pages/SinRuta").then((m) => ({ default: m.SinRuta })));
const ProyectoDetalle = lazy(() =>
  import("./pages/ProyectoDetalle").then((m) => ({ default: m.ProyectoDetalle }))
);
const Registro = lazy(() => import("./pages/Registro").then((m) => ({ default: m.Registro })));
const RecuperarPasswordMinero = lazy(() =>
  import("./pages/RecuperarPasswordMinero").then((m) => ({ default: m.RecuperarPasswordMinero }))
);
const RecuperarPasswordInversionista = lazy(() =>
  import("./pages/RecuperarPasswordInversionista").then((m) => ({
    default: m.RecuperarPasswordInversionista,
  }))
);
const Resultado = lazy(() =>
  import("./pages/Resultado").then((m) => ({ default: m.Resultado }))
);
const AdminDashboard = lazy(() =>
  import("./pages/admin/AdminDashboard").then((m) => ({ default: m.AdminDashboard }))
);
const AdminEmpresas = lazy(() =>
  import("./pages/admin/AdminEmpresas").then((m) => ({ default: m.AdminEmpresas }))
);
const AdminLeads = lazy(() =>
  import("./pages/admin/AdminLeads").then((m) => ({ default: m.AdminLeads }))
);
const AdminLogin = lazy(() =>
  import("./pages/admin/AdminLogin").then((m) => ({ default: m.AdminLogin }))
);

function PublicHeader() {
  return (
    <header className="flex items-center justify-between px-4 py-3">
      <Link to="/" className="font-bold text-acento">
        {MARCA}
      </Link>
      <ThemeToggle />
    </header>
  );
}

/** Placeholder mientras baja el archivo de la página (solo se ve un
 *  instante en conexiones lentas — mismo texto que usan los fetch). */
function CargandoPagina() {
  return (
    <p className="px-4 py-10 text-center text-sm text-texto-suave dark:text-texto-suave-dark">
      Cargando...
    </p>
  );
}

export function App() {
  const location = useLocation();
  const esAdmin = location.pathname.startsWith("/admin");

  return (
    <AuthProvider>
      <MineroAuthProvider>
      <InversionistaAuthProvider>
        <div className="min-h-screen">
          {!esAdmin && <PublicHeader />}

        <main>
          <Suspense fallback={<CargandoPagina />}>
          <Routes>
            <Route path="/" element={<Inicio />} />
            <Route path="/como-funciona" element={<ComoFunciona />} />
            <Route path="/diagnostico" element={<Cuestionario />} />
            <Route path="/resultado" element={<Resultado />} />
            <Route path="/sin-ruta" element={<SinRuta />} />
            <Route path="/empresas" element={<Empresas />} />
            <Route path="/registro" element={<Registro />} />
            <Route path="/postular" element={<Postular />} />
            <Route path="/gracias" element={<Gracias />} />
            <Route path="/proyectos" element={<Proyectos />} />
            <Route path="/proyectos/:id" element={<ProyectoDetalle />} />
            <Route path="/ingresar" element={<LoginMinero />} />
            <Route path="/recuperar-password" element={<RecuperarPasswordMinero />} />
            <Route
              path="/mi-cuenta"
              element={
                <ProtectedRouteMinero>
                  <MiCuenta />
                </ProtectedRouteMinero>
              }
            />
            <Route
              path="/mi-concesion"
              element={
                <ProtectedRouteMinero>
                  <MiConcesion />
                </ProtectedRouteMinero>
              }
            />
            <Route
              path="/mi-inversion"
              element={
                <ProtectedRouteMinero>
                  <CuestionarioInversion />
                </ProtectedRouteMinero>
              }
            />
            <Route
              path="/documentos-enviados"
              element={
                <ProtectedRouteMinero>
                  <DocumentosEnviados />
                </ProtectedRouteMinero>
              }
            />
            <Route path="/ingresar-inversionista" element={<LoginInversionista />} />
            <Route
              path="/recuperar-password-inversionista"
              element={<RecuperarPasswordInversionista />}
            />
            <Route
              path="/mi-cuenta-inversionista"
              element={
                <ProtectedRouteInversionista>
                  <MiCuentaInversionista />
                </ProtectedRouteInversionista>
              }
            />

            <Route path="/admin/login" element={<AdminLogin />} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/empresas"
              element={
                <ProtectedRoute>
                  <AdminEmpresas />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/leads"
              element={
                <ProtectedRoute>
                  <AdminLeads />
                </ProtectedRoute>
              }
            />
          </Routes>
          </Suspense>
        </main>
        </div>
      </InversionistaAuthProvider>
      </MineroAuthProvider>
    </AuthProvider>
  );
}
