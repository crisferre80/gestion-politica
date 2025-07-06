import React, { useState, useEffect } from 'react';
import { transformImage, optimizeImage, createThumbnail } from '../services/ImageTransformService';

interface ImageTransformerProps {
  imageUrl: string;
  initialWidth?: number;
}

const ImageTransformer: React.FC<ImageTransformerProps> = ({ imageUrl, initialWidth = 600 }) => {
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [optimizedUrl, setOptimizedUrl] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [customUrl, setCustomUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transformOptions, setTransformOptions] = useState({
    width: initialWidth,
    quality: 80,
    grayscale: false,
    blur: 0,
    format: 'webp' as 'webp' | 'jpeg' | 'png'
  });

  // Cargar la imagen original y versiones transformadas
  useEffect(() => {
    if (!imageUrl) return;
    
    setIsLoading(true);
    setError(null);
    setOriginalUrl(imageUrl);
    
    // Cargar versiones transformadas en paralelo
    const loadTransformedVersions = async () => {
      try {
        const [optimized, thumbnail] = await Promise.all([
          optimizeImage(imageUrl),
          createThumbnail(imageUrl)
        ]);
        
        setOptimizedUrl(optimized);
        setThumbnailUrl(thumbnail);
      } catch (err) {
        setError('Error al cargar transformaciones: ' + (err instanceof Error ? err.message : 'Error desconocido'));
      } finally {
        setIsLoading(false);
      }
    };
    
    loadTransformedVersions();
  }, [imageUrl]);

  // Aplicar transformación personalizada
  const handleApplyTransform = async () => {
    setIsLoading(true);
    try {
      const result = await transformImage(imageUrl, {
        width: transformOptions.width,
        quality: transformOptions.quality,
        format: transformOptions.format,
        grayscale: transformOptions.grayscale,
        blur: transformOptions.blur > 0 ? transformOptions.blur : undefined,
        name: 'custom-transform'
      });
      
      if (result.success && result.url) {
        setCustomUrl(result.url);
      } else {
        setError(result.error || 'Error en la transformación personalizada');
      }
    } catch (err) {
      setError('Error: ' + (err instanceof Error ? err.message : 'Error desconocido'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleOptionChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    
    setTransformOptions(prev => ({
      ...prev,
      [name]: type === 'checkbox' 
        ? (e.target as HTMLInputElement).checked 
        : type === 'number' 
          ? Number(value) 
          : value
    }));
  };

  return (
    <div className="image-transformer">
      <h2 className="text-xl font-semibold mb-4">Transformación de Imágenes</h2>
      
      {isLoading && <p className="loading">Cargando transformaciones...</p>}
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      <div className="image-grid">
        {originalUrl && (
          <div className="image-card">
            <h3>Imagen Original</h3>
            <img src={originalUrl} alt="Original" className="transformed-image" />
          </div>
        )}
        
        {optimizedUrl && (
          <div className="image-card">
            <h3>Optimizada</h3>
            <img src={optimizedUrl} alt="Optimizada" className="transformed-image" />
          </div>
        )}
        
        {thumbnailUrl && (
          <div className="image-card">
            <h3>Miniatura</h3>
            <img src={thumbnailUrl} alt="Miniatura" className="transformed-image thumbnail" />
          </div>
        )}
      </div>
      
      <div className="custom-transform">
        <h3 className="text-lg font-semibold mt-6 mb-3">Transformación Personalizada</h3>
        
        <div className="options-grid">
          <div className="option-group">
            <label htmlFor="width">Ancho</label>
            <input
              type="number"
              id="width"
              name="width"
              min="50"
              max="2000"
              value={transformOptions.width}
              onChange={handleOptionChange}
            />
          </div>
          
          <div className="option-group">
            <label htmlFor="quality">Calidad</label>
            <input
              type="number"
              id="quality"
              name="quality"
              min="10"
              max="100"
              value={transformOptions.quality}
              onChange={handleOptionChange}
            />
          </div>
          
          <div className="option-group">
            <label htmlFor="format">Formato</label>
            <select
              id="format"
              name="format"
              value={transformOptions.format}
              onChange={handleOptionChange}
            >
              <option value="webp">WebP</option>
              <option value="jpeg">JPEG</option>
              <option value="png">PNG</option>
            </select>
          </div>
          
          <div className="option-group">
            <label htmlFor="blur">Desenfoque</label>
            <input
              type="range"
              id="blur"
              name="blur"
              min="0"
              max="20"
              value={transformOptions.blur}
              onChange={handleOptionChange}
            />
            <span>{transformOptions.blur}</span>
          </div>
          
          <div className="option-group checkbox">
            <label htmlFor="grayscale">
              <input
                type="checkbox"
                id="grayscale"
                name="grayscale"
                checked={transformOptions.grayscale}
                onChange={handleOptionChange}
              />
              Escala de grises
            </label>
          </div>
        </div>
        
        <button
          onClick={handleApplyTransform}
          disabled={isLoading}
          className="transform-button"
        >
          {isLoading ? 'Procesando...' : 'Aplicar Transformación'}
        </button>
        
        {customUrl && (
          <div className="custom-result">
            <h3>Resultado Personalizado</h3>
            <img src={customUrl} alt="Personalizada" className="transformed-image" />
          </div>
        )}
      </div>
      
      <style>{`
        .image-transformer {
          padding: 1rem;
        }
        
        .loading, .error-message {
          margin-bottom: 1rem;
        }
        
        .error-message {
          color: #ef4444;
        }
        
        .image-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        
        .image-card {
          border: 1px solid #e5e7eb;
          border-radius: 0.5rem;
          padding: 1rem;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        
        .image-card h3 {
          margin-bottom: 0.75rem;
          font-weight: 500;
        }
        
        .transformed-image {
          max-width: 100%;
          height: auto;
          border-radius: 0.375rem;
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
        }
        
        .thumbnail {
          max-width: 200px;
          max-height: 200px;
        }
        
        .custom-transform {
          border-top: 1px solid #e5e7eb;
          padding-top: 1rem;
        }
        
        .options-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 1rem;
        }
        
        .option-group {
          display: flex;
          flex-direction: column;
        }
        
        .option-group.checkbox {
          flex-direction: row;
          align-items: center;
        }
        
        .option-group.checkbox input {
          margin-right: 0.5rem;
        }
        
        .option-group label {
          margin-bottom: 0.25rem;
          font-weight: 500;
        }
        
        .option-group input, .option-group select {
          padding: 0.5rem;
          border: 1px solid #d1d5db;
          border-radius: 0.25rem;
        }
        
        .transform-button {
          padding: 0.75rem 1.5rem;
          background-color: #3b82f6;
          color: white;
          border: none;
          border-radius: 0.375rem;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s;
          margin-bottom: 1.5rem;
        }
        
        .transform-button:hover {
          background-color: #2563eb;
        }
        
        .transform-button:disabled {
          background-color: #93c5fd;
          cursor: not-allowed;
        }
        
        .custom-result {
          margin-top: 1rem;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        
        .custom-result h3 {
          margin-bottom: 0.75rem;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
};

export default ImageTransformer;
