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

const ASSINATURA_STATUS = {
    ACTIVE: 'ATIVA',
    EXPIRED: 'EXPIRADA',
    CANCELED: 'CANCELADA'
};

const NOTICE_PERIOD_DAYS = 3;

const throwAssinaturaNotFound = () => {
    const error = new Error('Assinatura não encontrada');
    error.code = 'ASSINATURA_NOT_FOUND';
    throw error;
};

const throwAssinaturaAtiva = () => {
    const error = new Error('Assinatura já está ativa');
    error.code = 'ASSINATURA_ATIVA';
    throw error;
};

const throwAssinaturaNotActive = () => {
    const error = new Error('Assinatura não está ativa');
    error.code = 'ASSINATURA_NAO_ATIVA';
    throw error;
};

const throwAssinaturaForbidden = () => {
    const error = new Error('Aluno não possui essa assinatura');
    error.code = 'ASSINATURA_FORBIDDEN';
    throw error;
};

const throwNoPendingInvoice = () => {
    const error = new Error('Nenhuma fatura pendente encontrada para esta assinatura');
    error.code = 'FATURA_PENDENTE_INEXISTENTE';
    throw error;
};

const throwAssinaturaNaoRenovavel = () => {
    const error = new Error('Assinatura não pode ser renovada ainda');
    error.code = 'ASSINATURA_NAO_RENOVAVEL';
    throw error;
};

const throwFaturaExpirada = () => {
    const error = new Error('Fatura já expirou; não é possível cancelar agora');
    error.code = 'FATURA_VENCIDA';
    throw error;
};

const buildInClause = (fieldName, values, paramPrefix) => {
    if (!values?.length) {
        return { clause: '', params: {} };
    }
    const placeholders = values.map((_, index) => `@${paramPrefix}${index}`).join(', ');
    const params = values.reduce((acc, value, index) => {
        acc[`${paramPrefix}${index}`] = value;
        return acc;
    }, {});
    return {
        clause: `${fieldName} IN (${placeholders})`,
        params
    };
};

const ensureAssinaturaBelongsToAcademia = async (assinaturaId, academiaId) => {
    const rows = await db.query(
        `
            SELECT
                a.id,
                a.aluno_id,
                a.plano_id,
                a.status,
                a.data_inicio,
                a.duracao_meses,
                a.recorrente,
                u.academia_id
            FROM Assinaturas a
            INNER JOIN Usuarios u ON u.id = a.aluno_id
            WHERE a.id = @assinaturaId AND u.academia_id = @academiaId
        `,
        { assinaturaId, academiaId }
    );

    if (!rows.length) {
        throwAssinaturaNotFound();
    }

    return rows[0];
};

