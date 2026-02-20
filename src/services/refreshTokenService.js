import crypto from 'crypto';
import db from '../config/db.js';

const REFRESH_TOKEN_TTL_DAYS = parseInt(process.env.REFRESH_TOKEN_TTL_DAYS, 10) || 14;
const tokenTtlMilliseconds = REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const generateRandomToken = () => crypto.randomBytes(48).toString('hex');

const createRefreshToken = async (userId) => {
    const token = generateRandomToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + tokenTtlMilliseconds).toISOString();

    await db.query(
        `
            INSERT INTO RefreshTokens (user_id, token_hash, expires_at)
            VALUES (@userId, @tokenHash, @expiresAt)
        `,
        { userId, tokenHash, expiresAt }
    );

    return {
        token,
        expiresAt,
        expiresInDays: REFRESH_TOKEN_TTL_DAYS
    };
};

const findValidRefreshToken = async (token) => {
    const tokenHash = hashToken(token);
    const rows = await db.query(
        `
            SELECT TOP 1 *
            FROM RefreshTokens
            WHERE token_hash = @tokenHash AND expires_at > GETUTCDATE()
        `,
        { tokenHash }
    );

    if (!rows.length) {
        return null;
    }

    return {
        ...rows[0],
        tokenHash
    };
};

const deleteRefreshToken = async (token) => {
    const tokenHash = hashToken(token);
    await db.query(
        `
            DELETE FROM RefreshTokens
            WHERE token_hash = @tokenHash
        `,
        { tokenHash }
    );
};

const rotateRefreshToken = async ({ token, userId }) => {
    const tokenRecord = await findValidRefreshToken(token);
    if (tokenRecord && tokenRecord.user_id !== userId) {
        throw new Error('Refresh token does not belong to this user');
    }

    await deleteRefreshToken(token);
    return createRefreshToken(userId);
};

const refreshTokenService = {
    createRefreshToken,
    findValidRefreshToken,
    deleteRefreshToken,
    rotateRefreshToken,
    REFRESH_TOKEN_TTL_DAYS
};

export default refreshTokenService;
