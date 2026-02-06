import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import db from '../config/db.js';

dotenv.config();

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());


// Função para iniciar o servidor
const startServer = async () => {
    try {
        // Conecta ao SQL Server ANTES de iniciar as rotas
        await db.connect();
        
        // Rota de health check
        app.get('/health', async (req, res) => {
            try {
                // Usando sintaxe SQL Server (TOP ao invés de LIMIT)
                const rows = await db.query('SELECT TOP 1 * FROM Academias');
                
                res.json({
                    status: 'OK ✅',
                    database: 'CONECTADO ✅',
                    sqlServer: 'Funcionando',
                    timestamp: new Date().toISOString(),
                    recordCount: rows.length,
                    sample: rows[0] || null
                });
            } catch (error) {
                console.error('Erro no health check:', error.message);
                
                res.status(500).json({
                    status: 'ERRO ❌',
                    database: 'FALHOU ❌',
                    message: 'Erro ao conectar com o banco de dados',
                    timestamp: new Date().toISOString()
                });
            }
        });
        
        // Rota raiz
        app.get('/', (req, res) => {
            res.json({
                message: 'API SQL Server funcionando',
                version: '1.0.0',
                database: 'SQL Server',
                endpoints: {
                    health: '/health',
                    academias: '/academias'
                }
            });
        });
        
        // Exemplo de rota para listar academias
        app.get('/academias', async (req, res) => {
            try {
                const academias = await db.query('SELECT * FROM Academias');
                res.json({
                    success: true,
                    count: academias.length,
                    data: academias
                });
            } catch (error) {
                console.error('Erro ao buscar academias:', error.message);
                res.status(500).json({
                    success: false,
                    message: 'Erro ao buscar academias'
                });
            }
        });
        
        // Tratamento de erros global
        app.use((err, req, res, next) => {
            console.error('Erro não tratado:', err);
            res.status(500).json({
                status: 'error',
                message: 'Erro interno do servidor'
            });
        });
        
        // Iniciar servidor HTTP
        const PORT = process.env.PORT || 3001;
        app.listen(PORT, () => {
            console.log('\n🚀 Servidor rodando com sucesso!');
            console.log(`   URL: http://localhost:${PORT}`);
            console.log(`   Health: http://localhost:${PORT}/health`);
            console.log(`   Academias: http://localhost:${PORT}/academias`);
            console.log(`   Ambiente: ${process.env.NODE_ENV || 'development'}\n`);
        });
        
    } catch (error) {
        console.error('\n❌ FALHA AO INICIAR SERVIDOR:');
        console.error(`   ${error.message}\n`);
        console.error('💡 Verifique:');
        console.error('   1. SQL Server está rodando?');
        console.error('   2. Credenciais no .env estão corretas?');
        console.error('   3. Banco de dados existe?');
        console.error('   4. Usuário tem permissão?\n');
        process.exit(1);
    }
};

// Iniciar
startServer();

export default app;