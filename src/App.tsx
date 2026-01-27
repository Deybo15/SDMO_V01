import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import MaintenanceDashboard from './pages/MaintenanceDashboard';
import Articulos from './pages/Articulos';
import ConsultarInventario from './pages/ConsultarInventario';
import EscanerQR from './pages/EscanerQR';
import GestionImagenes from './pages/GestionImagenes';
import IngresarArticulo from './pages/IngresarArticulo';
import GenerarEtiqueta from './pages/GenerarEtiqueta';
import Devoluciones from './pages/Devoluciones';
import KardexDiario from './pages/KardexDiario';
import ClienteInterno from './pages/ClienteInterno';
import ClienteExterno from './pages/ClienteExterno';
import OtrasSolicitudes from './pages/OtrasSolicitudes';
import GestionInterna from './pages/GestionInterna';
import Activos from './pages/Activos';

import Login from './pages/Login';
import HistorialArticulo from './pages/HistorialArticulo';
import ConsultarSalidas from './pages/ConsultarSalidas';
import RealizarSalida from './pages/RealizarSalida';
import TablaSolicitudesSalida from './pages/TablaSolicitudesSalida';
import IngresarSolicitud from './pages/IngresarSolicitud';
import SeguimientoSolicitud from './pages/SeguimientoSolicitud';
import ConsultarEstadoSolicitud from './pages/ConsultarEstadoSolicitud';
import IngresarSolicitudExterno from './pages/IngresarSolicitudExterno';
import SeguimientoSolicitudExterno from './pages/SeguimientoSolicitudExterno';
import SolicitudesExternasTable from './pages/SolicitudesExternasTable';
import RegistroSalidaExterno from './pages/RegistroSalidaExterno';
import EquiposActivos from './pages/EquiposActivos';
import Herramientas from './pages/Herramientas';
import Prestamo from './pages/Prestamo';
import ArticulosOficina from './pages/ArticulosOficina';
import SinAsignacion from './pages/SinAsignacion';
import TallerEbanisteria from './pages/TallerEbanisteria';
import Vestimenta from './pages/Vestimenta';
import LimpiezaAseo from './pages/LimpiezaAseo';
import InformeColaboradores from './pages/InformeColaboradores';
import InventarioActivos from './pages/Activos/InventarioActivos';
import IngresoActivos from './pages/Activos/IngresoActivos';
import AsignacionActivos from './pages/Activos/AsignacionActivos';
import AccesoriosActivos from './pages/Activos/AccesoriosActivos';
import AuditHistory from './pages/AuditHistory';
import { ThemeProvider } from './context/ThemeContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthorizedRoute } from './components/AuthorizedRoute';

import ProyeccionCompras from './pages/ProyeccionCompras';
import ConsultaActivos from './pages/ConsultaActivos';

function App() {
    return (
        <ThemeProvider>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route element={<ProtectedRoute />}>
                    <Route element={<Layout />}>
                        <Route path="/" element={<MaintenanceDashboard />} />
                        <Route path="/articulos" element={<Articulos />} />
                        <Route path="/articulos/consultar-inventario" element={<ConsultarInventario />} />
                        <Route path="/articulos/escaner-qr" element={<EscanerQR />} />
                        <Route path="/articulos/consultar-salidas" element={<ConsultarSalidas />} />
                        <Route path="/articulos/kardex-diario" element={<KardexDiario />} />

                        {/* Read-only pages moved to public/session-only */}
                        <Route path="/articulos/generar-etiqueta" element={<GenerarEtiqueta />} />
                        <Route path="/articulos/historial-articulo" element={<HistorialArticulo />} />
                        <Route path="/cliente-interno/realizar-salidas" element={<TablaSolicitudesSalida />} />
                        <Route path="/cliente-externo/realizar" element={<SolicitudesExternasTable />} />
                        <Route path="/gestion-interna/colaboradores" element={<InformeColaboradores />} />
                        <Route path="/gestion-interna/proyeccion-compras" element={<ProyeccionCompras />} />
                        <Route path="/activos/consulta" element={<ConsultaActivos />} />

                        <Route element={<AuthorizedRoute />}>
                            <Route path="/articulos/ingresar-articulo" element={<IngresarArticulo />} />
                            <Route path="/articulos/gestion-imagenes" element={<GestionImagenes />} />
                            <Route path="/articulos/devoluciones" element={<Devoluciones />} />

                            {/* Cliente Interno - Mutations */}
                            <Route path="/cliente-interno/ingresar" element={<IngresarSolicitud />} />
                            <Route path="/cliente-interno/realizar-salidas/formulario" element={<RealizarSalida />} />

                            {/* Cliente Externo - Mutations */}
                            <Route path="/cliente-externo/ingresar" element={<IngresarSolicitudExterno />} />
                            <Route path="/cliente-externo/registro-salida" element={<RegistroSalidaExterno />} />

                            <Route path="/otras-solicitudes/equipos-activos" element={<EquiposActivos />} />
                            <Route path="/otras-solicitudes/herramientas" element={<Herramientas />} />
                            <Route path="/otras-solicitudes/prestamo" element={<Prestamo />} />
                            <Route path="/otras-solicitudes/articulos-oficina" element={<ArticulosOficina />} />
                            <Route path="/otras-solicitudes/sin-asignacion" element={<SinAsignacion />} />
                            <Route path="/otras-solicitudes/taller-ebanisteria" element={<TallerEbanisteria />} />
                            <Route path="/otras-solicitudes/vestimenta" element={<Vestimenta />} />
                            <Route path="/otras-solicitudes/limpieza-aseo" element={<LimpiezaAseo />} />

                            {/* Gestión de Activos - Mutations */}
                            <Route path="/activos/ingreso" element={<IngresoActivos />} />
                            <Route path="/activos/asignacion" element={<AsignacionActivos />} />
                            <Route path="/activos/accesorios" element={<AccesoriosActivos />} />
                            <Route path="/gestion-interna/auditoria" element={<AuditHistory />} />
                        </Route>

                        {/* Navigation / Container Pages */}
                        <Route path="/cliente-interno" element={<ClienteInterno />} />
                        <Route path="/cliente-interno/seguimiento" element={<SeguimientoSolicitud />} />
                        <Route path="/cliente-interno/consultar-estado" element={<ConsultarEstadoSolicitud />} />
                        <Route path="/cliente-externo" element={<ClienteExterno />} />
                        <Route path="/cliente-externo/seguimiento" element={<SeguimientoSolicitudExterno />} />
                        <Route path="/otras-solicitudes" element={<OtrasSolicitudes />} />
                        <Route path="/gestion-interna" element={<GestionInterna />} />
                        <Route path="/activos" element={<Activos />} />
                        <Route path="/activos/inventario" element={<InventarioActivos />} />
                    </Route>
                </Route>
            </Routes>
        </ThemeProvider>
    );
}

export default App;
