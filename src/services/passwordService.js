import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import db from '../config/db.js';

const SALT_ROUNDS = 10;
const RESET_TOKEN_TTL_MINUTES = 30;

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const findUserById = async (userId) => {
    const rows = await db.query(
        `
            SELECT id, password_hash
            FROM Usuarios
            WHERE id = @userId
        `,
        { userId }
    );
    return rows.length ? rows[0] : null;
};

const findUserByEmail = async (email) => {
    const rows = await db.query(
        `
            SELECT id, email
            FROM Usuarios
            WHERE email = @email
        `,
        { email }
    );
    return rows.length ? rows[0] : null;
};

const changePassword = async (userId, currentPassword, newPassword) => {
    const user = await findUserById(userId);
    if (!user) {
        throw { status: 404, message: 'Usuário não encontrado' };
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
        throw { status: 400, message: 'Senha atual incorreta' };
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await db.query(
        `
            UPDATE Usuarios
            SET password_hash = @passwordHash
            WHERE id = @userId
        `,
        { passwordHash, userId }
    );
};

const requestPasswordReset = async (email) => {
    const user = await findUserByEmail(email);
    if (!user) {
        return null;
    }

    const token = crypto.randomBytes(32).toString('hex');
    console.log('Password reset token generated for', email, token); // para dev apenas
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000).toISOString();

    await db.query(
        `
            INSERT INTO sqlPasswordResetTokens (user_id, token_hash, expires_at)
            VALUES (@userId, @tokenHash, @expiresAt)
        `,
        {
            userId: user.id,
            tokenHash,
            expiresAt
        }
    );

    return { token, email: user.email };
};

const findTokenRecord = async (tokenHash) => {
    const rows = await db.query(
        `
            SELECT TOP 1 *
            FROM sqlPasswordResetTokens
            WHERE token_hash = @tokenHash
        `,
        { tokenHash }
    );
    return rows.length ? rows[0] : null;
};

const validateResetToken = async (token) => {
    const tokenHash = hashToken(token);
    const record = await findTokenRecord(tokenHash);
    if (!record) {
        throw { status: 400, message: 'Token inválido ou expirado' };
    }

    if (record.used_at) {
        throw { status: 400, message: 'Token já utilizado' };
    }

    const expiresAt = new Date(record.expires_at);
    if (expiresAt <= new Date()) {
        throw { status: 400, message: 'Token expirado' };
    }

    return { userId: record.user_id, tokenId: record.id };
};

const resetPassword = async (token, newPassword) => {
    const { userId, tokenId } = await validateResetToken(token);
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await db.query(
        `
            UPDATE Usuarios
            SET password_hash = @passwordHash
            WHERE id = @userId
        `,
        { passwordHash, userId }
    );

    await db.query(
        `
            UPDATE sqlPasswordResetTokens
            SET used_at = GETUTCDATE()
            WHERE id = @tokenId
        `,
        { tokenId }
    );
};

const passwordService = {
    changePassword,
    requestPasswordReset,
    validateResetToken,
    resetPassword
};

export default passwordService;
