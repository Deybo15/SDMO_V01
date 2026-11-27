const solicitudes = {
    '13948': {
        estado: 'Activa',
        descripcion: 'Revisión de luminarias',
        materiales: [
            { nombre: 'Luminaria LED', cantidad: 2, subtotal: 3600 },
            { nombre: 'Conector', cantidad: 4, subtotal: 1000 }
        ]
    },
    '13947': {
        estado: 'Terminada',
        descripcion: 'Ajuste de puerta de acceso',
        materiales: []
    }
};

export const preguntasDemo = [
    '¿Qué materiales se usaron en la #13948?',
    '¿En qué estado está la #13948?',
    '¿Qué materiales se usaron en la #13947?',
    '¿En qué estado está la #13946?'
];

export function responderDemo(pregunta: string) {
    const texto = pregunta.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const numeros = texto.match(/\b\d{3,}\b/g) ?? [];
    const [numero] = [...new Set(numeros)];
    const pideMateriales = /\b(material(?:es)?|articulos?|consumo|cost[eo]s?|gastos?|total)\b/.test(texto);
    const pideEstado = /\b(estado|como va|activa|terminada|cerrada|seguimiento)\b/.test(texto);

    if (/\b(cambia(?:r)?|actualiza(?:r)?|borra(?:r)?|elimina(?:r)?|registra(?:r)?|cierra|cerrar|asigna(?:r)?|cancela(?:r)?)\b/.test(texto)) {
        return { mensaje: 'El asistente es de solo consulta y no puede modificar solicitudes.' };
    }
    if (!pideMateriales && !pideEstado) {
        return { mensaje: 'En esta prueba puedes preguntar por el estado, los materiales o los costos de una solicitud interna.' };
    }
    if (!numero || new Set(numeros).size > 1) {
        return { mensaje: 'Indica un solo número de solicitud. Para probar, usa #13948, #13947 o #13946.' };
    }
    if (numero === '13946') {
        return { mensaje: 'Esta solicitud no está disponible para el perfil de prueba. No se muestran detalles.' };
    }
    if (numero !== '13948' && numero !== '13947') {
        return { mensaje: 'No encontré ese número entre los datos de ejemplo. Esta prueba no consulta expedientes reales.' };
    }

    const solicitud = solicitudes[numero];
    return {
        mensaje: pideMateriales && solicitud.materiales.length === 0
            ? 'Esta solicitud no tiene materiales registrados.'
            : pideMateriales && !pideEstado ? 'Materiales registrados' : `Estado: ${solicitud.estado}.`,
        expediente: { numero, estado: solicitud.estado, descripcion: solicitud.descripcion },
        materiales: pideMateriales ? solicitud.materiales : undefined
    };
}
