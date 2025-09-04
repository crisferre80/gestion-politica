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
 * Verifica si el bucket de avatars existe y está configurado correctamente
 */
async function verifyAvatarsBucket(): Promise<boolean> {
  try {
    console.log('Verificando bucket de avatars...');
    // La API pública del cliente de Supabase no expone listBuckets().
    // En su lugar intentamos listar la raíz del bucket 'avatars' para comprobar existencia/permiso.
    try {
  const { error: listErr } = await supabase.storage.from('avatars').list('', { limit: 1 });
  if (listErr) {
        // Si hay un error al listar, intentamos crear una pequeña prueba en la subcarpeta 'avatares'
        console.warn('No fue posible listar el bucket avatars, intentando subir archivo de prueba:', listErr);
        try {
          const dummyName = `avatares/.placeholder_${Date.now()}.txt`;
          const dummyFile = new File(['ok'], dummyName, { type: 'text/plain' });
          const { error: uploadErr } = await supabase.storage.from('avatars').upload(dummyName, dummyFile);
          if (uploadErr) {
            console.error('No se pudo crear archivo de prueba en avatars:', uploadErr);
            return false;
          }
          // Intentar eliminar inmediatamente el placeholder (no crítico)
          try {
            await supabase.storage.from('avatars').remove([dummyName]);
          } catch {
            // ignorar errores de limpieza
          }
          return true;
        } catch (uErr) {
          console.error('Error creando archivo de prueba en avatars:', uErr);
          return false;
        }
      }

      // Si listData es undefined pero no hay error, consideramos que el bucket existe
      return true;
    } catch (err) {
      console.error('Error comprobando existencia del bucket avatars:', err);
      return false;
    }
  } catch (err) {
    console.error('Error verificando bucket:', err);
    return false;
  }
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
    console.log('uploadAvatar iniciado:', { userId, type: typeof fileOrBase64 });
    
    // Verificar que el bucket existe antes de proceder
    const bucketExists = await verifyAvatarsBucket();
    if (!bucketExists) {
      throw new Error('El bucket "avatars" no está disponible o no está configurado correctamente en Supabase Storage');
    }
    
  // Generamos un nombre único para el archivo (subir en la raíz del bucket)
  const fileName = `${userId}_${Date.now()}.webp`;
    console.log('Nombre de archivo generado con ruta:', fileName);
    
    // Convertimos a blob según el tipo de entrada
    let processedFile: File;
    
    if (typeof fileOrBase64 === 'string') {
      console.log('Procesando string base64...');
      // Es un string base64
      const base64Response = await fetch(fileOrBase64);
      const processedBlob = await base64Response.blob();
      processedFile = new File([processedBlob], fileName, { type: 'image/webp' });
      console.log('Archivo procesado desde base64:', { size: processedFile.size, type: processedFile.type });
    } else {
      console.log('Procesando archivo File:', { 
        name: fileOrBase64.name, 
        size: fileOrBase64.size, 
        type: fileOrBase64.type 
      });
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
        console.log('Preparando imagen para subir...');
        const base64 = await prepareImageForUpload(fileOrBase64, 300);
        if (!base64) {
          throw new Error('No se pudo procesar la imagen');
        }
        console.log('Imagen procesada a base64, convirtiendo a File...');
        const base64Response = await fetch(base64);
        const processedBlob = await base64Response.blob();
        processedFile = new File([processedBlob], fileName, { type: 'image/webp' });
        console.log('Archivo final preparado:', { size: processedFile.size, type: processedFile.type });
      }
    }

    // Subir a Supabase Storage
    console.log('Subiendo archivo a Supabase Storage bucket "avatars"...');
    let uploadResult = await supabase.storage.from('avatars').upload(fileName, processedFile, {
      cacheControl: '3600',
      upsert: true,
      contentType: 'image/webp',
    });
    
    // Si hay error con WebP, intentar con JPEG como fallback
    if (uploadResult.error) {
      console.warn('Error con WebP, intentando con JPEG como fallback:', uploadResult.error);
      
      // Convertir a JPEG
  const jpegFileName = fileName.replace('.webp', '.jpg');
      console.log('Intentando subir como JPEG:', jpegFileName);
      
      // Crear archivo JPEG desde el original
      let jpegFile: File;
      if (typeof fileOrBase64 === 'string') {
        const base64Response = await fetch(fileOrBase64);
        const blob = await base64Response.blob();
        jpegFile = new File([blob], jpegFileName, { type: 'image/jpeg' });
      } else {
        // Procesar el archivo original como JPEG
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        await new Promise((resolve) => {
          img.onload = resolve;
          img.src = URL.createObjectURL(fileOrBase64);
        });
        
        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);
        
        const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        const jpegResponse = await fetch(jpegDataUrl);
        const jpegBlob = await jpegResponse.blob();
        jpegFile = new File([jpegBlob], jpegFileName, { type: 'image/jpeg' });
        
        URL.revokeObjectURL(img.src);
      }
      
      uploadResult = await supabase.storage.from('avatars').upload(jpegFileName, jpegFile, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'image/jpeg',
      });
      
      if (uploadResult.error) {
        console.error('Error al subir avatar (tanto WebP como JPEG fallaron):', uploadResult.error);
        throw uploadResult.error;
      }
      
      console.log('Archivo subido exitosamente como JPEG, obteniendo URL pública...');
      const { data } = supabase.storage.from('avatars').getPublicUrl(jpegFileName);
      const publicUrl = data?.publicUrl || null;
      if (publicUrl) {
        console.log('URL pública obtenida:', publicUrl);
        return publicUrl;
      }
      // Fallback: si el bucket es privado, intentar crear una signed URL temporal
      try {
        const expires = 60 * 60; // 1 hora
        const { data: signedData, error: signedErr } = await supabase.storage.from('avatars').createSignedUrl(jpegFileName, expires);
        if (!signedErr && signedData?.signedUrl) {
          console.log('Signed URL obtenida:', signedData.signedUrl);
          return signedData.signedUrl;
        }
        console.warn('No se pudo obtener signed URL para avatar JPEG:', signedErr);
      } catch (e) {
        console.warn('Excepción al intentar crear signed URL para JPEG:', e);
      }
      return null;
    }

    console.log('Archivo subido exitosamente como WebP, obteniendo URL pública...');
    // Obtener URL pública
    const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
    const publicUrl = data?.publicUrl || null;
    if (publicUrl) {
      console.log('URL pública obtenida:', publicUrl);
      return publicUrl;
    }
    // Fallback: si el bucket es privado, intentar crear una signed URL temporal
    try {
      const expires = 60 * 60; // 1 hora
      const { data: signedData, error: signedErr } = await supabase.storage.from('avatars').createSignedUrl(fileName, expires);
      if (!signedErr && signedData?.signedUrl) {
        console.log('Signed URL obtenida:', signedData.signedUrl);
        return signedData.signedUrl;
      }
      console.warn('No se pudo obtener signed URL para avatar WebP:', signedErr);
    } catch (e) {
      console.warn('Excepción al intentar crear signed URL para WebP:', e);
    }
    return null;
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
  // Primero buscar el profile.id y luego actualizar por id para evitar rutas REST problemáticas
  try {
    const { data: profileRows, error: selErr } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();
    if (!selErr && profileRows && (profileRows as unknown as { id?: string }).id) {
      const idVal = (profileRows as unknown as { id?: string }).id;
      const { error } = await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', idVal);
      if (error) {
        return { publicUrl: null, error };
      }
    }
  } catch (err) {
    return { publicUrl: null, error: err as unknown as Error };
  }
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
    
    // 4. Actualizar el perfil con la URL del avatar (usar helper que evita actualizar por user_id directamente)
    try {
      const { updateProfileByUserId } = await import('./profileHelpers');
      await updateProfileByUserId(userId, { avatar_url: avatarUrl });
    } catch {
      // Fallback: intentar la actualización directa si el helper falla
      try {
        await updateProfileAvatar(userId, avatarUrl);
      } catch (err) {
        console.error('No se pudo actualizar el perfil con avatar URL:', err);
      }
    }

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

