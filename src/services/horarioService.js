import db from '../config/db.js';

const throwIfNotFound = (rows) => {
    if (!rows.length) {
        const error = new Error('Horário não encontrado');
        error.code = 'HORARIO_NOT_FOUND';
        throw error;
    }
};

const mapHorarioRecord = (record) => ({
    id: record.id,
    aulaId: record.aula_id,
    instrutorId: record.instrutor_id,
    diaSemana: record.dia_semana,
    horaInicio: record.hora_inicio,
    horaFim: record.hora_fim,
    capacidadeMaxima: record.capacidade_maxima
});

const ensureAulaBelongsToAcademia = async (aulaId, academiaId) => {
    const rows = await db.query(
        `
            SELECT id
            FROM Aulas
            WHERE id = @aulaId AND academia_id = @academiaId
        `,
        { aulaId, academiaId }
    );
    if (!rows.length) {
        const error = new Error('Aula não encontrada para esta academia');
        error.code = 'AULA_NOT_FOUND';
        throw error;
    }
};

const listHorariosByAula = async (aulaId, academiaId) => {
    await ensureAulaBelongsToAcademia(aulaId, academiaId);

    const rows = await db.query(
        `
            SELECT
                h.id,
                h.aula_id,
                h.instrutor_id,
                h.dia_semana,
                h.hora_inicio,
                h.hora_fim,
                h.capacidade_maxima
            FROM Horarios h
            INNER JOIN Aulas a ON h.aula_id = a.id AND a.academia_id = @academiaId
            WHERE h.aula_id = @aulaId
            ORDER BY h.dia_semana, h.hora_inicio
        `,
        { aulaId, academiaId }
    );
    return rows.map(mapHorarioRecord);
};

const getHorario = async (id, academiaId) => {
    const rows = await db.query(
        `
            SELECT
                h.id,
                h.aula_id,
                h.instrutor_id,
                h.dia_semana,
                h.hora_inicio,
                h.hora_fim,
                h.capacidade_maxima
            FROM Horarios h
            INNER JOIN Aulas a ON h.aula_id = a.id AND a.academia_id = @academiaId
            WHERE h.id = @id
        `,
        { id, academiaId }
    );
    throwIfNotFound(rows);
    return mapHorarioRecord(rows[0]);
};

const createHorario = async (
    {
        aulaId,
        instrutorId,
        diaSemana,
        horaInicio,
        horaFim,
        capacidadeMaxima
    },
    academiaId
) => {
    await ensureAulaBelongsToAcademia(aulaId, academiaId);

    const capacidadeValue = typeof capacidadeMaxima === 'number' ? capacidadeMaxima : 20;

    const rows = await db.query(
        `
            INSERT INTO Horarios (aula_id, instrutor_id, dia_semana, hora_inicio, hora_fim, capacidade_maxima)
            OUTPUT INSERTED.*
            VALUES (@aulaId, @instrutorId, @diaSemana, @horaInicio, @horaFim, @capacidadeMaxima)
        `,
        {
            aulaId,
            instrutorId: instrutorId || null,
            diaSemana,
            horaInicio,
            horaFim,
            capacidadeMaxima: capacidadeValue
        }
    );

    return mapHorarioRecord(rows[0]);
};

const updateHorario = async (id, academiaId, patch) => {
    const updates = [];
    const params = { id, academiaId };

    if (Object.prototype.hasOwnProperty.call(patch, 'aulaId')) {
        await ensureAulaBelongsToAcademia(patch.aulaId, academiaId);
        updates.push('h.aula_id = @aulaId');
        params.aulaId = patch.aulaId;
    }

    if (Object.prototype.hasOwnProperty.call(patch, 'instrutorId')) {
        updates.push('h.instrutor_id = @instrutorId');
        params.instrutorId = patch.instrutorId || null;
    }

    if (Object.prototype.hasOwnProperty.call(patch, 'diaSemana')) {
        updates.push('h.dia_semana = @diaSemana');
        params.diaSemana = patch.diaSemana;
    }

    if (Object.prototype.hasOwnProperty.call(patch, 'horaInicio')) {
        updates.push('h.hora_inicio = @horaInicio');
        params.horaInicio = patch.horaInicio;
    }

    if (Object.prototype.hasOwnProperty.call(patch, 'horaFim')) {
        updates.push('h.hora_fim = @horaFim');
        params.horaFim = patch.horaFim;
    }

    if (Object.prototype.hasOwnProperty.call(patch, 'capacidadeMaxima')) {
        updates.push('h.capacidade_maxima = @capacidadeMaxima');
        params.capacidadeMaxima = patch.capacidadeMaxima;
    }

    if (!updates.length) {
        const error = new Error('Nenhum campo para atualizar');
        error.code = 'HORARIO_NO_UPDATES';
        throw error;
    }

    const rows = await db.query(
        `
            UPDATE h
            SET ${updates.join(', ')}
            OUTPUT INSERTED.*
            FROM Horarios h
            INNER JOIN Aulas a ON h.aula_id = a.id AND a.academia_id = @academiaId
            WHERE h.id = @id
        `,
        params
    );

    throwIfNotFound(rows);
    return mapHorarioRecord(rows[0]);
};

const deleteHorario = async (id, academiaId) => {
    const rows = await db.query(
        `
            DELETE h
            OUTPUT DELETED.*
            FROM Horarios h
            INNER JOIN Aulas a ON h.aula_id = a.id AND a.academia_id = @academiaId
            WHERE h.id = @id
        `,
        { id, academiaId }
    );

    throwIfNotFound(rows);
    return mapHorarioRecord(rows[0]);
};

const horarioService = {
    listHorariosByAula,
    getHorario,
    createHorario,
    updateHorario,
    deleteHorario
};

export default horarioService;
