import path from 'path';
import { readFile } from 'fs/promises';
import dotenv from 'dotenv';
import sql from 'mssql';

dotenv.config();

if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'test';
}

const escapeIdentifier = (value) => `[${value.replace(/]/g, ']]')}]`;

const buildConfig = (database) => ({
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || '',
    server: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 1434,
    database,
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true,
        instanceName: process.env.DB_INSTANCE || ''
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
});

const schemaPath = path.join(process.cwd(), 'sql', 'schema.sql');
const targetDatabase = process.env.DB_NAME || 'padrao';

const dropAndCreateDatabase = async () => {
    const masterConfig = buildConfig('master');
    const pool = await sql.connect(masterConfig);
    try {
        const escapedName = escapeIdentifier(targetDatabase);
        await pool
            .request()
            .input('dbName', sql.NVarChar, targetDatabase)
            .query(`
                IF EXISTS (SELECT name FROM sys.databases WHERE name = @dbName)
                BEGIN
                    ALTER DATABASE ${escapedName} SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
                    DROP DATABASE ${escapedName};
                END
            `);
        await pool.request().query(`CREATE DATABASE ${escapedName};`);
        console.log(`✅ Banco ${targetDatabase} recriado`);
    } finally {
        await pool.close();
    }
};

const runSchema = async () => {
    const schemaSql = await readFile(schemaPath, 'utf-8');
    const pool = await sql.connect(buildConfig(targetDatabase));
    try {
        await pool.request().batch(schemaSql);
        console.log('✅ Estrutura SQL aplicada');
    } finally {
        await pool.close();
    }
};

const formatDate = (date) => date.toISOString().split('T')[0];

const seedDatabase = async (request, dbInstance) => {
    const timestamp = Date.now();
    const password = process.env.RECREATE_DB_PASSWORD || 'SenhaForte123!';
    const emails = {
        admin: `admin+${timestamp}@recreate.local`,
        owner: `dono+${timestamp}@recreate.local`,
        funcionario: `funcionario+${timestamp}@recreate.local`,
        aluno: `aluno+${timestamp}@recreate.local`
    };

    console.log('\n🎯 Iniciando seed via rotas');
    const admin = await request
        .post('/auth/register')
        .send({ name: 'Admin Reset', email: emails.admin, password, role: 'admin' })
        .expect(201);

    const adminToken = admin.body.token;
    const suffix = String(timestamp).slice(-3).padStart(3, '0');
    const academyPayload = {
        nome: `Academia Reset ${timestamp}`,
        cnpj: `12.345.${suffix}/0001-99`
    };

    const academy = await request
        .post('/academias')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(academyPayload)
        .expect(201);

    const academiaId = academy.body.data.id;

    const owner = await request
        .post('/auth/register')
        .send({
            name: 'Dono Reset',
            email: emails.owner,
            password,
            role: 'dono',
            academiaId
        })
        .expect(201);

    const funcionario = await request
        .post('/auth/register')
        .send({
            name: 'Funcionario Reset',
            email: emails.funcionario,
            password,
            role: 'funcionario',
            academiaId
        })
        .expect(201);

    const aluno = await request
        .post('/auth/register')
        .send({
            name: 'Aluno Reset',
            email: emails.aluno,
            password,
            academiaId
        })
        .expect(201);

    const ownerToken = owner.body.token;
    const alunoToken = aluno.body.token;
    const funcionarioToken = funcionario.body.token;
    const alunoId = aluno.body.user.id;

    const ownerAuthHeader = `Bearer ${ownerToken}`;
    const plano = await request
        .post('/owner/planos')
        .set('Authorization', ownerAuthHeader)
        .send({
            nome: 'Plano Reset Teste',
            valor: 199.9,
            descricao: 'Plano criado para testes automatizados',
            maxAulasPorSemana: 3
        })
        .expect(201);

    const aula = await request
        .post('/aulas')
        .set('Authorization', ownerAuthHeader)
        .send({
            nome: 'Aula Reset',
            descricao: 'Aula criada para testes'
        })
        .expect(201);

    const horario = await request
        .post('/horarios')
        .set('Authorization', ownerAuthHeader)
        .send({
            aulaId: aula.body.data.id,
            diaSemana: 1,
            horaInicio: '08:00',
            horaFim: '09:00'
        })
        .expect(201);

    await request
        .post(`/owner/planos/${plano.body.data.id}/aulas`)
        .set('Authorization', ownerAuthHeader)
        .send({
            aulaId: aula.body.data.id
        })
        .expect(201);

    const [assinaturaInserted] = await dbInstance.query(
        `
            INSERT INTO Assinaturas (aluno_id, plano_id, data_inicio, status)
            OUTPUT INSERTED.*
            VALUES (@alunoId, @planoId, @dataInicio, 'ativa')
        `,
        {
            alunoId,
            planoId: plano.body.data.id,
            dataInicio: new Date()
        }
    );

    const dataAula = formatDate(new Date(Date.now() + 24 * 60 * 60 * 1000));

    const presenca = await request
        .post('/presencas')
        .set('Authorization', `Bearer ${alunoToken}`)
        .send({
            alunoId,
            aulaId: aula.body.data.id,
            horarioId: horario.body.data.id,
            dataAula
        })
        .expect(201);

    console.log('\n📦 Seed concluído com os seguintes dados:');
    console.log(`- Academia: ${academyPayload.nome} (id ${academiaId})`);
    console.log(`- Plano: ${plano.body.data.nome} (id ${plano.body.data.id})`);
    console.log(`- Aula: ${aula.body.data.nome} (id ${aula.body.data.id})`);
    console.log(`- Horário: ${horario.body.data.id} (${horario.body.data.horaInicio}-${horario.body.data.horaFim})`);
    console.log(`- Assinatura: ${assinaturaInserted?.id}`);
    console.log(`- Presença: ${presenca.body.data.id} para ${dataAula}`);

    console.log('\n🔐 Credenciais para Postman:');
    console.log(`  Admin: ${emails.admin}/${password} → token ${adminToken}`);
    console.log(`  Dono: ${emails.owner}/${password} → token ${ownerToken}`);
    console.log(`  Funcionario: ${emails.funcionario}/${password} → token ${funcionarioToken}`);
    console.log(`  Aluno: ${emails.aluno}/${password} → token ${alunoToken}`);
    console.log(`\nAtive o header Authorization: Bearer <token> ao testar as rotas.`);
};

const main = async () => {
    try {
        await dropAndCreateDatabase();
        await runSchema();

        const supertestModule = await import('supertest');
        const { default: app } = await import('../src/server/server.js');
        const { default: dbInstance } = await import('../src/config/db.js');
        const request = supertestModule.default(app);

        await dbInstance.connect();
        await seedDatabase(request, dbInstance);
        await dbInstance.getPool().close();
        console.log('\n🎉 Banco reconstruído com sucesso');
    } catch (error) {
        console.error('\n❌ Falha ao recriar o banco:', error.message);
        console.error(error);
        process.exit(1);
    }
};

await main();
