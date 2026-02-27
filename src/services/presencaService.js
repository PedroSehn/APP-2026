import db from '../config/db.js';
import { ensurePlanoPermiteAula } from './planoService.js';

const throwHorarioNotFound = () => {
    const error = new Error('Horário ou aula não encontrados para esta academia');
    error.code = 'HORARIO_NOT_FOUND';
    throw error;
};

const throwPresencaNotFound = () => {
    const error = new Error('Presença não encontrada');
    error.code = 'PRESENCA_NOT_FOUND';
    throw error;
};

const throwCapacityExceeded = () => {
    const error = new Error('Capacidade máxima do horário atingida');
    error.code = 'PRESENCA_CAPACIDADE_MAXIMA';
    throw error;
};

const throwDuplicatePresenca = () => {
    const error = new Error('Presença já registrada para este aluno nesse horário');
    error.code = 'PRESENCA_JA_EXISTE';
    throw error;
};

const throwHorarioPassed = () => {
    const error = new Error('O horário já passou');
    error.code = 'HORARIO_JA_PASSOU';
    throw error;
};

const throwPlanoNotFound = () => {
    const error = new Error('Plano ativo não encontrado para este aluno');
    error.code = 'PLANO_NOT_FOUND';
    throw error;
};

const throwWeeklyLimitExceeded = () => {
    const error = new Error('Limite semanal do plano atingido');
    error.code = 'PLANO_LIMITE_SEMANAL';
    throw error;
};

const mapAlunoPresenca = (record) => ({
    id: record.aluno_id,
    name: record.nome,
    email: record.email,
    status: record.status,
    dataAula: record.data_aula
});

const mapPresencaRecord = (record) => ({
    id: record.id,
    alunoId: record.aluno_id,
    horarioId: record.horario_id,
    aulaId: record.aula_id ?? record.aulaId,
    dataAula: record.data_aula,
    status: record.status
});

const getWeekBounds = (dateValue) => {
    const date = new Date(dateValue);
    date.setHours(0, 0, 0, 0);
    const day = date.getDay();
    const diffToMonday = (day + 6) % 7;
    const start = new Date(date);
    start.setDate(date.getDate() - diffToMonday);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    return {
        startDate: formatDate(start),
        endDate: formatDate(end)
    };
};

const countWeeklyPresencas = async (alunoId, startDate, endDate) => {
    const rows = await db.query(
        `
            SELECT COUNT(*) AS total
            FROM Presencas
            WHERE aluno_id = @alunoId AND data_aula BETWEEN @startDate AND @endDate
              AND status <> 'cancelada'
        `,
        { alunoId, startDate, endDate }
    );

    return Number(rows[0].total) || 0;
};

const getAlunoPlano = async (alunoId, academiaId) => {
    const rows = await db.query(
        `
            SELECT TOP 1
                a.id AS assinatura_id,
                p.id AS plano_id,
                p.max_aulas_por_semana
            FROM Assinaturas a
            INNER JOIN Planos p ON a.plano_id = p.id
            WHERE a.aluno_id = @alunoId
              AND a.status = 'ativa'
              AND p.academia_id = @academiaId
            ORDER BY a.data_inicio DESC
        `,
        { alunoId, academiaId }
    );

    if (!rows.length) {
        throwPlanoNotFound();
    }

    return rows[0];
};

const formatDate = (value) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new Error('Data inválida');
    }
    return date.toISOString().split('T')[0];
};

const normalizeTime = (timeValue) => {
    if (!timeValue) {
        throw new Error('Horário inválido');
    }

    const raw = timeValue instanceof Date ? timeValue.toTimeString().split(' ')[0] : `${timeValue}`;
    const parts = raw.split(':').slice(0, 3);
    while (parts.length < 3) {
        parts.push('00');
    }
    return parts.map((part) => part.padStart(2, '0')).join(':');
};

const combineDateWithTime = (dateValue, timeValue) => {
    const datePart = formatDate(dateValue);
    const timePart = normalizeTime(timeValue);
    return new Date(`${datePart}T${timePart}`);
};

const ensureHorarioFuture = (dataAula, hora, allowEqual = false) => {
    const now = new Date();
    const target = combineDateWithTime(dataAula, hora);
    if (allowEqual ? target < now : target <= now) {
        throwHorarioPassed();
    }
};

