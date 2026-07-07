import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { ProyectoObraConDetalles } from '../types/proyectosObra';
import { formatMonedaCRC, formatFechaCR, formatProgressPercent, normalizeProgressFraction } from './proyectosObraService';
import { supabase } from './supabase';
import {
  ESTADO_DONACION_PROYECTO_OPTIONS,
  ESTADO_GARANTIA_CONTRATO_OPTIONS,
  ESTADO_HITO_PROYECTO_OPTIONS,
  ESTADO_PERMISO_PROYECTO_OPTIONS,
  FASE_PROYECTO_OPTIONS,
  getCatalogLabel,
  getFaseProyectoOrder,
  normalizeCatalogValue,
  TIPO_DOCUMENTO_PROYECTO_OPTIONS,
  TIPO_DONACION_PROYECTO_OPTIONS,
  TIPO_GARANTIA_CONTRATO_OPTIONS,
  TIPO_PERMISO_PROYECTO_OPTIONS
} from './proyectosObraCatalogos';

/**
 * Formateador de moneda específico para celdas de PDF (reemplaza cualquier ₡ por CRC para evitar incompatibilidad en PDF standard fonts)
 */
export const formatMonedaPDF = (monto: number | null | undefined): string => {
  if (monto === null || monto === undefined || isNaN(monto)) return 'CRC 0';
  const dects = Math.round(monto);
  const numStr = dects.toLocaleString('es-CR').replace(/₡/g, '').trim();
  return 'CRC ' + numStr;
};

const normalizarTexto = (value: string | null | undefined): string => (value || '').trim().toLowerCase();

const parseDateOnly = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const [year, month, day] = value.split('T')[0].split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const isPastDate = (value: string | null | undefined): boolean => {
  const date = parseDateOnly(value);
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
};

const isWithinNextDays = (value: string | null | undefined, days: number): boolean => {
  const date = parseDateOnly(value);
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const limit = new Date(today);
  limit.setDate(limit.getDate() + days);
  return date >= today && date <= limit;
};

const isPermisoPendiente = (estado: string | null | undefined): boolean => {
  const normalized = normalizarTexto(estado);
  return normalized === 'pendiente' || normalized === 'en tramite' || normalized === 'en trámite';
};

const isPermisoVencido = (permiso: { estado?: string | null; fecha_vencimiento?: string | null }): boolean => {
  return normalizarTexto(permiso.estado) === 'vencido' || isPastDate(permiso.fecha_vencimiento);
};

const isHitoAtrasado = (hito: { estado?: string | null; fecha_plan?: string | null }): boolean => {
  return normalizarTexto(hito.estado) === 'atrasado' || (normalizarTexto(hito.estado) !== 'completado' && isPastDate(hito.fecha_plan));
};

const isGarantiaVencida = (garantia: { estado?: string | null; fecha_vencimiento?: string | null }): boolean => {
  return normalizarTexto(garantia.estado) === 'vencida' || isPastDate(garantia.fecha_vencimiento);
};

const isGarantiaPorVencer = (garantia: { estado?: string | null; fecha_vencimiento?: string | null }): boolean => {
  return normalizarTexto(garantia.estado) === 'por vencer' || isWithinNextDays(garantia.fecha_vencimiento, 30);
};

const getProyectoAlertas = (proyecto: ProyectoObraConDetalles) => {
  const alertas: Array<[string, string, string, string]> = [];

  (proyecto.permisos || []).forEach(permiso => {
    const tipo = getCatalogLabel(permiso.tipo_permiso, TIPO_PERMISO_PROYECTO_OPTIONS);
    if (isPermisoVencido(permiso)) {
      alertas.push(['Permiso vencido', tipo, formatFechaCR(permiso.fecha_vencimiento), 'Alta']);
    } else if (isPermisoPendiente(permiso.estado)) {
      alertas.push(['Permiso pendiente', tipo, formatFechaCR(permiso.fecha_solicitud), 'Media']);
    }
  });

  (proyecto.hitos || []).forEach(hito => {
    if (isHitoAtrasado(hito)) {
      alertas.push(['Hito atrasado', hito.nombre || '-', formatFechaCR(hito.fecha_plan), 'Alta']);
    }
  });

  (proyecto.garantias || []).forEach(garantia => {
    const tipo = getCatalogLabel(garantia.tipo_garantia, TIPO_GARANTIA_CONTRATO_OPTIONS);
    if (isGarantiaVencida(garantia)) {
      alertas.push(['Garantia vencida', tipo, formatFechaCR(garantia.fecha_vencimiento), 'Alta']);
    } else if (isGarantiaPorVencer(garantia)) {
      alertas.push(['Garantia por vencer', tipo, formatFechaCR(garantia.fecha_vencimiento), 'Media']);
    }
  });

  return alertas;
};

const appendExcelSheet = (wb: XLSX.WorkBook, name: string, headers: string[], rows: any[][]) => {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...(rows.length > 0 ? rows : [['Sin registros']])]);
  XLSX.utils.book_append_sheet(wb, ws, name);
};

/**
 * Genera y descarga un informe completo en formato PDF para un proyecto de obra
 */
