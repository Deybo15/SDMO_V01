import { Shirt } from 'lucide-react';
import { SolicitudArticulosPage } from '../components/SolicitudArticulosPage';

export default function Vestimenta() {
    return <SolicitudArticulosPage title="Vestimenta e Indumentaria" icon={Shirt} tipoSalidaId="V" defaultDescription="Solicitud de Vestimenta" commentsPlaceholder="Detalles adicionales sobre esta solicitud de vestimenta..." itemsDescription="Seleccione las prendas que se entregarán." />;
}
