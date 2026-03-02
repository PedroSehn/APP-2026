import db from '../config/db.js';

const DEFAULT_PENDING_STATUSES = ['PENDENTE', 'VENCIDA'];
const DEFAULT_LIMIT = 25;

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

const mapSubscriptionRecord = (record) => ({
    faturaId: record.faturaId,
    faturaStatus: record.faturaStatus,
    valor: Number(record.valor ?? 0),
    dataVencimento: record.dataVencimento,
    dataPagamento: record.dataPagamento,
    assinaturaId: record.assinaturaId,
    assinaturaStatus: record.assinaturaStatus,
    planoId: record.planoId,
    planoNome: record.planoNome,
    planoDescricao: record.planoDescricao,
    alunoId: record.alunoId,
    alunoNome: record.alunoNome,
    alunoEmail: record.alunoEmail
});

const mapRevenueRecord = (record) => ({
    year: record.year,
    month: record.month,
    total: Number(record.total ?? 0)
});

const listPendingSubscriptions = async ({
    academiaId,
    statuses = DEFAULT_PENDING_STATUSES,
    limit = DEFAULT_LIMIT,
    offset = 0
}) => {
    const { clause: statusClause, params: statusParams } = buildInClause('f.status', statuses, 'pendingStatus');
    const query = `
        SELECT
            f.id AS faturaId,
            f.valor,
            f.data_vencimento AS dataVencimento,
            f.data_pagamento AS dataPagamento,
            f.status AS faturaStatus,
            a.id AS assinaturaId,
            a.status AS assinaturaStatus,
            p.id AS planoId,
            p.nome AS planoNome,
            p.descricao AS planoDescricao,
            u.id AS alunoId,
            u.nome AS alunoNome,
            u.email AS alunoEmail
        FROM Faturas f
        INNER JOIN Assinaturas a ON a.id = f.assinatura_id
        INNER JOIN Usuarios u ON u.id = a.aluno_id
        INNER JOIN Planos p ON p.id = a.plano_id
        WHERE u.academia_id = @academiaId
            ${statusClause ? `AND ${statusClause}` : ''}
        ORDER BY f.data_vencimento ASC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `;

    const rows = await db.query(query, {
        academiaId,
        offset,
        limit,
        ...statusParams
    });
    return rows.map(mapSubscriptionRecord);
};

