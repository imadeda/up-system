import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCR5PCIaJWvi7hKmRTJwE9HBGz8MTF-S-w",
  authDomain: "up-system-d12fc.firebaseapp.com",
  databaseURL: "https://up-system-d12fc-default-rtdb.firebaseio.com",
  projectId: "up-system-d12fc",
  storageBucket: "up-system-d12fc.firebasestorage.app",
  messagingSenderId: "100913259554",
  appId: "1:100913259554:web:bc733ae3ff5bf35233567b"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
