// ** IMPORTANT: Replace these placeholders with your actual Firebase configuration **

const firebaseConfig = {
    apiKey: "AIzaSyBGjXunUl03qs5XScJJfBYFcZrom1aErqo",
    authDomain: "univista-project.firebaseapp.com",
    projectId: "univista-project",
    storageBucket: "univista-project.firebasestorage.app",
    messagingSenderId: "951208963946",
    appId: "1:951208963946:web:b6406284cacecc95aabf13"
};

// Inside firebase-config.js (using Namespaced/Compat style)

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = app.auth();        // <-- Changed from firebase.getAuth(app)
const db = app.firestore();    // <-- Changed from firebase.getFirestore(app)
const storage = app.storage();  // <-- Changed from firebase.getStorage(app)

// Expose these for use in other JS files
window.auth = auth;
window.db = db;
window.storage = storage;