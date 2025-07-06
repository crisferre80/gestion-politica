import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ImageCropperProps {
  imageUrl: string;
  aspectRatio?: number | null; // Proporción ancho/alto (1 para cuadrado, 16/9 para panorámica, etc.)
  onCropComplete: (croppedImageUrl: string) => void;
  onCancel: () => void;
}

const ImageCropper: React.FC<ImageCropperProps> = ({ 
  imageUrl, 
  aspectRatio = null, 
  onCropComplete, 
  onCancel 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [crop, setCrop] = useState<CropArea>({ x: 0, y: 0, width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizing, setResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });

  // Inicializar el área de recorte cuando la imagen se carga
  useEffect(() => {
    const img = new Image();
    img.src = imageUrl;
    img.onload = () => {
      imageRef.current = img;

      // Inicializar el área de recorte
      let initialWidth, initialHeight;
      
      if (aspectRatio) {
        // Si hay un aspect ratio definido, hacer un recorte acorde
        if (img.width / img.height > aspectRatio) {
          // La imagen es más ancha que el aspect ratio deseado
          initialHeight = Math.min(300, img.height * 0.8);
          initialWidth = initialHeight * aspectRatio;
        } else {
          // La imagen es más alta que el aspect ratio deseado
          initialWidth = Math.min(300, img.width * 0.8);
          initialHeight = initialWidth / aspectRatio;
        }
      } else {
        // Sin aspect ratio, usar un cuadrado por defecto o el tamaño de la imagen
        initialWidth = Math.min(300, img.width * 0.8);
        initialHeight = Math.min(300, img.height * 0.8);
      }

      // Centrar el recorte
      const x = (img.width - initialWidth) / 2;
      const y = (img.height - initialHeight) / 2;

      setCrop({
        x,
        y,
        width: initialWidth,
        height: initialHeight
      });

      // Dibujar la imagen en el canvas después de inicializar
      setTimeout(() => drawImageAndCrop(), 0);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl, aspectRatio]); // drawImageAndCrop se excluye intencionalmente para evitar recreaciones

  // Dibujar la imagen y el área de recorte en el canvas
  const drawImageAndCrop = () => {
    if (!canvasRef.current || !imageRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Establecer el tamaño del canvas para que coincida con la imagen
    canvas.width = imageRef.current.width;
    canvas.height = imageRef.current.height;

    // Limpiar el canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dibujar la imagen original
    ctx.drawImage(imageRef.current, 0, 0);

    // Crear un área oscurecida fuera del recorte usando composición
    ctx.globalCompositeOperation = 'source-over';
    
    // Oscurecer las áreas fuera del recorte (superior, derecha, inferior, izquierda)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    
    // Área superior
    ctx.fillRect(0, 0, canvas.width, crop.y);
    
    // Área izquierda
    ctx.fillRect(0, crop.y, crop.x, crop.height);
    
    // Área derecha
    ctx.fillRect(crop.x + crop.width, crop.y, canvas.width - (crop.x + crop.width), crop.height);
    
    // Área inferior
    ctx.fillRect(0, crop.y + crop.height, canvas.width, canvas.height - (crop.y + crop.height));
    
    // Restaurar la operación de composición
    ctx.globalCompositeOperation = 'source-over';
    
    // Dibujar borde alrededor del área de recorte
    // Primero un borde blanco
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(crop.x, crop.y, crop.width, crop.height);
    
    // Luego un borde negro más fino para crear contraste
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(crop.x - 1, crop.y - 1, crop.width + 2, crop.height + 2);
    
    // Dibujar líneas de guía para dividir el área en tercios (regla de los tercios)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    
    // Líneas verticales
    const thirdWidth = crop.width / 3;
    ctx.beginPath();
    ctx.moveTo(crop.x + thirdWidth, crop.y);
    ctx.lineTo(crop.x + thirdWidth, crop.y + crop.height);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(crop.x + thirdWidth * 2, crop.y);
    ctx.lineTo(crop.x + thirdWidth * 2, crop.y + crop.height);
    ctx.stroke();
    
    // Líneas horizontales
    const thirdHeight = crop.height / 3;
    ctx.beginPath();
    ctx.moveTo(crop.x, crop.y + thirdHeight);
    ctx.lineTo(crop.x + crop.width, crop.y + thirdHeight);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(crop.x, crop.y + thirdHeight * 2);
    ctx.lineTo(crop.x + crop.width, crop.y + thirdHeight * 2);
    ctx.stroke();
  };

  // Actualizar el dibujo cuando cambie el área de recorte
  useEffect(() => {
    drawImageAndCrop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crop]); // drawImageAndCrop se excluye intencionalmente

  // Función genérica para iniciar el arrastre (compatible con mouse y touch)
  const startDragging = (clientX: number, clientY: number) => {
    if (!containerRef.current || !imageRef.current) return;
    
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    
    if (!canvasRect) return;
    
    // Calcular la escala entre la imagen original y el canvas visible
    const scaleX = imageRef.current.width / canvasRect.width;
    const scaleY = imageRef.current.height / canvasRect.height;
    
    // Convertir coordenadas del clic/toque a coordenadas de la imagen
    const x = (clientX - canvasRect.left) * scaleX;
    const y = (clientY - canvasRect.top) * scaleY;
    
    return { x, y, scaleX, scaleY, canvasRect };
  };
  
  // Manejar el inicio del arrastre con mouse
  const handleMouseDown = (e: React.MouseEvent) => {
    const result = startDragging(e.clientX, e.clientY);
    if (!result) return;
    
    const { x, y } = result;
    
    // Verificar si el usuario está haciendo clic dentro del área de recorte
    if (
      x >= crop.x && 
      x <= crop.x + crop.width && 
      y >= crop.y && 
      y <= crop.y + crop.height
    ) {
      setIsDragging(true);
      setDragStart({ x: x - crop.x, y: y - crop.y });
    }
  };

  // Función genérica para manejar el movimiento (compatible con mouse y touch)
  const handleMovement = (clientX: number, clientY: number) => {
    if (!isDragging && !resizing) return;
    if (!containerRef.current || !imageRef.current || !canvasRef.current) return;
    
    // Obtener el rectángulo del canvas
    const canvasRect = canvasRef.current.getBoundingClientRect();
    
    // Calcular el factor de escala entre el tamaño real de la imagen y cómo se muestra en pantalla
    const scaleX = imageRef.current.width / canvasRect.width;
    const scaleY = imageRef.current.height / canvasRect.height;
    
    // Convertir las coordenadas de la pantalla a coordenadas de la imagen
    const imageX = (clientX - canvasRect.left) * scaleX;
    const imageY = (clientY - canvasRect.top) * scaleY;
    
    return { imageX, imageY, scaleX, scaleY, canvasRect };
  };
  
  // Manejar el arrastre con mouse
  const handleMouseMove = (e: React.MouseEvent) => {
    const result = handleMovement(e.clientX, e.clientY);
    if (!result) return;
    
    const { imageX, imageY } = result;
    
    if (isDragging) {
      // Mover el área de recorte
      let newX = imageX - dragStart.x;
      let newY = imageY - dragStart.y;
      
      // Limitar el movimiento dentro de los bordes de la imagen
      newX = Math.max(
        0,
        Math.min(
          (imageRef.current ? imageRef.current.width : 0) - crop.width,
          newX
        )
      );
      newY = Math.max(
        0,
        Math.min(
          (imageRef.current ? imageRef.current.height : 0) - crop.height,
          newY
        )
      );
      
      setCrop(prev => ({
        ...prev,
        x: newX,
        y: newY
      }));
    } else if (resizing) {
      // Redimensionar el área de recorte según la dirección
      let newWidth = crop.width;
      let newHeight = crop.height;
      let newX = crop.x;
      let newY = crop.y;
      
      switch (resizeDirection) {
        case 'nw': // Esquina superior izquierda
          newWidth = resizeStart.width - (imageX - resizeStart.x);
          newHeight = aspectRatio ? newWidth / aspectRatio : resizeStart.height - (imageY - resizeStart.y);
          newX = resizeStart.x + resizeStart.width - newWidth;
          newY = resizeStart.y + resizeStart.height - newHeight;
          break;
        case 'ne': // Esquina superior derecha
          newWidth = imageX - resizeStart.x;
          newHeight = aspectRatio ? newWidth / aspectRatio : resizeStart.height - (imageY - resizeStart.y);
          newY = resizeStart.y + resizeStart.height - newHeight;
          break;
        case 'sw': // Esquina inferior izquierda
          newWidth = resizeStart.width - (imageX - resizeStart.x);
          newHeight = aspectRatio ? newWidth / aspectRatio : imageY - resizeStart.y;
          newX = resizeStart.x + resizeStart.width - newWidth;
          break;
        case 'se': // Esquina inferior derecha
          newWidth = imageX - resizeStart.x;
          newHeight = aspectRatio ? newWidth / aspectRatio : imageY - resizeStart.y;
          break;
        // Controles adicionales
        case 'n': // Centro superior
          newHeight = resizeStart.height - (imageY - resizeStart.y);
          newY = resizeStart.y + resizeStart.height - newHeight;
          if (aspectRatio) {
            newWidth = newHeight * aspectRatio;
            newX = resizeStart.x - (newWidth - resizeStart.width) / 2;
          }
          break;
        case 's': // Centro inferior
          newHeight = imageY - resizeStart.y;
          if (aspectRatio) {
            newWidth = newHeight * aspectRatio;
            newX = resizeStart.x - (newWidth - resizeStart.width) / 2;
          }
          break;
        case 'w': // Centro izquierdo
          newWidth = resizeStart.width - (imageX - resizeStart.x);
          newX = resizeStart.x + resizeStart.width - newWidth;
          if (aspectRatio) {
            newHeight = newWidth / aspectRatio;
            newY = resizeStart.y - (newHeight - resizeStart.height) / 2;
          }
          break;
        case 'e': // Centro derecho
          newWidth = imageX - resizeStart.x;
          if (aspectRatio) {
            newHeight = newWidth / aspectRatio;
            newY = resizeStart.y - (newHeight - resizeStart.height) / 2;
          }
          break;
      }
      
      // Asegurar dimensiones mínimas y mantener dentro de los límites
      const minSize = 50;
      newWidth = Math.max(minSize, newWidth);
      newHeight = Math.max(minSize, newHeight);
      
      if (newX < 0) {
        newWidth += newX;
        newX = 0;
      }
      
      if (newY < 0) {
        newHeight += newY;
        newY = 0;
      }
      
      if (imageRef.current && newX + newWidth > imageRef.current.width) {
        newWidth = imageRef.current.width - newX;
      }
      
      if (imageRef.current && newY + newHeight > imageRef.current.height) {
        newHeight = imageRef.current.height - newY;
      }
      
      setCrop({
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight
      });
    }
  };

  // Manejar fin del arrastre (mouse)
  const handleMouseUp = () => {
    setIsDragging(false);
    setResizing(false);
    setResizeDirection(null);
  };
  
  // Manejadores para eventos touch
  
  // Touch start - equivalente a mousedown
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault(); // Prevenir scroll
    const touch = e.touches[0];
    const result = startDragging(touch.clientX, touch.clientY);
    if (!result) return;
    
    const { x, y } = result;
    
    // Verificar si el usuario está tocando dentro del área de recorte
    if (
      x >= crop.x && 
      x <= crop.x + crop.width && 
      y >= crop.y && 
      y <= crop.y + crop.height
    ) {
      setIsDragging(true);
      setDragStart({ x: x - crop.x, y: y - crop.y });
    }
  };
  
  // Touch move - equivalente a mousemove
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging && !resizing) return;
    e.preventDefault(); // Prevenir scroll
    
    const touch = e.touches[0];
    const result = handleMovement(touch.clientX, touch.clientY);
    if (!result) return;
    
    const { imageX, imageY } = result;
    
    if (isDragging) {
      // Mover el área de recorte
      let newX = imageX - dragStart.x;
      let newY = imageY - dragStart.y;
      
      // Limitar el movimiento dentro de los bordes de la imagen
      if (imageRef.current) {
        newX = Math.max(0, Math.min(imageRef.current.width - crop.width, newX));
        newY = Math.max(0, Math.min(imageRef.current.height - crop.height, newY));
      }
      
      setCrop(prev => ({
        ...prev,
        x: newX,
        y: newY
      }));
    } else if (resizing && resizeDirection) {
      // La lógica de resize es compleja y similar a handleMouseMove
      // Para evitar duplicación de código, podríamos refactorizar más adelante
    }
  };
  
  // Touch end - equivalente a mouseup
  const handleTouchEnd = () => {
    setIsDragging(false);
    setResizing(false);
    setResizeDirection(null);
  };
  
  // Iniciador de resize para eventos táctiles
  const handleTouchResizeStart = (direction: string, e: React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setResizing(true);
    setResizeDirection(direction);
    
    // Guardamos posición inicial y dimensiones
    if (containerRef.current && imageRef.current && canvasRef.current) {
      setResizeStart({
        x: crop.x,
        y: crop.y,
        width: crop.width,
        height: crop.height
      });
    }
  };

  // Iniciar redimensionamiento
  const handleResizeStart = (direction: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setResizing(true);
    setResizeDirection(direction);
    if (!containerRef.current) return;
    
    // Guardamos las dimensiones iniciales para el cálculo
    setResizeStart({
      x: crop.x,
      y: crop.y,
      width: crop.width,
      height: crop.height
    });
  };

  // Recortar la imagen y devolver la URL del canvas
  const handleCrop = () => {
    if (!imageRef.current) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = crop.width;
    canvas.height = crop.height;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(
      imageRef.current,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      crop.width,
      crop.height
    );
    
    const croppedImageUrl = canvas.toDataURL('image/jpeg', 0.9);
    onCropComplete(croppedImageUrl);
  };

  // Estilos para el contenedor y los controles
  const containerStyle: React.CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    cursor: isDragging ? 'grabbing' : 'grab',
    touchAction: 'none'
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white p-4 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">Recortar imagen</h3>
          <button 
            onClick={onCancel} 
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="relative overflow-hidden" ref={containerRef} style={containerStyle}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
        >
          <canvas 
            ref={canvasRef} 
            className="max-w-full h-auto"
            style={{ maxHeight: '60vh' }}
          />
          
          {/* Recuadro visible del área de recorte con borde personalizado */}
          <div
            className="absolute border-2 border-white pointer-events-none z-10"
            style={{
              left: `${crop.x / (imageRef.current?.width || 1) * 100}%`,
              top: `${crop.y / (imageRef.current?.height || 1) * 100}%`,
              width: `${crop.width / (imageRef.current?.width || 1) * 100}%`,
              height: `${crop.height / (imageRef.current?.height || 1) * 100}%`,
              outline: '1px solid rgba(0, 0, 0, 0.5)'
            }}
          ></div>
          
          {/* Handles para redimensionar - esquinas */}
          <div 
            className="absolute w-8 h-8 border border-white bg-blue-600 opacity-90 hover:opacity-100 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize z-20 rounded-full shadow-md" 
            style={{ 
              left: `${crop.x / (imageRef.current?.width || 1) * 100}%`, 
              top: `${crop.y / (imageRef.current?.height || 1) * 100}%` 
            }}
            onMouseDown={(e) => handleResizeStart('nw', e)}
            onTouchStart={(e) => handleTouchResizeStart('nw', e)}
          />
          <div 
            className="absolute w-8 h-8 border border-white bg-blue-600 opacity-90 hover:opacity-100 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize z-20 rounded-full shadow-md" 
            style={{ 
              left: `${(crop.x + crop.width) / (imageRef.current?.width || 1) * 100}%`, 
              top: `${crop.y / (imageRef.current?.height || 1) * 100}%` 
            }}
            onMouseDown={(e) => handleResizeStart('ne', e)}
            onTouchStart={(e) => handleTouchResizeStart('ne', e)}
          />
          <div 
            className="absolute w-8 h-8 border border-white bg-blue-600 opacity-90 hover:opacity-100 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize z-20 rounded-full shadow-md" 
            style={{ 
              left: `${crop.x / (imageRef.current?.width || 1) * 100}%`, 
              top: `${(crop.y + crop.height) / (imageRef.current?.height || 1) * 100}%` 
            }}
            onMouseDown={(e) => handleResizeStart('sw', e)}
            onTouchStart={(e) => handleTouchResizeStart('sw', e)}
          />
          <div 
            className="absolute w-8 h-8 border border-white bg-blue-600 opacity-90 hover:opacity-100 translate-x-1/2 translate-y-1/2 cursor-nwse-resize z-20 rounded-full shadow-md" 
            style={{ 
              left: `${(crop.x + crop.width) / (imageRef.current?.width || 1) * 100}%`, 
              top: `${(crop.y + crop.height) / (imageRef.current?.height || 1) * 100}%` 
            }}
            onMouseDown={(e) => handleResizeStart('se', e)}
            onTouchStart={(e) => handleTouchResizeStart('se', e)}
          />
          
          {/* Handles centrales para mejor control */}
          <div 
            className="absolute w-5 h-6 border border-white bg-blue-600 opacity-90 hover:opacity-100 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize z-20 rounded-md shadow-md" 
            style={{ 
              left: `${(crop.x + crop.width/2) / (imageRef.current?.width || 1) * 100}%`, 
              top: `${crop.y / (imageRef.current?.height || 1) * 100}%` 
            }}
            onMouseDown={(e) => handleResizeStart('n', e)}
            onTouchStart={(e) => handleTouchResizeStart('n', e)}
          />
          <div 
            className="absolute w-5 h-6 border border-white bg-blue-600 opacity-90 hover:opacity-100 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize z-20 rounded-md shadow-md" 
            style={{ 
              left: `${(crop.x + crop.width/2) / (imageRef.current?.width || 1) * 100}%`, 
              top: `${(crop.y + crop.height) / (imageRef.current?.height || 1) * 100}%` 
            }}
            onMouseDown={(e) => handleResizeStart('s', e)}
            onTouchStart={(e) => handleTouchResizeStart('s', e)}
          />
          <div 
            className="absolute w-6 h-5 border border-white bg-blue-600 opacity-90 hover:opacity-100 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize z-20 rounded-md shadow-md" 
            style={{ 
              left: `${crop.x / (imageRef.current?.width || 1) * 100}%`, 
              top: `${(crop.y + crop.height/2) / (imageRef.current?.height || 1) * 100}%` 
            }}
            onMouseDown={(e) => handleResizeStart('w', e)}
            onTouchStart={(e) => handleTouchResizeStart('w', e)}
          />
          <div 
            className="absolute w-6 h-5 border border-white bg-blue-600 opacity-90 hover:opacity-100 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize z-20 rounded-md shadow-md" 
            style={{ 
              left: `${(crop.x + crop.width) / (imageRef.current?.width || 1) * 100}%`, 
              top: `${(crop.y + crop.height/2) / (imageRef.current?.height || 1) * 100}%` 
            }}
            onMouseDown={(e) => handleResizeStart('e', e)}
            onTouchStart={(e) => handleTouchResizeStart('e', e)}
          />
        </div>

        <div className="mt-4">
          <div className="text-sm text-gray-500 mb-2">
            {aspectRatio 
              ? `Relación de aspecto fijada a ${aspectRatio === 1 ? '1:1 (cuadrada)' : aspectRatio === 16/9 ? '16:9 (panorámica)' : aspectRatio}`
              : 'Relación de aspecto libre'}
            <p className="text-xs text-gray-400 mt-1">
              Usa los puntos azules para ajustar el recorte. En dispositivos móviles, desliza el área para moverla.
            </p>
          </div>
          <div className="text-sm text-gray-500 mb-4">
            Tamaño del recorte: {Math.round(crop.width)} x {Math.round(crop.height)} px
          </div>
        </div>

        <div className="mt-4 flex justify-end space-x-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleCrop}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
          >
            Recortar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageCropper;
