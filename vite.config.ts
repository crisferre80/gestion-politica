import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    // Fallback para SPA: Vite maneja esto automáticamente para proyectos SPA.
    // No es necesario agregar historyApiFallback.
    // Forzar opciones HMR para evitar que el cliente intente conectarse
    // automáticamente a un host externo (p. ej. '*.app.github.dev') usando WSS.
    // Estas opciones pueden sobreescribirse con variables de entorno si hace falta.
    host: true,
    hmr: {
      // por defecto usar ws y localhost (evita wss a dominios remotos)
      protocol: process.env.VITE_HMR_PROTOCOL || 'ws',
      host: process.env.VITE_HMR_HOST || 'localhost',
      // clientPort opcional: si tu entorno expone el servidor en otro puerto,
      // puedes definir VITE_HMR_CLIENT_PORT en el entorno para forzarlo.
      // clientPort: process.env.VITE_HMR_CLIENT_PORT ? Number(process.env.VITE_HMR_CLIENT_PORT) : undefined,
    },
  },
});
