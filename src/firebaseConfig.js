import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Essas chaves vêm de variáveis de ambiente (arquivo .env localmente,
// ou "Secrets/Variables" do GitHub Actions em produção).
// Veja o README.md para o passo a passo de como criar seu projeto Firebase
// gratuito e obter essas chaves.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Só consideramos "configurado" se as chaves essenciais existirem.
// Se você ainda não configurou o Firebase, o site continua funcionando
// normalmente com localStorage (ver storagePolyfill.js) até você configurar.
export const firebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId
);

export let db = null;

if (firebaseConfigured) {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
}
