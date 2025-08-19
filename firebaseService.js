const admin = require('firebase-admin');

// Initialisation de Firebase Admin
const serviceAccount = require('./serviceAccountKey.json'); // À créer

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://your-project-id.firebaseio.com' // Remplacez par votre URL Firebase
});

const db = admin.firestore();

module.exports = { admin, db };