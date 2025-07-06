import React, { useState } from 'react';
import { handleProfileImageUpload } from '../lib/uploadAvatar';
import PhotoCapture from './PhotoCapture';

interface ProfileImageManagerProps {
  userId: string;
  currentAvatarUrl?: string | null;
  onUpdate?: (urls: { avatar?: string; thumbnail?: string; header?: string }) => void;
  showHeader?: boolean;
}

const ProfileImageManager: React.FC<ProfileImageManagerProps> = ({ 
  userId, 
  currentAvatarUrl, 
  onUpdate,
  showHeader = false
}) => {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(currentAvatarUrl || null);
  const [headerUrl, setHeaderUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingHeader, setIsUploadingHeader] = useState(false);
  const [uploadType, setUploadType] = useState<'avatar' | 'header' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (file: File, type: 'avatar' | 'header') => {
    if (!userId) return;
    
    // Actualizar estados de carga
    setIsUploading(true);
    setError(null);
    if (type === 'avatar') {
      setIsUploadingAvatar(true);
    } else {
      setIsUploadingHeader(true);
    }
    
    try {
      // Procesar y subir la imagen
      const result = await handleProfileImageUpload(userId, file);
      
      if (!result.success) {
        throw new Error(result.error || 'Error al procesar la imagen');
      }
      
      // Actualizar la UI con las URLs resultantes (pueden ser data URLs o URLs de storage)
      if (type === 'avatar') {
        setAvatarUrl(result.avatar || null);
      } else {
        setHeaderUrl(result.header || null);
      }
      
      // Notificar al componente padre si es necesario
      if (onUpdate) {
        onUpdate({
          avatar: result.avatar,
          thumbnail: result.thumbnail,
          header: result.header
        });
      }
    } catch (err) {
      console.error('Error al actualizar imagen de perfil:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido al procesar la imagen');
    } finally {
      // Limpiar estados de carga independientemente del resultado
      setIsUploading(false);
      if (type === 'avatar') {
        setIsUploadingAvatar(false);
      } else {
        setIsUploadingHeader(false);
      }
      setUploadType(null);
    }
  };

  return (
    <div className="profile-image-manager">
      <div className="flex flex-col gap-6">
        {/* Avatar Section */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-3">Foto de Perfil</h3>
          <div className="flex items-center gap-4">
            <div className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center bg-gray-100 border border-gray-300">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-gray-400">Sin foto</span>
              )}
            </div>
            
            <div>
              {uploadType === 'avatar' ? (
                <PhotoCapture 
                  aspectRatio="square"
                  enableTransformations={true}
                  enableCropping={true}
                  onCapture={(file) => handleUpload(file, 'avatar')}
                  onCancel={() => setUploadType(null)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setUploadType('avatar')}
                  disabled={isUploading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
                >
                  {isUploadingAvatar ? 'Subiendo...' : 'Cambiar foto'}
                </button>
              )}
              <p className="text-sm text-gray-500 mt-1">
                Imagen cuadrada, máximo 300KB (recomendado 400x400px)
              </p>
            </div>
          </div>
        </div>
        
        {/* Header Section (optional) */}
        {showHeader && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Imagen de Portada</h3>
            <div className="flex flex-col gap-3">
              <div className="w-full h-32 rounded-lg overflow-hidden flex items-center justify-center bg-gray-100 border border-gray-300">
                {headerUrl ? (
                  <img src={headerUrl} alt="Portada" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-gray-400">Sin imagen de portada</span>
                )}
              </div>
              
              <div>
                {uploadType === 'header' ? (
                  <PhotoCapture 
                    aspectRatio="16:9"
                    enableTransformations={true}
                    enableCropping={true}
                    onCapture={(file) => handleUpload(file, 'header')}
                    onCancel={() => setUploadType(null)}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setUploadType('header')}
                    disabled={isUploading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
                  >
                    {isUploadingHeader ? 'Subiendo...' : 'Cambiar portada'}
                  </button>
                )}
                <p className="text-sm text-gray-500 mt-1">
                  Imagen panorámica, máximo 800KB (recomendado 1200x400px)
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {error && (
        <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}
    </div>
  );
};

export default ProfileImageManager;
