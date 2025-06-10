import React from 'react';

const TerminosCondicionesPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-10 border border-gray-200">
        <h1 className="text-4xl font-extrabold text-center text-green-800 mb-8 tracking-tight">Términos y Condiciones</h1>
        <div className="prose prose-lg max-w-none text-gray-800">
          <h2 className="text-2xl font-bold text-green-700 mt-8 mb-4">1. Disposiciones Básicas</h2>
          <p>
            SendPulse Inc. proporciona al usuario servicios para el servicio de envío de SendPulse de acuerdo con los términos establecidos en el presente documento. El uso del servicio SendPulse se rige por estos Términos del Servicio, Política de Privacidad y Política Anti-Spam. Los términos pueden ser corregidos o complementados por la administración sin notificación previa.
          </p>
          <h2 className="text-2xl font-bold text-green-700 mt-8 mb-4">2. Registro de Usuario</h2>
          <p>
            El usuario debe proporcionar información válida durante el proceso de registro. Está estrictamente prohibido registrar múltiples cuentas gratuitas. Toda la información personal está sujeta a la Política de Privacidad.
          </p>
          <h2 className="text-2xl font-bold text-green-700 mt-8 mb-4">3. Pago por Servicios</h2>
          <p>
            El servicio ofrece diferentes planes de facturación. El pago de cualquier plan o servicio adicional se realiza de forma anticipada. El usuario puede solicitar el reembolso de fondos no utilizados dentro de los 30 días posteriores al pago, bajo ciertas condiciones.
          </p>
          <h2 className="text-2xl font-bold text-green-700 mt-8 mb-4">4. Cuenta del Usuario</h2>
          <p>
            El usuario es responsable de la seguridad de su cuenta y contraseña. Puede solicitar la eliminación de su cuenta en cualquier momento. La administración puede suspender cuentas por inactividad o violaciones a la política anti-spam.
          </p>
          <h2 className="text-2xl font-bold text-green-700 mt-8 mb-4">5. Campañas de Marketing</h2>
          <p>
            El usuario es responsable del contenido de sus campañas y debe contar con el consentimiento de los destinatarios. El uso de bases de datos obtenidas ilegalmente y el envío de spam están estrictamente prohibidos.
          </p>
          <h2 className="text-2xl font-bold text-green-700 mt-8 mb-4">6. Entrega de Campañas</h2>
          <p>
            El servicio no garantiza la entrega de todas las campañas debido a factores externos como cobertura de red, filtros de spam, entre otros.
          </p>
          <h2 className="text-2xl font-bold text-green-700 mt-8 mb-4">7. Aceptación de los Términos</h2>
          <p>
            Al acceder o utilizar el servicio, el usuario acepta estos términos y condiciones. Si no está de acuerdo, debe abstenerse de utilizar el servicio.
          </p>
          <div className="mt-10 text-center text-gray-500 text-sm italic">
            Última actualización: 10 de junio de 2025
          </div>
        </div>
      </div>
    </div>
  );
};

export default TerminosCondicionesPage;
