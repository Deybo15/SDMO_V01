import { createContext, useContext } from 'react';

export const BodegaContext = createContext(false);

export const useBodegaProfile = () => useContext(BodegaContext);

export const bodegaScreens = [
    { title: 'Consultar inventario', path: '/articulos/consultar-inventario' },
    { title: 'Consultar salidas', path: '/articulos/consultar-salidas' },
    { title: 'Kárdex diario', path: '/articulos/kardex-diario' },
    { title: 'Historial de artículo', path: '/articulos/historial-articulo' },
    { title: 'Escáner QR', path: '/articulos/escaner-qr' },
    { title: 'Generar etiqueta', path: '/articulos/generar-etiqueta' },
    { title: 'Retiros por artículo', path: '/gestion-interna/retiros-articulo' },
    { title: 'Materiales por solicitud', path: '/gestion-interna/materiales-solicitud' },
];

const bodegaPaths = new Set([
    '/articulos',
    '/gestion-interna',
    ...bodegaScreens.map(screen => screen.path),
]);

export const isBodegaPath = (path: string) => bodegaPaths.has(path.replace(/\/+$/, ''));

export const bodegaHome = '/articulos/consultar-inventario';
