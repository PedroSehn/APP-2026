import bcrypt from 'bcryptjs';
import db from '../config/db.js';

const DEFAULT_ROLE = 'aluno';

const mapAlunoRecord = (record) => ({
    id: record.id,
    name: record.nome,
    email: record.email,
    role: record.role,
    academiaId: record.academia_id
});

const throwIfNotFound = (rows) => {
    if (!rows.length) {
        const error = new Error('Aluno não encontrado');
        error.code = 'ALUNO_NOT_FOUND';
        throw error;
    }
};

const handleDuplicateEmail = (error) => {
    const duplicateErrorNumbers = [2627, 2601];
    if (duplicateErrorNumbers.includes(error?.number)) {
        const duplicateError = new Error('Já existe um aluno com esse e-mail');
        duplicateError.code = 'ALUNO_DUPLICATE_EMAIL';
        throw duplicateError;
    }
    throw error;
};

const ensurePassword = async (password) => {
    if (!password || typeof password !== 'string') {
        const error = new Error('Senha inválida');
        error.code = 'ALUNO_INVALID_PASSWORD';
        throw error;
    }
    return bcrypt.hash(password, 10);
};

const listAlunos = async (academiaId) => {
    const rows = await db.query(
        `
            SELECT id, academia_id, nome, email, role
            FROM Usuarios
            WHERE academia_id = @academiaId AND role = @role
            ORDER BY id
        `,
        { academiaId, role: DEFAULT_ROLE }
    );
    return rows.map(mapAlunoRecord);
};

const getAluno = async (id, academiaId) => {
    const rows = await db.query(
        `
            SELECT id, academia_id, nome, email, role
            FROM Usuarios
            WHERE id = @id AND academia_id = @academiaId AND role = @role
        `,
        { id, academiaId, role: DEFAULT_ROLE }
    );
    throwIfNotFound(rows);
    return mapAlunoRecord(rows[0]);
};

const createAluno = async ({ name, email, password, academiaId }) => {
    const passwordHash = await ensurePassword(password);

    try {
        const rows = await db.query(
            `
                INSERT INTO Usuarios (academia_id, nome, email, password_hash, role)
                OUTPUT INSERTED.*
                VALUES (@academiaId, @name, @email, @passwordHash, @role)
            `,
            {
                academiaId,
                name,
                email,
                passwordHash,
                role: DEFAULT_ROLE
            }
        );

        if (!rows.length) {
            throw new Error('Não foi possível criar o aluno');
        }

        return mapAlunoRecord(rows[0]);
    } catch (error) {
        handleDuplicateEmail(error);
    }
};

const updateAluno = async (id, academiaId, patch) => {
    const updates = [];
    const params = { id, academiaId, role: DEFAULT_ROLE };

    if (patch.name) {
        updates.push('nome = @name');
        params.name = patch.name;
    }

    if (patch.email) {
        updates.push('email = @email');
        params.email = patch.email;
    }

    if (patch.password) {
        updates.push('password_hash = @passwordHash');
        params.passwordHash = await ensurePassword(patch.password);
    }

    if (!updates.length) {
        const error = new Error('Nenhum campo para atualizar');
        error.code = 'ALUNO_NO_UPDATES';
        throw error;
    }

    try {
        const rows = await db.query(
            `
                UPDATE Usuarios
                SET ${updates.join(', ')}
                OUTPUT INSERTED.*
                WHERE id = @id AND academia_id = @academiaId AND role = @role
            `,
            params
        );

        throwIfNotFound(rows);
        return mapAlunoRecord(rows[0]);
    } catch (error) {
        handleDuplicateEmail(error);
    }
};

const deleteAluno = async (id, academiaId) => {
    const rows = await db.query(
        `
            DELETE FROM Usuarios
            OUTPUT DELETED.*
            WHERE id = @id AND academia_id = @academiaId AND role = @role
        `,
        { id, academiaId, role: DEFAULT_ROLE }
    );
    throwIfNotFound(rows);
    return mapAlunoRecord(rows[0]);
};

const alunoService = {
    listAlunos,
    getAluno,
    createAluno,
    updateAluno,
    deleteAluno
};

export default alunoService;
