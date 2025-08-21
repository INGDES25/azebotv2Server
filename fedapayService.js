require('dotenv').config();
const axios = require('axios');

const createTransaction = async (amount, description, customer, articleId, userId) => {
  try {
    const baseURL = process.env.FEDAPAY_ENVIRONMENT === 'live' 
      ? 'https://api.fedapay.com' 
      : 'https://sandbox-api.fedapay.com';
    
    console.log('🚀 Création de transaction FedaPay...');
    console.log('📊 Configuration:', {
      environment: process.env.FEDAPAY_ENVIRONMENT,
      baseURL,
      apiKey: process.env.FEDAPAY_API_KEY ? 'Présente' : 'Absente'
    });
    
    const transactionData = {
      amount: amount,
      description: description,
      currency: { iso: 'XOF' },
      callback_url: process.env.FEDAPAY_CALLBACK_URL,
      customer: customer,
      reference: articleId,
      metadata: {
        userId: userId,
        articleId: articleId
     },
      redirect_url: {
        success: `${process.env.FEDAPAY_SUCCESS_URL}?article_id=${articleId}`,
        cancel: `${process.env.FEDAPAY_CANCEL_URL}?article_id=${articleId}`
      }
    };
    
    console.log('📤 Données envoyées à FedaPay:', JSON.stringify(transactionData, null, 2));

    const transactionResponse = await axios.post(
      `${baseURL}/v1/transactions`,
      transactionData,
      {
        headers: {
          'Authorization': `Bearer ${process.env.FEDAPAY_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const transaction = transactionResponse.data;
    console.log('📥 Réponse FedaPay:', JSON.stringify(transaction, null, 2));

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
    console.error('❌ Erreur FedaPay:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message
    };
  }
};

module.exports = { createTransaction };