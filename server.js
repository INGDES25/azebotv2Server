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
    console.log('=== CALLBACK FEDAPAY REÇU ===');
    console.log('Headers:', req.headers);
    console.log('Body:', JSON.stringify(req.body, null, 2));
    console.log('=== FIN CALLBACK ===');
    
    const { transaction } = req.body;
    
    if (!transaction) {
      console.error('❌ Aucune transaction dans le callback');
      return res.status(400).send('Transaction manquante');
    }
    
    console.log('📊 Statut de la transaction:', transaction.status);
    
    if (transaction.status === 'approved') {
      console.log('✅ Transaction approuvée, traitement...');
      
      // Récupérer les métadonnées
      const metadata = transaction.metadata || {};
      const { userId, articleId } = metadata;
      
      console.log('📝 Métadonnées extraites:', { userId, articleId });
      
      if (!userId || !articleId) {
        console.error('❌ userId ou articleId manquant');
        console.error('Métadonnées complètes:', metadata);
        return res.status(400).send('Métadonnées incomplètes');
      }
      
      // Créer le document ValidPay
      const validPayData = {
        userId: userId,
        articleId: articleId,
        transactionId: transaction.id,
        amount: transaction.amount,
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
      
      console.log('💾 Données ValidPay à créer:', validPayData);
      
      try {
        // Création du document
        const validPayRef = await db.collection('ValidPay').add(validPayData);
        console.log(`✅ Document ValidPay créé avec ID: ${validPayRef.id}`);
        
        // Mise à jour de l'article
        await db.collection('news').doc(articleId).update({
          paymentStatus: 'paid',
          paymentId: transaction.id,
          paymentDate: new Date(),
          paymentAmount: transaction.amount,
          paymentMethod: transaction.mode || 'fedapay',
          validPayId: validPayRef.id
        });
        
        console.log(`✅ Article ${articleId} mis à jour`);
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