# 🗺️ Guía para Probar las Zonas del Administrador

## 📍 **¿Dónde probar la funcionalidad?**

La funcionalidad "Ver Zonas del Administrador" está disponible en el **Dashboard del Reciclador**.

## 🔧 **Pasos para probar:**

### 1. **Navegar al Dashboard del Reciclador**
   - Ir a: `http://localhost:5174/dashboard-recycler`
   - O usar la página de prueba: `http://localhost:5174/test-zones`

### 2. **Activar el Mapa Principal** (Solo en dashboard-recycler)
   - Buscar la sección "Mapa de Centros de Movilizaciòn"
   - Hacer click en el botón **"Ver mapa"**
   - El mapa se expandirá mostrando todos los puntos disponibles y reclamados

### 3. **Ver las Zonas del Administrador**
   - Una vez que el mapa esté visible, buscar el botón **"Ver Zonas Admin"** en la esquina superior derecha del mapa
   - Hacer click en el botón
   - Las zonas se cargarán automáticamente desde Supabase

## 🎯 **¿Qué debería pasar?**

### ✅ **Comportamiento esperado:**
1. **Carga inicial**: El botón muestra "Ver Zonas Admin" con un ícono
2. **Durante la carga**: Aparece un spinner y el texto "Cargando..."
3. **Zonas mostradas**: Se renderizan polígonos coloreados en el mapa
4. **Información**: Un indicador en la parte inferior muestra cuántas zonas se cargaron
5. **Ocultar**: El botón cambia a "Ocultar Zonas" para esconderlas

### 🔍 **Debug en Consola:**
Abrir las DevTools (F12) para ver logs detallados:
```
🔍 Iniciando carga de zonas desde Supabase...
📦 Datos recibidos de Supabase: [...]
🔧 Procesando zona: Zona Centro
✅ Coordenadas parseadas para Zona Centro: [...]
🎉 Cargadas X zonas de administrador
🎭 Zonas para mostrar: [...]
```

## 🛠️ **Si no funciona:**

### **Opción 1: Datos de Prueba**
Si hay problemas con Supabase, el código automáticamente usa datos de prueba:
- Zona Centro (verde)
- Zona Norte (azul)

### **Opción 2: Página de Prueba**
Ir a `http://localhost:5174/test-zones` para una implementación simplificada.

### **Opción 3: Verificar Configuración**
1. **Token Mapbox**: Verificar que `VITE_MAPBOX_ACCESS_TOKEN` esté configurado
2. **Consola**: Revisar errores en DevTools
3. **Red**: Verificar llamadas a Supabase en la pestaña Network

## 📊 **Datos de Prueba**

Si necesitas insertar datos manualmente en Supabase, ejecuta el archivo:
```sql
-- Ver: insert_test_zones.sql
INSERT INTO zones (name, coordinates, color) VALUES (...)
```

## 🎨 **Características Visuales**

- **Polígonos semitransparentes** con bordes definidos
- **Colores personalizables** por zona
- **Popups informativos** (en desarrollo)
- **Animaciones** suaves de carga

---

**✨ ¡La funcionalidad está completamente implementada y lista para usar!**
