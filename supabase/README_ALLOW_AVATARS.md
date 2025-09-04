Ejecutar SQL para permitir uploads al bucket `avatars`

Instrucciones rápidas

1) Requisito: debes ejecutar como el OWNER de la base de datos (no sirve la clave anon/public). Usa la connection string del proyecto Supabase con rol OWNER (p. ej. la que aparece como "DB Connection string (URI)" en Project Settings -> Database -> Connection string).

2) Ejecuta el script SQL incluido en este directorio: `allow_avatars.sql`.

Opciones para ejecutar (PowerShell / Windows)

# Opción A — Usando psql (instala psql y añadelo al PATH)
$env:PGPASSWORD = "<DB_OWNER_PASSWORD>"
psql "postgresql://<owner_user>@<host>:<port>/<database>" -f "C:\ruta\al\proyecto\project\supabase\allow_avatars.sql"

# Opción B — Ejecutar desde el SQL editor del Dashboard de Supabase
- Abre Project -> SQL Editor
- Pega el contenido de `allow_avatars.sql`
- Ejecuta como owner (debes estar autenticado con una cuenta con privilegios de owner).

Alternativa rápida (si no puedes ejecutar SQL como owner)

- Haz el bucket `avatars` público desde Supabase UI: Storage -> Buckets -> avatars -> Settings -> Public (Make public). Esto permitirá lecturas públicas y normalmente desbloquea uploads desde cliente.
- O bien implementa un endpoint backend seguro que use la clave `service_role` para realizar uploads en nombre del cliente.

Notas de seguridad

- Dar publicación total a un bucket permite que cualquiera con la URL acceda a las imágenes.
- Permitir INSERT/DELETE con policies debe restringirse a `authenticated` y, preferiblemente, a objetos cuyo `owner = auth.uid()` para evitar que un usuario borre archivos de otros.
- El script incluido configura owner checks para UPDATE/DELETE.

Si quieres, puedo aplicar otras variantes del SQL (por ejemplo: lecturas sólo para authenticated y no públicas) — dime la política exacta y la genero.
