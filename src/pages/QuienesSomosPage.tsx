import React from 'react';

const QuienesSomosPage: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold text-green-800 mb-6">¿Quiénes Somos?</h1>
      <div className="prose prose-green max-w-none">
        <p>
          ASURA es la Asociación Sindical Única de Recicladores Argentinos, una organización que lucha por la dignificación del trabajo reciclador y el desarrollo de herramientas tecnológicas que promuevan la inclusión social y el cuidado ambiental.
        </p>
        <p>
          Nuestra misión es conectar a ciudadanos, recicladores y empresas para gestionar residuos reciclables de forma eficiente, segura y trazable, promoviendo la economía circular y el desarrollo sostenible.
        </p>
        <p>
          Trabajamos para brindar oportunidades, visibilidad y mejores condiciones a los recicladores, integrando tecnología y compromiso social en cada acción.
        </p>
        <h2 className="text-2xl font-semibold mt-6 mb-2">Contacto</h2>
        <p>
          Cristian Raúl Ferreyra<br />
          Líder de Proyecto Asura EcoNecta2<br />
          asurasantiago@gmail.com<br />
          Ciudad Capital de Santiago del Estero
        </p>
      </div>
    </div>
  );
};

export default QuienesSomosPage;
