import React, { useState } from 'react';

interface Tab {
  label: string;
  value: string;
  submenu?: { label: string; value: string }[];
}

const tabs: Tab[] = [
  {
    label: 'Mis Puntos',
    value: 'mis-puntos',
    submenu: [
      { label: 'Puntos Reclamados', value: 'reclamados' },
      { label: 'Puntos Cancelados', value: 'cancelados' },
      { label: 'Puntos Retirados', value: 'retirados' },
    ],
  },
  { label: 'Mi Perfil', value: 'perfil' },
  { label: 'Historial', value: 'historial' },
  { label: 'Mis Puntos Favoritos', value: 'favoritos' },
];

interface HeaderRecyclerProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const MIS_PUNTOS_SUBTABS = [
  { label: 'Puntos Disponibles', value: 'mis-puntos-disponibles' },
  { label: 'Puntos Reclamados', value: 'mis-puntos-reclamados' },
  { label: 'Puntos Cancelados', value: 'mis-puntos-cancelados' },
  { label: 'Puntos Retirados', value: 'mis-puntos-retirados' },
];

const HeaderRecycler: React.FC<HeaderRecyclerProps> = ({ activeTab, setActiveTab }) => {
  // Detectar si estamos en una subtab de Mis Puntos
  const isMisPuntos = activeTab.startsWith('mis-puntos');
  // Subtab local para Mis Puntos
  const [subTab, setSubTab] = useState('mis-puntos-disponibles');

  // Sincronizar subTab con activeTab externo
  React.useEffect(() => {
    if (isMisPuntos && !MIS_PUNTOS_SUBTABS.some(t => t.value === activeTab)) {
      setActiveTab(subTab);
    }
    if (isMisPuntos && MIS_PUNTOS_SUBTABS.some(t => t.value === activeTab)) {
      setSubTab(activeTab);
    }
  }, [activeTab, isMisPuntos, setActiveTab, subTab]);

  return (
    <div className="w-full bg-white shadow rounded-t-lg overflow-x-auto">
      <div className="flex flex-wrap md:flex-nowrap items-center gap-2 md:gap-4 px-2 py-2">
        {/* Tabs principales */}
        {tabs.map((tab) => (
          <React.Fragment key={tab.value}>
            {tab.value === 'mis-puntos' ? (
              <button
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  isMisPuntos
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-green-100'
                }`}
                onClick={() => {
                  setActiveTab('mis-puntos-disponibles');
                  setSubTab('mis-puntos-disponibles');
                }}
              >
                {tab.label}
              </button>
            ) : (
              <button
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  activeTab === tab.value
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-green-100'
                }`}
                onClick={() => setActiveTab(tab.value)}
              >
                {tab.label}
              </button>
            )}
          </React.Fragment>
        ))}
        {/* Eliminar campana duplicada del header de tabs */}
        {/* <div className="ml-auto flex items-center">
          <NotificationBell />
        </div> */}
      </div>
      {/* Subtabs de Mis Puntos */}
      {isMisPuntos && (
        <div className="flex gap-2 px-2 py-2 border-b bg-white">
          {MIS_PUNTOS_SUBTABS.map((sub) => (
            <button
              key={sub.value}
              className={`px-3 py-1 rounded-md font-medium transition-colors text-sm ${
                subTab === sub.value
                  ? 'bg-green-100 text-green-800 shadow'
                  : 'bg-gray-100 text-gray-700 hover:bg-green-50'
              }`}
              onClick={() => {
                setSubTab(sub.value);
                setActiveTab(sub.value);
              }}
            >
              {sub.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default HeaderRecycler;