const addMonths = (dateValue, months) => {
    const date = new Date(dateValue);
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
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
    status: record.status,
    duracaoMeses: record.duracao_meses,
    recorrente: Boolean(record.recorrente)
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
    faturaStatus,
    duracaoMeses,
    recorrente
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

    const normalizedDuration = typeof duracaoMeses === 'number' ? duracaoMeses : Number(plano.duracaoMeses) || 1;
    const isRecorrente = typeof recorrente === 'boolean' ? recorrente : Boolean(plano.recorrente);
    const formattedDataInicio = formatDate(dataInicio, true);
    const assinaturaStatus = normalizeStatus(status, 'ATIVA');
    const assinaturaRows = await db.query(
        `
            INSERT INTO Assinaturas (aluno_id, plano_id, data_inicio, status, duracao_meses, recorrente)
            OUTPUT INSERTED.*
            VALUES (@alunoId, @planoId, @dataInicio, @status)
        `,
        {
            alunoId,
            planoId,
            dataInicio: formattedDataInicio,
            status: assinaturaStatus,
            duracaoMeses: normalizedDuration,
            recorrente: isRecorrente ? 1 : 0
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

const renewAssinatura = async ({
    assinaturaId,
    academiaId,
    dataInicio,
    dataVencimento,
    faturaStatus
}) => {
    const assinatura = await ensureAssinaturaBelongsToAcademia(assinaturaId, academiaId);
    if (normalizeStatus(assinatura.status) === ASSINATURA_STATUS.ACTIVE) {
        throwAssinaturaAtiva();
    }

    if (!assinatura.recorrente) {
        throwAssinaturaNaoRenovavel();
    }

    const duration = Number(assinatura.duracao_meses) || 1;
    const lastDue = await getLastInvoiceDueDate(assinaturaId);
    if (!lastDue) {
        throwAssinaturaNaoRenovavel();
    }

    const lastDueDate = new Date(lastDue);
    if (Number.isNaN(lastDueDate.getTime()) || lastDueDate.getTime() >= Date.now()) {
        throwAssinaturaNaoRenovavel();
    }

    const periodEnd = addMonths(assinatura.data_inicio, duration);
    if (Date.now() < periodEnd.getTime()) {
        throwAssinaturaNaoRenovavel();
    }

    await db.query(
        `
            UPDATE Assinaturas
            SET status = @status, recorrente = 0
            WHERE id = @assinaturaId
        `,
        {
            status: ASSINATURA_STATUS.EXPIRED,
            assinaturaId
        }
    );

    const novoDataInicio = dataInicio || new Date().toISOString();

    return createAssinatura({
        alunoId: assinatura.aluno_id,
        planoId: assinatura.plano_id,
        academiaId,
        dataInicio: novoDataInicio,
        status: ASSINATURA_STATUS.ACTIVE,
        dataVencimento,
        faturaStatus,
        duracaoMeses: duration,
        recorrente: true
    });
};

const getNextPendingFatura = async (assinaturaId) => {
    const statuses = ['PENDENTE', 'VENCIDA'];
    const { clause, params } = buildInClause('f.status', statuses, 'status');
    const query = `
        SELECT TOP 1 *
        FROM Faturas f
        WHERE f.assinatura_id = @assinaturaId
            ${clause ? `AND ${clause}` : ''}
        ORDER BY f.data_vencimento ASC
    `;

    const rows = await db.query(query, { assinaturaId, ...params });
    if (!rows.length) {
        throwNoPendingInvoice();
    }
    return rows[0];
};

const getLastInvoiceDueDate = async (assinaturaId) => {
    const rows = await db.query(
        `
            SELECT TOP 1 data_vencimento
            FROM Faturas
            WHERE assinatura_id = @assinaturaId
            ORDER BY data_vencimento DESC
        `,
        { assinaturaId }
    );

    return rows.length ? rows[0].data_vencimento : null;
};

const cancelarAssinaturaPeloAluno = async ({ assinaturaId, academiaId, alunoId }) => {
    const assinatura = await ensureAssinaturaBelongsToAcademia(assinaturaId, academiaId);
    if (assinatura.aluno_id !== alunoId) {
        throwAssinaturaForbidden();
    }

    if (normalizeStatus(assinatura.status) !== ASSINATURA_STATUS.ACTIVE) {
        throwAssinaturaNotActive();
    }

    const nextInvoice = await getNextPendingFatura(assinaturaId);
    const dueDate = new Date(nextInvoice.data_vencimento);
    if (Number.isNaN(dueDate.getTime())) {
        throwNoPendingInvoice();
    }

    if (assinatura.duracao_meses === 1 && dueDate.getTime() < Date.now()) {
        throwFaturaExpirada();
    }

    const rows = await db.query(
        `
            UPDATE Assinaturas
            SET recorrente = 0
            OUTPUT INSERTED.*
            FROM Assinaturas a
            INNER JOIN Usuarios u ON u.id = a.aluno_id AND u.academia_id = @academiaId
            WHERE a.id = @assinaturaId
        `,
        {
            academiaId,
            assinaturaId
        }
    );

    if (!rows.length) {
        throwAssinaturaNotFound();
    }

    return mapAssinaturaRecord(rows[0]);
};

const assinaturaService = {
    createAssinatura,
    renewAssinatura,
    cancelarAssinaturaPeloAluno
};

export default assinaturaService;
