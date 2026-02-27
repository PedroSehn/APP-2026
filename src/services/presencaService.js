import db from '../config/db.js';

const throwHorarioNotFound = () => {
    const error = new Error('Horário ou aula não encontrados para esta academia');
    error.code = 'HORARIO_NOT_FOUND';
    throw error;
};

const mapAlunoPresenca = (record) => ({
    id: record.aluno_id,
    name: record.nome,
    email: record.email,
    status: record.status,
    dataAula: record.data_aula
});

const ensureAulaHorario = async (aulaId, horarioId, academiaId) => {
    const rows = await db.query(
        `
            SELECT h.id
            FROM Horarios h
            INNER JOIN Aulas a ON h.aula_id = a.id AND a.academia_id = @academiaId
            WHERE h.id = @horarioId AND a.id = @aulaId
        `,
        { horarioId, aulaId, academiaId }
    );

    if (!rows.length) {
        throwHorarioNotFound();
    }
};

const listAlunosByAulaHorario = async (aulaId, horarioId, academiaId) => {
    await ensureAulaHorario(aulaId, horarioId, academiaId);

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

const presencaService = {
    listAlunosByAulaHorario
};

export default presencaService;
