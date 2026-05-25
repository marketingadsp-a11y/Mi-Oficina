import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

// Configuración proporcionada por el usuario
const firebaseConfig = {
  apiKey: "AIzaSyCqmEaerkS7Qw7bVvSlGnvGdD-Jad6VamU",
  authDomain: "mi-oficina-9a31c.firebaseapp.com",
  projectId: "mi-oficina-9a31c",
  storageBucket: "mi-oficina-9a31c.firebasestorage.app",
  messagingSenderId: "816914414943",
  appId: "1:816914414943:web:866201b9a9ddc3a7f04aea",
  measurementId: "G-KHF46VF7SE"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);
const analytics = getAnalytics(app);

export { db, storage, auth, analytics };
