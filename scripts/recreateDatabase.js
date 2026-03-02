import path from 'path';
import { readFile, readdir } from 'fs/promises';
import dotenv from 'dotenv';
import sql from 'mssql';
import passwordService from '../src/services/passwordService.js';

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

const schemaDir = path.join(process.cwd(), 'sql');
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
    const pool = await sql.connect(buildConfig(targetDatabase));
    try {
        const files = (await readdir(schemaDir)).filter((file) => file.endsWith('.sql'));
        const prioritized = files.includes('schema.sql')
            ? ['schema.sql', ...files.filter((file) => file !== 'schema.sql').sort()]
            : [...files.sort()];

        for (const fileName of prioritized) {
            const filePath = path.join(schemaDir, fileName);
            const scriptSql = await readFile(filePath, 'utf-8');
            await pool.request().batch(scriptSql);
            console.log(`✅ Estrutura aplicada: ${fileName}`);
        }

        console.log('✅ Estrutura SQL aplicada');
    } finally {
        await pool.close();
    }
};

const formatDate = (date) => date.toISOString().split('T')[0];

const seedDatabase = async (request, dbInstance) => {
    const password = process.env.RECREATE_DB_PASSWORD || 'SenhaForte123!';
    const resetPasswordValue = process.env.RECREATE_RESET_PASSWORD || 'SenhaReset123!';
    const emails = {
        admin: process.env.RECREATE_ADMIN_EMAIL || 'admin@recreate.local',
        owner: process.env.RECREATE_OWNER_EMAIL || 'dono@recreate.local',
        funcionario: process.env.RECREATE_FUNCIONARIO_EMAIL || 'funcionario@recreate.local',
        aluno: process.env.RECREATE_ALUNO_EMAIL || 'aluno@recreate.local'
    };

    console.log('\n🎯 Iniciando seed via rotas');
    const admin = await request
        .post('/auth/register')
        .send({ name: 'Admin Reset', email: emails.admin, password, role: 'admin' })
        .expect(201);

    const adminToken = admin.body.token;
    const academyPayload = {
        nome: process.env.RECREATE_ACADEMIA_NOME || 'Academia Reset',
        cnpj: process.env.RECREATE_ACADEMIA_CNPJ || '12.345.678/0001-91'
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
            maxAulasPorSemana: 3,
            duracaoMeses: 3,
            recorrente: true
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

    const assinaturaInsertDate = new Date();
    const [assinaturaInserted] = await dbInstance.query(
        `
            INSERT INTO Assinaturas (aluno_id, plano_id, data_inicio, status, duracao_meses, recorrente)
            OUTPUT INSERTED.*
            VALUES (@alunoId, @planoId, @dataInicio, 'ativa', @duracaoMeses, @recorrente)
        `,
        {
            alunoId,
            planoId: plano.body.data.id,
            dataInicio: assinaturaInsertDate,
            duracaoMeses: plano.body.data.duracaoMeses ?? 1,
            recorrente: plano.body.data.recorrente ? 1 : 0
        }
    );
    const faturaDueDate = formatDate(assinaturaInsertDate);
    const [faturaInserted] = await dbInstance.query(
        `
            INSERT INTO Faturas (assinatura_id, valor, data_vencimento, data_pagamento, status)
            OUTPUT INSERTED.*
            VALUES (@assinaturaId, @valor, @dataVencimento, NULL, 'PENDENTE')
        `,
        {
            assinaturaId: assinaturaInserted.id,
            valor: plano.body.data.valor,
            dataVencimento: faturaDueDate
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

    await request
        .patch('/auth/password')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
            currentPassword: password,
            newPassword: password,
            confirmPassword: password
        })
        .expect(200);

    await request
        .post('/auth/forgot-password')
        .send({ email: emails.aluno })
        .expect(200);

    const resetTokenData = await passwordService.requestPasswordReset(emails.aluno);
    if (!resetTokenData?.token) {
        throw new Error('Não foi possível gerar o token de redefinição');
    }

    await request
        .get(`/auth/reset-password/${resetTokenData.token}`)
        .expect(200);

    await request
        .post('/auth/reset-password')
        .send({
            token: resetTokenData.token,
            newPassword: resetPasswordValue,
            confirmPassword: resetPasswordValue
        })
        .expect(200);

    console.log('\n📦 Seed concluído com os seguintes dados:');
    console.log(`- Academia: ${academyPayload.nome} (id ${academiaId})`);
    console.log(`- Plano: ${plano.body.data.nome} (id ${plano.body.data.id})`);
    console.log(`- Aula: ${aula.body.data.nome} (id ${aula.body.data.id})`);
    console.log(`- Horário: ${horario.body.data.id} (${horario.body.data.horaInicio}-${horario.body.data.horaFim})`);
    console.log(`- Assinatura: ${assinaturaInserted?.id}`);
    console.log(`- Fatura: ${faturaInserted?.id}`);
    console.log(`- Presença: ${presenca.body.data.id} para ${dataAula}`);

    console.log('\n🔐 Credenciais para Postman:');
    console.log(`  Admin: ${emails.admin}/${password} → token ${adminToken}`);
    console.log(`  Dono: ${emails.owner}/${password} → token ${ownerToken}`);
    console.log(`  Funcionario: ${emails.funcionario}/${password} → token ${funcionarioToken}`);
    console.log(`  Aluno: ${emails.aluno}/${resetPasswordValue} → token ${alunoToken}`);
    console.log(`\n🔁 Fluxo de redefinição validado para ${emails.aluno}`);
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
