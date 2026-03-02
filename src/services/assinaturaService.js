import db from '../config/db.js';
import { getPlanoById, ensurePlanoBelongsToAcademia } from './planoService.js';

const throwAlunoNotFound = () => {
    const error = new Error('Aluno ativo não encontrado para esta academia');
    error.code = 'ALUNO_NOT_FOUND';
    throw error;
};

const throwAlunoNotAluno = () => {
    const error = new Error('O usuário informado não é um aluno');
    error.code = 'ASSINATURA_ALUNO_INVALIDO';
    throw error;
};

const throwActiveAssinaturaExists = () => {
    const error = new Error('Já existe uma assinatura ativa para este aluno');
    error.code = 'ASSINATURA_JA_ATIVA';
    throw error;
};

const formatDate = (value, includeTime = false) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        const error = new Error('Data inválida');
        error.code = 'ASSINATURA_DATA_INVALIDA';
        throw error;
    }

    const iso = date.toISOString();
    if (includeTime) {
        return iso.slice(0, 19).replace('T', ' ');
    }

    return iso.split('T')[0];
};

const normalizeStatus = (value, fallback) => {
    if (!value) {
        return fallback;
    }
    return `${value}`.trim().toUpperCase();
};

const ensureAlunoInAcademia = async (alunoId, academiaId) => {
    const rows = await db.query(
        `
            SELECT id, role
            FROM Usuarios
            WHERE id = @alunoId AND academia_id = @academiaId
        `,
        { alunoId, academiaId }
    );

    if (!rows.length) {
        throwAlunoNotFound();
    }

    if (rows[0].role !== 'aluno') {
        throwAlunoNotAluno();
    }

    return rows[0];
};

const ensureNoActiveAssinatura = async (alunoId) => {
    const rows = await db.query(
        `
            SELECT id
            FROM Assinaturas
            WHERE aluno_id = @alunoId AND status = 'ATIVA'
        `,
        { alunoId }
    );

    if (rows.length) {
        throwActiveAssinaturaExists();
    }
};

const mapAssinaturaRecord = (record) => ({
    id: record.id,
    alunoId: record.aluno_id,
    planoId: record.plano_id,
    dataInicio: record.data_inicio,
    status: record.status
});

const mapFaturaRecord = (record) => ({
    id: record.id,
    assinaturaId: record.assinatura_id,
    valor: Number(record.valor ?? 0),
    dataVencimento: record.data_vencimento,
    dataPagamento: record.data_pagamento,
    status: record.status
});

const createAssinatura = async ({
    alunoId,
    planoId,
    academiaId,
    dataInicio,
    status,
    dataVencimento,
    faturaStatus
}) => {
    if (!dataInicio) {
        const error = new Error('dataInicio é obrigatória');
        error.code = 'ASSINATURA_DATA_OBRIGATORIA';
        throw error;
    }

    await ensureAlunoInAcademia(alunoId, academiaId);
    await ensureNoActiveAssinatura(alunoId);
    await ensurePlanoBelongsToAcademia(planoId, academiaId);
    const plano = await getPlanoById(planoId, academiaId);

    const formattedDataInicio = formatDate(dataInicio, true);
    const assinaturaStatus = normalizeStatus(status, 'ATIVA');
    const assinaturaRows = await db.query(
        `
            INSERT INTO Assinaturas (aluno_id, plano_id, data_inicio, status)
            OUTPUT INSERTED.*
            VALUES (@alunoId, @planoId, @dataInicio, @status)
        `,
        {
            alunoId,
            planoId,
            dataInicio: formattedDataInicio,
            status: assinaturaStatus
        }
    );

    const assinatura = assinaturaRows[0];
    const dueDate = dataVencimento ? formatDate(dataVencimento) : formatDate(dataInicio);
    const faturaRows = await db.query(
        `
            INSERT INTO Faturas (assinatura_id, valor, data_vencimento, data_pagamento, status)
            OUTPUT INSERTED.*
            VALUES (@assinaturaId, @valor, @dataVencimento, @dataPagamento, @status)
        `,
        {
            assinaturaId: assinatura.id,
            valor: Number(plano.valor),
            dataVencimento: dueDate,
            dataPagamento: null,
            status: normalizeStatus(faturaStatus, 'PENDENTE')
        }
    );

    return {
        assinatura: mapAssinaturaRecord(assinatura),
        fatura: mapFaturaRecord(faturaRows[0])
    };
};

const assinaturaService = {
    createAssinatura
};

export default assinaturaService;
