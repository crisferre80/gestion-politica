// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// API Key de MailerLite
const MAILERLITE_API_KEY = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiI0IiwianRpIjoiMjJmODExOTQ3MTBjMWUyMTQzYjdmNjVlMGY5ODljZDJjN2M0MDUxNzNhNzM0NzIxZDgzYzMwYmFkMWE4YjNhMDViMWFhZWQ4ZDg0OGJhOTciLCJpYXQiOjE3NTE2NTY5MjkuNTQ2ODA3LCJuYmYiOjE3NTE2NTY5MjkuNTQ2ODA5LCJleHAiOjQ5MDczMzA1MjkuNTQyNzI1LCJzdWIiOiIxNjU1NjM4Iiwic2NvcGVzIjpbXX0.aQdZJGLdDe_A7g4fFcwyJ-IAvCLNThx1pPy6il4GbTzHo27t6T9ywUqrNSmhdb9wzLGPulW__6mu1ciPuATWgR3u4EN8ekC6TY1xcAh4ow_4ARxRdnlGe0JhMkHjyCbatZAqEUoCuXkEiF4eyjJzp1XX5_NbLayoHUwV0vqtGgqOXnTS_FIdi5pGFza2I-qVYl7LZyT61P-yNKtbGn2mCYdqOA_rPDNPpMTD0krejRgFpoUU_ilTus50jL2vZaL9_rVJx9A0f3_SnqfmXvmgFfQn91WuYqXOYJPmaV5x4MZU6X8Juz91eISPoZj6TjkdrkCgtNxf74oc9rQqskqE0EjBcux-tzu0LPRXo0NGFxZ4st86vhTBN9vctgsyFlPE9V3xKfodd7qzZmhUAnC3hvlSTGS81T2v5-AXR_dtbadvSoeGRRzuOIzV8JFzDWiRKEYwAb9zhOI1oipatKoAQjRcWAp6Vpme7DtdzHwMOz_nYMrEq7egkjIyZlhkoSqvN_LAHzErgC2AYKTTLWLTzdwtEqPLbQtgQoXb6L0b_uKomaOEyc5jWYDR6KH9myL83v8N0CbQ7p_SwnzhftolJeTBhDomPq2VJTWZm7Sc9nDSGTWCVQW4oRaYVPBNhdokr8w5kenOdF3vtHlbltBl52AIhoXQJSahKvCp8AHp8J4";

// Cabeceras CORS para permitir solicitudes desde cualquier origen
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

// Importar la función serve desde el módulo estándar de Deno
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";

// Función para verificar la conexión con MailerLite
serve(async (req) => {
  // Manejo de solicitudes OPTIONS para CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { 
      status: 200,
      headers: corsHeaders 
    });
  }
  
  try {
    // Intentar hacer una solicitud simple a la API de MailerLite para verificar la conexión
    const response = await fetch("https://connect.mailerlite.com/api/account", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Bearer ${MAILERLITE_API_KEY}`
      }
    });
    
    // Verificar respuesta
    if (response.status === 200) {
      const data = await response.json();
      return new Response(
        JSON.stringify({ available: true, data: { account: data.data.company } }),
        { 
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          } 
        }
      );
    } else {
      const errorData = await response.json();
      return new Response(
        JSON.stringify({ 
          available: false, 
          error: `Error de conexión con MailerLite: ${response.status}`,
          details: errorData
        }),
        { 
          status: 200, // Usamos 200 en lugar de 400 para evitar problemas con CORS
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          } 
        }
      );
    }
  } catch (error) {
    console.error("Error al verificar servicio de email:", error);
    return new Response(
      JSON.stringify({ 
        available: false, 
        error: `Error al conectar con MailerLite: ${error.message}` 
      }),
      { 
        status: 200, // Usamos 200 en lugar de 500 para evitar problemas con CORS
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        } 
      }
    );
  }
})