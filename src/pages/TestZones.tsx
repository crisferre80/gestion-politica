import React, { useState, useEffect } from 'react';
import Map from '../components/Map';

const TestZones: React.FC = () => {
  const [showZones, setShowZones] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  // Interceptar console.log para mostrar en la UI
  useEffect(() => {
    const originalLog = console.log;
    console.log = (...args) => {
      originalLog(...args);
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      setLogs(prev => [...prev.slice(-10), `${new Date().toLocaleTimeString()}: ${message}`]);
    };

    return () => {
      console.log = originalLog;
    };
  }, []);

  // Zonas de prueba hardcodeadas
  const testZones = [
    {
      id: 'test-zone-1',
      name: 'Zona Centro Test',
      coordinates: [
        [
          [-64.2667, -27.7833],
          [-64.2600, -27.7833],
          [-64.2600, -27.7900],
          [-64.2667, -27.7900],
          [-64.2667, -27.7833]
        ]
      ],
      color: '#22c55e',
      created_at: new Date().toISOString()
    },
    {
      id: 'test-zone-2',
      name: 'Zona Norte Test',
      coordinates: [
        [
          [-64.2700, -27.7700],
          [-64.2600, -27.7700],
          [-64.2600, -27.7750],
          [-64.2700, -27.7750],
          [-64.2700, -27.7700]
        ]
      ],
      color: '#3b82f6',
      created_at: new Date().toISOString()
    }
  ];

  return (
    <div style={{ padding: '20px' }}>
      <h1>Test de Zonas Administrativas</h1>
      <button 
        onClick={() => setShowZones(!showZones)}
        style={{
          marginBottom: '20px',
          padding: '10px 20px',
          backgroundColor: showZones ? '#ef4444' : '#22c55e',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer'
        }}
      >
        {showZones ? 'Ocultar Zonas' : 'Mostrar Zonas'}
      </button>
      
      <div style={{ height: '500px', width: '100%' }}>
        <Map 
          zones={showZones ? testZones : []}
          showAdminZonesButton={true}
          showUserLocation={true}
        />
      </div>
      
      <div style={{ marginTop: '20px' }}>
        <h3>Debug Info:</h3>
        <p>Mostrando zonas: {showZones ? 'Sí' : 'No'}</p>
        <p>Número de zonas: {showZones ? testZones.length : 0}</p>
        
        <h4>Console Logs:</h4>
        <div style={{ 
          backgroundColor: '#1a1a1a', 
          color: '#00ff00', 
          padding: '10px', 
          borderRadius: '5px',
          fontFamily: 'monospace',
          fontSize: '12px',
          maxHeight: '200px',
          overflowY: 'auto'
        }}>
          {logs.map((log, index) => (
            <div key={index}>{log}</div>
          ))}
        </div>

        <h4>Zonas de Prueba:</h4>
        <pre style={{ backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '5px', fontSize: '12px' }}>
          {JSON.stringify(showZones ? testZones : [], null, 2)}
        </pre>
      </div>
    </div>
  );
};

export default TestZones;