const getHorarioDetail = async (aulaId, horarioId, academiaId) => {
    const rows = await db.query(
        `
            SELECT
                h.id,
                h.aula_id,
                h.hora_inicio,
                h.hora_fim,
                h.capacidade_maxima
            FROM Horarios h
            INNER JOIN Aulas a ON h.aula_id = a.id AND a.academia_id = @academiaId
            WHERE h.id = @horarioId AND a.id = @aulaId
        `,
        { aulaId, horarioId, academiaId }
    );

    if (!rows.length) {
        throwHorarioNotFound();
    }

    return rows[0];
};

const ensureNoDuplicate = async (alunoId, horarioId, dataAula) => {
    const rows = await db.query(
        `
            SELECT id
            FROM Presencas
            WHERE aluno_id = @alunoId AND horario_id = @horarioId AND data_aula = @dataAula
        `,
        { alunoId, horarioId, dataAula }
    );

    if (rows.length) {
        throwDuplicatePresenca();
    }
};

const countPresencas = async (horarioId, dataAula) => {
    const rows = await db.query(
        `
            SELECT COUNT(*) AS total
            FROM Presencas
            WHERE horario_id = @horarioId AND data_aula = @dataAula
        `,
        { horarioId, dataAula }
    );

    return Number(rows[0].total) || 0;
};

const ensureCapacityAvailable = async (horarioId, dataAula, capacidadeMaxima) => {
    const existing = await countPresencas(horarioId, dataAula);
    if (existing >= capacidadeMaxima) {
        throwCapacityExceeded();
    }
};

const getPresencaWithHorario = async (id, academiaId) => {
    const rows = await db.query(
        `
            SELECT
                p.*,
                h.hora_inicio,
                h.hora_fim,
                h.aula_id
            FROM Presencas p
            INNER JOIN Horarios h ON p.horario_id = h.id
            INNER JOIN Aulas a ON h.aula_id = a.id AND a.academia_id = @academiaId
            WHERE p.id = @id
        `,
        { id, academiaId }
    );

    if (!rows.length) {
        throwPresencaNotFound();
    }

    return rows[0];
};

const ensureAlunoOwnership = (presenca, alunoId) => {
    if (presenca.aluno_id !== alunoId) {
        const error = new Error('Aluno não pode manipular presença de outro aluno');
        error.code = 'PRESENCA_FORBIDDEN';
        throw error;
    }
};

const ensureHorarioNotPassed = (dataAula, horaFim) => {
    ensureHorarioFuture(dataAula, horaFim);
};

const listAlunosByAulaHorario = async (aulaId, horarioId, academiaId) => {
    await getHorarioDetail(aulaId, horarioId, academiaId);

    const rows = await db.query(
        `
            SELECT
                u.id AS aluno_id,
                u.nome,
                u.email,
                p.status,
                p.data_aula
            FROM Presencas p
            INNER JOIN Usuarios u ON p.aluno_id = u.id
            INNER JOIN Horarios h ON p.horario_id = h.id
            INNER JOIN Aulas a ON h.aula_id = a.id AND a.academia_id = @academiaId
            WHERE p.horario_id = @horarioId AND a.id = @aulaId
            ORDER BY p.data_aula DESC, u.nome
        `,
        { horarioId, aulaId, academiaId }
    );

    return rows.map(mapAlunoPresenca);
};

const getAulasByAluno = async (alunoId, academiaId) => {
    const rows = await db.query(
        `
            SELECT
                p.id AS presenca_id,
                p.data_aula,
                p.status,
                h.id AS horario_id,
                h.hora_inicio,
                h.hora_fim,
                h.capacidade_maxima,
                a.id AS aula_id,
                a.nome AS aula_nome,
                a.descricao AS aula_descricao
            FROM Presencas p
            INNER JOIN Horarios h ON p.horario_id = h.id
            INNER JOIN Aulas a ON h.aula_id = a.id AND a.academia_id = @academiaId
            WHERE p.aluno_id = @alunoId
            ORDER BY p.data_aula DESC, a.nome
        `,
        { alunoId, academiaId }
    );

    return rows.map((record) => ({
        presencaId: record.presenca_id,
        dataAula: record.data_aula,
        status: record.status,
        horario: {
            id: record.horario_id,
            horaInicio: record.hora_inicio,
            horaFim: record.hora_fim,
            capacidadeMaxima: record.capacidade_maxima
        },
        aula: {
            id: record.aula_id,
            nome: record.aula_nome,
            descricao: record.aula_descricao
        }
    }));
};

