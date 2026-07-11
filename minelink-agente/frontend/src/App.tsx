import { Link, Route, Routes, useLocation } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ProtectedRouteMinero } from "./components/ProtectedRouteMinero";
import { ProtectedRouteInversionista } from "./components/ProtectedRouteInversionista";
import { ThemeToggle } from "./components/ThemeToggle";
import { AuthProvider } from "./context/AuthContext";
import { MineroAuthProvider } from "./context/MineroAuthContext";
import { InversionistaAuthProvider } from "./context/InversionistaAuthContext";
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { AdminEmpresas } from "./pages/admin/AdminEmpresas";
import { AdminLeads } from "./pages/admin/AdminLeads";
import { AdminLogin } from "./pages/admin/AdminLogin";
import { ComoFunciona } from "./pages/ComoFunciona";
import { Cuestionario } from "./pages/Cuestionario";
import { CuestionarioInversion } from "./pages/CuestionarioInversion";
import { Empresas } from "./pages/Empresas";
import { Gracias } from "./pages/Gracias";
import { Inicio } from "./pages/Inicio";
import { LoginMinero } from "./pages/LoginMinero";
import { LoginInversionista } from "./pages/LoginInversionista";
import { MiCuenta } from "./pages/MiCuenta";
import { MiConcesion } from "./pages/MiConcesion";
import { MiCuentaInversionista } from "./pages/MiCuentaInversionista";
import { Postular } from "./pages/Postular";
import { Proyectos } from "./pages/Proyectos";
import { SinRuta } from "./pages/SinRuta";
import { ProyectoDetalle } from "./pages/ProyectoDetalle";
import { Registro } from "./pages/Registro";
import { RecuperarPasswordMinero } from "./pages/RecuperarPasswordMinero";
import { RecuperarPasswordInversionista } from "./pages/RecuperarPasswordInversionista";
import { Resultado } from "./pages/Resultado";

function PublicHeader() {
  return (
    <header className="flex items-center justify-between px-4 py-3">
      <Link to="/" className="font-bold text-acento">
        MineLink
      </Link>
      <ThemeToggle />
    </header>
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
        </main>
        </div>
      </InversionistaAuthProvider>
      </MineroAuthProvider>
    </AuthProvider>
  );
}
