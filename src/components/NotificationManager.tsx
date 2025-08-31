import { useEffect, useState } from 'react';
import { 
  requestNotificationPermission, 
  setupForegroundNotifications
} from '../components/Firebase';
import { 
  showLocalNotification, 
  sendNotificationForTesting as sendNotificationToUser,
  sendTopicNotificationForTesting as sendNotificationToTopic
} from '../services/FirebaseNotificationService';

const NotificationManager = () => {
  const [deviceToken, setDeviceToken] = useState<string | null>(null);
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationBody, setNotificationBody] = useState('');
  const [notificationStatus, setNotificationStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Configurar notificaciones en primer plano
    setupForegroundNotifications();
    
    // Solicitar permiso para notificaciones
    const getPermission = async () => {
      const token = await requestNotificationPermission();
      if (token) {
        setDeviceToken(token);
      }
    };
    
    getPermission();
  }, []);

  const handleSendNotification = async () => {
    if (!deviceToken) {
      setNotificationStatus('No hay token de dispositivo disponible.');
      return;
    }
    
    if (!notificationTitle || !notificationBody) {
      setNotificationStatus('Por favor ingresa un título y un mensaje para la notificación.');
      return;
    }
    
    try {
      setIsLoading(true);
      // Enviar notificación a este dispositivo
      const result = await sendNotificationToUser(
        deviceToken,
        notificationTitle,
        notificationBody,
        { timestamp: new Date().toISOString() }
      );
      
      if (result.success) {
        setNotificationStatus('Notificación enviada con éxito!');
        // Mostrar una notificación local para demostración
        showLocalNotification(notificationTitle, notificationBody);
        // Limpiar campos
        setNotificationTitle('');
        setNotificationBody('');
      } else {
        setNotificationStatus(`Error al enviar la notificación: ${result.error || ''}`);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      setNotificationStatus(`Error: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendTopicNotification = async (topic = 'all_users') => {
    if (!notificationTitle || !notificationBody) {
      setNotificationStatus('Por favor ingresa un título y un mensaje para la notificación.');
      return;
    }
    
    try {
      setIsLoading(true);
      // Enviar notificación a todos los usuarios suscritos al tema
      const result = await sendNotificationToTopic(
        topic,
        notificationTitle,
        notificationBody,
        { timestamp: new Date().toISOString() }
      );
      
      if (result.success) {
        setNotificationStatus(`Notificación enviada con éxito al tema '${topic}'!`);
        // Mostrar una notificación local para demostración
        showLocalNotification(notificationTitle, notificationBody);
        // Limpiar campos
        setNotificationTitle('');
        setNotificationBody('');
      } else {
        setNotificationStatus(`Error al enviar la notificación al tema: ${result.error || ''}`);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      setNotificationStatus(`Error: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="notification-manager p-4 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">Gestor de Notificaciones</h2>
      
      <div className="mb-4">
        <p className="mb-2">
          Estado del token: 
          <span className={`ml-2 ${deviceToken ? 'text-blue-500' : 'text-red-500'}`}>
            {deviceToken ? 'Disponible' : 'No disponible'}
          </span>
        </p>
        {deviceToken && (
          <p className="text-xs text-gray-500 break-all">Token: {deviceToken.substring(0, 20)}...</p>
        )}
      </div>
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Título de la notificación
        </label>
        <input
          type="text"
          value={notificationTitle}
          onChange={(e) => setNotificationTitle(e.target.value)}
          className="w-full p-2 border rounded-md"
          placeholder="Ingrese el título"
        />
      </div>
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Mensaje de la notificación
        </label>
        <textarea
          value={notificationBody}
          onChange={(e) => setNotificationBody(e.target.value)}
          className="w-full p-2 border rounded-md"
          rows={3}
          placeholder="Ingrese el mensaje"
        />
      </div>
      
      <div className="flex space-x-2">
        <button
          onClick={handleSendNotification}
          disabled={isLoading || !deviceToken}
          className={`px-4 py-2 rounded-md ${
            isLoading || !deviceToken
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
        >
          {isLoading ? 'Enviando...' : 'Enviar al dispositivo actual'}
        </button>
        
        <button
          onClick={() => handleSendTopicNotification('all_users')}
          disabled={isLoading}
          className={`px-4 py-2 rounded-md ${
            isLoading
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
        >
          {isLoading ? 'Enviando...' : 'Enviar a todos los usuarios'}
        </button>
      </div>
      
      {notificationStatus && (
        <div className={`mt-4 p-2 rounded-md ${
          notificationStatus.includes('éxito')
            ? 'bg-blue-100 text-blue-800'
            : 'bg-red-100 text-red-800'
        }`}>
          {notificationStatus}
        </div>
      )}
    </div>
  );
};

export default NotificationManager;
