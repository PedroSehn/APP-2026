import express from 'express';
import { body, param, validationResult } from 'express-validator';
import alunoService from '../services/alunoService.js';
import { requireRole } from '../middleware/auth.js';

const router = express.Router();

const handleValidationErrors = (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    return null;
};

const handleServiceError = (error, res, next) => {
    if (!error) {
        return next();
    }

    if (error.code === 'ALUNO_NOT_FOUND') {
        return res.status(404).json({ message: error.message });
    }

    if (error.code === 'ALUNO_DUPLICATE_EMAIL') {
        return res.status(409).json({ message: error.message });
    }

    if (error.code === 'ALUNO_NO_UPDATES' || error.code === 'ALUNO_INVALID_PASSWORD') {
        return res.status(400).json({ message: error.message });
    }

    return next(error);
};

router.get('/', requireRole(['admin', 'dono', 'funcionario']), async (req, res, next) => {
    try {
        const alunos = await alunoService.listAlunos(req.user.academiaId);
        return res.json({
            success: true,
            count: alunos.length,
            data: alunos
        });
    } catch (error) {
        next(error);
    }
});

router.get(
    '/:id',
    requireRole(['admin', 'dono', 'funcionario']),
    [param('id').isInt({ min: 1 })],
    async (req, res, next) => {
        const validationError = handleValidationErrors(req, res);
        if (validationError) {
            return validationError;
        }

        const id = parseInt(req.params.id, 10);
        try {
            const aluno = await alunoService.getAluno(id, req.user.academiaId);
            return res.json({ success: true, data: aluno });
        } catch (error) {
            return handleServiceError(error, res, next);
        }
    }
);

router.post(
    '/',
    requireRole(['admin', 'dono']),
    [
        body('name').trim().notEmpty(),
        body('email').isEmail().normalizeEmail(),
        body('password').isLength({ min: 6 })
    ],
    async (req, res, next) => {
        const validationError = handleValidationErrors(req, res);
        if (validationError) {
            return validationError;
        }

        const { name, email, password } = req.body;
        try {
            const aluno = await alunoService.createAluno({
                name,
                email,
                password,
                academiaId: req.user.academiaId
            });
            return res.status(201).json({ success: true, data: aluno });
        } catch (error) {
            return handleServiceError(error, res, next);
        }
    }
);

router.put(
    '/:id',
    requireRole(['admin', 'dono']),
    [
        param('id').isInt({ min: 1 }),
        body('name').optional().trim().notEmpty(),
        body('email').optional().isEmail().normalizeEmail(),
        body('password').optional().isLength({ min: 6 })
    ],
    async (req, res, next) => {
        const validationError = handleValidationErrors(req, res);
        if (validationError) {
            return validationError;
        }

        const patch = {};
        ['name', 'email', 'password'].forEach((field) => {
            if (req.body[field]) {
                patch[field] = req.body[field];
            }
        });

        if (!Object.keys(patch).length) {
            return res.status(400).json({ message: 'Pelo menos um campo deve ser atualizado' });
        }

        const id = parseInt(req.params.id, 10);
        try {
            const aluno = await alunoService.updateAluno(id, req.user.academiaId, patch);
            return res.json({ success: true, data: aluno });
        } catch (error) {
            return handleServiceError(error, res, next);
        }
    }
);

router.delete(
    '/:id',
    requireRole(['admin', 'dono']),
    [param('id').isInt({ min: 1 })],
    async (req, res, next) => {
        const validationError = handleValidationErrors(req, res);
        if (validationError) {
            return validationError;
        }

        try {
            await alunoService.deleteAluno(parseInt(req.params.id, 10), req.user.academiaId);
            return res.sendStatus(204);
        } catch (error) {
            return handleServiceError(error, res, next);
        }
    }
);

export default router;
