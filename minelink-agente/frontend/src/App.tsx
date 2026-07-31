import { Suspense, lazy } from "react";
import { MARCA } from "./config/marca";
import { ChevronDown } from "lucide-react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ProtectedRouteMinero } from "./components/ProtectedRouteMinero";
import { ProtectedRouteInversionista } from "./components/ProtectedRouteInversionista";
import { ThemeToggle } from "./components/ThemeToggle";
import { Footer } from "./components/Footer";
import { AsesorWidget } from "./components/AsesorWidget";
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
const AdminAsesor = lazy(() =>
  import("./pages/admin/AdminAsesor").then((m) => ({ default: m.AdminAsesor }))
);
const AdminLogin = lazy(() =>
  import("./pages/admin/AdminLogin").then((m) => ({ default: m.AdminLogin }))
);
const NoEncontrada = lazy(() =>
  import("./pages/NoEncontrada").then((m) => ({ default: m.NoEncontrada }))
);
const Privacidad = lazy(() =>
  import("./pages/Privacidad").then((m) => ({ default: m.Privacidad }))
);
const Terminos = lazy(() =>
  import("./pages/Terminos").then((m) => ({ default: m.Terminos }))
);

// julio 2026, pedido explícito ("mejora áreas que te falten de la página
// web total"): antes era solo el logo + el botón de tema, sin un solo
// link de navegación, en TODAS las páginas públicas — quien llegaba a
// cualquier página que no fuera Inicio (ej. un enlace compartido a una
// ficha de proyecto) no tenía forma de moverse por el sitio sin bajar
// hasta el Footer. Los 3 links espejan los del Footer (mismo destino,
// visibles arriba también). En celular se esconden los links secundarios
// (quedan disponibles en el Footer) pero "Ingresar" se mantiene siempre
// visible: es la acción que más le sirve a alguien que ya tiene cuenta
// y llegó a una página interna.
function PublicHeader() {
  return (
    <header className="border-b border-black/10 dark:border-white/10">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link to="/" className="shrink-0 text-lg font-semibold tracking-tight text-acento">
          {MARCA}
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium sm:flex">
          <Link
            to="/proyectos"
            className="text-texto-suave transition-colors hover:text-acento dark:text-texto-suave-dark"
          >
            Proyectos
          </Link>
          <Link
            to="/como-funciona"
            className="text-texto-suave transition-colors hover:text-acento dark:text-texto-suave-dark"
          >
            Cómo funciona
          </Link>
          <Link
            to="/postular"
            className="text-texto-suave transition-colors hover:text-acento dark:text-texto-suave-dark"
          >
            Soy consultor
          </Link>
        </nav>
        <div className="flex shrink-0 items-center gap-3">
          <MenuIngresar />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

/** "Ingresar" en el header (julio 2026, corregido tras reporte con
 * captura de Esthiven: "no lo veo lógico" — antes era un link fijo al
 * login del minero, así que un inversionista que ya tenía cuenta caía en
 * el formulario equivocado). Con dos tipos de cuenta reales (minero e
 * inversionista — los consultores no tienen login propio, solo postulan
 * desde /postular y Esthiven los gestiona desde /admin), un solo link no
 * alcanza. `<details>` nativo, mismo patrón ya usado en el filtro de
 * Empresas.tsx — se abre/cierra solo, sin manejar estado ni clics afuera
 * a mano. */
function MenuIngresar() {
  return (
    <details className="relative">
      <summary className="flex cursor-pointer list-none items-center gap-1 text-sm font-semibold text-acento [&::-webkit-details-marker]:hidden">
        Ingresar
        <ChevronDown size={14} strokeWidth={2.5} aria-hidden />
      </summary>
      <div className="absolute right-0 top-full z-10 mt-2 flex w-48 flex-col border border-black/10 bg-tarjeta py-1 shadow-lg dark:border-white/10 dark:bg-tarjeta-dark">
        {/* Cierra el <details> al elegir -- si no, como la navegación es
            del lado del cliente (SPA, el header nunca se remonta), el
            menú se quedaría "abierto" en la siguiente página hasta que
            alguien lo vuelva a tocar. */}
        <Link
          to="/ingresar"
          onClick={(e) => e.currentTarget.closest("details")?.removeAttribute("open")}
          className="px-3 py-2 text-sm font-medium transition-colors hover:bg-acento/5 hover:text-acento"
        >
          Soy minero
        </Link>
        <Link
          to="/ingresar-inversionista"
          onClick={(e) => e.currentTarget.closest("details")?.removeAttribute("open")}
          className="px-3 py-2 text-sm font-medium transition-colors hover:bg-acento/5 hover:text-acento"
        >
          Soy inversionista
        </Link>
      </div>
    </details>
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
            <Route path="/privacidad" element={<Privacidad />} />
            <Route path="/terminos" element={<Terminos />} />
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
            <Route
              path="/admin/asesor"
              element={
                <ProtectedRoute>
                  <AdminAsesor />
                </ProtectedRoute>
              }
            />

            {/* Cualquier ruta no reconocida — antes quedaba en blanco. */}
            <Route path="*" element={<NoEncontrada />} />
          </Routes>
          </Suspense>
        </main>
        {!esAdmin && <Footer />}
        {!esAdmin && <AsesorWidget />}
        </div>
      </InversionistaAuthProvider>
      </MineroAuthProvider>
    </AuthProvider>
  );
}
