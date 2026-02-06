import sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

const config = {
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || '',
    server: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 1434,
    database: process.env.DB_NAME || 'padrao',
    
    options: {
        encrypt: false, // Para desenvolvimento local
        trustServerCertificate: true,
        enableArithAbort: true,
        instanceName: process.env.DB_INSTANCE || '', // Ex: 'SQLEXPRESS'
    },
    
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

let pool;


const connectDB = async () => {
    try {
        pool = await sql.connect(config);
        console.log('✅ SQL Server conectado com sucesso');
        console.log(`   Server: ${config.server}`);
        console.log(`   Database: ${config.database}`);
        console.log(`   Port: ${config.port}`);
        return pool;
    } catch (err) {
        console.error('❌ Erro ao conectar no SQL Server:');
        console.error(`   Server: ${config.server}`);
        console.error(`   Database: ${config.database}`);
        console.error(`   Port: ${config.port}`);
        console.error(`   User: ${config.user}`);
        console.error(`   Erro: ${err.message}`);
        throw err;
    }
};

const db = {
    connect: connectDB,
    
    // Retorna o pool de conexões
    getPool: () => {
        if (!pool || !pool.connected) {
            throw new Error('Pool não está conectado. Execute db.connect() primeiro.');
        }
        return pool;
    },
    
    // Helper para executar queries
    async query(queryString, params = {}) {
        try {
            const currentPool = db.getPool();
            const request = currentPool.request();
            
            // Adicionar parâmetros se houver
            Object.keys(params).forEach(key => {
                request.input(key, params[key]);
            });
            
            const result = await request.query(queryString);
            return result.recordset;
        } catch (error) {
            console.error('Erro ao executar query:', error.message);
            throw error;
        }
    }
};

export default db;