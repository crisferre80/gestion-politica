// Script para probar las funciones Edge de Supabase localmente
// Este archivo te permite probar tu función antes de desplegarla

// Importamos la función desde el archivo index.ts
import { corsHeaders } from "../verify-email-service/index.ts";

// Crea un servidor HTTP simple para probar
const server = Deno.serve({
  port: 54321,
  hostname: "localhost",
}, (req) => {
  // Enruta las solicitudes a las funciones correspondientes
  const url = new URL(req.url);
  const path = url.pathname;

  console.log(`Solicitud recibida: ${req.method} ${path}`);
  
  // Si es una solicitud preflight OPTIONS, respondemos correctamente con CORS
  if (req.method === "OPTIONS") {
    console.log("Respondiendo a solicitud OPTIONS con cabeceras CORS");
    return new Response("ok", {
      status: 200,
      headers: corsHeaders
    });
  }
  
  // Aquí puedes manejar tus rutas
  if (path === "/test-cors") {
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "CORS configurado correctamente",
        corsHeaders: corsHeaders
      }),
      { 
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        } 
      }
    );
  }

  return new Response(
    JSON.stringify({ error: "Ruta no encontrada" }),
    { 
      status: 404,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      } 
    }
  );
});

console.log(`Servidor iniciado en http://localhost:54321/`);
console.log(`Para probar CORS, visita: http://localhost:54321/test-cors`);

// Espera a que el servidor se cierre
await server.finished;
