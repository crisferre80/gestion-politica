// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// Import Deno global types for TypeScript
/// <reference types="deno.ns" />

// API Key de MailerLite
const MAILERLITE_API_KEY = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiI0IiwianRpIjoiMjJmODExOTQ3MTBjMWUyMTQzYjdmNjVlMGY5ODljZDJjN2M0MDUxNzNhNzM0NzIxZDgzYzMwYmFkMWE4YjNhMDViMWFhZWQ4ZDg0OGJhOTciLCJpYXQiOjE3NTE2NTY5MjkuNTQ2ODA3LCJuYmYiOjE3NTE2NTY5MjkuNTQ2ODA5LCJleHAiOjQ5MDczMzA1MjkuNTQyNzI1LCJzdWIiOiIxNjU1NjM4Iiwic2NvcGVzIjpbXX0.aQdZJGLdDe_A7g4fFcwyJ-IAvCLNThx1pPy6il4GbTzHo27t6T9ywUqrNSmhdb9wzLGPulW__6mu1ciPuATWgR3u4EN8ekC6TY1xcAh4ow_4ARxRdnlGe0JhMkHjyCbatZAqEUoCuXkEiF4eyjJzp1XX5_NbLayoHUwV0vqtGgqOXnTS_FIdi5pGFza2I-qVYl7LZyT61P-yNKtbGn2mCYdqOA_rPDNPpMTD0krejRgFpoUU_ilTus50jL2vZaL9_rVJx9A0f3_SnqfmXvmgFfQn91WuYqXOYJPmaV5x4MZU6X8Juz91eISPoZj6TjkdrkCgtNxf74oc9rQqskqE0EjBcux-tzu0LPRXo0NGFxZ4st86vhTBN9vctgsyFlPE9V3xKfodd7qzZmhUAnC3hvlSTGS81T2v5-AXR_dtbadvSoeGRRzuOIzV8JFzDWiRKEYwAb9zhOI1oipatKoAQjRcWAp6Vpme7DtdzHwMOz_nYMrEq7egkjIyZlhkoSqvN_LAHzErgC2AYKTTLWLTzdwtEqPLbQtgQoXb6L0b_uKomaOEyc5jWYDR6KH9myL83v8N0CbQ7p_SwnzhftolJeTBhDomPq2VJTWZm7Sc9nDSGTWCVQW4oRaYVPBNhdokr8w5kenOdF3vtHlbltBl52AIhoXQJSahKvCp8AHp8J4";

// Cabeceras CORS para permitir solicitudes desde cualquier origen
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

// Email por defecto para enviar desde MailerLite
const DEFAULT_FROM_EMAIL = "notificaciones@econecta.app";
const DEFAULT_FROM_NAME = "Econecta";

// Función para generar un ID aleatorio para los emails
function generateEmailId() {
  return `email_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

// Función para enviar correos electrónicos con MailerLite
Deno.serve(async (req) => {
  // Manejo de solicitudes OPTIONS para CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { 
      status: 200,
      headers: corsHeaders 
    });
  }
  
  try {
    // Obtener datos del correo desde la solicitud
    const {
      to,
      subject,
      recipientName,
      title,
      content,
      buttonText,
      buttonUrl,
    } = await req.json();
    
    // Validar que se proporcionen los campos necesarios
    if (!to || !subject || !title || !content) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Faltan campos requeridos: 'to', 'subject', 'title' y 'content' son obligatorios" 
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
    
    // Construir el HTML del correo
    const htmlContent = `
      <html>
        <head>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              line-height: 1.6;
              color: #333;
              margin: 0;
              padding: 0;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #ffffff;
            }
            .header {
              text-align: center;
              padding: 20px 0;
              border-bottom: 1px solid #eee;
            }
            .logo {
              width: 80px;
              height: auto;
            }
            .content {
              padding: 20px 0;
            }
            h1 {
              color: #336633;
            }
            h2 {
              color: #336633;
            }
            .button {
              display: inline-block;
              background-color: #4caf50;
              color: white;
              padding: 10px 20px;
              text-decoration: none;
              border-radius: 5px;
              margin-top: 15px;
            }
            .footer {
              border-top: 1px solid #eee;
              padding-top: 20px;
              margin-top: 20px;
              text-align: center;
              color: #777;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <img class="logo" src="https://res.cloudinary.com/dhvrrxejo/image/upload/v1746839122/Punto_de_Recoleccion_Marcador_z3nnyy.png" alt="Econecta Logo" />
            </div>
            <div class="content">
              <h1>Hola${recipientName ? `, ${recipientName}` : ''}</h1>
              <h2>${title}</h2>
              <p>${content}</p>
              ${buttonText && buttonUrl ? `<a href="${buttonUrl}" class="button">${buttonText}</a>` : ''}
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} Econecta. Todos los derechos reservados.</p>
              <p>Este correo fue enviado a través de nuestra plataforma de gestión ambiental.</p>
            </div>
          </div>
        </body>
      </html>
    `;
    
    // Texto plano alternativo
    const plainText = `${title}\n\n${content}${buttonText && buttonUrl ? `\n\n${buttonText}: ${buttonUrl}` : ''}`;
    
    // Preparar el correo para MailerLite
    const emailData = {
      id: generateEmailId(),
      subject: subject,
      from: {
        email: DEFAULT_FROM_EMAIL,
        name: DEFAULT_FROM_NAME
      },
      to: Array.isArray(to) 
        ? to.map(email => ({ email })) 
        : [{ email: to, name: recipientName }],
      html: htmlContent,
      plain: plainText
    };
    
    // Enviar correo usando la API de MailerLite (Campaigns Single Email)
    const response = await fetch("https://connect.mailerlite.com/api/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Bearer ${MAILERLITE_API_KEY}`
      },
      body: JSON.stringify(emailData)
    });
    
    // Procesar respuesta
    const data = await response.json();
    
    if (response.ok) {
      return new Response(
        JSON.stringify({ 
          success: true,
          message: "Correo enviado exitosamente",
          data: data
        }),
        { 
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          } 
        }
      );
    } else {
      console.error("Error al enviar correo con MailerLite:", data);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Error al enviar correo electrónico",
          details: data
        }),
        { 
          status: 200, // Usamos 200 en lugar de error status para evitar problemas con CORS
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          } 
        }
      );
    }
  } catch (error) {
    console.error("Error al procesar la solicitud de envío de correo:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `Error interno: ${error.message}` 
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
});
