import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, MapPin, Calendar, ArrowRight, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';

// Estructura para la celda de la grilla
interface GridAdCell {
  id: string;
  ad_id: string | null;
  size: string;
  row: number;
  col: number;
  custom_label?: string;
  bg_color?: string;
  advertisement?: {
    id: string;
    title: string;
    image_url: string;
    link?: string;
    active: boolean;
    created_at: string;
  } | null;
}


const Home: React.FC = () => {
  const [gridAds, setGridAds] = useState<GridAdCell[]>([]);

  useEffect(() => {
    fetchGridAds();
  }, []);

  const fetchGridAds = async () => {
    try {
      const { data, error } = await supabase
        .from('ads_grid')
        .select(`*, advertisement:ad_id (id, title, image_url, link, active, created_at)`)
        .order('row', { ascending: true })
        .order('col', { ascending: true });
      if (error) throw error;
      setGridAds(data);
    } catch (err) {
      console.error('Error fetching grid ads:', err);
    }
  };

  return (
    <div>
      {/* Hero Section */}
      <section className="relative bg-green-600 text-white">
        <div className="absolute inset-0 bg-black opacity-30"></div>
        <div 
          className="relative h-[600px] bg-cover bg-center flex items-center"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1470&q=80')" }}
        >
          <div className="max-w-7xl mx-auto px-10 sm:px-6 lg:px-8 py-24">
            <div className="max-w-3xl">
              <h1 className="text-4xl md:text-5xl font-bold mb-6">Conectando recicladores con comunidades sostenibles</h1>
              <p className="text-xl mb-8">
                Facilitamos la conexión entre recicladores urbanos y residentes que clasifican sus residuos, 
                creando un ecosistema de reciclaje más eficiente y humano.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link to="/register" className="bg-white text-green-600 px-6 py-3 rounded-md font-medium hover:bg-gray-100 transition">
                  Registrarse
                </Link>
                <Link to="/login" className="bg-green-700 text-white px-6 py-3 rounded-md font-medium hover:bg-green-800 transition relative animate-glow focus:outline-none focus:ring-4 focus:ring-green-300">
                  <span className="absolute inset-0 rounded-md pointer-events-none glow-effect"></span>
                  Ingresar
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Video institucional */}
      <section className="py-12 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-center text-green-700 mb-6">Conoce Econecta2 en 1 minuto</h2>
          <div className="relative pb-[56.25%] h-0 overflow-hidden rounded-lg shadow-lg">
            <iframe
              className="absolute top-0 left-0 w-full h-full"
              src="https://www.youtube.com/embed/G3Vlm8abEfc"
              title="Video institucional Econecta2"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            ></iframe>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">¿Cómo funciona?</h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Nuestra plataforma conecta a recicladores urbanos con residentes que separan sus residuos, 
              creando un sistema más eficiente y beneficioso para todos.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gray-50 p-6 rounded-lg text-center">
              <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Regístrate</h3>
              <p className="text-gray-600">
                Crea tu perfil como reciclador urbano o como residente que separa sus residuos.
              </p>
            </div>

            <div className="bg-gray-50 p-6 rounded-lg text-center">
              <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <MapPin className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Conecta</h3>
              <p className="text-gray-600">
                Los residentes registran sus puntos de recolección y los recicladores pueden encontrarlos fácilmente.
              </p>
            </div>

            <div className="bg-gray-50 p-6 rounded-lg text-center">
              <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Coordina</h3>
              <p className="text-gray-600">
                Establece horarios de recolección y mantén un registro de tus actividades de reciclaje.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Beneficios</h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Nuestra plataforma ofrece ventajas tanto para recicladores urbanos como para residentes.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-lg shadow-sm">
              <h3 className="text-2xl font-semibold text-green-600 mb-4">Para Recicladores</h3>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <ArrowRight className="h-5 w-5 text-green-500 mr-2 mt-1 flex-shrink-0" />
                  <span>Acceso a una red de puntos de recolección verificados</span>
                </li>
                <li className="flex items-start">
                  <ArrowRight className="h-5 w-5 text-green-500 mr-2 mt-1 flex-shrink-0" />
                  <span>Mayor eficiencia en rutas de recolección</span>
                </li>
                <li className="flex items-start">
                  <ArrowRight className="h-5 w-5 text-green-500 mr-2 mt-1 flex-shrink-0" />
                  <span>Perfil visible para la comunidad</span>
                </li>
                <li className="flex items-start">
                  <ArrowRight className="h-5 w-5 text-green-500 mr-2 mt-1 flex-shrink-0" />
                  <span>Reconocimiento por su labor ambiental</span>
                </li>
              </ul>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-sm">
              <h3 className="text-2xl font-semibold text-green-600 mb-4">Para Residentes</h3>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <ArrowRight className="h-5 w-5 text-green-500 mr-2 mt-1 flex-shrink-0" />
                  <span>Contribución directa al medio ambiente</span>
                </li>
                <li className="flex items-start">
                  <ArrowRight className="h-5 w-5 text-green-500 mr-2 mt-1 flex-shrink-0" />
                  <span>Gestión adecuada de residuos reciclables</span>
                </li>
                <li className="flex items-start">
                  <ArrowRight className="h-5 w-5 text-green-500 mr-2 mt-1 flex-shrink-0" />
                  <span>Horarios de recolección coordinados</span>
                </li>
                <li className="flex items-start">
                  <ArrowRight className="h-5 w-5 text-green-500 mr-2 mt-1 flex-shrink-0" />
                  <span>Apoyo a la economía circular local</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Sponsors Section */}
      {gridAds.length > 0 && (
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Nuestros Auspiciantes</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {gridAds.map((cell) => (
                cell.advertisement && cell.advertisement.active ? (
                  <div
                    key={cell.id}
                    className="bg-white rounded-lg shadow-sm overflow-hidden flex flex-col justify-between"
                    style={{ backgroundColor: cell.bg_color || undefined }}
                  >
                    <img
                      src={cell.advertisement.image_url}
                      alt={cell.advertisement.title}
                      style={{
                        width: '100%',
                        height: cell.size === '2x2' ? '320px' : cell.size === '2x1' ? '220px' : cell.size === '1x2' ? '180px' : '140px',
                        objectFit: 'contain',
                        maxHeight: '340px',
                        margin: '0 auto',
                        background: '#f3f4f6',
                        borderRadius: '0.5rem',
                      }}
                    />
                    <div className="p-4">
                      <h3 className="font-medium text-lg text-gray-900">
                        {cell.custom_label || cell.advertisement.title}
                      </h3>
                      {cell.advertisement.link && (
                        <a
                          href={cell.advertisement.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-block text-green-600 hover:text-green-700"
                        >
                          Más información
                        </a>
                      )}
                    </div>
                  </div>
                ) : null
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="py-16 bg-green-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-6">Únete a nuestra comunidad de reciclaje</h2>
          <p className="text-xl mb-8 max-w-3xl mx-auto">
            Sé parte del cambio. Juntos podemos crear un sistema de reciclaje más eficiente y humano.
          </p>
          <div className="flex justify-center gap-4 flex-wrap">
            <Link to="/register" className="bg-white text-green-600 px-6 py-3 rounded-md font-medium hover:bg-gray-100 transition">
              Registrarse ahora
            </Link>
            <Link to="/collection-points" className="bg-green-700 text-white px-6 py-3 rounded-md font-medium hover:bg-green-800 border border-white transition">
              Explorar puntos de recolección
            </Link>
            {/* Acceso Admin solo si está logueado como admin */}
            {window.localStorage.getItem('eco_user_email') === 'cristianferreyra8076@gmail.com' && (
              <Link to="/admin-panel" className="bg-yellow-400 text-green-900 px-6 py-3 rounded-md font-bold hover:bg-yellow-500 transition flex items-center">
                <Lock className="h-5 w-5 mr-2" />
                Acceso Administrador
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Animación de luz para el botón Ingresar */}
      <style>
      {`
        @keyframes glow {
          0% { box-shadow: 0 0 0 0 rgba(34,197,94,0.7); }
          50% { box-shadow: 0 0 16px 8px rgba(34,197,94,0.4); }
          100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.7); }
        }
        .animate-glow {
          animation: glow 2s infinite;
        }
        .glow-effect {
          box-shadow: 0 0 16px 4px rgba(34,197,94,0.4);
          opacity: 0.7;
          z-index: 0;
          animation: glow 2s infinite;
        }
      `}
      </style>
    </div>
  );
};

export default Home;