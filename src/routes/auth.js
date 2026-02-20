import express from 'express';
import { body, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import userService from '../services/userService.js';
import refreshTokenService from '../services/refreshTokenService.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const REFRESH_TOKEN_EXPIRES_IN_DAYS =
    parseInt(process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS, 10) ||
    refreshTokenService.REFRESH_TOKEN_TTL_DAYS;

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is required to sign tokens');
}

const createToken = (user) =>
    jwt.sign(
        { sub: user.id, email: user.email, role: user.role, academiaId: user.academiaId },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );

const responsePayload = (user, token, refreshData) => ({
    token,
    expiresIn: JWT_EXPIRES_IN,
    refreshToken: refreshData.token,
    refreshTokenExpiresInDays: refreshData.expiresInDays ?? REFRESH_TOKEN_EXPIRES_IN_DAYS,
    user
});

router.post(
    '/login',
    [
        body('email').isEmail().normalizeEmail(),
        body('password').isString().trim().notEmpty()
    ],
    async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password } = req.body;
        try {
            const user = await userService.authenticateUser({ email, password });
            if (!user) {
                return res.status(401).json({ message: 'Credenciais inválidas', body: req.body });
            }

            const token = createToken(user);
            const refreshData = await refreshTokenService.createRefreshToken(user.id);
            return res.json(responsePayload(user, token, refreshData));
        } catch (error) {
            next(error);
        }
    }
);

router.post(
    '/register',
    [
        body('name').trim().notEmpty(),
        body('email').isEmail().normalizeEmail(),
        body('password').isLength({ min: 6 }),
        body('role').optional().isString().trim(),
        body('academiaId').optional().isInt({ min: 1 })
    ],
    async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, email, password, role, academiaId } = req.body;
        try {
            const user = await userService.createUser({
                name,
                email,
                password,
                role,
                academiaId: academiaId ?? null
            });

            const token = createToken(user);
            const refreshData = await refreshTokenService.createRefreshToken(user.id);
            return res.status(201).json(responsePayload(user, token, refreshData));
        } catch (error) {
            if (error.code === 'USER_ALREADY_EXISTS') {
                return res.status(409).json({ message: error.message });
            }
            next(error);
        }
    }
);

router.post(
    '/refresh',
    [body('refreshToken').isString().trim().notEmpty()],
    async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { refreshToken } = req.body;
        try {
            const tokenRecord = await refreshTokenService.findValidRefreshToken(refreshToken);
            if (!tokenRecord) {
                return res.status(401).json({ message: 'Refresh token inválido ou expirado' });
            }

            const user = await userService.findById(tokenRecord.user_id);
            if (!user) {
                return res.status(401).json({ message: 'Usuário não encontrado' });
            }

            const newToken = createToken(user);
            const refreshData = await refreshTokenService.rotateRefreshToken({
                token: refreshToken,
                userId: user.id
            });
            return res.json(responsePayload(user, newToken, refreshData));
        } catch (error) {
            next(error);
        }
    }
);

router.post(
    '/logout',
    [body('refreshToken').isString().trim().notEmpty()],
    async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            await refreshTokenService.deleteRefreshToken(req.body.refreshToken);
            return res.sendStatus(204);
        } catch (error) {
            next(error);
        }
    }
);

export default router;
