import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, MapPin, Calendar, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';

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
  const [currentAd, setCurrentAd] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartX = useRef<number | null>(null);

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
      setGridAds((data as GridAdCell[]) || []);
    } catch (err) {
      console.error('Error fetching grid ads:', err);
    }
  };

  const activeAds = gridAds.filter((cell) => cell.advertisement && cell.advertisement.active) as GridAdCell[];

  useEffect(() => {
    if (window.innerWidth < 640 && activeAds.length > 1) {
      intervalRef.current = setInterval(() => setCurrentAd((p) => (p + 1) % activeAds.length), 4000);
      return () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
    setCurrentAd(0);
    return undefined;
  }, [activeAds.length]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || activeAds.length === 0) return;
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(diff) > 50)
      setCurrentAd((p) => (diff < 0 ? (p + 1) % activeAds.length : (p - 1 + activeAds.length) % activeAds.length));
    touchStartX.current = null;
  };

  useEffect(() => {
    if (currentAd >= activeAds.length) setCurrentAd(0);
  }, [activeAds.length, currentAd]);

  return (
    <>
      <section className="relative bg-blue-200 text-white">
        <div
          className="relative min-h-[320px] sm:h-[600px] bg-cover bg-center flex items-center"
          style={{
            backgroundImage: "url('/assets/PJ logo.png')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'repeat',
          }}
        >
          <div className="absolute inset-0 bg-black opacity-30" />
          <div className="max-w-7xl mx-auto px-6 sm:px-6 lg:px-8 py-20">
            <div className="max-w-3xl">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">Conectando dirigentes y referentes por barrio en Santiago del Estero</h1>
              <p className="text-base sm:text-lg mb-6">Organizamos y conectamos dirigentes políticos, referentes comunitarios y vecinos para coordinar acciones, reuniones y campañas en los distintos barrios de Santiago del Estero.</p>
              <div className="flex flex-wrap gap-4">
                <Link to="/register" className="bg-white text-blue-600 px-5 py-2.5 rounded-md font-medium hover:bg-gray-100 transition">Registrarse</Link>
                <Link to="/login" className="bg-blue-700 text-white px-5 py-2.5 rounded-md font-medium hover:bg-blue-800 transition relative animate-glow focus:outline-none focus:ring-4 focus:ring-blue-300">
                  <span className="absolute inset-0 rounded-md pointer-events-none glow-effect" />Ingresar
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">¿Cómo funciona?</h2>
            <p className="text-base text-gray-600 max-w-3xl mx-auto">Nuestra plataforma pone en contacto a dirigentes, referentes vecinales y ciudadanos para mapear necesidades por barrio, coordinar reuniones y gestionar actividades comunitarias y campañas locales.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-gray-50 p-6 rounded-lg text-center">
              <div className="bg-blue-100 w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"><Users className="h-6 w-6 text-blue-600" /></div>
              <h3 className="text-lg font-semibold mb-2">Regístrate</h3>
              <p className="text-sm text-gray-600">Crea tu perfil como dirigente, referente vecinal o ciudadano interesado en participar y coordinar actividades en tu barrio.</p>
            </div>
            <div className="bg-gray-50 p-6 rounded-lg text-center">
              <div className="bg-blue-100 w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"><MapPin className="h-6 w-6 text-blue-600" /></div>
              <h3 className="text-lg font-semibold mb-2">Conecta</h3>
              <p className="text-sm text-gray-600">Localiza referentes y dirigentes por barrio, comparte contactos y coordina reuniones o acciones comunitarias.</p>
            </div>
            <div className="bg-gray-50 p-6 rounded-lg text-center">
              <div className="bg-blue-100 w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"><Calendar className="h-6 w-6 text-blue-600" /></div>
              <h3 className="text-lg font-semibold mb-2">Coordina</h3>
              <p className="text-sm text-gray-600">Organiza eventos, agenda reuniones y lleva el seguimiento de actividades y acuerdos por barrio.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">Beneficios</h2>
            <p className="text-base text-gray-600 max-w-3xl mx-auto">Beneficios para dirigentes, referentes y vecinos: mejor coordinación, representación territorial y mayor impacto local.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-xl font-semibold text-blue-600 mb-4">Para Dirigentes y Referentes</h3>
              <ul className="space-y-3 text-sm text-gray-700">
                <li className="flex items-start"><ArrowRight className="h-4 w-4 text-blue-500 mr-2 mt-1" />Acceso a una red de dirigentes y referentes por barrio</li>
                <li className="flex items-start"><ArrowRight className="h-4 w-4 text-blue-500 mr-2 mt-1" />Mejor organización de agendas y actividades</li>
                <li className="flex items-start"><ArrowRight className="h-4 w-4 text-blue-500 mr-2 mt-1" />Visibilidad local para tus iniciativas</li>
                <li className="flex items-start"><ArrowRight className="h-4 w-4 text-blue-500 mr-2 mt-1" />Herramientas para coordinar campañas y seguimiento</li>
              </ul>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-xl font-semibold text-blue-600 mb-4">Para Vecinos</h3>
              <ul className="space-y-3 text-sm text-gray-700">
                <li className="flex items-start"><ArrowRight className="h-4 w-4 text-blue-500 mr-2 mt-1" />Participación en decisiones y actividades de barrio</li>
                <li className="flex items-start"><ArrowRight className="h-4 w-4 text-blue-500 mr-2 mt-1" />Acceso a información sobre reuniones y eventos locales</li>
                <li className="flex items-start"><ArrowRight className="h-4 w-4 text-blue-500 mr-2 mt-1" />Canales directos para comunicar necesidades</li>
                <li className="flex items-start"><ArrowRight className="h-4 w-4 text-blue-500 mr-2 mt-1" />Mayor presencia y respuesta de representantes locales</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {activeAds.length > 0 && (
        <section className="py-12 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center mb-8">
              <div className="flex items-center gap-3 mb-2">
                <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100">
                  <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="10" fill="#bbf7d0" />
                    <path d="M8 12l2 2 4-4" stroke="#16a34a" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                </span>
                <h2 className="text-2xl font-bold text-gray-900">Organizaciones y Apoyos</h2>
              </div>
              <p className="text-blue-700 text-lg font-medium text-center max-w-2xl">Organizaciones, colectivos y patrocinadores que apoyan la participación ciudadana y la organización territorial en Santiago del Estero.</p>
            </div>

            <div className="block sm:hidden">
              <div className="relative overflow-hidden" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} style={{ minHeight: 320 }}>
                {activeAds.map((cell: GridAdCell, idx: number) => (
                  <div
                    key={cell.id}
                    className={`absolute top-0 left-0 w-full transition-transform duration-700 ease-in-out ${idx === currentAd ? 'translate-x-0 opacity-100 z-10' : idx < currentAd ? '-translate-x-full opacity-0 z-0' : 'translate-x-full opacity-0 z-0'}`}
                    style={{ pointerEvents: idx === currentAd ? 'auto' : 'none' }}
                  >
                    <div className="group bg-gradient-to-br from-blue-50 to-white rounded-2xl shadow-lg border border-blue-100 overflow-hidden flex flex-col mx-auto max-w-xs">
                      <div className="flex-1 flex items-center justify-center bg-gray-50 p-6" style={{ minHeight: '180px' }}>
                        <img src={cell.advertisement!.image_url} alt={cell.advertisement!.title} className="object-contain max-h-40 w-full rounded-lg shadow-sm bg-white" style={{ height: cell.size === '2x2' ? '220px' : cell.size === '2x1' ? '160px' : cell.size === '1x2' ? '120px' : '100px' }} />
                      </div>
                      <div className="p-5 flex flex-col items-center">
                        <h3 className="font-semibold text-lg text-blue-800 mb-2 text-center group-hover:text-blue-600 transition">{cell.custom_label || cell.advertisement!.title}</h3>
                        {cell.advertisement!.link && (
                          <a href={cell.advertisement!.link} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block px-4 py-2 rounded-full bg-blue-600 text-white font-medium shadow hover:bg-blue-700 transition">Más información</a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div className="flex justify-center gap-2 mt-4">
                  {activeAds.map((_, idx: number) => (
                    <button key={idx} className={`w-3 h-3 rounded-full ${idx === currentAd ? 'bg-blue-600' : 'bg-blue-200'}`} onClick={() => setCurrentAd(idx)} aria-label={`Ir al anuncio ${idx + 1}`} />
                  ))}
                </div>
              </div>
            </div>

            <div className="hidden sm:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeAds.map((cell: GridAdCell) => (
                <div key={cell.id} className="group bg-gradient-to-br from-blue-50 to-white rounded-2xl shadow-lg border border-blue-100 overflow-hidden flex flex-col transition-transform duration-200 hover:scale-105 hover:shadow-2xl" style={{ backgroundColor: cell.bg_color || undefined }}>
                  <div className="flex-1 flex items-center justify-center bg-gray-50 p-6" style={{ minHeight: '180px' }}>
                    <img src={cell.advertisement!.image_url} alt={cell.advertisement!.title} className="object-contain max-h-40 w-full rounded-lg shadow-sm bg-white" style={{ height: cell.size === '2x2' ? '220px' : cell.size === '2x1' ? '160px' : cell.size === '1x2' ? '120px' : '100px' }} />
                  </div>
                  <div className="p-5 flex flex-col items-center">
                    <h3 className="font-semibold text-lg text-blue-800 mb-2 text-center group-hover:text-blue-600 transition">{cell.custom_label || cell.advertisement!.title}</h3>
                    {cell.advertisement!.link && (
                      <a href={cell.advertisement!.link} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block px-4 py-2 rounded-full bg-blue-600 text-white font-medium shadow hover:bg-blue-700 transition">Más información</a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
};

export default Home;