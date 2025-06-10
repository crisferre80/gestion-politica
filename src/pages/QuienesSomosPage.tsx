import React from 'react';

const QuienesSomosPage: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <div className="bg-white rounded-xl shadow-lg p-8 border border-green-200">
        <h1 className="text-4xl font-extrabold text-green-800 mb-6 text-center tracking-tight">¿Quiénes Somos?</h1>
        {/* Carrusel de imágenes */}
        <div className="mb-8">
          <CarouselSindicato />
        </div>
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
          <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded-lg text-gray-800">
            <p className="font-semibold">Cristian Raúl Ferreyra</p>
            <p>Líder de Proyecto Asura EcoNecta2</p>
            <p className="mb-1">asurasantiago@gmail.com</p>
            <p>Ciudad Capital de Santiago del Estero</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Carrusel de imágenes del sindicato y actividades
const images = [
  {
    src: "/assets/recycling-marker.svg",
    alt: "Recicladores en acción",
    caption: "Recicladores urbanos trabajando en la ciudad"
  },
  {
    src: "/assets/reciclaje1.jpg",
    alt: "Jornada de capacitación",
    caption: "Capacitación y formación para recicladores"
  },
  {
    src: "/assets/reciclaje2.jpg",
    alt: "Evento comunitario",
    caption: "Eventos de concientización ambiental"
  },
  {
    src: "/assets/reciclaje3.jpg",
    alt: "Entrega de materiales",
    caption: "Entrega de materiales reciclables a empresas"
  }
];

const CarouselSindicato: React.FC = () => {
  const [current, setCurrent] = React.useState(0);
  const total = images.length;
  React.useEffect(() => {
    const timer = setInterval(() => setCurrent(c => (c + 1) % total), 4000);
    return () => clearInterval(timer);
  }, [total]);
  return (
    <div className="relative w-full max-w-2xl mx-auto rounded-lg overflow-hidden shadow">
      <img
        src={images[current].src}
        alt={images[current].alt}
        className="w-full h-64 object-cover transition-all duration-700"
        style={{ background: '#e6f4ea' }}
      />
      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-center py-2 text-sm">
        {images[current].caption}
      </div>
      <div className="absolute inset-x-0 bottom-2 flex justify-center gap-2">
        {images.map((_, idx) => (
          <button
            key={idx}
            className={`w-3 h-3 rounded-full ${idx === current ? 'bg-green-500' : 'bg-white bg-opacity-60'} border border-green-700`}
            onClick={() => setCurrent(idx)}
            aria-label={`Ver imagen ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
};

export default QuienesSomosPage;
