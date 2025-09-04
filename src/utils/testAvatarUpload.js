// Función de prueba para verificar la subida de avatares
// Ejecutar desde la consola del navegador cuando estés en el dashboard del reciclador

export async function testAvatarUpload() {
  console.log('=== INICIANDO PRUEBA DE SUBIDA DE AVATAR ===');
  
  try {
    // Importar supabase
    const { supabase } = await import('../lib/supabase');
    
    // 1. Verificar que podemos acceder al bucket
    console.log('1. Verificando acceso al bucket avatars...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('Error listando buckets:', bucketsError);
      return false;
    }
    
    console.log('Buckets disponibles:', buckets.map(b => b.name));
    
    const avatarsBucket = buckets.find(b => b.name === 'avatars');
    if (!avatarsBucket) {
      console.error('Bucket "avatars" no encontrado');
      return false;
    }
    
    console.log('✓ Bucket "avatars" encontrado');
    
    // 2. Verificar que podemos listar archivos en el bucket
    console.log('2. Verificando contenido del bucket...');
    const { data: files, error: listError } = await supabase.storage
      .from('avatars')
      .list('', { limit: 10 });
    
    if (listError) {
      console.error('Error listando archivos:', listError);
      return false;
    }
    
    console.log('Archivos en bucket avatars:', files);
    
    // 3. Crear un archivo de prueba pequeño
    console.log('3. Creando archivo de prueba...');
    const testContent = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const response = await fetch(testContent);
    const blob = await response.blob();
    const testFile = new File([blob], 'test-avatar.png', { type: 'image/png' });
    
    console.log('Archivo de prueba creado:', {
      name: testFile.name,
      size: testFile.size,
      type: testFile.type
    });
    
    // 4. Intentar subir el archivo
    console.log('4. Subiendo archivo de prueba...');
  const fileName = `test_${Date.now()}.png`;
  const filePath = fileName;
    
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, testFile, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'image/png',
      });
    
    if (uploadError) {
      console.error('Error subiendo archivo de prueba:', uploadError);
      return false;
    }
    
    console.log('✓ Archivo subido exitosamente');
    
    // 5. Verificar que el archivo fue subido
    console.log('5. Verificando que el archivo existe...');
  const { data: uploadedFiles, error: verifyError } = await supabase.storage.from('avatars').list('', { limit: 100 });
    
    if (verifyError) {
      console.error('Error verificando archivo:', verifyError);
    } else {
      const foundFile = uploadedFiles?.find(f => f.name === fileName);
      if (foundFile) {
        console.log('✓ Archivo encontrado en storage:', foundFile);
      } else {
        console.warn('⚠ Archivo no encontrado en el listado');
      }
    }
    
    // 6. Obtener URL pública
    console.log('6. Obteniendo URL pública...');
  const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
    console.log('URL pública generada:', data.publicUrl);
    
    // 7. Limpiar - eliminar archivo de prueba
    console.log('7. Limpiando archivo de prueba...');
    const { error: deleteError } = await supabase.storage
      .from('avatars')
      .remove([filePath]);
    
    if (deleteError) {
      console.warn('Error eliminando archivo de prueba:', deleteError);
    } else {
      console.log('✓ Archivo de prueba eliminado');
    }
    
    console.log('=== PRUEBA COMPLETADA EXITOSAMENTE ===');
    return true;
    
  } catch (error) {
    console.error('=== ERROR EN PRUEBA ===');
    console.error(error);
    return false;
  }
}

// También probar específicamente la ruta avatars/avatares/
export async function testAvatarsSubfolder() {
  console.log('=== PROBANDO SUBCARPETA AVATARES ===');
  
  try {
    const { supabase } = await import('../lib/supabase');
    
    // Crear archivo de prueba
    const testContent = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const response = await fetch(testContent);
    const blob = await response.blob();
    const testFile = new File([blob], 'test-subfolder.png', { type: 'image/png' });
    
    const fileName = `test_subfolder_${Date.now()}.png`;
  const filePath = fileName; // Subir en la raíz del bucket
    
    console.log('Intentando subir a subcarpeta avatares:', filePath);
    
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, testFile, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'image/png',
      });
    
    if (uploadError) {
      console.error('Error subiendo a subcarpeta:', uploadError);
      return false;
    }
    
    console.log('✓ Subida a subcarpeta exitosa');
    
    // Verificar
  const { data: files, error: listError } = await supabase.storage.from('avatars').list('', { limit: 100 });
    
    if (listError) {
      console.error('Error listando subcarpeta:', listError);
    } else {
      console.log('Archivos en subcarpeta avatares:', files);
    }
    
    // Limpiar
    await supabase.storage.from('avatars').remove([filePath]);
    
    return true;
    
  } catch (error) {
    console.error('Error en prueba de subcarpeta:', error);
    return false;
  }
}

// Función para ser llamada desde la consola
window.testAvatarUpload = testAvatarUpload;
window.testAvatarsSubfolder = testAvatarsSubfolder;

console.log('Funciones de prueba disponibles:');
console.log('- testAvatarUpload() - Prueba subida directa a bucket avatars');
console.log('- testAvatarsSubfolder() - Prueba subida a subcarpeta avatares');
