import { supabase } from './supabase';
import { prepareImageForUpload, transformImage } from '../services/ImageTransformService';

/**
 * Convierte un dataURL a un objeto File
 * @param dataUrl El dataURL a convertir
 * @param filename Nombre del archivo
 * @returns Un objeto File
 */
async function dataURLtoFile(dataUrl: string, filename: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type });
}

/**
 * Procesa y sube el avatar de un usuario.
 * Est    // Generar un nombre único para el archivo (usando jpg en lugar de webp)
    const fileName = `${userId}_${Date.now()}.jpg`;
    const processedFile = new File([finalBlob], fileName, { type: 'image/jpeg' });
    
    // Subir el avatar procesado a Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, processedFile, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'image/jpeg',
      });ora acepta tanto un archivo File como un string base64.
 * @param userId ID del usuario
 * @param fileOrBase64 Archivo de imagen o string base64 ya procesado
 * @returns URL pública del avatar
 */
export async function uploadAvatar(
  userId: string, 
  fileOrBase64: File | string
): Promise<string | null> {
  try {
    // Generamos un nombre único para el archivo
    const fileName = `${userId}_${Date.now()}.webp`; // Siempre usamos WebP para mejor compresión
    
    // Convertimos a blob según el tipo de entrada
    let processedFile: File;
    
    if (typeof fileOrBase64 === 'string') {
      // Es un string base64
      const base64Response = await fetch(fileOrBase64);
      const processedBlob = await base64Response.blob();
      processedFile = new File([processedBlob], fileName, { type: 'image/webp' });
    } else {
      // Es un archivo File
      if (fileOrBase64.type.startsWith('image/webp')) {
        // Ya es webp, pero aplicamos el límite de tamaño de 300KB para avatar
        const base64 = await prepareImageForUpload(fileOrBase64, 300);
        if (!base64) {
          throw new Error('No se pudo procesar la imagen');
        }
        const base64Response = await fetch(base64);
        const processedBlob = await base64Response.blob();
        processedFile = new File([processedBlob], fileName, { type: 'image/webp' });
      } else {
        // Convertir a base64, luego a webp, con límite de 300KB para avatar
        const base64 = await prepareImageForUpload(fileOrBase64, 300);
        if (!base64) {
          throw new Error('No se pudo procesar la imagen');
        }
        const base64Response = await fetch(base64);
        const processedBlob = await base64Response.blob();
        processedFile = new File([processedBlob], fileName, { type: 'image/webp' });
      }
    }

    // Subir a Supabase Storage
    const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, processedFile, {
      cacheControl: '3600',
      upsert: true,
      contentType: 'image/webp',
    });
    
    if (uploadError) {
      console.error('Error al subir avatar:', uploadError);
      throw uploadError;
    }

    // Obtener URL pública
    const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
    return data.publicUrl || null;
  } catch (err) {
    console.error('Error en uploadAvatar:', err);
    return null;
  }
}

/**
 * Actualiza el avatar de un perfil
 * @param userId ID del usuario
 * @param avatarUrl URL del avatar
 */
export async function updateProfileAvatar(userId: string, avatarUrl: string) {
  const { error } = await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('user_id', userId);
  if (error) throw error;
}

/**
 * Procesa un avatar para crear diferentes versiones (grande y thumbnail)
 * Todo el procesamiento se realiza en el cliente usando Canvas
 * @param imageUrl URL o base64 de la imagen original
 * @returns Objeto con URLs de las diferentes versiones
 */
