import React from 'react';

const TerminosCondicionesPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-10 border border-gray-200">
        <h1 className="text-4xl font-extrabold text-center text-green-800 mb-8 tracking-tight">Términos y Condiciones</h1>
        <div className="prose prose-lg max-w-none text-gray-800 whitespace-pre-line" style={{fontFamily: 'serif', fontSize: '1.1rem'}}>
          {`
${require('../../public/terminos y servicios .txt')}
          `}
          <div className="mt-10 text-center text-gray-500 text-sm italic">
            Última actualización: 10 de junio de 2025
          </div>
        </div>
      </div>
    </div>
  );
};

export default TerminosCondicionesPage;