/**
 * Función de prueba para verificar la conectividad con Supabase Storage
 * Puedes llamar esta función desde la consola del navegador para debug
 */
export async function testSupabaseStorage(): Promise<void> {
  console.log('=== Test de Supabase Storage ===');
  
  try {
    // 1. Verificar bucket
    console.log('1. Verificando bucket...');
    const bucketExists = await verifyAvatarsBucket();
    console.log('Bucket exists:', bucketExists);
    
    if (!bucketExists) {
      console.error('❌ El bucket "avatars" no está disponible');
      return;
    }
    
    // 2. Crear un archivo de prueba
    console.log('2. Creando archivo de prueba...');
    const testData = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzAwODAyNiIvPjx0ZXh0IHg9IjUwIiB5PSI1NSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+VEVTVDwvdGV4dD48L3N2Zz4=';
  const testFileName = `test_${Date.now()}.jpg`;
    
    const response = await fetch(testData);
    const blob = await response.blob();
    const testFile = new File([blob], testFileName, { type: 'image/jpeg' });
    
    console.log('Archivo de prueba creado:', { name: testFile.name, size: testFile.size, type: testFile.type });
    
    // 3. Subir archivo de prueba
    console.log('3. Subiendo archivo de prueba...');
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(testFileName, testFile, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'image/jpeg',
      });
    
    if (uploadError) {
      console.error('❌ Error al subir archivo de prueba:', uploadError);
      return;
    }
    
    console.log('✅ Archivo de prueba subido exitosamente');
    
    // 4. Obtener URL pública
    console.log('4. Obteniendo URL pública...');
  const { data } = supabase.storage.from('avatars').getPublicUrl(testFileName);
    console.log('✅ URL pública obtenida:', data.publicUrl);
    
    // 5. Limpiar archivo de prueba
    console.log('5. Limpiando archivo de prueba...');
  const { error: deleteError } = await supabase.storage.from('avatars').remove([testFileName]);
    
    if (deleteError) {
      console.warn('⚠️ Error al eliminar archivo de prueba:', deleteError);
    } else {
      console.log('✅ Archivo de prueba eliminado');
    }
    
    console.log('=== Test completado exitosamente ===');
    
  } catch (err) {
    console.error('❌ Error en test de Supabase Storage:', err);
  }
}

// Hacer la función disponible globalmente para debug
if (typeof window !== 'undefined') {
  (window as Window & { testSupabaseStorage?: () => Promise<void> }).testSupabaseStorage = testSupabaseStorage;
}
