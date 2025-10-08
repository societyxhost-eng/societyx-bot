require('dotenv').config();
const mongoose = require('mongoose');

async function connectDB() {
  if (!process.env.MONGO_URI) {
    console.error('❌ MONGO_URI não está definida! Verifique o .env ou as variáveis do SquareCloud.');
    console.log('process.env:', process.env); // debug
    return;
  }

  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Conectado ao MongoDB Atlas!');
  } catch (err) {
    console.error('❌ Erro ao conectar ao MongoDB:', err);
  }
}

module.exports = connectDB;
