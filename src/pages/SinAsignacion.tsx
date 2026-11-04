import { HelpCircle } from 'lucide-react';

import { SolicitudArticulosPage } from '../components/SolicitudArticulosPage';

export default function SinAsignacion() {
    return (
        <SolicitudArticulosPage
            title="Sin Asignación Específica"
            icon={HelpCircle}
            tipoSalidaId="SAE"
            defaultDescription="Solicitud Sin Asignación Específica"
            commentsPlaceholder="Detalles adicionales sobre esta solicitud..."
            itemsDescription="Seleccione los artículos a entregar."
        />
    );
}
