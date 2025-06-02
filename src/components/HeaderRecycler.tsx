import { useState } from 'react';

const HeaderRecycler = () => {
  const [activeTab, setActiveTabLocal] = useState('mis-puntos-disponibles');

  return (
    <div className="w-full bg-white shadow rounded-t-lg overflow-x-auto">
      <div className="flex flex-wrap md:flex-nowrap items-center gap-2 md:gap-4 px-2 py-2">
        {/* Tabs principales */}
        <button
          className={`px-4 py-2 rounded-md font-medium transition-colors ${
            activeTab.startsWith('mis-puntos')
              ? 'bg-green-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-green-100'
          }`}
          onClick={() => setActiveTabLocal('mis-puntos-disponibles')}
        >
          Mis Puntos
        </button>
        <button
          className={`px-4 py-2 rounded-md font-medium transition-colors ${
            activeTab === 'perfil'
              ? 'bg-green-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-green-100'
          }`}
          onClick={() => setActiveTabLocal('perfil')}
        >
          Mi Perfil
        </button>
        <button
          className={`px-4 py-2 rounded-md font-medium transition-colors ${
            activeTab === 'historial'
              ? 'bg-green-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-green-100'
          }`}
          onClick={() => setActiveTabLocal('historial')}
        >
          Historial
        </button>
        <button
          className={`px-4 py-2 rounded-md font-medium transition-colors ${
            activeTab === 'favoritos'
              ? 'bg-green-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-green-100'
          }`}
          onClick={() => setActiveTabLocal('favoritos')}
        >
          Mis Puntos Favoritos
        </button>
      </div>
      {/* Mostrar el tab activo debajo del header */}
      <div className="px-4 py-1 text-sm text-gray-600 font-semibold">
        Tab actual: {activeTab}
      </div>
      {/* Subtabs de Mis Puntos */}
      {/* Eliminados los subtabs */}
    </div>
  );
};

export default HeaderRecycler;
