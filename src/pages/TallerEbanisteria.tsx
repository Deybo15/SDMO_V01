import { Hammer } from 'lucide-react';
import { SolicitudArticulosPage } from '../components/SolicitudArticulosPage';

export default function TallerEbanisteria() {
    return <SolicitudArticulosPage title="Taller de Ebanistería" icon={Hammer} tipoSalidaId="TE" defaultDescription="Solicitud Taller Ebanistería" commentsPlaceholder="Detalles adicionales sobre esta solicitud de taller..." itemsDescription="Seleccione los materiales de ebanistería que se entregarán." />;
}
