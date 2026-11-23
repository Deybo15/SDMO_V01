import { createContext, useContext } from 'react';

export const BodegaContext = createContext(false);

export const useBodegaProfile = () => useContext(BodegaContext);

export const bodegaScreens = [
    { title: 'Consultar inventario', path: '/articulos/consultar-inventario' },
    { title: 'Consultar salidas', path: '/articulos/consultar-salidas' },
    { title: 'K�rdex diario', path: '/articulos/kardex-diario' },
    { title: 'Historial de art�culo', path: '/articulos/historial-articulo' },
    { title: 'Esc�ner QR', path: '/articulos/escaner-qr' },
    { title: 'Generar etiqueta', path: '/articulos/generar-etiqueta' },
    { title: 'Retiros por art�culo', path: '/gestion-interna/retiros-articulo' },
    { title: 'Materiales por solicitud', path: '/gestion-interna/materiales-solicitud' },
];

const bodegaPaths = new Set([
    '/articulos',
    '/gestion-interna',
    ...bodegaScreens.map(screen => screen.path),
]);

export const isBodegaPath = (path: string) => bodegaPaths.has(path.replace(/\/+$/, ''));

export const bodegaHome = '/articulos/consultar-inventario';

