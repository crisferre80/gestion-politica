/**
 * Servicio para la transformación de imágenes completamente en el cliente
 * Este servicio permite procesar imágenes antes de subirlas o mostrarlas
 */
export interface ImageTransformOptions {
  width?: number;       // Ancho deseado para la imagen
  height?: number;      // Alto deseado para la imagen
  quality?: number;     // Calidad de la imagen (1-100)
  format?: 'webp' | 'jpeg' | 'png'; // Formato de salida
  blur?: number;        // Valor de desenfoque (0-10)
  brightness?: number;  // Brillo (0-200, 100 es normal)
  contrast?: number;    // Contraste (0-200, 100 es normal)
  saturation?: number;  // Saturación (0-200, 100 es normal)
  grayscale?: boolean;  // Convertir a escala de grises
  name?: string;        // Nombre para identificar la operación
}

export interface ImageTransformResponse {
  url: string;          // URL o data URL de la imagen transformada
  size: number;         // Tamaño de la imagen resultante (en bytes)
  format: string;       // Formato final de la imagen
  width: number;        // Ancho final
  height: number;       // Alto final
  success: boolean;     // Si la operación fue exitosa
  error?: string;       // Mensaje de error si hubo algún problema
}

/**
 * Transforma una imagen completamente en el cliente usando Canvas API
 * @param imageUrl URL o Base64 de la imagen a transformar
 * @param options Opciones de transformación
 * @returns Respuesta con información de la imagen transformada
 */
export const transformImage = async (
  imageUrl: string,
  options: ImageTransformOptions
): Promise<ImageTransformResponse> => {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      
      img.onload = () => {
        // Calcular dimensiones finales manteniendo relación de aspecto
        let targetWidth = options.width || img.width;
        let targetHeight = options.height || img.height;
        
        // Si ambas dimensiones están especificadas, calculamos el recorte o ajuste
        if (options.width && options.height) {
          // Decidir si recortamos o ajustamos según la relación de aspecto
          const sourceRatio = img.width / img.height;
          const targetRatio = targetWidth / targetHeight;
          
          // Por ahora solo ajustamos (no recortamos)
          if (sourceRatio > targetRatio) {
            // La imagen es más ancha que el target
            targetHeight = targetWidth / sourceRatio;
          } else {
            // La imagen es más alta que el target
            targetWidth = targetHeight * sourceRatio;
          }
        } else if (options.width) {
          // Solo se especificó ancho, calcular altura manteniendo relación
          targetHeight = (img.height / img.width) * targetWidth;
        } else if (options.height) {
          // Solo se especificó altura, calcular ancho manteniendo relación
          targetWidth = (img.width / img.height) * targetHeight;
        }
        
        // Crear canvas con las dimensiones calculadas
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({
            success: false,
            error: 'No se pudo crear el contexto de canvas',
            url: imageUrl,
            size: 0,
            format: 'unknown',
            width: img.width,
            height: img.height
          });
          return;
        }
        
        // Aplicar suavizado para mejor calidad
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Aplicar filtros si hay transformaciones adicionales
        const filters = [];
        
        // Aplicar brillo
        if (options.brightness !== undefined && options.brightness !== 100) {
          filters.push(`brightness(${options.brightness}%)`);
        }
        
        // Aplicar contraste
        if (options.contrast !== undefined && options.contrast !== 100) {
          filters.push(`contrast(${options.contrast}%)`);
        }
        
        // Aplicar saturación
        if (options.saturation !== undefined && options.saturation !== 100) {
          filters.push(`saturate(${options.saturation}%)`);
        }
        
        // Aplicar desenfoque
        if (options.blur !== undefined && options.blur > 0) {
          filters.push(`blur(${options.blur}px)`);
        }
        
        // Aplicar escala de grises
        if (options.grayscale) {
          filters.push('grayscale(100%)');
        }
        
        // Establecer los filtros en el contexto
        if (filters.length > 0) {
          ctx.filter = filters.join(' ');
        }
        
        // Dibujar la imagen con todas las transformaciones
        // Usamos un enfoque de paso doble para mejorar la calidad en la reducción de resolución
        if (img.width > targetWidth * 2 || img.height > targetHeight * 2) {
          // Para imágenes muy grandes, hacemos una reducción en dos pasos para mejor calidad
          const tempCanvas = document.createElement('canvas');
          const tempCtx = tempCanvas.getContext('2d');
          
          // Paso intermedio al 50% del tamaño original
          const intermediateWidth = Math.floor(img.width / 2);
          const intermediateHeight = Math.floor(img.height / 2);
          
          tempCanvas.width = intermediateWidth;
          tempCanvas.height = intermediateHeight;
          
          if (tempCtx) {
            tempCtx.imageSmoothingEnabled = true;
            tempCtx.imageSmoothingQuality = 'high';
            tempCtx.drawImage(img, 0, 0, intermediateWidth, intermediateHeight);
            
            // Segundo paso al tamaño final
            ctx.drawImage(tempCanvas, 0, 0, targetWidth, targetHeight);
          } else {
            // Si no podemos crear el contexto intermedio, dibujamos directamente
            ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
          }
        } else {
          // Para imágenes más pequeñas, dibujamos directamente
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        }
        
        // Determinar el formato de salida (usar JPEG por compatibilidad con Supabase Storage)
        const format = options.format || 'jpeg';
        const mimeType = format === 'png' ? 'image/png' : 'image/jpeg'; // Ya no usamos WebP porque Supabase no lo soporta
        
        // Calidad de la imagen (0-1)
        const quality = (options.quality !== undefined ? options.quality : 85) / 100;
        
        // Verificar si necesitamos reducir más las dimensiones para casos de imágenes muy grandes
        const maxTargetDimension = 1500; // Máximo absoluto para cualquier dimensión
        let outputCanvas = canvas;
        
        if (canvas.width > maxTargetDimension || canvas.height > maxTargetDimension) {
          // Crear un canvas más pequeño para la salida final
          outputCanvas = document.createElement('canvas');
          const ratio = canvas.width / canvas.height;
          
          if (canvas.width > canvas.height) {
            outputCanvas.width = maxTargetDimension;
            outputCanvas.height = Math.round(maxTargetDimension / ratio);
          } else {
            outputCanvas.height = maxTargetDimension;
            outputCanvas.width = Math.round(maxTargetDimension * ratio);
          }
          
          const outputCtx = outputCanvas.getContext('2d');
          if (outputCtx) {
            outputCtx.imageSmoothingEnabled = true;
            outputCtx.imageSmoothingQuality = 'high';
            outputCtx.drawImage(canvas, 0, 0, outputCanvas.width, outputCanvas.height);
          }
        }
        
        // Convertir a Data URL con la calidad especificada
        const dataUrl = outputCanvas.toDataURL(mimeType, quality);
        
        // Calcular tamaño aproximado (eliminando el encabezado data:image)
        const base64 = dataUrl.split(',')[1];
        const byteSize = Math.ceil((base64.length * 3) / 4);
        
        // Devolver la respuesta
        resolve({
          success: true,
          url: dataUrl,
          format: format,
          width: targetWidth,
          height: targetHeight,
          size: byteSize
        });
      };
      
      // Manejar error al cargar la imagen
      img.onerror = () => {
        resolve({
          success: false,
          error: 'Error al cargar la imagen original',
          url: imageUrl,
          size: 0,
          format: 'unknown',
          width: 0,
          height: 0
        });
      };
      
      // Iniciar carga de la imagen
      img.src = imageUrl;
      
    } catch (err) {
      resolve({
        success: false,
        error: err instanceof Error ? err.message : 'Error desconocido',
        url: imageUrl,
        size: 0,
        format: 'unknown',
        width: 0,
        height: 0
      });
    }
  });
};

