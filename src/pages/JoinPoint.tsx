import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { supabase } from '../lib/supabase';

const JoinPoint: React.FC = () => {
  const { pointId } = useParams<{ pointId: string }>();
  const { user } = useUser();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pointInfo, setPointInfo] = useState<{ address: string; institutionalName: string | null } | null>(null);

  useEffect(() => {
    const fetchPointInfo = async () => {
      if (!pointId) {
        setError('No se ha especificado un punto de recolección.');
        setLoading(false);
        return;
      }

      if (!user) {
        setError('Debes iniciar sesión para unirte a un punto.');
        setLoading(false);
        return;
      }

      // Solo los Dirigentes (role 'recycler') pueden unirse a puntos colectivos
      if (user.type !== 'recycler') {
        setError('Solo los Dirigentes pueden unirse a puntos colectivos.');
        setLoading(false);
        return;
      }

      // Obtener detalles del punto de recolección
      const { data: pointData, error: pointError } = await supabase
        .from('concentration_points')
        .select('address, user_id')
        .eq('id', pointId)
        .single();

      if (pointError || !pointData) {
        setError('No se pudo encontrar el punto de recolección o no es válido.');
        setLoading(false);
        return;
      }
      
      // Obtener el nombre del perfil institucional
      const { data: institutionalProfile } = await supabase
        .from('profiles')
        .select('name')
        .eq('user_id', pointData.user_id)
        .single();

      setPointInfo({
        address: pointData.address,
        institutionalName: institutionalProfile?.name || 'una institución'
      });
      setLoading(false);
    };

    fetchPointInfo();
  }, [pointId, user, navigate]);

  const handleConfirm = async () => {
    if (!user || !pointInfo) return;

    setLoading(true);
    setError(null);

    // Actualizar el perfil del Dirigente con la dirección del punto
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ address: pointInfo.address })
      .eq('user_id', user.id);

    if (updateError) {
      setError('Hubo un error al unirte al punto. Inténtalo de nuevo.');
      setLoading(false);
    } else {
      setSuccess(true);
      setTimeout(() => {
        navigate('/dashboard');
      }, 3000);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen"><div>Cargando...</div></div>;
  }

  if (error) {
    return <div className="flex justify-center items-center h-screen"><div className="text-red-500 p-4 bg-red-100 rounded">{error}</div></div>;
  }
  
  if (success) {
      return (
          <div className="flex justify-center items-center h-screen">
              <div className="text-center p-8 bg-white rounded-lg shadow-lg">
                  <h2 className="text-2xl font-bold text-blue-600 mb-4">¡Te has unido con éxito!</h2>
                  <p className="text-gray-700">Ahora estás asociado al punto de recolección.</p>
                  <p className="text-gray-500 mt-2">Serás redirigido a tu panel en unos segundos...</p>
              </div>
          </div>
      );
  }

  return (
    <div className="flex justify-center items-center h-screen bg-gray-50">
      <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-lg mx-4">
        <h1 className="text-2xl font-bold mb-4">Confirmar Adhesión</h1>
        {pointInfo && (
          <p className="text-gray-700 mb-6">
            ¿Deseas unirte al punto de recolección gestionado por <strong>{pointInfo.institutionalName}</strong> en la dirección: <strong>{pointInfo.address}</strong>?
          </p>
        )}
        <div className="flex justify-center gap-4">
          <button
            onClick={handleConfirm}
            className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            Sí, unirme
          </button>
          <button
            onClick={() => navigate('/dashboard-resident')}
            className="px-6 py-2 bg-gray-300 text-gray-800 font-semibold rounded-lg hover:bg-gray-400 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};

export default JoinPoint;
