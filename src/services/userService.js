import bcrypt from 'bcryptjs';
import db from '../config/db.js';

const SALT_ROUNDS = 10;
const DEFAULT_ROLE = 'aluno';
const VALID_ROLES = ['admin', 'aluno', 'dono', 'funcionario'];

const mapUserRecord = (record) => ({
    id: record.id,
    name: record.nome,
    email: record.email,
    role: record.role,
    academiaId: record.academia_id
});

const findUserRecordByEmail = async (email) => {
    const rows = await db.query(
        'SELECT id, academia_id, nome, email, password_hash, role FROM Usuarios WHERE email = @email',
        { email }
    );
    console.log('rows', rows);
    return rows.length ? rows[0] : null;
};

const findUserRecordById = async (id) => {
    const rows = await db.query(
        'SELECT id, academia_id, nome, email, role FROM Usuarios WHERE id = @id',
        { id }
    );
    return rows.length ? rows[0] : null;
};

const authenticateUser = async ({ email, password }) => {
    const record = await findUserRecordByEmail(email);
    if (!record) {
        return null;
    }

    const isValidPassword = await bcrypt.compare(password, record.password_hash);
    console.log('password', password);
    console.log('record.password_hash', record.password_hash);
    console.log('isValidPassword', isValidPassword);
    if (!isValidPassword) {
        return null;
    }

    return mapUserRecord(record);
};

const createUser = async ({ name, email, password, role, academiaId }) => {
    const existingUser = await findUserRecordByEmail(email);
    if (existingUser) {
        const error = new Error('Já existe um usuário cadastrado com este e-mail');
        error.code = 'USER_ALREADY_EXISTS';
        throw error;
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const normalizedRole = role ? role.trim().toLowerCase() : DEFAULT_ROLE;

    if (!VALID_ROLES.includes(normalizedRole)) {
        const error = new Error('Role inválida');
        error.code = 'USER_INVALID_ROLE';
        throw error;
    }

    if (normalizedRole === 'dono' && !academiaId) {
        const error = new Error('Dono precisa estar vinculado a uma academia');
        error.code = 'OWNER_REQUIRES_ACADEMIA';
        throw error;
    }

    const result = await db.query(
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
            role: normalizedRole
        }
    );

    if (!result.length) {
        throw new Error('Não foi possível criar o usuário');
    }

    return mapUserRecord(result[0]);
};

const userService = {
    authenticateUser,
    createUser,
    findByEmail: async (email) => {
        const record = await findUserRecordByEmail(email);
        return record ? mapUserRecord(record) : null;
    },
    findById: async (id) => {
        const record = await findUserRecordById(id);
        return record ? mapUserRecord(record) : null;
    }
};

export default userService;
