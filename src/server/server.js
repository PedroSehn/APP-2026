import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import db from '../config/db.js';
import mysql from 'mysql2/promise';
const app = express();
app.use(cors());
app.use(express.json());

dotenv.config();

app.get('/health', async (req, res) => {
  try {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 1433,
        database: process.env.DB_NAME || 'padrao',
        user: process.env.DB_USER || 'sa',
        password: process.env.DB_PASSWORD || ''
      });
      console.log(connection);
    const [rows] = await connection.execute(`SELECT * FROM Academias`);
    await connection.end();

    res.json({
      status: 'OK ✅',
      db: 'CONECTADO ✅',
      conexoes: 'Pool funcionando',
      timestamp: new Date().toISOString(),
      resultado_query: rows[0]
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERRO ❌',
      db: 'FALHOU ❌',
      erro: error.message,
      resultado_query: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 1433,
        database: process.env.DB_NAME || 'padrao',
        user: process.env.DB_USER || 'sa',
        password: process.env.DB_PASSWORD || ''
      },
    });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 http://localhost:${PORT}`);
  console.log(`🧪 Teste: http://localhost:${PORT}/health`);
});