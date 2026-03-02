import express from 'express';
import { body, validationResult, param } from 'express-validator';
import jwt from 'jsonwebtoken';
import userService from '../services/userService.js';
import refreshTokenService from '../services/refreshTokenService.js';
import academiaService from '../services/academiaService.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import passwordService from '../services/passwordService.js';

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

const passwordRules = [
    body('newPassword')
        .isLength({ min: 8 })
        .withMessage('A nova senha precisa ter pelo menos 8 caracteres')
        .matches(/[A-Z]/)
        .withMessage('A nova senha precisa conter ao menos uma letra maiúscula')
        .matches(/\d/)
        .withMessage('A nova senha precisa conter ao menos um número'),
    body('confirmPassword')
        .custom((value, { req }) => value === req.body.newPassword)
        .withMessage('A confirmação deve ser igual à nova senha')
];

const respondBusinessError = (res, error) => {
    if (error?.status && error?.message) {
        res.status(error.status).json({ success: false, message: error.message });
        return true;
    }
    return false;
};

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
        body('role').optional().isIn(['admin', 'aluno', 'dono', 'funcionario']),
        body('academiaId')
            .if(body('role').equals('dono'))
            .exists()
            .withMessage('Academia obrigatória para donos')
            .bail()
            .isInt({ min: 1 }),
        body('academiaId')
            .if(body('role').equals('funcionario'))
            .exists()
            .withMessage('Academia obrigatória para funcionários')
            .bail()
            .isInt({ min: 1 }),
        body('academiaId').optional().isInt({ min: 1 })
    ],
    async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, email, password, role } = req.body;
        const academiaId = req.body.academiaId ?? null;

        try {
            const user = await userService.createUser({
                name,
                email,
                password,
                role,
                academiaId
            });

            if (user.role === 'dono') {
                await academiaService.assignOwnerToAcademia({
                    academiaId: user.academiaId,
                    ownerId: user.id
                });
            }

            const token = createToken(user);
            const refreshData = await refreshTokenService.createRefreshToken(user.id);
            return res.status(201).json(responsePayload(user, token, refreshData));
        } catch (error) {
            if (error.code === 'USER_ALREADY_EXISTS' || error.code === 'ACADEMIA_HAS_OWNER') {
                return res.status(409).json({ message: error.message });
            }
            if (error.code === 'USER_INVALID_ROLE' || error.code === 'OWNER_REQUIRES_ACADEMIA') {
                return res.status(400).json({ message: error.message });
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

router.patch(
    '/password',
    authenticate,
    [
    body('currentPassword')
        .isString()
        .trim()
        .notEmpty()
        .withMessage('A senha atual é obrigatória'),
        ...passwordRules
    ],
    async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { currentPassword, newPassword } = req.body;
        try {
            await passwordService.changePassword(req.user.id, currentPassword, newPassword);
            return res.json({ success: true, message: 'Senha alterada com sucesso' });
        } catch (error) {
            if (respondBusinessError(res, error)) {
                return;
            }
            next(error);
        }
    }
);

router.post(
    '/forgot-password',
    [body('email').isEmail().normalizeEmail()],
    async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const tokenData = await passwordService.requestPasswordReset(req.body.email);
            if (tokenData?.token) {
                // TODO: injetar emailService.sendResetEmail(tokenData.email, tokenData.token);
            }
            return res.json({
                success: true,
                message: 'Se houver uma conta vinculada ao e-mail, enviaremos instruções para redefinir a senha'
            });
        } catch (error) {
            next(error);
        }
    }
);

router.get(
    '/reset-password/:token',
    [param('token').isString().trim().notEmpty()],
    async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            await passwordService.validateResetToken(req.params.token);
            return res.json({ success: true, message: 'Token válido' });
        } catch (error) {
            if (respondBusinessError(res, error)) {
                return;
            }
            next(error);
        }
    }
);

router.post(
    '/reset-password',
    [
        body('token').isString().trim().notEmpty(),
        ...passwordRules
    ],
    async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            await passwordService.resetPassword(req.body.token, req.body.newPassword);
            return res.json({ success: true, message: 'Senha redefinida com sucesso' });
        } catch (error) {
            if (respondBusinessError(res, error)) {
                return;
            }
            next(error);
        }
    }
);

router.delete(
    '/delete',
    authenticate,
    requireRole(['admin', 'dono']),
    [body('userId').isInt({ min: 1 })],
    async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const targetUserId = parseInt(req.body.userId, 10);
        try {
            await userService.deleteUser(targetUserId, req.user.academiaId);
            return res.sendStatus(204);
        } catch (error) {
            if (error.code === 'USER_NOT_FOUND') {
                return res.status(404).json({ message: error.message });
            }
            next(error);
        }
    }
);

export default router;
