import LegalLayout from '@/components/LegalLayout';

export const metadata = { title: 'Política de reembolso' };

export default function RefundPage() {
  return (
    <LegalLayout title="Política de reembolso" updated="30 de agosto de 2026">
      <p>
        Esta política se aplica a las suscripciones Premium. Mientras no haya una pasarela de pago
        conectada, sirve como referencia de las condiciones previstas.
      </p>

      <h2>1. Periodo de reembolso</h2>
      <p>
        Puedes solicitar la devolución íntegra dentro de los <strong>14 días naturales</strong>{' '}
        siguientes a la compra, siempre que no se haya hecho un uso intensivo de las funciones
        Premium durante ese periodo.
      </p>

      <h2>2. Cómo solicitarlo</h2>
      <ul>
        <li>Escribe por el servidor de soporte indicando el ID del servidor y la fecha de compra.</li>
        <li>Explica brevemente el motivo, para poder mejorar el servicio.</li>
        <li>La respuesta llega normalmente en un plazo de 72 horas.</li>
      </ul>

      <h2>3. Casos no reembolsables</h2>
      <ul>
        <li>Suscripciones con más de 14 días de antigüedad.</li>
        <li>Servidores a los que se ha retirado el acceso por incumplir los términos de uso.</li>
        <li>Renovaciones automáticas no canceladas a tiempo.</li>
      </ul>

      <h2>4. Cancelación</h2>
      <p>
        Puedes cancelar la renovación en cualquier momento. Las funciones Premium seguirán activas
        hasta el final del periodo ya pagado.
      </p>
    </LegalLayout>
  );
}
