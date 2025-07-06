import React, { useState, useCallback } from 'react';
import { transformImage, prepareImageForUpload } from '../services/ImageTransformService';

interface ImageUploaderProps {
  onImageReady?: (imageUrl: string) => void;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ 
  onImageReady, 
  maxWidth = 1200, 
  maxHeight = 1200,
  quality = 80
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [originalSize, setOriginalSize] = useState<number>(0);
  const [optimizedSize, setOptimizedSize] = useState<number>(0);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsLoading(true);
    setError(null);
    setOriginalSize(file.size);
    
    try {
      // Mostrar vista previa de la imagen original
      const reader = new FileReader();
      reader.onloadend = async () => {
        const originalPreview = reader.result as string;
        setPreview(originalPreview);
        
        // Procesar la imagen para reducir su tamaño
        const processedImage = await prepareImageForUpload(file);
        
        if (processedImage) {
          // Transformar la imagen con las opciones especificadas
          const result = await transformImage(processedImage, {
            width: maxWidth,
            height: maxHeight,
            quality,
            format: 'webp',
            name: 'upload'
          });
          
          if (result.success && result.url) {
            setPreview(result.url);
            setOptimizedSize(result.size || 0);
            
            // Notificar al componente padre
            if (onImageReady) {
              onImageReady(result.url);
            }
          } else {
            setError(result.error || 'Error al procesar la imagen');
            // Usar la imagen original si la transformación falla
            if (onImageReady) {
              onImageReady(originalPreview);
            }
          }
        } else {
          setError('No se pudo leer la imagen');
        }
        
        setIsLoading(false);
      };
      
      reader.readAsDataURL(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setIsLoading(false);
    }
  }, [maxWidth, maxHeight, quality, onImageReady]);

  return (
    <div className="image-uploader">
      <div className="upload-container">
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={isLoading}
          className="file-input"
        />
        
        <label className="upload-button">
          {isLoading ? 'Procesando...' : 'Seleccionar imagen'}
        </label>
      </div>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      {preview && (
        <div className="preview-container">
          <img src={preview} alt="Vista previa" className="image-preview" />
          
          {originalSize > 0 && optimizedSize > 0 && (
            <div className="size-info">
              <p>Tamaño original: {(originalSize / 1024).toFixed(2)} KB</p>
              <p>Tamaño optimizado: {(optimizedSize / 1024).toFixed(2)} KB</p>
              <p>Reducción: {((1 - optimizedSize / originalSize) * 100).toFixed(2)}%</p>
            </div>
          )}
        </div>
      )}
      
      <style>{`
        .image-uploader {
          margin: 1rem 0;
        }
        
        .upload-container {
          position: relative;
          margin-bottom: 1rem;
        }
        
        .file-input {
          position: absolute;
          width: 100%;
          height: 100%;
          opacity: 0;
          cursor: pointer;
          z-index: 2;
        }
        
        .upload-button {
          display: block;
          padding: 0.75rem 1.5rem;
          background-color: #3b82f6;
          color: white;
          border-radius: 0.375rem;
          text-align: center;
          cursor: pointer;
          font-weight: 500;
          transition: background-color 0.2s;
        }
        
        .upload-button:hover {
          background-color: #2563eb;
        }
        
        .error-message {
          color: #ef4444;
          margin-bottom: 1rem;
        }
        
        .preview-container {
          margin-top: 1rem;
        }
        
        .image-preview {
          max-width: 100%;
          max-height: 300px;
          border-radius: 0.375rem;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        
        .size-info {
          margin-top: 0.5rem;
          font-size: 0.875rem;
          color: #4b5563;
        }
      `}</style>
    </div>
  );
};

export default ImageUploader;
