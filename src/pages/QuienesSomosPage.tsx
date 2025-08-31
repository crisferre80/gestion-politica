import React from 'react';

const QuienesSomosPage: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <div className="bg-white rounded-xl shadow-lg p-8 border border-blue-200">
        <h1 className="text-4xl font-extrabold text-blue-800 mb-6 text-center tracking-tight">¿Quiénes Somos?</h1>
        {/* Carrusel de imágenes */}
        <div className="mb-8">
          <CarouselSindicato />
        </div>
        <div className="prose prose-blue max-w-none">
          <p>
            ASURA es la Asociación Sindical Única de Dirigentes Argentinos, una organización que lucha por la dignificación del trabajo reciclador y el desarrollo de herramientas tecnológicas que promuevan la inclusión social y el cuidado ambiental.
          </p>
          <p>
            Nuestra misión es conectar a ciudadanos, Dirigentes y empresas para gestionar residuos reciclables de forma eficiente, segura y trazable, promoviendo la economía circular y el desarrollo sostenible.
          </p>
          <p>
            Trabajamos para brindar oportunidades, visibilidad y mejores condiciones a los Dirigentes, integrando tecnología y compromiso social en cada acción.
          </p>
          <h2 className="text-2xl font-semibold mt-6 mb-2">Contacto</h2>
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-lg text-gray-800">
            <p className="font-semibold">Cristian Raúl Ferreyra</p>
            <p>Líder de Proyecto Gestion Dirigencial y Politica</p>
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
    src: "/assets/490907928_1120762550065261_4214991636731734683_n.jpg",
    alt: "Dirigentes en acción",
    caption: "Dirigentes urbanos trabajando en la ciudad"
  },
  {
    src: "/assets/497886864_17856255534429774_1346804607382853053_n.jpg",
    alt: "Jornada de capacitación",
    caption: "Capacitación y formación para Dirigentes"
  },
  {
    src: "/assets/498632049_1148638820610967_8627901475166359115_n.jpg",
    alt: "Evento comunitario",
    caption: "Eventos de concientización ambiental"
  },
  {
    src: "/assets/499758200_1153178876823628_2596475908585908410_n.jpg",
    alt: "Entrega de materiales",
    caption: "Entrega de materiales reciclables a empresas"
  },
  {
    src: "/assets/499810247_1152487683559414_2469505657518800470_n.jpg",
    alt: "Reunión de equipo",
    caption: "Reuniones y organización sindical"
  },
  {
    src: "/assets/500001904_1152487753559407_9161498294815437748_n.jpg",
    alt: "Campaña ambiental",
    caption: "Campañas de concientización ambiental"
  },
  {
    src: "/assets/500249663_1150695927071923_3564149507304532222_n.jpg",
    alt: "Entrega de premios",
    caption: "Entrega de premios y reconocimientos"
  },
  {
    src: "/assets/500257893_1152487723559410_8854013996731546313_n.jpg",
    alt: "Trabajo en equipo",
    caption: "Trabajo en equipo y colaboración"
  },
  {
    src: "/assets/503107991_1160686546072861_8317471763090115750_n.jpg",
    alt: "Jornada de limpieza",
    caption: "Jornadas de limpieza urbana"
  },
  {
    src: "/assets/504717463_1163215652486617_3936359207217405359_n.jpg",
    alt: "Participación comunitaria",
    caption: "Participación en eventos comunitarios"
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
    <div className="relative w-full max-w-2x2 mx-auto rounded-lg overflow-hidden shadow">
      <img
        src={images[current].src}
        alt={images[current].alt}
        className="w-80 h-110 object-cover transition-all duration-700"
        style={{ background: '#e6f4ea' }}
      />
      <div className="absolute bottom-6 left-0 right-0 bg-black bg-opacity-50 text-white text-center py-2 text-sm">
        {images[current].caption}
      </div>
      <div className="absolute inset-x-0 bottom-2 flex justify-center gap-2">
        {images.map((_, idx) => (
          <button
            key={idx}
            className={`w-3 h-3 rounded-full ${idx === current ? 'bg-blue-500' : 'bg-white bg-opacity-60'} border border-blue-700`}
            onClick={() => setCurrent(idx)}
            aria-label={`Ver imagen ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
};

export default QuienesSomosPage;
