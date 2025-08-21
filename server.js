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


app.get('/api/payment-callback', (req, res) => {
  // Récupérer le statut depuis les paramètres
  const status = req.query.status || req.body?.transaction?.status;
  
  if (status === 'approved') {
    // Rediriger vers la page de succès
    res.redirect(process.env.FEDAPAY_SUCCESS_URL);
  } else {
    // Rediriger vers la page d'annulation
    res.redirect(process.env.FEDAPAY_CANCEL_URL);
  }
});


app.get('/api/test-callback', (req, res) => {
  console.log('=== TEST CALLBACK REÇU ===');
  console.log('Headers:', req.headers);
  console.log('Query:', req.query);
  console.log('Body:', req.body);
  res.status(200).send('Test callback reçu');
});



// Route pour vérifier le statut d'une transaction FedaPay
app.get('/api/transaction-status/:transactionId', async (req, res) => {
  try {
    const { transactionId } = req.params;
    
    console.log('🔍 Vérification du statut de la transaction:', transactionId);
    
    // URL de base selon l'environnement
    const baseURL = process.env.FEDAPAY_ENVIRONMENT === 'live' 
      ? 'https://api.fedapay.com' 
      : 'https://sandbox-api.fedapay.com';
    
    const response = await axios.get(`${baseURL}/v1/transactions/${transactionId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.FEDAPAY_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    const transaction = response.data;
    console.log('📊 Statut de la transaction:', transaction.status);
    
    res.json({
      status: transaction.status,
      amount: transaction.amount,
      mode: transaction.mode,
      reference: transaction.reference
    });
  } catch (error) {
    console.error('❌ Erreur lors de la vérification du statut de la transaction:', error);
    res.status(500).json({ error: 'Erreur lors de la vérification du statut de la transaction' });
  }
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
    console.log('=== CALLBACK FEDAPAY REÇU À', new Date().toISOString(), '===');
    const { transaction } = req.body;
    
    if (!transaction) {
      console.error('❌ Aucune transaction dans le callback');
      return res.status(400).send('Transaction manquante');
    }
    
    if (transaction.status === 'approved') {
      console.log('✅ Transaction approuvée, mise à jour de l\'article...');
      
      // Récupérer l'ID de l'article depuis la référence
      const articleId = transaction.reference;
      
      if (!articleId) {
        console.error('❌ articleId manquant dans la référence');
        return res.status(400).send('Article ID manquant');
      }
      
      // Récupérer l'ID de l'utilisateur depuis les métadonnées
      const metadata = transaction.metadata || {};
      const userId = metadata.userId;
      
      if (!userId) {
        console.error('❌ userId manquant dans les métadonnées');
        return res.status(400).send('User ID manquant');
      }
      
      try {
        // Mettre à jour le statut de paiement de l'article
        const updateData = {
          paymentStatus: 'paid',
          paymentId: transaction.id,
          paymentDate: new Date(),
          paymentAmount: transaction.amount / 100,
          paymentMethod: transaction.mode || 'fedapay',
          paidBy: userId // Stocker l'ID de l'utilisateur qui a payé
        };
        
        await db.collection('news').doc(articleId).update(updateData);
        console.log(`✅ Article ${articleId} marqué comme payé par l'utilisateur ${userId}`);
      } catch (firestoreError) {
        console.error('❌ Erreur Firestore:', firestoreError);
        return res.status(500).send('Erreur Firestore');
      }
    } else {
      console.log('⚠️ Transaction non approuvée, statut:', transaction.status);
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Erreur lors du traitement du callback:', error);
    res.status(500).send('Erreur interne du serveur');
  }
  const sendPaymentConfirmation = async (email, customerName, articleTitle) => {
          // Implémentez l'envoi d'email avec un service comme SendGrid, Nodemailer, etc.
          console.log(`Email de confirmation envoyé à ${email}`);
        };

        await sendPaymentConfirmation(
          transaction.customer?.email,
          `${transaction.customer?.firstname} ${transaction.customer?.lastname}`,
          articleTitle
        );

});

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});