import React, { useState } from 'react';
import ImageUploader from '../components/ImageUploader';
import ImageTransformer from '../components/ImageTransformer';
import ProfileImageManager from '../components/ProfileImageManager';

const ImageManagementExample: React.FC = () => {
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [showTransformer, setShowTransformer] = useState(false);
  const [profileImages, setProfileImages] = useState<{
    avatar?: string;
    thumbnail?: string;
    header?: string;
  }>({});

  const handleImageReady = (imageUrl: string) => {
    setSelectedImageUrl(imageUrl);
    setShowTransformer(true);
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Manejo de Imágenes con Supabase Functions</h1>
      
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">1. Gestión de Imágenes de Perfil</h2>
        <p className="text-gray-700 mb-4">
          Las imágenes de perfil se optimizan automáticamente y se generan en múltiples formatos.
        </p>
        
        <ProfileImageManager 
          userId="ejemplo-usuario-123"
          showHeader={true}
          onUpdate={(urls) => {
            setProfileImages(urls);
            console.log('Imágenes de perfil actualizadas:', urls);
          }}
        />
        
        {(profileImages.avatar || profileImages.thumbnail || profileImages.header) && (
          <div className="mt-6 border-t pt-4">
            <h3 className="text-lg font-medium mb-3">Imágenes generadas:</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {profileImages.avatar && (
                <div>
                  <p className="text-sm font-medium mb-1">Avatar (400x400)</p>
                  <img 
                    src={profileImages.avatar} 
                    alt="Avatar" 
                    className="rounded-lg border border-gray-200"
                  />
                </div>
              )}
              
              {profileImages.thumbnail && (
                <div>
                  <p className="text-sm font-medium mb-1">Miniatura (100x100)</p>
                  <img 
                    src={profileImages.thumbnail} 
                    alt="Miniatura" 
                    className="rounded-lg border border-gray-200"
                  />
                </div>
              )}
              
              {profileImages.header && (
                <div>
                  <p className="text-sm font-medium mb-1">Portada (1200x400)</p>
                  <img 
                    src={profileImages.header} 
                    alt="Portada" 
                    className="rounded-lg border border-gray-200 w-full"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">2. Subir y Optimizar Imagen</h2>
        <p className="text-gray-700 mb-4">
          Sube una imagen para procesarla. Las imágenes grandes serán optimizadas automáticamente.
        </p>
        
        <ImageUploader 
          onImageReady={handleImageReady}
          maxWidth={1200}
          quality={85}
        />
      </div>
      
      {selectedImageUrl && showTransformer && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">3. Transformaciones de Imagen</h2>
          <p className="text-gray-700 mb-4">
            Puedes aplicar diferentes transformaciones a la imagen cargada.
          </p>
          
          <ImageTransformer 
            imageUrl={selectedImageUrl}
            initialWidth={800}
          />
        </div>
      )}
      
      <div className="bg-white rounded-lg shadow-md p-6 mt-8">
        <h2 className="text-xl font-semibold mb-4">¿Cómo funciona?</h2>
        <p className="text-gray-700 mb-2">
          Esta demostración utiliza la función de Supabase <code>image-transform</code> para procesar imágenes:
        </p>
        
        <pre className="bg-gray-100 p-4 rounded-md overflow-x-auto text-sm">
{`// Ejemplo de uso del servicio de transformación de imágenes
import { transformImage } from '../services/ImageTransformService';

// En un componente o función asíncrona:
const procesarImagen = async (imageUrl) => {
  const resultado = await transformImage(imageUrl, {
    width: 800,
    quality: 85,
    format: 'webp',
    name: 'mi-transformacion'
  });
  
  if (resultado.success) {
    // Usar imagen transformada
    const imagenOptimizada = resultado.url;
    // ...
  }
};`}
        </pre>
        
        <h3 className="text-lg font-semibold mt-6 mb-2">Ventajas</h3>
        <ul className="list-disc pl-6 text-gray-700 space-y-1">
          <li>Reduce el tamaño de imágenes grandes antes de subirlas</li>
          <li>Mejora la velocidad de carga de la aplicación</li>
          <li>Ahorra ancho de banda para los usuarios</li>
          <li>Genera miniaturas para previsualizaciones</li>
          <li>Procesa imágenes del lado del servidor sin cargar el dispositivo del usuario</li>
        </ul>
      </div>
    </div>
  );
};

export default ImageManagementExample;
