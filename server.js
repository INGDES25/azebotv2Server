const express = require('express');
require('dotenv').config();
const cors = require('cors');
const { createTransaction } = require('./fedapayService');
const { db } = require('./firebaseService');

const app = express();
const PORT = process.env.PORT || 5000;

// Configuration CORS pour la production
const allowedOrigins = [
  'https://azebotv2-client.vercel.app',
  'http://localhost:8080', // Pour le développement local
  'http://192.168.1.101:8080' // Pour le développement local
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
  res.json({ message: 'Backend opérationnel en production!' });
});

// Route de création de paiement
app.post('/api/create-payment', async (req, res) => {
  console.log('Reçue une demande de création de paiement:', req.body);
  
  try {
    const { amount, description, customer, articleId, userId } = req.body;
    
    const result = await createTransaction(amount, description, customer, articleId, userId);
    
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
      // Récupérer les informations depuis les métadonnées
      const { userId, articleId } = transaction.metadata;
      
      if (userId && articleId) {
        // Créer un document dans la collection "ValidPay"
        const validPayData = {
          userId: userId,
          articleId: articleId,
          transactionId: transaction.id,
          amount: transaction.amount, // Convertir de centimes
          currency: 'XOF',
          paymentDate: new Date(),
          paymentMethod: transaction.mode || 'fedapay',
          status: 'approved',
          customerEmail: transaction.customer?.email || '',
          customerName: `${transaction.customer?.firstname || ''} ${transaction.customer?.lastname || ''}`.trim(),
          reference: transaction.reference,
          createdAt: new Date(),
          updatedAt: new Date()
        };


        const sendPaymentConfirmation = async (email, customerName, articleTitle) => {
  // Implémentez l'envoi d'email avec un service comme SendGrid, Nodemailer, etc.
  console.log(`Email de confirmation envoyé à ${email}`);
};

await sendPaymentConfirmation(
  transaction.customer?.email,
  `${transaction.customer?.firstname} ${transaction.customer?.lastname}`,
  articleTitle
);
        
        // Ajouter le document à la collection "ValidPay"
        const validPayRef = await db.collection('ValidPay').add(validPayData);
        console.log(`Document ValidPay créé avec ID: ${validPayRef.id}`);
        
        // Mettre à jour le statut de paiement dans la collection "news"
        await db.collection('news').doc(articleId).update({
          paymentStatus: 'paid',
          paymentId: transaction.id,
          paymentDate: new Date(),
          paymentAmount: transaction.amount,
          paymentMethod: transaction.mode || 'fedapay',
          validPayId: validPayRef.id
        });
        
        console.log(`Article ${articleId} marqué comme payé et document ValidPay créé`);
      } else {
        console.error('userId ou articleId manquant dans les métadonnées de la transaction');
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
  console.log(`Serveur démarré sur le port ${PORT}`);
});