export function generarReporteProyectoPDF(proyecto: ProyectoObraConDetalles) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Colores Institucionales
  const primaryColor: [number, number, number] = [0, 113, 227]; // #0071E3
  const secondaryColor: [number, number, number] = [39, 39, 42]; // #27272a
  const textColor: [number, number, number] = [30, 41, 59];

  let currentY = 15;

  // 1. HEADER / LOGO INSTITUCIONAL
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('SDMO', 14, 15);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Sistema de Desarrollo y Mantenimiento de Obras | Municipalidad de San José', 35, 15);

  currentY = 32;

  // Título del Reporte (soporta títulos largos en 2 o 3 líneas sin cortarse)
  doc.setTextColor(...textColor);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');

  const titleText = `Informe de Proyecto: ${proyecto.nombre_proyecto}`;
  const maxTitleWidth = 170; // 170mm disponibles
  const titleLines = doc.splitTextToSize(titleText, maxTitleWidth);

  doc.text(titleLines, 14, currentY);

  // Ajustar espaciado dinámicamente según las líneas del título
  const lineHeight = 6;
  currentY += (titleLines.length * lineHeight) + 1;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Fecha de emisión: ${new Date().toLocaleDateString('es-CR')} | ID: ${proyecto.id}`, 14, currentY);

  currentY += 7;

  // SECCIÓN 1: DATOS GENERALES
  autoTable(doc, {
    startY: currentY,
    head: [[{ content: 'INFORMACIÓN GENERAL DEL PROYECTO', colSpan: 4, styles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold' } }]],
    body: [
      [
        { content: 'Código Meta:', styles: { fontStyle: 'bold' } }, proyecto.codigo_meta || '-',
        { content: 'Año:', styles: { fontStyle: 'bold' } }, String(proyecto.anio || '-')
      ],
      [
        { content: 'Dependencia:', styles: { fontStyle: 'bold' } }, proyecto.dependencia || '-',
        { content: 'Gerencia:', styles: { fontStyle: 'bold' } }, proyecto.gerencia || '-'
      ],
      [
        { content: 'Responsable:', styles: { fontStyle: 'bold' } }, proyecto.nombre_responsable || proyecto.profesional_responsable || '-',
        { content: 'Estado:', styles: { fontStyle: 'bold' } }, proyecto.estado || 'Activo'
      ],
      [
        { content: 'Avance POA:', styles: { fontStyle: 'bold' } }, `${formatProgressPercent(proyecto.avance_poa)}%`,
        { content: 'Tipo Ejecución:', styles: { fontStyle: 'bold' } }, proyecto.tipo_ejecucion || '-'
      ],
      [
        { content: 'Tipo Contrato:', styles: { fontStyle: 'bold' } }, proyecto.tipo_contrato || '-',
        { content: 'Ubicación:', styles: { fontStyle: 'bold' } }, `${proyecto.canton || 'San José'}, ${proyecto.distrito || 'Sin distrito'}`
      ],
      [
        { content: 'Línea Estratégica:', styles: { fontStyle: 'bold' } }, { content: (proyecto.linea_estrategica || '-').replace(/_/g, ' '), colSpan: 3 }
      ]
    ],
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2.5 },
    columnStyles: {
      0: { cellWidth: 32, fillColor: [241, 245, 249] },
      1: { cellWidth: 63 },
      2: { cellWidth: 32, fillColor: [241, 245, 249] },
      3: { cellWidth: 55 }
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // SECCIÓN 2: PRESUPUESTO
  const pres = proyecto.presupuesto_vigente;
  const asignado = pres ? Number(pres.presupuesto_asignado || 0) : 0;
  const adjudicado = pres ? Number(pres.presupuesto_adjudicado || 0) : 0;
  const ejecutado = pres ? Number(pres.presupuesto_ejecutado || 0) : 0;
  const comprometido = pres ? Number(pres.presupuesto_comprometido || 0) : 0;
  const libre = pres ? Number(pres.presupuesto_libre ?? (asignado - adjudicado - Number(pres.presupuesto_reserva || 0))) : asignado;

  autoTable(doc, {
    startY: currentY,
    head: [[{ content: 'RESUMEN PRESUPUESTARIO', colSpan: 4, styles: { fillColor: secondaryColor, textColor: 255, fontStyle: 'bold' } }]],
    body: [
      [
        { content: 'Presupuesto Asignado:', styles: { fontStyle: 'bold' } }, formatMonedaPDF(asignado),
        { content: 'Presupuesto Adjudicado:', styles: { fontStyle: 'bold' } }, formatMonedaPDF(adjudicado)
      ],
      [
        { content: 'Presupuesto Ejecutado:', styles: { fontStyle: 'bold' } }, formatMonedaPDF(ejecutado),
        { content: 'Presupuesto Comprometido:', styles: { fontStyle: 'bold' } }, formatMonedaPDF(comprometido)
      ],
      [
        { content: 'Presupuesto Libre:', styles: { fontStyle: 'bold', textColor: [16, 185, 129] } }, formatMonedaPDF(libre),
        { content: 'Origen Presupuesto:', styles: { fontStyle: 'bold' } }, proyecto.origen_presupuesto || '-'
      ]
    ],
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2.5 },
    columnStyles: {
      0: { cellWidth: 40, fillColor: [241, 245, 249] },
      1: { cellWidth: 55 },
      2: { cellWidth: 42, fillColor: [241, 245, 249] },
      3: { cellWidth: 45 }
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // SECCIÓN 3: CONTRATO SICOP
  const cont = proyecto.contrato;
  autoTable(doc, {
    startY: currentY,
    head: [[{ content: 'INFORMACIÓN DE CONTRATACIÓN Y SICOP', colSpan: 4, styles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold' } }]],
    body: [
      [
        { content: 'N° Contrato / Procedimiento:', styles: { fontStyle: 'bold' } }, cont?.numero_contrato_sicop || '-',
        { content: 'N° Orden de Compra:', styles: { fontStyle: 'bold' } }, cont?.numero_orden_compra || '-'
      ],
      [
        { content: 'Contratista / Empresa:', styles: { fontStyle: 'bold' } }, cont?.empresa_adjudicada || cont?.contratista || '-',
        { content: 'Analista Proveeduría:', styles: { fontStyle: 'bold' } }, cont?.analista_proveeduria || '-'
      ],
      [
        { content: 'Estado Contratación:', styles: { fontStyle: 'bold' } }, cont?.estado_contratacion || '-',
        { content: 'N° Solicitud:', styles: { fontStyle: 'bold' } }, cont?.numero_solicitud_contratacion || '-'
      ]
    ],
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2.5 },
    columnStyles: {
      0: { cellWidth: 45, fillColor: [241, 245, 249] },
      1: { cellWidth: 50 },
      2: { cellWidth: 40, fillColor: [241, 245, 249] },
      3: { cellWidth: 47 }
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // SECCIÓN 4: FASES DEL PROYECTO
  const fasesOrdenadas = [...(proyecto.fases || [])].sort((a, b) => {
    return getFaseProyectoOrder(a.fase) - getFaseProyectoOrder(b.fase);
  });

  const fasesBody = fasesOrdenadas.map(f => [
    getCatalogLabel(f.fase, FASE_PROYECTO_OPTIONS),
    formatFechaCR(f.fecha_inicio_plan),
    formatFechaCR(f.fecha_fin_plan),
    formatFechaCR(f.fecha_inicio_real),
    formatFechaCR(f.fecha_fin_real),
    `${formatProgressPercent(f.porcentaje_avance)}%`,
    f.completada ? 'Sí' : 'No'
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [
      [{ content: 'LÍNEA DE TIEMPO Y FASES DEL PROYECTO', colSpan: 7, styles: { fillColor: secondaryColor, textColor: 255, fontStyle: 'bold' } }],
      ['Fase', 'Inicio Plan', 'Fin Plan', 'Inicio Real', 'Fin Real', 'Avance', 'Completada']
    ],
    body: fasesBody.length > 0 ? fasesBody : [['Sin fases registradas', '', '', '', '', '', '']],
    theme: 'striped',
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: 'bold' }
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // SECCIÓN 5: BITÁCORA DE SEGUIMIENTO
  const seguimientosBody = (proyecto.seguimientos || []).map(s => [
    formatFechaCR(s.fecha_corte),
    `${formatProgressPercent(s.avance_registrado)}%`,
    s.etapa || '-',
    s.observaciones || '-',
    s.registrado_por || '-'
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [
      [{ content: 'HISTORIAL Y BITÁCORA DE SEGUIMIENTO (APPEND-ONLY)', colSpan: 5, styles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold' } }],
      ['Fecha Corte', 'Avance', 'Etapa', 'Observaciones', 'Registrado Por']
    ],
    body: seguimientosBody.length > 0 ? seguimientosBody : [['Sin registros de seguimiento', '', '', '', '']],
    theme: 'striped',
    styles: { fontSize: 7.5, cellPadding: 2 },
    headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      3: { cellWidth: 60 }
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  const alertasBody = getProyectoAlertas(proyecto);
  autoTable(doc, {
    startY: currentY,
    head: [
      [{ content: 'ALERTAS EJECUTIVAS DEL PROYECTO', colSpan: 4, styles: { fillColor: secondaryColor, textColor: 255, fontStyle: 'bold' } }],
      ['Tipo', 'Detalle', 'Fecha', 'Severidad']
    ],
    body: alertasBody.length > 0 ? alertasBody : [['Sin alertas activas', '', '', '']],
    theme: 'striped',
    styles: { fontSize: 7.5, cellPadding: 2 },
    headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: 'bold' }
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  const documentosBody = (proyecto.documentos || []).map(d => [
    getCatalogLabel(d.tipo_documento, TIPO_DOCUMENTO_PROYECTO_OPTIONS),
    d.nombre_archivo || '-',
    formatFechaCR(d.creado_en),
    d.descripcion || '-'
  ]);
  autoTable(doc, {
    startY: currentY,
    head: [
      [{ content: 'DOCUMENTOS ADJUNTOS', colSpan: 4, styles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold' } }],
      ['Tipo', 'Archivo', 'Fecha carga', 'Descripcion']
    ],
    body: documentosBody.length > 0 ? documentosBody : [['Sin documentos adjuntos', '', '', '']],
    theme: 'striped',
    styles: { fontSize: 7.2, cellPadding: 2 },
    headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: 'bold' },
    columnStyles: { 1: { cellWidth: 55 }, 3: { cellWidth: 65 } }
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  const permisosBody = (proyecto.permisos || []).map(p => [
    getCatalogLabel(p.tipo_permiso, TIPO_PERMISO_PROYECTO_OPTIONS),
    p.entidad_emisora || '-',
    getCatalogLabel(p.estado, ESTADO_PERMISO_PROYECTO_OPTIONS),
    formatFechaCR(p.fecha_solicitud),
    formatFechaCR(p.fecha_aprobacion),
    formatFechaCR(p.fecha_vencimiento)
  ]);
  autoTable(doc, {
    startY: currentY,
    head: [
      [{ content: 'PERMISOS EXTERNOS', colSpan: 6, styles: { fillColor: secondaryColor, textColor: 255, fontStyle: 'bold' } }],
      ['Tipo', 'Entidad', 'Estado', 'Solicitud', 'Aprobacion', 'Vence']
    ],
    body: permisosBody.length > 0 ? permisosBody : [['Sin permisos registrados', '', '', '', '', '']],
    theme: 'striped',
    styles: { fontSize: 7.2, cellPadding: 2 },
    headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: 'bold' }
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  const hitosBody = (proyecto.hitos || []).map(h => [
    h.nombre || '-',
    getCatalogLabel(h.estado, ESTADO_HITO_PROYECTO_OPTIONS),
    formatFechaCR(h.fecha_plan),
    formatFechaCR(h.fecha_real),
    `${formatProgressPercent(h.porcentaje_avance)}%`,
    h.responsable || '-'
  ]);
  autoTable(doc, {
    startY: currentY,
    head: [
      [{ content: 'HITOS DEL PROYECTO', colSpan: 6, styles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold' } }],
      ['Hito', 'Estado', 'Fecha plan', 'Fecha real', 'Avance', 'Responsable']
    ],
    body: hitosBody.length > 0 ? hitosBody : [['Sin hitos registrados', '', '', '', '', '']],
    theme: 'striped',
    styles: { fontSize: 7.2, cellPadding: 2 },
    headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 45 } }
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  const donacionesBody = (proyecto.donaciones || []).map(d => [
    getCatalogLabel(d.tipo_donacion, TIPO_DONACION_PROYECTO_OPTIONS),
    d.donante || '-',
    formatMonedaPDF(Number(d.valor_estimado || 0)),
    formatFechaCR(d.fecha_recepcion),
    getCatalogLabel(d.estado, ESTADO_DONACION_PROYECTO_OPTIONS)
  ]);
  autoTable(doc, {
    startY: currentY,
    head: [
      [{ content: 'DONACIONES Y APORTES', colSpan: 5, styles: { fillColor: secondaryColor, textColor: 255, fontStyle: 'bold' } }],
      ['Tipo', 'Donante', 'Valor', 'Fecha recepcion', 'Estado']
    ],
    body: donacionesBody.length > 0 ? donacionesBody : [['Sin donaciones registradas', '', '', '', '']],
    theme: 'striped',
    styles: { fontSize: 7.2, cellPadding: 2 },
    headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: 'bold' }
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  const garantiasBody = (proyecto.garantias || []).map(g => [
    getCatalogLabel(g.tipo_garantia, TIPO_GARANTIA_CONTRATO_OPTIONS),
    g.entidad_emisora || '-',
    g.numero_referencia || '-',
    formatMonedaPDF(Number(g.monto || 0)),
    formatFechaCR(g.fecha_vencimiento),
    getCatalogLabel(g.estado, ESTADO_GARANTIA_CONTRATO_OPTIONS)
  ]);
  autoTable(doc, {
    startY: currentY,
    head: [
      [{ content: 'GARANTIAS CONTRACTUALES', colSpan: 6, styles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold' } }],
      ['Tipo', 'Entidad', 'Referencia', 'Monto', 'Vence', 'Estado']
    ],
    body: garantiasBody.length > 0 ? garantiasBody : [['Sin garantias registradas', '', '', '', '', '']],
    theme: 'striped',
    styles: { fontSize: 7.2, cellPadding: 2 },
    headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: 'bold' }
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  const auditoriaBody = (proyecto.historial_proyecto || []).slice(0, 12).map(h => [
    h.entidad || '-',
    h.campo_modificado || '-',
    h.valor_anterior || '-',
    h.valor_nuevo || '-',
    formatFechaCR(h.creado_en)
  ]);
  autoTable(doc, {
    startY: currentY,
    head: [
      [{ content: 'AUDITORIA GENERAL DEL PROYECTO', colSpan: 5, styles: { fillColor: secondaryColor, textColor: 255, fontStyle: 'bold' } }],
      ['Entidad', 'Campo', 'Valor anterior', 'Valor nuevo', 'Fecha']
    ],
    body: auditoriaBody.length > 0 ? auditoriaBody : [['Sin registros de auditoria general', '', '', '', '']],
    theme: 'striped',
    styles: { fontSize: 6.8, cellPadding: 2 },
    headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: 'bold' },
    columnStyles: { 2: { cellWidth: 45 }, 3: { cellWidth: 45 } }
  });

  // Descargar PDF
  doc.save(`Reporte_Proyecto_${proyecto.codigo_meta || proyecto.id}.pdf`);
}

/**
 * Genera y descarga un libro de Excel (.xlsx) con pestañas individuales por sección
 */
export function generarReporteProyectoExcel(proyecto: ProyectoObraConDetalles) {
  const wb = XLSX.utils.book_new();

  // 1. HOJA: General
  const generalData = [
    ['REPORTE DE PROYECTO DE OBRA - SDMO'],
    ['ID Proyecto', proyecto.id],
    ['Nombre Proyecto', proyecto.nombre_proyecto],
    ['Código Meta', proyecto.codigo_meta || '-'],
    ['Dependencia', proyecto.dependencia],
    ['Gerencia', proyecto.gerencia || '-'],
    ['Profesional Responsable', proyecto.nombre_responsable || proyecto.profesional_responsable || '-'],
    ['Estado', proyecto.estado || 'Activo'],
    ['Año', proyecto.anio],
    ['Avance POA', `${formatProgressPercent(proyecto.avance_poa)}%`],
    ['Tipo Ejecución', proyecto.tipo_ejecucion || '-'],
    ['Tipo Contrato', proyecto.tipo_contrato || '-'],
    ['POA Origen', proyecto.poa_origen || '-'],
    ['Cantón', proyecto.canton || 'San José'],
    ['Distrito', proyecto.distrito || '-'],
    ['Línea Estratégica', (proyecto.linea_estrategica || '-').replace(/_/g, ' ')],
    ['Programa', proyecto.programa || '-'],
    ['Observaciones Meta POA', proyecto.observaciones_meta_poa || '-']
  ];
  const wsGeneral = XLSX.utils.aoa_to_sheet(generalData);
  XLSX.utils.book_append_sheet(wb, wsGeneral, 'General');

  // 2. HOJA: Presupuesto
  const pres = proyecto.presupuesto_vigente;
  const asignado = pres ? Number(pres.presupuesto_asignado || 0) : 0;
  const adjudicado = pres ? Number(pres.presupuesto_adjudicado || 0) : 0;
  const ejecutado = pres ? Number(pres.presupuesto_ejecutado || 0) : 0;
  const comprometido = pres ? Number(pres.presupuesto_comprometido || 0) : 0;
  const libre = pres ? Number(pres.presupuesto_libre ?? (asignado - adjudicado - Number(pres.presupuesto_reserva || 0))) : asignado;

  const presupuestoData = [
    ['CONCEPTO PRESUPUESTARIO', 'MONTO (CRC)', 'INFORMACIÓN ADICIONAL'],
    ['Presupuesto Asignado', asignado, formatMonedaCRC(asignado)],
    ['Presupuesto Adjudicado', adjudicado, formatMonedaCRC(adjudicado)],
    ['Presupuesto Ejecutado', ejecutado, formatMonedaCRC(ejecutado)],
    ['Presupuesto Comprometido', comprometido, formatMonedaCRC(comprometido)],
    ['Presupuesto Libre', libre, formatMonedaCRC(libre)],
    ['Origen Presupuesto', proyecto.origen_presupuesto || '-', '-']
  ];
  const wsPresupuesto = XLSX.utils.aoa_to_sheet(presupuestoData);
  XLSX.utils.book_append_sheet(wb, wsPresupuesto, 'Presupuesto');

  // 3. HOJA: Contrato
  const cont = proyecto.contrato;
  const contratoData = [
    ['CAMPO CONTRATACIÓN SICOP', 'DETALLE'],
    ['Número Contrato / Procedimiento SICOP', cont?.numero_contrato_sicop || '-'],
    ['Número Orden de Compra', cont?.numero_orden_compra || '-'],
    ['Empresa Adjudicada / Contratista', cont?.empresa_adjudicada || cont?.contratista || '-'],
    ['Analista Proveeduría', cont?.analista_proveeduria || '-'],
    ['Estado Contratación', cont?.estado_contratacion || '-'],
    ['Número Solicitud Contratación', cont?.numero_solicitud_contratacion || '-']
  ];
  const wsContrato = XLSX.utils.aoa_to_sheet(contratoData);
  XLSX.utils.book_append_sheet(wb, wsContrato, 'Contrato');

  // 4. HOJA: Fases
  const fasesOrdenadas = [...(proyecto.fases || [])].sort((a, b) => {
    return getFaseProyectoOrder(a.fase) - getFaseProyectoOrder(b.fase);
  });

  const fasesHeader = [['Fase', 'Fecha Inicio Plan', 'Fecha Fin Plan', 'Fecha Inicio Real', 'Fecha Fin Real', 'Porcentaje Avance', 'Completada']];
  const fasesRows = fasesOrdenadas.map(f => [
    getCatalogLabel(f.fase, FASE_PROYECTO_OPTIONS),
    formatFechaCR(f.fecha_inicio_plan),
    formatFechaCR(f.fecha_fin_plan),
    formatFechaCR(f.fecha_inicio_real),
    formatFechaCR(f.fecha_fin_real),
    `${formatProgressPercent(f.porcentaje_avance)}%`,
    f.completada ? 'Sí' : 'No'
  ]);
  const wsFases = XLSX.utils.aoa_to_sheet([...fasesHeader, ...fasesRows]);
  XLSX.utils.book_append_sheet(wb, wsFases, 'Fases');

  // 5. HOJA: Seguimiento
  const seguimientoHeader = [['ID Seguimiento', 'Fecha Corte', 'Avance Registrado', 'Etapa', 'Observaciones', 'Registrado Por']];
  const seguimientoRows = (proyecto.seguimientos || []).map(s => [
    s.id,
    formatFechaCR(s.fecha_corte),
    `${formatProgressPercent(s.avance_registrado)}%`,
    s.etapa || '-',
    s.observaciones || '-',
    s.registrado_por || '-'
  ]);
  const wsSeguimiento = XLSX.utils.aoa_to_sheet([...seguimientoHeader, ...seguimientoRows]);
  XLSX.utils.book_append_sheet(wb, wsSeguimiento, 'Seguimiento');

  appendExcelSheet(wb, 'Alertas', ['Tipo', 'Detalle', 'Fecha', 'Severidad'], getProyectoAlertas(proyecto));

  appendExcelSheet(
    wb,
    'Documentos',
    ['Tipo documento', 'Nombre archivo', 'Ruta storage', 'Fecha carga', 'Subido por', 'Descripcion'],
    (proyecto.documentos || []).map(d => [
      getCatalogLabel(d.tipo_documento, TIPO_DOCUMENTO_PROYECTO_OPTIONS),
      d.nombre_archivo || '-',
      d.ruta_storage || '-',
      formatFechaCR(d.creado_en),
      d.subido_por || '-',
      d.descripcion || '-'
    ])
  );

  appendExcelSheet(
    wb,
    'Permisos',
    ['Tipo permiso', 'Entidad emisora', 'Estado', 'Referencia', 'Solicitud', 'Aprobacion', 'Vencimiento', 'Responsable', 'Observaciones'],
    (proyecto.permisos || []).map(p => [
      getCatalogLabel(p.tipo_permiso, TIPO_PERMISO_PROYECTO_OPTIONS),
      p.entidad_emisora || '-',
      getCatalogLabel(p.estado, ESTADO_PERMISO_PROYECTO_OPTIONS),
      p.numero_referencia || '-',
      formatFechaCR(p.fecha_solicitud),
      formatFechaCR(p.fecha_aprobacion),
      formatFechaCR(p.fecha_vencimiento),
      p.responsable || '-',
      p.observaciones || '-'
    ])
  );

  appendExcelSheet(
    wb,
    'Hitos',
    ['Nombre', 'Descripcion', 'Estado', 'Fecha plan', 'Fecha real', 'Avance', 'Responsable'],
    (proyecto.hitos || []).map(h => [
      h.nombre || '-',
      h.descripcion || '-',
      getCatalogLabel(h.estado, ESTADO_HITO_PROYECTO_OPTIONS),
      formatFechaCR(h.fecha_plan),
      formatFechaCR(h.fecha_real),
      `${formatProgressPercent(h.porcentaje_avance)}%`,
      h.responsable || '-'
    ])
  );

  appendExcelSheet(
    wb,
    'Donaciones',
    ['Tipo donacion', 'Donante', 'Descripcion', 'Valor estimado', 'Fecha recepcion', 'Estado', 'Responsable', 'Observaciones'],
    (proyecto.donaciones || []).map(d => [
      getCatalogLabel(d.tipo_donacion, TIPO_DONACION_PROYECTO_OPTIONS),
      d.donante || '-',
      d.descripcion || '-',
      Number(d.valor_estimado || 0),
      formatFechaCR(d.fecha_recepcion),
      getCatalogLabel(d.estado, ESTADO_DONACION_PROYECTO_OPTIONS),
      d.responsable || '-',
      d.observaciones || '-'
    ])
  );

  appendExcelSheet(
    wb,
    'Garantias',
    ['Tipo garantia', 'Entidad emisora', 'Referencia', 'Monto', 'Emision', 'Vencimiento', 'Estado', 'Observaciones'],
    (proyecto.garantias || []).map(g => [
      getCatalogLabel(g.tipo_garantia, TIPO_GARANTIA_CONTRATO_OPTIONS),
      g.entidad_emisora || '-',
      g.numero_referencia || '-',
      Number(g.monto || 0),
      formatFechaCR(g.fecha_emision),
      formatFechaCR(g.fecha_vencimiento),
      getCatalogLabel(g.estado, ESTADO_GARANTIA_CONTRATO_OPTIONS),
      g.observaciones || '-'
    ])
  );

  appendExcelSheet(
    wb,
    'Auditoria',
    ['Entidad', 'Campo modificado', 'Valor anterior', 'Valor nuevo', 'Modificado por', 'Fecha'],
    (proyecto.historial_proyecto || []).map(h => [
      h.entidad || '-',
      h.campo_modificado || '-',
      h.valor_anterior || '-',
      h.valor_nuevo || '-',
      h.modificado_por || '-',
      formatFechaCR(h.creado_en)
    ])
  );

  // Descargar Excel
  XLSX.writeFile(wb, `Reporte_Proyecto_${proyecto.codigo_meta || proyecto.id}.xlsx`);
}

/**
 * Genera un informe general consolidado de todos los proyectos en un archivo Excel con la estructura oficial
 */
export async function generarInformeGeneralExcel() {
  try {
    // 1. Consultar todos los proyectos
    const { data: proyectos, error: errProyectos } = await supabase
      .from('proyecto_obra')
      .select('*')
      .order('id', { ascending: true });

    if (errProyectos || !proyectos) throw errProyectos || new Error('Error al consultar proyectos');

    // 2. Consultar tablas secundarias en paralelo
    const [
      resPresupuestos,
      resContratos,
      resFases,
      resSeguimientos,
      resColabs,
      resDocumentos,
      resPermisos,
      resHitos,
      resDonaciones,
      resGarantias
    ] = await Promise.all([
      supabase.from('presupuesto_proyecto').select('*').eq('es_vigente', true),
      supabase.from('contrato_obra').select('*'),
      supabase.from('fase_proyecto').select('*'),
      supabase.from('seguimiento_proyecto').select('*').order('fecha_corte', { ascending: false }),
      supabase.from('colaboradores_06').select('identificacion, colaborador, alias'),
      supabase.from('proyecto_documento').select('id, proyecto_id'),
      supabase.from('proyecto_permiso').select('id, proyecto_id, estado, fecha_vencimiento'),
      supabase.from('proyecto_hito').select('id, proyecto_id, estado, fecha_plan'),
      supabase.from('proyecto_donacion').select('id, proyecto_id, valor_estimado, estado'),
      supabase.from('contrato_garantia').select('id, proyecto_id, estado, fecha_vencimiento')
    ]);

    const presupuestosMap = new Map<string | number, any>();
    (resPresupuestos.data || []).forEach(p => presupuestosMap.set(p.proyecto_id, p));

    const contratosMap = new Map<string | number, any>();
    (resContratos.data || []).forEach(c => contratosMap.set(c.proyecto_id, c));

    const fasesMap = new Map<string | number, any[]>();
    (resFases.data || []).forEach(f => {
      if (!fasesMap.has(f.proyecto_id)) fasesMap.set(f.proyecto_id, []);
      fasesMap.get(f.proyecto_id)!.push(f);
    });

    const seguimientosMap = new Map<string | number, any>();
    (resSeguimientos.data || []).forEach(s => {
      if (!seguimientosMap.has(s.proyecto_id)) {
        seguimientosMap.set(s.proyecto_id, s);
      }
    });

    const documentosMap = new Map<string | number, any[]>();
    (resDocumentos.data || []).forEach(d => {
      if (!documentosMap.has(d.proyecto_id)) documentosMap.set(d.proyecto_id, []);
      documentosMap.get(d.proyecto_id)!.push(d);
    });

    const permisosMap = new Map<string | number, any[]>();
    (resPermisos.data || []).forEach(p => {
      if (!permisosMap.has(p.proyecto_id)) permisosMap.set(p.proyecto_id, []);
      permisosMap.get(p.proyecto_id)!.push(p);
    });

    const hitosMap = new Map<string | number, any[]>();
    (resHitos.data || []).forEach(h => {
      if (!hitosMap.has(h.proyecto_id)) hitosMap.set(h.proyecto_id, []);
      hitosMap.get(h.proyecto_id)!.push(h);
    });

    const donacionesMap = new Map<string | number, any[]>();
    (resDonaciones.data || []).forEach(d => {
      if (!donacionesMap.has(d.proyecto_id)) donacionesMap.set(d.proyecto_id, []);
      donacionesMap.get(d.proyecto_id)!.push(d);
    });

    const garantiasMap = new Map<string | number, any[]>();
    (resGarantias.data || []).forEach(g => {
      if (!garantiasMap.has(g.proyecto_id)) garantiasMap.set(g.proyecto_id, []);
      garantiasMap.get(g.proyecto_id)!.push(g);
    });

    const colabsMap = new Map<string, string>();
    (resColabs.data || []).forEach(c => {
      if (c.identificacion) colabsMap.set(String(c.identificacion).trim(), c.alias || c.colaborador);
      if (c.alias) colabsMap.set(String(c.alias).trim(), c.alias);
    });

    // 3. Encabezados de la hoja única oficial
    const headers = [
      'Prioridad',
      'Gerencia',
      'Dependencia',
      'Profesional Responsable',
      'Código Meta',
      'Nombre del proyecto',
      'Fecha envío a proveeduría',
      'Fecha estimación adjudicación',
      'Fase',
      'Distrito',
      'Georreferencia',
      'Fecha Inicio Estudios Preliminares',
      'Fecha Final Estudios Preliminares',
      'Fecha Inicio Contratación',
      'Fecha Final Contratación',
      'Fecha inicio Obras',
      'Fecha final Obra',
      'Vigencia del Contrato',
      'POA de Origen',
      'Origen presupuesto',
      'Presupuesto Asignado',
      'Presupuesto Adjudicado',
      'Presupuesto Ejecutado',
      'Presupuesto Reserva',
      'Presupuesto Libre',
      'Tipo de Ejecución',
      'Porcentaje Físico de Avance del Proyecto',
      'Línea Estratégica',
      'Programa',
      'Estado',
      'Observaciones más recientes',
      'Documentos adjuntos',
      'Permisos pendientes',
      'Permisos vencidos',
      'Hitos atrasados',
      'Garantias por vencer',
      'Garantias vencidas',
      'Valor donaciones'
    ];

    // 4. Mapear filas
    const dataRows = proyectos.map(p => {
      const pres = presupuestosMap.get(p.id);
      const cont = contratosMap.get(p.id);
      const fases = fasesMap.get(p.id) || [];
      const seg = seguimientosMap.get(p.id);
      const documentos = documentosMap.get(p.id) || [];
      const permisos = permisosMap.get(p.id) || [];
      const hitos = hitosMap.get(p.id) || [];
      const donaciones = donacionesMap.get(p.id) || [];
      const garantias = garantiasMap.get(p.id) || [];

      const respNombre = p.profesional_responsable 
        ? (colabsMap.get(String(p.profesional_responsable).trim()) || p.profesional_responsable)
        : '-';

      // Fases especificas
      const fasePorValor = (valor: string) => fases.find(f => normalizeCatalogValue(f.fase, FASE_PROYECTO_OPTIONS) === valor);
      const faseEstudios = fasePorValor('Inicio_y_Estudios_Preliminares');
      const faseContratacion = fasePorValor('Planeación_y_Diseños');
      const faseObras = fasePorValor('Ejecución_y_Construcción');

      // Determinacion de la Fase Actual
      const fasesOrdenadas = [...fases].sort((a, b) => getFaseProyectoOrder(a.fase) - getFaseProyectoOrder(b.fase));
      const faseEnProgreso = fasesOrdenadas.find(f => !f.completada) || fasesOrdenadas[fasesOrdenadas.length - 1];
      const faseNombreStr = faseEnProgreso ? getCatalogLabel(faseEnProgreso.fase, FASE_PROYECTO_OPTIONS) : '-';

      // Montos en formato numérico puro
      const asignado = pres ? Number(pres.presupuesto_asignado || 0) : 0;
      const adjudicado = pres ? Number(pres.presupuesto_adjudicado || 0) : 0;
      const ejecutado = pres ? Number(pres.presupuesto_ejecutado || 0) : 0;
      const reserva = pres ? Number(pres.presupuesto_reserva || 0) : 0;
      const comprometido = pres ? Number(pres.presupuesto_comprometido || 0) : 0;
      const libre = pres ? Number(pres.presupuesto_libre ?? (asignado - adjudicado - reserva)) : asignado;

      // Avance físico como decimal (ej. 0.95)
      const avanceDecimal = normalizeProgressFraction(seg ? seg.avance_registrado : p.avance_poa);
      const permisosPendientes = permisos.filter(permiso => isPermisoPendiente(permiso.estado)).length;
      const permisosVencidos = permisos.filter(permiso => isPermisoVencido(permiso)).length;
      const hitosAtrasados = hitos.filter(hito => isHitoAtrasado(hito)).length;
      const garantiasPorVencer = garantias.filter(garantia => !isGarantiaVencida(garantia) && isGarantiaPorVencer(garantia)).length;
      const garantiasVencidas = garantias.filter(garantia => isGarantiaVencida(garantia)).length;
      const valorDonaciones = donaciones.reduce((total, donacion) => total + Number(donacion.valor_estimado || 0), 0);

      return [
        p.prioridad || '-',
        p.gerencia || '-',
        p.dependencia || '-',
        respNombre,
        p.codigo_meta || '-',
        p.nombre_proyecto || '-',
        formatFechaCR(cont?.fecha_envio_proveeduria),
        formatFechaCR(cont?.fecha_estimacion_adjudicacion),
        faseNombreStr,
        p.distrito || '-',
        p.georeferencia ? (typeof p.georeferencia === 'object' ? JSON.stringify(p.georeferencia) : String(p.georeferencia)) : '-',
        formatFechaCR(faseEstudios?.fecha_inicio_real || faseEstudios?.fecha_inicio_plan),
        formatFechaCR(faseEstudios?.fecha_fin_real || faseEstudios?.fecha_fin_plan),
        formatFechaCR(faseContratacion?.fecha_inicio_real || faseContratacion?.fecha_inicio_plan),
        formatFechaCR(faseContratacion?.fecha_fin_real || faseContratacion?.fecha_fin_plan),
        formatFechaCR(faseObras?.fecha_inicio_real || faseObras?.fecha_inicio_plan),
        formatFechaCR(faseObras?.fecha_fin_real || faseObras?.fecha_fin_plan),
        cont?.vigencia_contrato || (cont?.fecha_adjudicacion ? 'Vigente' : '-'),
        p.poa_origen || '-',
        p.origen_presupuesto || '-',
        asignado,
        adjudicado,
        ejecutado,
        reserva,
        libre,
        p.tipo_ejecucion || '-',
        avanceDecimal,
        (p.linea_estrategica || '-').replace(/_/g, ' '),
        p.programa || '-',
        p.estado || '-',
        seg?.observaciones || p.observaciones_meta_poa || '-',
        documentos.length,
        permisosPendientes,
        permisosVencidos,
        hitosAtrasados,
        garantiasPorVencer,
        garantiasVencidas,
        valorDonaciones
      ];
    });

    // 5. Construcción del archivo Excel
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    XLSX.utils.book_append_sheet(wb, ws, 'Construcción de Obra 2026');

    const fechaStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `Informe_General_Proyectos_SDMO_${fechaStr}.xlsx`);
  } catch (err: any) {
    console.error('Error al generar informe general en Excel:', err);
    alert('Error al generar el informe general: ' + (err.message || err));
  }
}
