import React from 'react';
import { MapPin, User, CheckCircle } from 'lucide-react';

const MapLegend: React.FC = () => {
  return (
    <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-md p-4">
      <h3 className="text-sm font-medium text-gray-700 mb-2">Leyenda</h3>
      <div className="space-y-2">
        <div className="flex items-center">
          <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center mr-2">
            <User className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm text-gray-600">Punto Disponible</span>
        </div>
        <div className="flex items-center">
          <div className="w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center mr-2">
            <User className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm text-gray-600">Punto Reclamado</span>
        </div>
        <div className="flex items-center">
          <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center mr-2">
            <CheckCircle className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm text-gray-600">Punto Retirado</span>
        </div>
        <div className="flex items-center">
          <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center mr-2">
            <MapPin className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm text-gray-600">Tu Ubicación</span>
        </div>
      </div>
    </div>
  );
};

export default MapLegend;