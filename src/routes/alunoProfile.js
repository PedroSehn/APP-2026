import express from 'express';
import { body, validationResult } from 'express-validator';
import alunoService from '../services/alunoService.js';

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

    if (error.code === 'ALUNO_NO_UPDATES') {
        return res.status(400).json({ message: error.message });
    }

    return next(error);
};

router.get('/', async (req, res, next) => {
    try {
        const aluno = await alunoService.getAluno(req.user.id, req.user.academiaId);
        return res.json({ success: true, data: aluno });
    } catch (error) {
        return handleServiceError(error, res, next);
    }
});

router.put(
    '/',
    [
        body('name').optional().trim().notEmpty(),
        body('email').optional().isEmail().normalizeEmail(),
    ],
    async (req, res, next) => {
        const validationError = handleValidationErrors(req, res);
        if (validationError) {
            return validationError;
        }

        const patch = {};
        ['name', 'email'].forEach((field) => {
            if (req.body[field]) {
                patch[field] = req.body[field];
            }
        });

        if (!Object.keys(patch).length) {
            return res.status(400).json({ message: 'Pelo menos um campo deve ser atualizado' });
        }

        try {
            const aluno = await alunoService.updateAluno(req.user.id, req.user.academiaId, patch);
            return res.json({ success: true, data: aluno });
        } catch (error) {
            return handleServiceError(error, res, next);
        }
    }
);

export default router;
