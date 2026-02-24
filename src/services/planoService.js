import db from '../config/db.js';

const throwIfNotFound = (rows) => {
    if (!rows.length) {
        const error = new Error('Plano não encontrado');
        error.code = 'PLANO_NOT_FOUND';
        throw error;
    }
};

const handleDuplicateError = (error) => {
    const duplicateErrorNumbers = [2627, 2601];
    if (duplicateErrorNumbers.includes(error?.number)) {
        const duplicate = new Error('Já existe um plano com esse nome nesta academia');
        duplicate.code = 'PLANO_DUPLICATE';
        throw duplicate;
    }
    throw error;
};

const mapPlanoRecord = (record) => ({
    id: record.id,
    academiaId: record.academia_id,
    nome: record.nome,
    valor: Number(record.valor),
    descricao: record.descricao
});

const listPlanos = async (academiaId) => {
    const rows = await db.query(
        `
            SELECT id, academia_id, nome, valor, descricao
            FROM Planos
            WHERE academia_id = @academiaId
            ORDER BY nome
        `,
        { academiaId }
    );
    return rows.map(mapPlanoRecord);
};

const getPlanoById = async (id, academiaId) => {
    const rows = await db.query(
        `
            SELECT id, academia_id, nome, valor, descricao
            FROM Planos
            WHERE id = @id AND academia_id = @academiaId
        `,
        { id, academiaId }
    );
    throwIfNotFound(rows);
    return mapPlanoRecord(rows[0]);
};

const createPlano = async ({ academiaId, nome, valor, descricao }) => {
    try {
        const rows = await db.query(
            `
                INSERT INTO Planos (academia_id, nome, valor, descricao)
                OUTPUT INSERTED.*
                VALUES (@academiaId, @nome, @valor, @descricao)
            `,
            {
                academiaId,
                nome,
                valor,
                descricao
            }
        );
        return mapPlanoRecord(rows[0]);
    } catch (error) {
        handleDuplicateError(error);
    }
};

const updatePlano = async (id, academiaId, patch) => {
    const updates = [];
    const params = { id, academiaId };

    if (patch.nome) {
        updates.push('nome = @nome');
        params.nome = patch.nome;
    }
    if (typeof patch.valor !== 'undefined') {
        updates.push('valor = @valor');
        params.valor = patch.valor;
    }
    if (typeof patch.descricao !== 'undefined') {
        updates.push('descricao = @descricao');
        params.descricao = patch.descricao;
    }

    if (!updates.length) {
        const error = new Error('Nenhum campo para atualizar');
        error.code = 'PLANO_NO_UPDATES';
        throw error;
    }

    try {
        const rows = await db.query(
            `
                UPDATE Planos
                SET ${updates.join(', ')}
                OUTPUT INSERTED.*
                WHERE id = @id AND academia_id = @academiaId
            `,
            params
        );
        throwIfNotFound(rows);
        return mapPlanoRecord(rows[0]);
    } catch (error) {
        handleDuplicateError(error);
    }
};

const deletePlano = async (id, academiaId) => {
    const rows = await db.query(
        `
            DELETE FROM Planos
            OUTPUT DELETED.*
            WHERE id = @id AND academia_id = @academiaId
        `,
        { id, academiaId }
    );
    throwIfNotFound(rows);
    return mapPlanoRecord(rows[0]);
};

const planoService = {
    listPlanos,
    getPlanoById,
    createPlano,
    updatePlano,
    deletePlano
};

export default planoService;
