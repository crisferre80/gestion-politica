import React from 'react';

const DossierPage: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <div className="bg-white rounded-xl shadow-lg p-8 border border-blue-200">
        <h1 className="text-4xl font-extrabold text-blue-800 mb-6 text-center tracking-tight">Dossier Institucional</h1>
        <h2 className="text-2xl font-bold text-blue-700 mb-4 mt-2">¿Qué es Gestion Dirigencial y Politica?</h2>
        <p className="text-gray-700 mb-4">
          Es una app móvil que conecta a ciudadanos, Dirigentes y empresas para gestionar residuos reciclables de forma eficiente, segura y trazable. Permite solicitar recolección, visualizar rutas, enviar feedback y obtener eco-créditos.
        </p>
        <h2 className="text-2xl font-bold text-blue-700 mb-4 mt-8">¿Quiénes somos?</h2>
        <p className="text-gray-700 mb-4">
          ASURA es la Asociación Sindical Única de Dirigentes Argentinos, una organización que lucha por la dignificación del trabajo reciclador y el desarrollo de herramientas tecnológicas que promuevan la inclusión social y el cuidado ambiental.
        </p>
        <h2 className="text-2xl font-bold text-blue-700 mb-4 mt-8">¿Por qué ser Sponsor?</h2>
        <ul className="list-disc pl-6 text-gray-700 mb-6 space-y-1">
          <li>Visibilidad de marca en una aplicación social y ambiental.</li>
          <li>Presencia en pantallas y stands del Congreso Nacional de Medio Ambiente.</li>
          <li>Participación en campañas con impacto directo en comunidades urbanas.</li>
          <li>Asociación con valores de sostenibilidad, tecnología y economía circular.</li>
        </ul>
        <h2 className="text-2xl font-bold text-blue-700 mb-4 mt-8">Formatos de Sponsoreo Disponibles</h2>
        <ul className="list-disc pl-6 text-gray-700 mb-6 space-y-1">
          <li>Sponsor Principal del Congreso Nacional de Medio Ambiente</li>
          <li>Sponsor Tecnológico de la App EcoNecta2</li>
          <li>Sponsor de EcoCréditos y Premios</li>
          <li>Sponsor Institucional (Redes, Medios, Eventos Locales)</li>
        </ul>
        <h2 className="text-2xl font-bold text-blue-700 mb-4 mt-8">Contacto</h2>
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-lg text-gray-800">
          <p className="font-semibold">Cristian Raúl Ferreyra</p>
          <p>Líder de Proyecto Gestion Dirigencial y Politica</p>
          <p className="mb-1">asurasantiago@gmail.com</p>
            <p className="mb-1">+54 385 5042155</p>
          <p>Ciudad de Santiago del Estero</p>
        </div>
      </div>
    </div>
  );
};

export default DossierPage;
