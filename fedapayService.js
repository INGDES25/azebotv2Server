require('dotenv').config();
const axios = require('axios');

const createTransaction = async (amount, description, customer, articleId, userId) => {
  try {
    // URL de base selon l'environnement
    const baseURL = process.env.FEDAPAY_ENVIRONMENT === 'live' 
      ? 'https://api.fedapay.com' 
      : 'https://sandbox-api.fedapay.com';
    
    console.log('Configuration FedaPay:', {
      environment: process.env.FEDAPAY_ENVIRONMENT,
      baseURL,
      apiKey: process.env.FEDAPAY_API_KEY ? 'Présente' : 'Absente'
    });

    // Création de la transaction
    const transactionResponse = await axios.post(
      `${baseURL}/v1/transactions`,
      {
        amount: amount, // Conversion en centimes
        description: description,
        currency: { iso: 'XOF' },
        callback_url: process.env.FEDAPAY_CALLBACK_URL,
        customer: customer,
        reference: articleId,
        metadata: {
          userId: userId, // Stockage du userId dans les métadonnées
          articleId: articleId
        },
        redirect_url: {
          success: process.env.FEDAPAY_SUCCESS_URL,
          cancel: process.env.FEDAPAY_CANCEL_URL
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.FEDAPAY_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const transaction = transactionResponse.data;
    console.log('Transaction créée:', transaction);

    if (transaction['v1/transaction'] && transaction['v1/transaction'].payment_url) {
      return {
        success: true,
        url: transaction['v1/transaction'].payment_url,
        transactionId: transaction['v1/transaction'].id
      };
    } else {
      throw new Error('URL de paiement non trouvée dans la réponse');
    }
  } catch (error) {
    console.error('Erreur FedaPay:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message
    };
  }
};

module.exports = { createTransaction };