/**
 * Optimiza una imagen para su uso en la aplicación (tamaño medio)
 * @param imageUrl URL o base64 de la imagen a optimizar
 * @returns URL de la imagen optimizada
 */
export const optimizeImage = async (imageUrl: string): Promise<string | null> => {
  const result = await transformImage(imageUrl, {
    width: 800, // Ancho máximo para uso general
    quality: 85,
    format: 'webp',
    name: 'optimize'
  });
  
  return result.success ? result.url : null;
};

/**
 * Genera una miniatura de una imagen para previsualizaciones
 * @param imageUrl URL o base64 de la imagen original
 * @returns URL de la miniatura
 */
export const createThumbnail = async (imageUrl: string): Promise<string | null> => {
  const result = await transformImage(imageUrl, {
    width: 200,
    height: 200,
    quality: 70,
    format: 'webp',
    name: 'thumbnail'
  });
  
  return result.success ? result.url : null;
};

/**
 * Prepara una imagen para ser subida, reduciendo su tamaño si es muy grande
 * @param file Archivo de imagen a preparar
 * @param maxSizeKB Tamaño máximo en kilobytes (2048 por defecto)
 * @returns Base64 de la imagen preparada
 */
export const prepareImageForUpload = async (file: File, maxSizeKB: number = 2048): Promise<string | null> => {
  const MAX_SIZE_BYTES = maxSizeKB * 1024; // Convertir KB a bytes

  // Convertir el archivo a base64
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = async () => {
      if (typeof reader.result === 'string') {
        // Siempre procesamos la imagen para garantizar que cumpla con el tamaño máximo
        try {
          // Determinar dimensiones iniciales basadas en el límite de tamaño
          let initialWidth = 1200;
          let initialQuality = 85;
          
          // Si el tamaño máximo es para avatar (300KB), empezamos con valores más conservadores
          if (MAX_SIZE_BYTES <= 300 * 1024) {
            initialWidth = 500; // Dimensión inicial más pequeña para avatar
            initialQuality = 65; // Calidad inicial más baja para garantizar tamaño menor
          } else if (MAX_SIZE_BYTES <= 800 * 1024) {
            initialWidth = 800; // Dimensión media para cabeceras
            initialQuality = 70; // Calidad inicial un poco más baja para cabeceras
          }

          // Primera pasada: intentar con dimensiones adaptadas al límite
          let result = await transformImage(reader.result, {
            width: initialWidth,
            quality: initialQuality,
            format: 'jpeg', // Usar JPEG en lugar de WebP por compatibilidad con Supabase
            name: 'upload-preparation'
          });
          
          // Verificar el tamaño resultante
          let currentSize = result.size;
          let attempts = 0;
          const maxAttempts = 3;
          let currentQuality = initialQuality;
          let currentWidth = initialWidth;

          // Reducir progresivamente calidad y dimensiones si el tamaño sigue siendo demasiado grande
          while (currentSize > MAX_SIZE_BYTES && attempts < maxAttempts) {
            attempts++;
            
            // Ajustar la estrategia de reducción según el tamaño máximo permitido
            if (MAX_SIZE_BYTES <= 300 * 1024) {
              // Estrategia muy agresiva para avatar (300KB estricto)
              if (attempts === 1) {
                currentQuality = 55;
                currentWidth = Math.round(currentWidth * 0.8); // 20% más pequeña
              } else if (attempts === 2) {
                currentQuality = 40;
                currentWidth = Math.round(currentWidth * 0.6); // 40% más pequeña que la original
              } else {
                currentQuality = 30;
                currentWidth = Math.min(300, Math.round(currentWidth * 0.5)); // Máximo 300px
              }
            } else if (MAX_SIZE_BYTES <= 800 * 1024) {
              // Estrategia agresiva para cabeceras (800KB estricto)
              if (attempts === 1) {
                currentQuality = 60;
                currentWidth = Math.round(currentWidth * 0.85); // 15% más pequeña
              } else if (attempts === 2) {
                currentQuality = 45;
                currentWidth = Math.round(currentWidth * 0.7); // 30% más pequeña que la original
              } else {
                currentQuality = 35;
                currentWidth = Math.min(500, Math.round(currentWidth * 0.6)); // Máximo 500px
              }
            } else {
              // Estrategia original para otros casos (2MB)
              if (attempts === 1) {
                currentQuality = 65;
              } else if (attempts === 2) {
                currentQuality = 50;
                currentWidth = Math.min(1000, Math.round(currentWidth * 0.9));
              } else {
                currentQuality = 40;
                currentWidth = Math.min(800, Math.round(currentWidth * 0.8));
              }
            }
            
            // Aplicar nueva transformación
            console.log(`Intento ${attempts+1}: Reduciendo a calidad ${currentQuality}% y ancho ${currentWidth}px`);
            
            result = await transformImage(reader.result, {
              width: currentWidth,
              quality: currentQuality,
              format: 'jpeg',
              name: `upload-compression-${attempts}`
            });
            
            currentSize = result.size;
            console.log(`Nuevo tamaño: ${(currentSize / 1024).toFixed(2)} KB (límite: ${MAX_SIZE_BYTES/1024} KB)`);
          }
          
          if (result.success) {
            resolve(result.url);
          } else {
            // Si hay error, aplicamos una última transformación extremadamente agresiva
            // Ajustar parámetros según el tamaño límite
            let lastResortWidth = 600;
            let lastResortQuality = 30;
            
            if (MAX_SIZE_BYTES <= 300 * 1024) {
              lastResortWidth = 250; // Extremadamente pequeño para avatar
              lastResortQuality = 15; // Calidad mínima para garantizar el tamaño
            } else if (MAX_SIZE_BYTES <= 800 * 1024) {
              lastResortWidth = 400; // Muy pequeño para header
              lastResortQuality = 20; // Calidad muy baja para garantizar el tamaño
            }
            
            const lastAttempt = await transformImage(reader.result, {
              width: lastResortWidth, 
              quality: lastResortQuality,
              format: 'jpeg',
              name: 'upload-last-resort'
            });
            
            if (lastAttempt.success) {
              resolve(lastAttempt.url);
            } else {
              // Si todo falla, devolvemos la original con advertencia
              console.warn(`No se pudo comprimir la imagen por debajo de ${MAX_SIZE_BYTES/1024}KB`);
              resolve(reader.result);
            }
          }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (e) {
          // En caso de error, devolver la imagen original con advertencia
          console.warn('Error al comprimir la imagen');
          resolve(reader.result);
        }
      } else {
        resolve(null);
      }
    };
    reader.readAsDataURL(file);
  });
};
