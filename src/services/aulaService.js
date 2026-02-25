import db from '../config/db.js';

const throwIfNotFound = (rows) => {
    if (!rows.length) {
        const error = new Error('Aula não encontrada');
        error.code = 'AULA_NOT_FOUND';
        throw error;
    }
};

const handleDuplicateError = (error) => {
    const duplicateErrorNumbers = [2627, 2601];
    if (duplicateErrorNumbers.includes(error?.number)) {
        const duplicate = new Error('Já existe uma aula com esse nome nesta academia');
        duplicate.code = 'AULA_DUPLICATE';
        throw duplicate;
    }
    throw error;
};

const mapAulaRecord = (record) => ({
    id: record.id,
    academiaId: record.academia_id,
    nome: record.nome,
    descricao: record.descricao
});

const listAulas = async (academiaId) => {
    const rows = await db.query(
        `
            SELECT id, academia_id, nome, descricao
            FROM Aulas
            WHERE academia_id = @academiaId
            ORDER BY nome
        `,
        { academiaId }
    );
    return rows.map(mapAulaRecord);
};

const getAula = async (id, academiaId) => {
    const rows = await db.query(
        `
            SELECT id, academia_id, nome, descricao
            FROM Aulas
            WHERE id = @id AND academia_id = @academiaId
        `,
        { id, academiaId }
    );
    throwIfNotFound(rows);
    return mapAulaRecord(rows[0]);
};

const createAula = async ({ academiaId, nome, descricao }) => {
    try {
        const rows = await db.query(
            `
                INSERT INTO Aulas (academia_id, nome, descricao)
                OUTPUT INSERTED.*
                VALUES (@academiaId, @nome, @descricao)
            `,
            {
                academiaId,
                nome,
                descricao
            }
        );
        return mapAulaRecord(rows[0]);
    } catch (error) {
        handleDuplicateError(error);
    }
};

const updateAula = async (id, academiaId, patch) => {
    const updates = [];
    const params = { id, academiaId };

    if (patch.nome) {
        updates.push('nome = @nome');
        params.nome = patch.nome;
    }

    if (typeof patch.descricao !== 'undefined') {
        updates.push('descricao = @descricao');
        params.descricao = patch.descricao;
    }

    if (!updates.length) {
        const error = new Error('Nenhum campo para atualizar');
        error.code = 'AULA_NO_UPDATES';
        throw error;
    }

    try {
        const rows = await db.query(
            `
                UPDATE Aulas
                SET ${updates.join(', ')}
                OUTPUT INSERTED.*
                WHERE id = @id AND academia_id = @academiaId
            `,
            params
        );
        throwIfNotFound(rows);
        return mapAulaRecord(rows[0]);
    } catch (error) {
        handleDuplicateError(error);
    }
};

const deleteAula = async (id, academiaId) => {
    const rows = await db.query(
        `
            DELETE FROM Aulas
            OUTPUT DELETED.*
            WHERE id = @id AND academia_id = @academiaId
        `,
        { id, academiaId }
    );
    throwIfNotFound(rows);
    return mapAulaRecord(rows[0]);
};

const aulaService = {
    listAulas,
    getAula,
    createAula,
    updateAula,
    deleteAula
};

export default aulaService;
