export interface Colaborador {
    identificacion: string;
    alias?: string;
    colaborador: string;
    autorizado?: boolean;
    condicion_laboral?: boolean;
}

export interface Articulo {
    codigo_articulo: string;
    nombre_articulo: string;
    cantidad_disponible: number;
    unidad: string;
    imagen_url: string | null;
    precio_unitario: number;
    marca?: string;
}

export interface Equipo {
    numero_activo: number;
    placa: string;
    descripcion_equipo: string;
}

export interface DetalleSalida {
    codigo_articulo: string;
    articulo: string;
    cantidad: number | string;
    precio_unitario: number;
}