const listInvoices = async ({
    academiaId,
    status,
    month,
    year,
    limit = DEFAULT_LIMIT,
    offset = 0
}) => {
    const filters = ['u.academia_id = @academiaId'];
    const params = { academiaId, limit, offset };

    if (status) {
        filters.push('f.status = @statusFilter');
        params.statusFilter = status;
    }
    if (typeof year === 'number') {
        filters.push('YEAR(f.data_vencimento) = @yearFilter');
        params.yearFilter = year;
    }
    if (typeof month === 'number') {
        filters.push('MONTH(f.data_vencimento) = @monthFilter');
        params.monthFilter = month;
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const query = `
        SELECT
            f.id AS faturaId,
            f.valor,
            f.data_vencimento AS dataVencimento,
            f.data_pagamento AS dataPagamento,
            f.status AS faturaStatus,
            a.id AS assinaturaId,
            a.status AS assinaturaStatus,
            u.id AS alunoId,
            u.nome AS alunoNome,
            u.email AS alunoEmail
        FROM Faturas f
        INNER JOIN Assinaturas a ON a.id = f.assinatura_id
        INNER JOIN Usuarios u ON u.id = a.aluno_id
        INNER JOIN Planos p ON p.id = a.plano_id
        ${whereClause}
        ORDER BY f.data_vencimento DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `;

    const rows = await db.query(query, params);
    return rows.map(mapSubscriptionRecord);
};

const listAlunoFaturas = async ({
    academiaId,
    alunoId,
    status,
    month,
    year,
    limit = DEFAULT_LIMIT,
    offset = 0
}) => {
    const filters = ['u.id = @alunoId', 'u.academia_id = @academiaId'];
    const params = { academiaId, alunoId, limit, offset };

    if (status) {
        filters.push('f.status = @statusFilter');
        params.statusFilter = status;
    }
    if (typeof year === 'number') {
        filters.push('YEAR(f.data_vencimento) = @yearFilter');
        params.yearFilter = year;
    }
    if (typeof month === 'number') {
        filters.push('MONTH(f.data_vencimento) = @monthFilter');
        params.monthFilter = month;
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const query = `
        SELECT
            f.id AS faturaId,
            f.valor,
            f.data_vencimento AS dataVencimento,
            f.data_pagamento AS dataPagamento,
            f.status AS faturaStatus,
            a.id AS assinaturaId,
            a.status AS assinaturaStatus,
            p.id AS planoId,
            p.nome AS planoNome,
            p.descricao AS planoDescricao,
            u.id AS alunoId,
            u.nome AS alunoNome,
            u.email AS alunoEmail
        FROM Faturas f
        INNER JOIN Assinaturas a ON a.id = f.assinatura_id
        INNER JOIN Usuarios u ON u.id = a.aluno_id
        INNER JOIN Planos p ON p.id = a.plano_id
        ${whereClause}
        ORDER BY f.data_vencimento DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `;

    const rows = await db.query(query, params);
    return rows.map(mapSubscriptionRecord);
};

const ensureFaturaOwnership = (rows) => {
    if (!rows.length) {
        const error = new Error('Fatura não encontrada para esta academia');
        error.code = 'FATURA_NOT_FOUND';
        throw error;
    }
    return rows[0];
};

const updateFaturaStatus = async ({
    faturaId,
    academiaId,
    status,
    dataPagamento
}) => {
    const normalizedStatus = `${status || ''}`.trim().toUpperCase();
    if (!normalizedStatus) {
        const error = new Error('Status é obrigatório');
        error.code = 'FATURA_STATUS_OBRIGATORIO';
        throw error;
    }

    const params = {
        faturaId,
        academiaId,
        status: normalizedStatus,
        dataPagamento: null
    };

    if (dataPagamento) {
        const date = new Date(dataPagamento);
        if (Number.isNaN(date.getTime())) {
            const error = new Error('dataPagamento inválida');
            error.code = 'FATURA_DATA_INVALIDA';
            throw error;
        }
        params.dataPagamento = date.toISOString().split('T')[0];
    }

    const query = `
        UPDATE f
        SET status = @status,
            data_pagamento = @dataPagamento
        OUTPUT INSERTED.*
        FROM Faturas f
        INNER JOIN Assinaturas a ON a.id = f.assinatura_id
        INNER JOIN Usuarios u ON u.id = a.aluno_id
        WHERE f.id = @faturaId
            AND u.academia_id = @academiaId
    `;

    const rows = await db.query(query, params);
    const updated = ensureFaturaOwnership(rows);
    return mapSubscriptionRecord(updated);
};

const getMonthlyRevenueForecast = async ({ academiaId, year }) => {
    const filters = ['u.academia_id = @academiaId'];
    const params = { academiaId };

    if (typeof year === 'number') {
        filters.push('YEAR(f.data_vencimento) = @yearFilter');
        params.yearFilter = year;
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const query = `
        SELECT
            YEAR(f.data_vencimento) AS year,
            MONTH(f.data_vencimento) AS month,
            SUM(f.valor) AS total
        FROM Faturas f
        INNER JOIN Assinaturas a ON a.id = f.assinatura_id
        INNER JOIN Usuarios u ON u.id = a.aluno_id
        ${whereClause}
        GROUP BY YEAR(f.data_vencimento), MONTH(f.data_vencimento)
        ORDER BY year, month
    `;

    const rows = await db.query(query, params);
    return rows.map(mapRevenueRecord);
};

const dashboardService = {
    listPendingSubscriptions,
    listInvoices,
    listAlunoFaturas,
    getMonthlyRevenueForecast,
    updateFaturaStatus
};

export default dashboardService;
