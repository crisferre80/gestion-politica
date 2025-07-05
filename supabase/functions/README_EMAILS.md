# Implementación de Funciones de Correo Electrónico en Supabase

## Descripción

Este documento describe cómo implementar las funciones de Supabase necesarias para enviar correos electrónicos desde la aplicación Econecta. Estas funciones resuelven el problema de compatibilidad del navegador con módulos de Node.js como `nodemailer`.

## Implementación

### 1. Función `send-email`

Crear una nueva función Edge en Supabase:

```bash
supabase functions new send-email
```

Contenido del archivo `index.ts`:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer/mod.ts";

// Configuración del cliente SMTP
const client = new SMTPClient({
  connection: {
    hostname: Deno.env.get("SMTP_HOST") || "smtp.mailtrap.io",
    port: parseInt(Deno.env.get("SMTP_PORT") || "2525"),
    tls: Deno.env.get("SMTP_SECURE") === "true",
    auth: {
      username: Deno.env.get("SMTP_USER") || "user",
      password: Deno.env.get("SMTP_PASSWORD") || "password",
    },
  },
});

// Función para generar HTML de email básico
function generateEmailHTML(options: {
  recipientName?: string;
  title: string;
  content: string;
  buttonText?: string;
  buttonUrl?: string;
}) {
  const { recipientName = 'Usuario', title, content, buttonText, buttonUrl } = options;
  
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      body { 
        font-family: Arial, sans-serif;
        margin: 0;
        padding: 0;
        background-color: #f5f5f5;
      }
      .container {
        max-width: 600px;
        margin: 0 auto;
        background-color: #ffffff;
        padding: 20px;
      }
      .header {
        text-align: center;
        padding: 20px 0;
      }
      .content {
        padding: 20px 0;
      }
      .button {
        background-color: #4caf50;
        border: none;
        color: white;
        padding: 15px 32px;
        text-align: center;
        text-decoration: none;
        display: inline-block;
        font-size: 16px;
        margin: 4px 2px;
        cursor: pointer;
        border-radius: 4px;
      }
      .footer {
        padding: 20px 0;
        text-align: center;
        color: #666666;
        font-size: 12px;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <img src="https://res.cloudinary.com/dhvrrxejo/image/upload/v1746839122/Punto_de_Recoleccion_Marcador_z3nnyy.png" alt="Econecta Logo" width="50" height="50" />
      </div>
      <div class="content">
        <h1>Hola, ${recipientName}</h1>
        <h2>${title}</h2>
        <p>${content}</p>
        ${buttonText && buttonUrl ? `<p><a href="${buttonUrl}" class="button">${buttonText}</a></p>` : ''}
      </div>
      <div class="footer">
        <p>&copy; ${new Date().getFullYear()} Econecta. Todos los derechos reservados.</p>
        <p>Si no desea recibir estos correos, puede <a href="#">cancelar su suscripción</a>.</p>
      </div>
    </div>
  </body>
  </html>
  `;
}

serve(async (req) => {
  try {
    const {
      to,
      subject,
      recipientName,
      title,
      content,
      buttonText,
      buttonUrl,
    } = await req.json();
    
    // Generar HTML del email
    const htmlContent = generateEmailHTML({
      recipientName,
      title,
      content,
      buttonText,
      buttonUrl
    });
    
    // Enviar correo
    await client.send({
      from: Deno.env.get("SMTP_FROM") || '"Econecta" <notificaciones@econecta.app>',
      to,
      subject,
      html: htmlContent,
      text: `${title}\n\n${content}${buttonText && buttonUrl ? `\n\n${buttonText}: ${buttonUrl}` : ''}`,
    });
    
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
```

### 2. Función `verify-email-service`

```bash
supabase functions new verify-email-service
```

Contenido del archivo `index.ts`:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer/mod.ts";

serve(async (_req) => {
  try {
    // Crear un cliente SMTP temporal para verificación
    const client = new SMTPClient({
      connection: {
        hostname: Deno.env.get("SMTP_HOST") || "smtp.mailtrap.io",
        port: parseInt(Deno.env.get("SMTP_PORT") || "2525"),
        tls: Deno.env.get("SMTP_SECURE") === "true",
        auth: {
          username: Deno.env.get("SMTP_USER") || "user",
          password: Deno.env.get("SMTP_PASSWORD") || "password",
        },
      },
    });
    
    // Intenta conectar para verificar
    await client.connect();
    await client.close();
    
    return new Response(
      JSON.stringify({ available: true }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Email service verification failed:", error);
    return new Response(
      JSON.stringify({ available: false, error: error.message }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
});
```

## Configuración de Secretos

Para configurar las variables de entorno en Supabase:

```bash
supabase secrets set SMTP_HOST=smtp.tu-proveedor-email.com
supabase secrets set SMTP_PORT=587
supabase secrets set SMTP_USER=tu-usuario
supabase secrets set SMTP_PASSWORD=tu-contraseña
supabase secrets set SMTP_SECURE=false
supabase secrets set SMTP_FROM='"Econecta" <notificaciones@econecta.app>'
```

## Despliegue

Para desplegar las funciones:

```bash
supabase functions deploy send-email --no-verify-jwt
supabase functions deploy verify-email-service --no-verify-jwt
```

## Verificación

Puedes probar el funcionamiento con una solicitud de prueba:

```bash
curl -X POST https://tu-proyecto.supabase.co/functions/v1/send-email \
  -H "Content-Type: application/json" \
  -d '{"to":"destinatario@ejemplo.com","subject":"Prueba","title":"Correo de prueba","content":"Este es un correo de prueba"}'
```

## Notas Adicionales

1. Estas funciones no requieren autenticación JWT por defecto para facilitar la implementación inicial. En un entorno de producción, considera añadir autenticación.
2. Puedes personalizar el HTML del correo según las necesidades de tu aplicación.
3. Para un envío masivo más eficiente, considera implementar una cola de trabajos.
