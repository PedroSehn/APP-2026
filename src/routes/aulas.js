import express from 'express';
import { body, param, validationResult } from 'express-validator';
import { requireRole } from '../middleware/auth.js';
import aulaService from '../services/aulaService.js';

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

    if (error.code === 'AULA_NOT_FOUND') {
        return res.status(404).json({ message: error.message });
    }

    if (error.code === 'AULA_DUPLICATE') {
        return res.status(409).json({ message: error.message });
    }

    if (error.code === 'AULA_NO_UPDATES') {
        return res.status(400).json({ message: error.message });
    }

    return next(error);
};

router.get('/', requireRole(['admin', 'dono']), async (req, res, next) => {
    try {
        const aulas = await aulaService.listAulas(req.user.academiaId);
        return res.json({ success: true, count: aulas.length, data: aulas });
    } catch (error) {
        next(error);
    }
});

router.get(
    '/:id',
    requireRole(['admin', 'dono']),
    [param('id').isInt({ min: 1 })],
    async (req, res, next) => {
        const validationError = handleValidationErrors(req, res);
        if (validationError) {
            return validationError;
        }

        const id = parseInt(req.params.id, 10);
        try {
            const aula = await aulaService.getAula(id, req.user.academiaId);
            return res.json({ success: true, data: aula });
        } catch (error) {
            return handleServiceError(error, res, next);
        }
    }
);

router.post(
    '/',
    requireRole(['admin', 'dono']),
    [body('nome').trim().notEmpty(), body('descricao').optional().trim()],
    async (req, res, next) => {
        const validationError = handleValidationErrors(req, res);
        if (validationError) {
            return validationError;
        }

        const { nome, descricao } = req.body;
        try {
            const aula = await aulaService.createAula({
                academiaId: req.user.academiaId,
                nome,
                descricao: descricao || null
            });
            return res.status(201).json({ success: true, data: aula });
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
        body('nome').optional().trim().notEmpty(),
        body('descricao').optional().trim()
    ],
    async (req, res, next) => {
        const validationError = handleValidationErrors(req, res);
        if (validationError) {
            return validationError;
        }

        const patch = {};
        ['nome', 'descricao'].forEach((field) => {
            if (Object.prototype.hasOwnProperty.call(req.body, field)) {
                patch[field] = req.body[field];
            }
        });

        if (!Object.keys(patch).length) {
            return res.status(400).json({ message: 'Pelo menos um campo deve ser atualizado' });
        }

        const id = parseInt(req.params.id, 10);
        try {
            const aula = await aulaService.updateAula(id, req.user.academiaId, patch);
            return res.json({ success: true, data: aula });
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
            await aulaService.deleteAula(parseInt(req.params.id, 10), req.user.academiaId);
            return res.sendStatus(204);
        } catch (error) {
            return handleServiceError(error, res, next);
        }
    }
);

export default router;
