import React from 'react';
import { Link } from 'react-router-dom';
import { Recycle, Users, MapPin, Calendar, ArrowRight } from 'lucide-react';

const Home: React.FC = () => {
  return (
    <div>
      {/* Hero Section */}
      <section className="relative bg-green-600 text-white">
        <div className="absolute inset-0 bg-black opacity-30"></div>
        <div 
          className="relative h-[600px] bg-cover bg-center flex items-center"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1470&q=80')" }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
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
                <Link to="/collection-points" className="bg-green-700 text-white px-6 py-3 rounded-md font-medium hover:bg-green-800 transition">
                  Ver puntos de recolección
                </Link>
              </div>
            </div>
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
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;