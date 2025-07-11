# Configuración del Bucket "points" para Fotos de Puntos de Recolección

## Resumen de Cambios

Se han realizado los siguientes cambios para que las fotos de los puntos de recolección se almacenen correctamente en el bucket "points" de Supabase Storage:

### 1. Cambios en el Código

#### `src/pages/AddCollectionPoint.tsx`
- **Líneas 321 y 325**: Cambiado el bucket de `'collection_photos'` a `'points'`
- Las fotos de materiales ahora se suben al bucket correcto

#### `supabaseTypes.ts`
- **Líneas 164, 186, 203**: Agregado el campo `photo_url: string | null` a la interfaz de `collection_points`
- Esto permite el tipado correcto en TypeScript

### 2. Migración de Base de Datos

#### Archivo: `supabase/migrations/20250710_add_photo_url_to_collection_points.sql`
```sql
ALTER TABLE collection_points 
ADD COLUMN IF NOT EXISTS photo_url TEXT;
```

#### Archivo: `sql/add_photo_url_field.sql`
Script para ejecutar manualmente en el dashboard de Supabase si la migración automática no funciona.

### 3. Configuración del Bucket

#### Archivo: `sql/configure_points_bucket.sql`
Script para configurar el bucket "points" con las políticas de acceso correctas.

## Instrucciones para Aplicar los Cambios

### Paso 1: Ejecutar la Migración de Base de Datos
1. Ve a https://supabase.com/dashboard/project/mfnvzijeanxvmolrprzj/sql
2. Copia y pega el contenido de `sql/add_photo_url_field.sql`
3. Haz clic en "Run" para ejecutar

### Paso 2: Configurar el Bucket "points"
1. Ve a https://supabase.com/dashboard/project/mfnvzijeanxvmolrprzj/storage/buckets
2. Si no existe el bucket "points", créalo:
   - Nombre: `points`
   - Público: ✅ Sí
   - Tamaño máximo: 2 MB
   - Tipos permitidos: image/jpeg, image/png, image/webp

3. Luego ejecuta el script `sql/configure_points_bucket.sql` en el SQL Editor

### Paso 3: Verificar el Funcionamiento
1. Reinicia la aplicación
2. Ve a "Agregar Punto de Recolección"
3. Sube una foto del material
4. Verifica que la foto se muestre correctamente en la lista de puntos

## Estructura de Buckets

Ahora tienes una estructura organizada de buckets en Supabase Storage:

- **`avatars`**: Fotos de perfil de usuarios
- **`header-img`**: Imágenes de cabecera de perfiles
- **`points`**: Fotos de materiales en puntos de recolección

## Beneficios

1. **Organización**: Cada tipo de imagen tiene su propio bucket
2. **Escalabilidad**: Facilita la gestión de permisos por tipo de contenido
3. **Rendimiento**: Permite optimizar políticas de caché por bucket
4. **Mantenimiento**: Facilita las tareas de limpieza y respaldo

## Troubleshooting

Si las fotos no se muestran:
1. Verifica que el bucket "points" esté marcado como público
2. Revisa las políticas de RLS en Storage
3. Comprueba la consola del navegador para errores de CORS
4. Verifica que el campo `photo_url` exista en la tabla `collection_points`
