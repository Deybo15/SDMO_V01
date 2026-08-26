import { Paperclip } from 'lucide-react';
import { SolicitudArticulosPage } from '../components/SolicitudArticulosPage';

export default function ArticulosOficina() {
    return <SolicitudArticulosPage title="Artículos de Oficina" icon={Paperclip} tipoSalidaId="OFI" defaultDescription="Solicitud de Artículos de Oficina" commentsPlaceholder="Detalles adicionales sobre este pedido de oficina..." itemsDescription="Seleccione los artículos de oficina que se entregarán." />;
}
