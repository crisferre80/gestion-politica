import React from 'react';
import { useEffect, useState } from 'react';

const TerminosCondicionesPage: React.FC = () => {
  const [texto, setTexto] = useState('');

  useEffect(() => {
    fetch('/terminos%20y%20servicios%20.txt')
      .then(res => res.text())
      .then(setTexto);
  }, []);

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-10 border border-gray-200">
        <h1 className="text-4xl font-extrabold text-center text-blue-800 mb-8 tracking-tight">Términos y Condiciones</h1>
        <div className="prose prose-lg max-w-none text-gray-800 whitespace-pre-line" style={{fontFamily: 'serif', fontSize: '1.1rem'}}>
          {texto || <span className="text-gray-400">Cargando...</span>}
          <div className="mt-10 text-center text-gray-500 text-sm italic">
            Última actualización: 10 de junio de 2025
          </div>
        </div>
      </div>
    </div>
  );
};

export default TerminosCondicionesPage;
