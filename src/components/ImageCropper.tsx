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
    
    // Usar un oscurecimiento más sutil para que el usuario pueda ver mejor la imagen completa
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    
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
    // Borde blanco más prominente
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 2;
    ctx.strokeRect(crop.x, crop.y, crop.width, crop.height);
    
    // Crear un borde exterior negro más fino para mejor contraste
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(crop.x - 1, crop.y - 1, crop.width + 2, crop.height + 2);
    
    // Dibujar líneas de guía para dividir el área en tercios (regla de los tercios) - versión más sutil
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 0.5;
    
    // Líneas verticales
    const thirdWidth = crop.width / 3;
    const thirdHeight = crop.height / 3;
    
    // Usar líneas más sutiles, especialmente en móviles
    const dashPattern = isMobile ? [2, 5] : [3, 3];
    ctx.setLineDash(dashPattern);
    
    // Dibujar las líneas de los tercios
    for (let i = 1; i < 3; i++) {
      // Líneas verticales
      ctx.beginPath();
      ctx.moveTo(crop.x + thirdWidth * i, crop.y);
      ctx.lineTo(crop.x + thirdWidth * i, crop.y + crop.height);
      ctx.stroke();
      
      // Líneas horizontales
      ctx.beginPath();
      ctx.moveTo(crop.x, crop.y + thirdHeight * i);
      ctx.lineTo(crop.x + crop.width, crop.y + thirdHeight * i);
      ctx.stroke();
    }
    
    // Restaurar el estilo de línea
    ctx.setLineDash([]);
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
  
  // Touch start - optimizado para móviles
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault(); // Prevenir scroll
    const touch = e.touches[0];
    const result = startDragging(touch.clientX, touch.clientY);
    if (!result) return;
    
    const { x, y } = result;
    
    // Verificar si el usuario está tocando dentro del área de recorte
    const isInsideCropArea = (
      x >= crop.x && 
      x <= crop.x + crop.width && 
      y >= crop.y && 
      y <= crop.y + crop.height
    );
    
    // Verificar si el usuario está cerca de las esquinas (para redimensionar)
    const cornerSize = 20; // Área más grande para que sea más fácil tocar las esquinas en móviles
    const corners = [
      { pos: { x: crop.x, y: crop.y }, dir: 'nw' },
      { pos: { x: crop.x + crop.width, y: crop.y }, dir: 'ne' },
      { pos: { x: crop.x, y: crop.y + crop.height }, dir: 'sw' },
      { pos: { x: crop.x + crop.width, y: crop.y + crop.height }, dir: 'se' }
    ];
    
    // Verificar si tocó una esquina
    for (const corner of corners) {
      const distance = Math.sqrt(
        Math.pow(x - corner.pos.x, 2) + Math.pow(y - corner.pos.y, 2)
      );
      
      if (distance < cornerSize) {
        // Si tocó una esquina, comenzar redimensionamiento
        setResizing(true);
        setResizeDirection(corner.dir);
        setResizeStart({
          x: crop.x,
          y: crop.y,
          width: crop.width,
          height: crop.height
        });
        return;
      }
    }
    
    // Si el usuario está tocando dentro del área de recorte o en cualquier parte de la imagen
    // cuando es un dispositivo móvil, permitir mover
    if (isInsideCropArea || (isMobile && x >= 0 && y >= 0 && 
        imageRef.current && 
        x <= imageRef.current.width && 
        y <= imageRef.current.height)) {
      setIsDragging(true);
      // Calcular el punto de arrastre relativo al área de recorte
      // Si está fuera del área, usar el borde más cercano
      setDragStart({
        x: isInsideCropArea ? (x - crop.x) : (x < crop.x ? 0 : crop.width),
        y: isInsideCropArea ? (y - crop.y) : (y < crop.y ? 0 : crop.height)
      });
    }
  };
  
  // Touch move - optimizado para móviles
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
      // Implementar la lógica de resize - similar a handleMouseMove
      let newWidth = crop.width;
      let newHeight = crop.height;
      let newX = crop.x;
      let newY = crop.y;
      
      // Aumentar la sensibilidad en móviles para un mejor control
      const sensitivity = isMobile ? 1.2 : 1.0;
      
      switch (resizeDirection) {
        case 'nw': // Esquina superior izquierda
          newWidth = resizeStart.width - (imageX - resizeStart.x) * sensitivity;
          if (aspectRatio) {
            newHeight = newWidth / aspectRatio;
          } else {
            newHeight = resizeStart.height - (imageY - resizeStart.y) * sensitivity;
          }
          newX = resizeStart.x + resizeStart.width - newWidth;
          newY = resizeStart.y + resizeStart.height - newHeight;
          break;
        case 'ne': // Esquina superior derecha
          newWidth = (imageX - resizeStart.x) * sensitivity;
          if (aspectRatio) {
            newHeight = newWidth / aspectRatio;
          } else {
            newHeight = resizeStart.height - (imageY - resizeStart.y) * sensitivity;
          }
          newY = resizeStart.y + resizeStart.height - newHeight;
          break;
        case 'sw': // Esquina inferior izquierda
          newWidth = resizeStart.width - (imageX - resizeStart.x) * sensitivity;
          if (aspectRatio) {
            newHeight = newWidth / aspectRatio;
          } else {
            newHeight = (imageY - resizeStart.y) * sensitivity;
          }
          newX = resizeStart.x + resizeStart.width - newWidth;
          break;
        case 'se': // Esquina inferior derecha
          newWidth = (imageX - resizeStart.x) * sensitivity;
          if (aspectRatio) {
            newHeight = newWidth / aspectRatio;
          } else {
            newHeight = (imageY - resizeStart.y) * sensitivity;
          }
          break;
        case 'n': // Medio superior
          newHeight = resizeStart.height - (imageY - resizeStart.y) * sensitivity;
          newY = resizeStart.y + resizeStart.height - newHeight;
          if (aspectRatio) {
            newWidth = newHeight * aspectRatio;
            newX = resizeStart.x - (newWidth - resizeStart.width) / 2;
          }
          break;
        case 's': // Medio inferior
          newHeight = (imageY - resizeStart.y) * sensitivity;
          if (aspectRatio) {
            newWidth = newHeight * aspectRatio;
            newX = resizeStart.x - (newWidth - resizeStart.width) / 2;
          }
          break;
        case 'w': // Medio izquierdo
          newWidth = resizeStart.width - (imageX - resizeStart.x) * sensitivity;
          newX = resizeStart.x + resizeStart.width - newWidth;
          if (aspectRatio) {
            newHeight = newWidth / aspectRatio;
            newY = resizeStart.y - (newHeight - resizeStart.height) / 2;
          }
          break;
        case 'e': // Medio derecho
          newWidth = (imageX - resizeStart.x) * sensitivity;
          if (aspectRatio) {
            newHeight = newWidth / aspectRatio;
            newY = resizeStart.y - (newHeight - resizeStart.height) / 2;
          }
          break;
      }
      
      // Asegurar dimensiones mínimas y mantener dentro de los límites
      const minSize = isMobile ? 30 : 50; // Tamaño mínimo más grande en móviles para mejor usabilidad
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
    touchAction: 'none',
    WebkitUserSelect: 'none', // Prevenir selección de texto en móviles
    userSelect: 'none'
  };
  
  // Estado para detectar si es un dispositivo móvil
  const [isMobile, setIsMobile] = useState(false);
  
  // Detectar si es un dispositivo móvil para ajustar la experiencia de usuario
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    };
    
    // Verificar al cargar
    checkMobile();
    
    // Verificar al cambiar el tamaño de la ventana
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Tamaño de los controles basado en si es móvil o no
  const handleSize = isMobile ? 10 : 6;

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
          
          {/* Recuadro visible del área de recorte con borde y sombra mejorados */}
          <div
            className="absolute z-10"
            style={{
              left: `${crop.x / (imageRef.current?.width || 1) * 100}%`,
              top: `${crop.y / (imageRef.current?.height || 1) * 100}%`,
              width: `${crop.width / (imageRef.current?.width || 1) * 100}%`,
              height: `${crop.height / (imageRef.current?.height || 1) * 100}%`,
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.7)',
              border: '2px solid white'
            }}
          ></div>
          
          {/* Handles simplificados para redimensionar - solo esquinas */}
          <div 
            className="absolute -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize z-20" 
            style={{ 
              left: `${crop.x / (imageRef.current?.width || 1) * 100}%`, 
              top: `${crop.y / (imageRef.current?.height || 1) * 100}%`,
              width: `${handleSize}px`,
              height: `${handleSize}px`,
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              border: '1px solid rgba(0, 0, 0, 0.3)',
              borderRadius: '50%'
            }}
            onMouseDown={(e) => handleResizeStart('nw', e)}
            onTouchStart={(e) => handleTouchResizeStart('nw', e)}
          />
          <div 
            className="absolute translate-x-1/2 -translate-y-1/2 cursor-nesw-resize z-20" 
            style={{ 
              left: `${(crop.x + crop.width) / (imageRef.current?.width || 1) * 100}%`, 
              top: `${crop.y / (imageRef.current?.height || 1) * 100}%`,
              width: `${handleSize}px`,
              height: `${handleSize}px`,
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              border: '1px solid rgba(0, 0, 0, 0.3)',
              borderRadius: '50%'
            }}
            onMouseDown={(e) => handleResizeStart('ne', e)}
            onTouchStart={(e) => handleTouchResizeStart('ne', e)}
          />
          <div 
            className="absolute -translate-x-1/2 translate-y-1/2 cursor-nesw-resize z-20" 
            style={{ 
              left: `${crop.x / (imageRef.current?.width || 1) * 100}%`, 
              top: `${(crop.y + crop.height) / (imageRef.current?.height || 1) * 100}%`,
              width: `${handleSize}px`,
              height: `${handleSize}px`,
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              border: '1px solid rgba(0, 0, 0, 0.3)',
              borderRadius: '50%'
            }}
            onMouseDown={(e) => handleResizeStart('sw', e)}
            onTouchStart={(e) => handleTouchResizeStart('sw', e)}
          />
          <div 
            className="absolute translate-x-1/2 translate-y-1/2 cursor-nwse-resize z-20" 
            style={{ 
              left: `${(crop.x + crop.width) / (imageRef.current?.width || 1) * 100}%`, 
              top: `${(crop.y + crop.height) / (imageRef.current?.height || 1) * 100}%`,
              width: `${handleSize}px`,
              height: `${handleSize}px`,
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              border: '1px solid rgba(0, 0, 0, 0.3)',
              borderRadius: '50%'
            }}
            onMouseDown={(e) => handleResizeStart('se', e)}
            onTouchStart={(e) => handleTouchResizeStart('se', e)}
          />
          
          {/* Solo mostrar controladores adicionales en escritorio */}
          {!isMobile && (
            <>
              <div 
                className="absolute -translate-x-1/2 -translate-y-1/2 cursor-ns-resize z-20" 
                style={{ 
                  left: `${(crop.x + crop.width/2) / (imageRef.current?.width || 1) * 100}%`, 
                  top: `${crop.y / (imageRef.current?.height || 1) * 100}%`,
                  width: `${handleSize}px`,
                  height: `${handleSize}px`,
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  border: '1px solid rgba(0, 0, 0, 0.3)',
                  borderRadius: '50%'
                }}
                onMouseDown={(e) => handleResizeStart('n', e)}
              />
              <div 
                className="absolute -translate-x-1/2 -translate-y-1/2 cursor-ns-resize z-20" 
                style={{ 
                  left: `${(crop.x + crop.width/2) / (imageRef.current?.width || 1) * 100}%`, 
                  top: `${(crop.y + crop.height) / (imageRef.current?.height || 1) * 100}%`,
                  width: `${handleSize}px`,
                  height: `${handleSize}px`,
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  border: '1px solid rgba(0, 0, 0, 0.3)',
                  borderRadius: '50%'
                }}
                onMouseDown={(e) => handleResizeStart('s', e)}
              />
              <div 
                className="absolute -translate-x-1/2 -translate-y-1/2 cursor-ew-resize z-20" 
                style={{ 
                  left: `${crop.x / (imageRef.current?.width || 1) * 100}%`, 
                  top: `${(crop.y + crop.height/2) / (imageRef.current?.height || 1) * 100}%`,
                  width: `${handleSize}px`,
                  height: `${handleSize}px`,
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  border: '1px solid rgba(0, 0, 0, 0.3)',
                  borderRadius: '50%'
                }}
                onMouseDown={(e) => handleResizeStart('w', e)}
              />
              <div 
                className="absolute -translate-x-1/2 -translate-y-1/2 cursor-ew-resize z-20" 
                style={{ 
                  left: `${(crop.x + crop.width) / (imageRef.current?.width || 1) * 100}%`, 
                  top: `${(crop.y + crop.height/2) / (imageRef.current?.height || 1) * 100}%`,
                  width: `${handleSize}px`,
                  height: `${handleSize}px`,
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  border: '1px solid rgba(0, 0, 0, 0.3)',
                  borderRadius: '50%'
                }}
                onMouseDown={(e) => handleResizeStart('e', e)}
              />
            </>
          )}
        </div>

        <div className="mt-4">
          <div className="text-sm text-gray-500 mb-2">
            {aspectRatio 
              ? `Relación de aspecto fijada a ${aspectRatio === 1 ? '1:1 (cuadrada)' : aspectRatio === 16/9 ? '16:9 (panorámica)' : aspectRatio}`
              : 'Relación de aspecto libre'}
            <p className="text-xs text-gray-400 mt-1">
              {isMobile 
                ? "Toca los puntos blancos para ajustar el tamaño. Toca y arrastra dentro del recuadro para moverlo." 
                : "Usa los puntos blancos para ajustar el tamaño. Haz clic y arrastra dentro del recuadro para moverlo."}
            </p>
          </div>
          <div className="text-sm text-gray-500 mb-4 flex items-center">
            <span>Tamaño: {Math.round(crop.width)} × {Math.round(crop.height)} px</span>
            {isMobile && (
              <span className="ml-3 text-xs text-blue-600">
                Gira tu dispositivo horizontalmente para mayor precisión
              </span>
            )}
          </div>
        </div>

        <div className="mt-4 flex justify-end space-x-3">
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
            className="px-5 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            Aplicar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageCropper;
