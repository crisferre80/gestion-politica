// Archivo de configuración para Firebase
const FIREBASE_CONFIG = {
  // Configuración del cliente Firebase
  client: {
    apiKey: "AIzaSyDOJYAby32IrARJaCkJ1o7hGmU7HAGtdL4",
    authDomain: "econecta2-346d4.firebaseapp.com",
    projectId: "econecta2-346d4",
    storageBucket: "econecta2-346d4.firebasestorage.app",
    messagingSenderId: "15435452481",
    appId: "1:15435452481:web:b2e9ae56fd38724a0436c0",
    measurementId: "G-R1E2PWNYLV"
  },
  // Clave web push (VAPID) para notificaciones - formato correcto para la Web Push API
  vapidKey: "BEb3IDkDXLZ-Zg_BpVzBa9ZrT9Hu9BkskiTxwkLxI0TybSBYZiZiYs-9DARAJfIUvn9hEP_FvMzVfT8RWbqNxI0",
  // Clave del servidor Admin SDK para backend (esta sería la clave privada real, no la pública)
  serverKey: "8mjZg2aU_cC-mXi0E9nRRi4aOQQmGh3WPKtPDn2rixY"
};

// Credenciales para Firebase Admin SDK
const FIREBASE_ADMIN_CREDENTIALS = {
  type: "service_account",
  project_id: "econecta2-346d4",
  private_key: FIREBASE_CONFIG.serverKey,
  client_email: "firebase-adminsdk-econecta@econecta2-346d4.iam.gserviceaccount.com"
};

export { FIREBASE_CONFIG, FIREBASE_ADMIN_CREDENTIALS };
