const express = require('express');
require('dotenv').config();
const cors = require('cors');
const { createTransaction } = require('./fedapayService');
const { db } = require('./firebaseService'); // Ajout

const app = express();
const PORT = process.env.PORT || 5000;

// Configuration CORS
const allowedOrigins = [
  'http://localhost:8080',
  'http://192.168.1.101:8080'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('Origine non autorisée:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());

// Route de test
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend opérationnel!' });
});

// Route de création de paiement
app.post('/api/create-payment', async (req, res) => {
  console.log('Reçue une demande de création de paiement:', req.body);
  
  try {
    const { amount, description, customer, articleId } = req.body;
    
    const result = await createTransaction(amount, description, customer, articleId);
    
    if (result.success) {
      res.json({
        success: true,
        url: result.url,
        transactionId: result.transactionId
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Erreur lors de la création du paiement:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur interne du serveur'
    });
  }
});

// Route de callback pour FedaPay
app.post('/api/payment-callback', async (req, res) => {
  try {
    console.log('Callback reçu de FedaPay:', req.body);
    
    const { transaction } = req.body;
    
    if (transaction.status === 'approved') {
      // Extraire l'ID de l'article depuis la référence
      const articleId = transaction.reference;
      
      if (articleId) {
        // Mettre à jour le statut de paiement dans Firebase
        await db.collection('news').doc(articleId).update({
          paymentStatus: 'paid',
          paymentId: transaction.id,
          paymentDate: new Date(),
          paymentAmount: transaction.amount / 100, // Convertir de centimes
          paymentMethod: transaction.mode || 'fedapay'
        });
        
        console.log(`Article ${articleId} marqué comme payé`);
      }
    }
    
    // Réponse à FedaPay
    res.status(200).send('OK');
  } catch (error) {
    console.error('Erreur lors du traitement du callback:', error);
    res.status(500).send('Erreur interne du serveur');
  }
});

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});