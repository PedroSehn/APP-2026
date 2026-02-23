import db from '../config/db.js';

const SELECT_COLUMNS = 'id, nome, cnpj, created_at';

const mapAcademiaRecord = (record) => ({
    id: record.id,
    nome: record.nome,
    cnpj: record.cnpj,
    createdAt: record.created_at
});

const throwIfNotFound = (rows) => {
    if (!rows.length) {
        const error = new Error('Academia não encontrada');
        error.code = 'ACADEMIA_NOT_FOUND';
        throw error;
    }
};

const handleDuplicateError = (error) => {
    const duplicateErrorNumbers = [2627, 2601];
    if (duplicateErrorNumbers.includes(error?.number)) {
        const duplicateError = new Error('Já existe uma academia com esse nome ou CNPJ');
        duplicateError.code = 'ACADEMIA_DUPLICATE';
        throw duplicateError;
    }
    throw error;
};

const listAcademias = async () => {
    const rows = await db.query(`SELECT ${SELECT_COLUMNS} FROM Academias ORDER BY id`);
    return rows.map(mapAcademiaRecord);
};

const getAcademiaById = async (id) => {
    const rows = await db.query(`SELECT ${SELECT_COLUMNS} FROM Academias WHERE id = @id`, { id });
    throwIfNotFound(rows);
    return mapAcademiaRecord(rows[0]);
};

const createAcademia = async ({ nome, cnpj }) => {
    try {
        const rows = await db.query(
            `
            INSERT INTO Academias (nome, cnpj)
            OUTPUT INSERTED.*
            VALUES (@nome, @cnpj)
        `,
            { nome, cnpj }
        );

        if (!rows.length) {
            throw new Error('Não foi possível criar a academia');
        }

        return mapAcademiaRecord(rows[0]);
    } catch (error) {
        handleDuplicateError(error);
    }
};

const updateAcademia = async (id, { nome, cnpj }) => {
    try {
        const rows = await db.query(
            `
            UPDATE Academias
            SET nome = @nome, cnpj = @cnpj
            OUTPUT INSERTED.*
            WHERE id = @id
        `,
            { id, nome, cnpj }
        );

        throwIfNotFound(rows);
        return mapAcademiaRecord(rows[0]);
    } catch (error) {
        handleDuplicateError(error);
    }
};

const deleteAcademia = async (id) => {
    const rows = await db.query(
        `
            DELETE FROM Academias
            OUTPUT DELETED.*
            WHERE id = @id
        `,
        { id }
    );
    throwIfNotFound(rows);
    return mapAcademiaRecord(rows[0]);
};

const academiaService = {
    listAcademias,
    getAcademiaById,
    createAcademia,
    updateAcademia,
    deleteAcademia
};

export default academiaService;
