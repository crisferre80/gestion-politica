import React, { useCallback, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { Camera, Upload, X, Check, RefreshCw, Crop } from 'lucide-react';
import ImageCropper from './ImageCropper';

export interface PhotoCaptureProps {
  onCapture: (file: File) => void | Promise<void>;
  onCancel: () => void;
  aspectRatio?: 'square' | 'cover' | '16:9';
  enableTransformations?: boolean;
  enableCropping?: boolean;
}

const PhotoCapture: React.FC<PhotoCaptureProps> = ({ 
  onCapture, 
  onCancel,
  aspectRatio = 'square',
  enableTransformations = true,
  enableCropping = true
}) => {
  const webcamRef = useRef<Webcam>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showTransformOptions, setShowTransformOptions] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  
  // Opciones de transformación
  const [imageTransformOptions, setImageTransformOptions] = useState({
    brightness: 100, // 0-200, 100 es normal
    contrast: 100,   // 0-200, 100 es normal
    saturation: 100, // 0-200, 100 es normal
    blur: 0,         // 0-10px
    grayscale: false // blanco y negro
  });

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setPreviewImage(imageSrc);
    }
  }, [webcamRef]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validar tipo de archivo permitido
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        alert('Solo se permiten imágenes JPG, PNG, WebP o GIF.');
        return;
      }
      
      // Mostrar previsualización
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Función para aplicar los filtros de CSS a la imagen
  const applyImageTransformations = useCallback((image: string): Promise<string> => {
    return new Promise((resolve) => {
      if (!enableTransformations || !showTransformOptions) {
        resolve(image); // Si las transformaciones no están habilitadas, devolver la imagen original
        return;
      }

      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Establecer el tamaño del canvas según la imagen original
        canvas.width = img.width;
        canvas.height = img.height;
        
        if (!ctx) {
          resolve(image); // Si no se puede crear el contexto, devolver la imagen original
          return;
        }
        
        // Aplicar filtros
        const filters = [];
        if (imageTransformOptions.brightness !== 100) {
          filters.push(`brightness(${imageTransformOptions.brightness}%)`);
        }
        if (imageTransformOptions.contrast !== 100) {
          filters.push(`contrast(${imageTransformOptions.contrast}%)`);
        }
        if (imageTransformOptions.saturation !== 100) {
          filters.push(`saturate(${imageTransformOptions.saturation}%)`);
        }
        if (imageTransformOptions.blur > 0) {
          filters.push(`blur(${imageTransformOptions.blur}px)`);
        }
        if (imageTransformOptions.grayscale) {
          filters.push('grayscale(100%)');
        }
        
        if (filters.length > 0) {
          ctx.filter = filters.join(' ');
        }
        
        // Dibujar la imagen con los filtros aplicados
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Optimización: siempre redimensionar para garantizar un tamaño razonable
        const maxDimension = 1000; // Reducimos el máximo tamaño para mejor compresión
        let finalCanvas = canvas;
        
        // Siempre redimensionar para garantizar un tamaño controlado
        // Calcular las nuevas dimensiones manteniendo la relación de aspecto
        let newWidth, newHeight;
        
        if (img.width > img.height) {
          newWidth = Math.min(maxDimension, img.width);
          newHeight = Math.round((img.height / img.width) * newWidth);
        } else {
          newHeight = Math.min(maxDimension, img.height);
          newWidth = Math.round((img.width / img.height) * newHeight);
        }
        
        // Crear un nuevo canvas con las dimensiones optimizadas
        finalCanvas = document.createElement('canvas');
        finalCanvas.width = newWidth;
        finalCanvas.height = newHeight;
        
        const finalCtx = finalCanvas.getContext('2d');
        if (finalCtx) {
          // Aplicar suavizado para mejor calidad en el redimensionamiento
          finalCtx.imageSmoothingEnabled = true;
          finalCtx.imageSmoothingQuality = 'high';
          
          // Dibujar la imagen redimensionada
          finalCtx.drawImage(canvas, 0, 0, newWidth, newHeight);
        }
        
        // Convertir el canvas a data URL con compresión JPEG (compatible con Supabase)
        const quality = 0.85; // JPEG necesita un poco más de calidad que WebP para verse bien
        const transformedImageData = finalCanvas.toDataURL('image/jpeg', quality);
        resolve(transformedImageData);
      };
      
      img.src = image;
    });
  }, [enableTransformations, showTransformOptions, imageTransformOptions]);

  const [processingState, setProcessingState] = useState('');
  const [processingProgress, setProcessingProgress] = useState(0);
  
  const handleConfirmImage = useCallback(async () => {
    if (!previewImage) return;
    
    setProcessing(true);
    setProcessingProgress(0);
    
    try {
      // Paso 1: Aplicar transformaciones si están habilitadas
      setProcessingState('Aplicando transformaciones...');
      setProcessingProgress(25);
      const processedImage = await applyImageTransformations(previewImage);
      
      // Paso 2: Convertir a blob y luego a File para optimizar tamaño
      setProcessingState('Optimizando imagen...');
      setProcessingProgress(50);
      let response = await fetch(processedImage);
      let blob = await response.blob();
      
      // Verificar tamaño del blob resultante
      const MAX_SIZE_MB = 1;
      const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
      let fileSizeMB = blob.size / (1024 * 1024);
      
      // Si el tamaño es mayor a 2MB, aplicar compresión adicional
      if (blob.size > MAX_SIZE_BYTES) {
        setProcessingState(`Comprimiendo imagen (${fileSizeMB.toFixed(2)} MB > 2 MB)...`);
        
        // Crear un canvas para comprimir más la imagen
        const img = new Image();
        img.src = processedImage;
        await new Promise(resolve => { img.onload = resolve; });
        
        const canvas = document.createElement('canvas');
        // Reducir dimensiones para archivo más pequeño
        const scale = Math.sqrt(MAX_SIZE_BYTES / blob.size) * 0.9; // Factor de seguridad
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          // Usar calidad muy baja para garantizar tamaño pequeño
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.6); // JPEG requiere un poco más de calidad
          
          response = await fetch(compressedDataUrl);
          blob = await response.blob();
          fileSizeMB = blob.size / (1024 * 1024);
          console.log(`Imagen recomprimida a: ${fileSizeMB.toFixed(2)} MB`);
        }
      }
      
      // Crear nombre de archivo con timestamp para evitar conflictos (usar jpg en lugar de webp)
      const timestamp = new Date().getTime();
      const filename = `profile-photo-${timestamp}.jpg`;
      const mimeType = 'image/jpeg';
      const file = new File([blob], filename, { type: mimeType });
      
      // Verificar tamaño final
      console.log(`Tamaño final de la imagen: ${fileSizeMB.toFixed(2)} MB`);
      
      // Paso 3: Enviar el archivo procesado
      setProcessingState('Guardando imagen...');
      setProcessingProgress(75);
      await onCapture(file);
      
      setProcessingProgress(100);
      
      // Limpiar estados
      setTimeout(() => {
        setPreviewImage(null);
        setIsCameraActive(false);
        setShowTransformOptions(false);
        setProcessingState('');
        setProcessingProgress(0);
      }, 500); // Pequeño retraso para mostrar completado
    } catch (err) {
      console.error('Error al procesar la imagen:', err);
      setProcessingState('Error al procesar la imagen');
      alert('Ha ocurrido un error al procesar la imagen. Por favor, intenta nuevamente.');
    } finally {
      setProcessing(false);
    }
  }, [previewImage, onCapture, applyImageTransformations]);

  // Si no hay cámara activa ni previsualización, mostrar botones iniciales
  if (!isCameraActive && !previewImage) {
    return (
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setIsCameraActive(true)}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          <Camera className="h-5 w-5 mr-2" />
          Tomar foto
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          <Upload className="h-5 w-5 mr-2" />
          Subir foto
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
        />
      </div>
    );
  }

  // Si se está mostrando el recortador de imagen
  if (showCropper && previewImage) {
    const getAspectRatioValue = () => {
      if (aspectRatio === 'square') return 1;
      if (aspectRatio === '16:9') return 16/9;
      return null; // libre para aspectRatio === 'cover'
    };

    return (
      <ImageCropper
        imageUrl={previewImage}
        aspectRatio={getAspectRatioValue()}
        onCropComplete={(croppedImageUrl) => {
          setPreviewImage(croppedImageUrl);
          setShowCropper(false);
        }}
        onCancel={() => setShowCropper(false)}
      />
    );
  }

  // Si hay previsualización, mostrar la imagen y opciones
  if (previewImage) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
        <div className="bg-white p-4 rounded-lg max-w-md w-full">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium">Previsualización de imagen</h3>
            <button
              type="button"
              onClick={() => {
                setPreviewImage(null);
                setIsCameraActive(false);
                setShowTransformOptions(false);
              }}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          
          <div className={`relative ${aspectRatio === 'square' ? 'aspect-square' : aspectRatio === '16:9' ? 'aspect-video' : 'aspect-[3/2]'} overflow-hidden rounded-lg bg-gray-100`}>
            <img 
              src={previewImage} 
              alt="Vista previa" 
              className="w-full h-full object-cover"
              style={{
                filter: `
                  brightness(${imageTransformOptions.brightness}%) 
                  contrast(${imageTransformOptions.contrast}%) 
                  saturate(${imageTransformOptions.saturation}%)
                  blur(${imageTransformOptions.blur}px)
                  ${imageTransformOptions.grayscale ? 'grayscale(100%)' : ''}
                `
              }}
            />
          </div>
          
          {/* Barra de acciones para transformar/recortar la imagen */}
          <div className="mt-3 flex justify-center space-x-4">
            {enableTransformations && (
              <button
                type="button"
                onClick={() => setShowTransformOptions(!showTransformOptions)}
                className="text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center"
              >
                {showTransformOptions ? 'Ocultar opciones' : 'Ajustar imagen'}
              </button>
            )}
            
            {enableCropping && (
              <button
                type="button"
                onClick={() => setShowCropper(true)}
                className="text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center"
              >
                <Crop className="h-4 w-4 mr-1" />
                Recortar
              </button>
            )}
          </div>
          
          {/* Opciones de transformación */}
          {enableTransformations && showTransformOptions && (
            <div className="mt-3 space-y-3 border-t pt-3">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-sm font-medium text-gray-700">Brillo</label>
                  <span className="text-xs text-gray-500">{imageTransformOptions.brightness}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={imageTransformOptions.brightness}
                  onChange={(e) => setImageTransformOptions(prev => ({
                    ...prev,
                    brightness: parseInt(e.target.value)
                  }))}
                  className="w-full"
                />
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-sm font-medium text-gray-700">Contraste</label>
                  <span className="text-xs text-gray-500">{imageTransformOptions.contrast}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={imageTransformOptions.contrast}
                  onChange={(e) => setImageTransformOptions(prev => ({
                    ...prev,
                    contrast: parseInt(e.target.value)
                  }))}
                  className="w-full"
                />
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-sm font-medium text-gray-700">Saturación</label>
                  <span className="text-xs text-gray-500">{imageTransformOptions.saturation}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={imageTransformOptions.saturation}
                  onChange={(e) => setImageTransformOptions(prev => ({
                    ...prev,
                    saturation: parseInt(e.target.value)
                  }))}
                  className="w-full"
                />
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-sm font-medium text-gray-700">Desenfoque</label>
                  <span className="text-xs text-gray-500">{imageTransformOptions.blur}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.5"
                  value={imageTransformOptions.blur}
                  onChange={(e) => setImageTransformOptions(prev => ({
                    ...prev,
                    blur: parseFloat(e.target.value)
                  }))}
                  className="w-full"
                />
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="grayscale"
                  checked={imageTransformOptions.grayscale}
                  onChange={(e) => setImageTransformOptions(prev => ({
                    ...prev,
                    grayscale: e.target.checked
                  }))}
                  className="mr-2 h-4 w-4"
                />
                <label htmlFor="grayscale" className="text-sm font-medium text-gray-700">
                  Escala de grises
                </label>
              </div>
              
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setImageTransformOptions({
                    brightness: 100,
                    contrast: 100,
                    saturation: 100,
                    blur: 0,
                    grayscale: false
                  })}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Restablecer valores
                </button>
              </div>
            </div>
          )}
          
          <div className="mt-4 flex justify-between">
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => {
                  setPreviewImage(null);
                  setShowTransformOptions(false);
                  if (isCameraActive) {
                    // Volver a la cámara
                  } else {
                    // Volver a la selección de archivo
                    fileInputRef.current?.click();
                  }
                }}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 bg-white hover:bg-gray-50"
                disabled={processing}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Cambiar
              </button>
            </div>
            
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => {
                  setPreviewImage(null);
                  setIsCameraActive(false);
                  setShowTransformOptions(false);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                disabled={processing}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmImage}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 flex items-center"
                disabled={processing}
              >
                {processing ? (
                  <div className="flex items-center">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    <div className="flex flex-col">
                      <span>{processingState || 'Procesando...'}</span>
                      {processingProgress > 0 && (
                        <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                          <div 
                            className="bg-white h-1 rounded-full" 
                            style={{ width: `${processingProgress}%` }}
                          ></div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Confirmar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Si la cámara está activa, mostrar la cámara
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white p-4 rounded-lg max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">Tomar foto de perfil</h3>
          <button
            type="button"
            onClick={() => {
              setIsCameraActive(false);
              onCancel();
            }}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <div className="relative">
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            className="w-full rounded-lg"
            videoConstraints={{
              facingMode: { ideal: 'user' }
            }}
          />
        </div>
        
        <div className="mt-4 flex justify-end space-x-2">
          <button
            type="button"
            onClick={() => setIsCameraActive(false)}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={capture}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
          >
            Capturar
          </button>
        </div>
      </div>
    </div>
  );
};

export default PhotoCapture;

// Usage example
/*
{showPhotoCapture && (
  <PhotoCapture
    onCapture={async (file: File) => {
      await handlePhotoUpload(file);
      setShowPhotoCapture(false);
    }}
    onCancel={() => setShowPhotoCapture(false)}
  />
)}
*/