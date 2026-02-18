import express from 'express';
import { body, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import userService from '../services/userService.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is required to sign tokens');
}

const createToken = (user) =>
    jwt.sign(
        { sub: user.id, email: user.email, role: user.role, academiaId: user.academiaId },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );

const responsePayload = (user, token) => ({
    token,
    expiresIn: JWT_EXPIRES_IN,
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
            return res.json(responsePayload(user, token));
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
            return res.status(201).json(responsePayload(user, token));
        } catch (error) {
            if (error.code === 'USER_ALREADY_EXISTS') {
                return res.status(409).json({ message: error.message });
            }
            next(error);
        }
    }
);

export default router;