const createPresenca = async (
    { alunoId, aulaId, horarioId, dataAula },
    academiaId,
    status = 'confirmada'
) => {
    const horario = await getHorarioDetail(aulaId, horarioId, academiaId);
    const formattedDate = formatDate(dataAula);
    const plano = await getAlunoPlano(alunoId, academiaId);
    await ensurePlanoPermiteAula(plano.plano_id, aulaId, academiaId);
    const weeklyLimit = Number(plano.max_aulas_por_semana) || 0;
    if (weeklyLimit > 0) {
        const { startDate, endDate } = getWeekBounds(formattedDate);
        const total = await countWeeklyPresencas(alunoId, startDate, endDate);
        if (total >= weeklyLimit) {
            throwWeeklyLimitExceeded();
        }
    }

    ensureHorarioFuture(formattedDate, horario.hora_inicio);
    await ensureNoDuplicate(alunoId, horarioId, formattedDate);
    await ensureCapacityAvailable(horarioId, formattedDate, horario.capacidade_maxima);

    const rows = await db.query(
        `
            INSERT INTO Presencas (aluno_id, horario_id, data_aula, status)
            OUTPUT INSERTED.*
            VALUES (@alunoId, @horarioId, @dataAula, @status)
        `,
        {
            alunoId,
            horarioId,
            dataAula: formattedDate,
            status
        }
    );

    return {
        ...mapPresencaRecord(rows[0]),
        aulaId
    };
};

const cancelPresenca = async (id, academiaId, { alunoId = null, requireAlunoOwnership = false, ensureFuture = false } = {}) => {
    const presenca = await getPresencaWithHorario(id, academiaId);

    if (requireAlunoOwnership) {
        ensureAlunoOwnership(presenca, alunoId);
    }

    if (ensureFuture) {
        ensureHorarioNotPassed(presenca.data_aula, presenca.hora_fim);
    }

    const rows = await db.query(
        `
            DELETE p
            OUTPUT DELETED.*
            FROM Presencas p
            INNER JOIN Horarios h ON p.horario_id = h.id
            INNER JOIN Aulas a ON h.aula_id = a.id AND a.academia_id = @academiaId
            WHERE p.id = @id
                AND (@requireAlunoOwnership = 0 OR p.aluno_id = @alunoId)
        `,
        {
            id,
            academiaId,
            alunoId,
            requireAlunoOwnership: requireAlunoOwnership ? 1 : 0
        }
    );

    if (!rows.length) {
        throwPresencaNotFound();
    }

    return mapPresencaRecord(rows[0]);
};

const updatePresenca = async (id, academiaId, patch) => {
    const presenca = await getPresencaWithHorario(id, academiaId);
    const updates = [];
    const params = { id, academiaId };

    if (Object.prototype.hasOwnProperty.call(patch, 'dataAula')) {
        const formattedDate = formatDate(patch.dataAula);
        ensureHorarioFuture(formattedDate, presenca.hora_inicio);
        updates.push('p.data_aula = @dataAula');
        params.dataAula = formattedDate;
    }

    if (Object.prototype.hasOwnProperty.call(patch, 'status')) {
        updates.push('p.status = @status');
        params.status = patch.status;
    }

    if (!updates.length) {
        const error = new Error('Nenhum campo para atualizar');
        error.code = 'PRESENCA_NO_UPDATES';
        throw error;
    }

    const rows = await db.query(
        `
            UPDATE p
            SET ${updates.join(', ')}
            OUTPUT INSERTED.*
            FROM Presencas p
            INNER JOIN Horarios h ON p.horario_id = h.id
            INNER JOIN Aulas a ON h.aula_id = a.id AND a.academia_id = @academiaId
            WHERE p.id = @id
        `,
        params
    );

    if (!rows.length) {
        throwPresencaNotFound();
    }

    return mapPresencaRecord(rows[0]);
};

const presencaService = {
    listAlunosByAulaHorario,
    createPresenca,
    cancelPresenca,
    updatePresenca
};

export default presencaService;
export { getAulasByAluno };