export async function processProfileImages(imageUrl: string): Promise<{
  avatar?: string;
  thumbnail?: string;
  header?: string;
}> {
  try {
    // Primero, procesamos el avatar y header con los límites de tamaño específicos
    const avatarBase64 = await prepareImageForUpload(await dataURLtoFile(imageUrl, 'avatar.jpg'), 300); // 300KB máximo para avatar
    const headerBase64 = await prepareImageForUpload(await dataURLtoFile(imageUrl, 'header.jpg'), 800); // 800KB máximo para header
    
    if (!avatarBase64 || !headerBase64) {
      throw new Error('Error al procesar imágenes');
    }
    
    // Procesar en paralelo las diferentes versiones
    const [avatarResult, thumbnailResult, headerResult] = await Promise.all([
      // Avatar principal (tamaño mediano, cuadrado)
      transformImage(avatarBase64, {
        width: 400,
        height: 400,
        quality: 75,        // Calidad controlada porque ya está comprimido a 300KB
        format: 'jpeg',     // Usar JPEG para compatibilidad con Supabase
        name: 'avatar'
      }),
      // Miniatura para listados (más pequeña, para uso en chats y listas)
      transformImage(avatarBase64, {
        width: 100,
        height: 100,
        quality: 70,        // Calidad menor es aceptable para miniaturas
        format: 'jpeg',     // Usar JPEG para compatibilidad con Supabase
        name: 'thumbnail'
      }),
      // Header para perfil (versión panorámica para cabecera)
      transformImage(headerBase64, {
        width: 1000,        // Reducimos un poco el ancho máximo
        height: 400,
        quality: 70,        // Calidad controlada porque ya está comprimido a 800KB
        format: 'jpeg',     // Usar JPEG para compatibilidad con Supabase
        name: 'header'
      })
    ]);

    return {
      avatar: avatarResult.success ? avatarResult.url : undefined,
      thumbnail: thumbnailResult.success ? thumbnailResult.url : undefined,
      header: headerResult.success ? headerResult.url : undefined
    };
  } catch (err) {
    console.error('Error al procesar imágenes de perfil:', err);
    return {};
  }
}

/**
 * Función completa para manejar la subida y procesamiento de avatares
 * Todo el procesamiento se realiza en el cliente
 * @param userId ID del usuario
 * @param file Archivo de imagen
 * @returns Objeto con todas las URLs de las imágenes procesadas
 */
export async function handleProfileImageUpload(userId: string, file: File): Promise<{
  success: boolean;
  avatar?: string;
  thumbnail?: string;
  header?: string;
  error?: string;
}> {
  try {
    // 1. Procesar la imagen localmente antes de subirla (usando el límite para header como referencia)
    // Este preprocesamiento es para hacer manipulaciones generales antes de versiones específicas
    const imageBase64 = await prepareImageForUpload(file, 800); // 800KB para la imagen inicial
    if (!imageBase64) {
      throw new Error('No se pudo procesar la imagen');
    }
    
    // 2. Generar las diferentes versiones localmente
    const processedImages = await processProfileImages(imageBase64);
    
    // 3. Subir la versión del avatar
    const avatarBase64 = processedImages.avatar || imageBase64;
    
    // Convertir base64 a blob para subir
    const response = await fetch(avatarBase64);
    const blob = await response.blob();
    
    // Verificar el tamaño del blob
    const MAX_SIZE_MB = 2;
    const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
    
    let finalBlob = blob;
    if (blob.size > MAX_SIZE_BYTES) {
      console.warn(`La imagen supera los ${MAX_SIZE_MB}MB (${(blob.size / (1024 * 1024)).toFixed(2)}MB). Comprimiendo más...`);
      
      // Crear un canvas para comprimir aún más la imagen
      const img = new Image();
      img.src = avatarBase64;
      await new Promise(resolve => { img.onload = resolve; });
      
      const canvas = document.createElement('canvas');
      // Calcular un factor de escala para reducir el tamaño del archivo
      const scale = Math.min(0.7, Math.sqrt(MAX_SIZE_BYTES / blob.size) * 0.9);
      
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        // Usar baja calidad para garantizar tamaño pequeño (con JPEG)
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.5);
        
        const compressedResponse = await fetch(compressedDataUrl);
        finalBlob = await compressedResponse.blob();
        
        console.log(`Imagen recomprimida a: ${(finalBlob.size / (1024 * 1024)).toFixed(2)}MB`);
      }
    }
    
    // Crear nombre único para el archivo
    const fileName = `${userId}_${Date.now()}.webp`;
    const processedFile = new File([finalBlob], fileName, { type: 'image/webp' });
    
    // Subir el avatar procesado a Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, processedFile, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'image/webp',
      });
    
    if (uploadError) {
      console.error('Error al subir avatar:', uploadError);
      throw new Error('Error al subir avatar a storage');
    }
    
    // Obtener URL pública
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
    const avatarUrl = urlData.publicUrl;
    
    // 4. Actualizar el perfil con la URL del avatar
    await updateProfileAvatar(userId, avatarUrl);

    return {
      success: true,
      avatar: avatarUrl,
      thumbnail: processedImages.thumbnail, // Devolvemos base64 para uso inmediato en la UI
      header: processedImages.header       // Devolvemos base64 para uso inmediato en la UI
    };
  } catch (err) {
    console.error('Error en handleProfileImageUpload:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Error desconocido al procesar la imagen'
    };
  }
}
