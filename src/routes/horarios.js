import express from 'express';
import { body, param, validationResult } from 'express-validator';
import horarioService from '../services/horarioService.js';
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

    if (error.code === 'HORARIO_NOT_FOUND' || error.code === 'AULA_NOT_FOUND') {
        return res.status(404).json({ message: error.message });
    }

    if (error.code === 'HORARIO_NO_UPDATES') {
        return res.status(400).json({ message: error.message });
    }

    return next(error);
};

const validateTime = (field, { optional = false } = {}) => {
    const validator = optional
        ? body(field).optional({ nullable: true })
        : body(field);

    return validator
        .matches(/^\d{2}:\d{2}(:\d{2})?$/)
        .withMessage('Deve estar em formato HH:MM ou HH:MM:SS');
};

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
            const horario = await horarioService.getHorario(id, req.user.academiaId);
            return res.json({ success: true, data: horario });
        } catch (error) {
            return handleServiceError(error, res, next);
        }
    }
);

router.post(
    '/',
    requireRole(['admin', 'dono']),
    [
        body('aulaId').isInt({ min: 1 }),
        body('instrutorId').optional({ nullable: true }).isInt({ min: 1 }),
        body('diaSemana').isInt({ min: 0, max: 6 }),
        validateTime('horaInicio'),
        validateTime('horaFim'),
        body('capacidadeMaxima').optional().isInt({ min: 1 })
    ],
    async (req, res, next) => {
        const validationError = handleValidationErrors(req, res);
        if (validationError) {
            return validationError;
        }

        const {
            aulaId,
            instrutorId,
            diaSemana,
            horaInicio,
            horaFim,
            capacidadeMaxima
        } = req.body;

        try {
            const horario = await horarioService.createHorario(
                {
                    aulaId: parseInt(aulaId, 10),
                    instrutorId: instrutorId ? parseInt(instrutorId, 10) : null,
                    diaSemana: parseInt(diaSemana, 10),
                    horaInicio,
                    horaFim,
                    capacidadeMaxima: capacidadeMaxima ? parseInt(capacidadeMaxima, 10) : undefined
                },
                req.user.academiaId
            );
            return res.status(201).json({ success: true, data: horario });
        } catch (error) {
            return handleServiceError(error, res, next);
        }
    }
);

router.patch(
    '/:id',
    requireRole(['admin', 'dono']),
    [
        param('id').isInt({ min: 1 }),
        body('aulaId').optional().isInt({ min: 1 }),
        body('instrutorId').optional({ nullable: true }).isInt({ min: 1 }),
        body('diaSemana').optional().isInt({ min: 0, max: 6 }),
        validateTime('horaInicio', { optional: true }),
        validateTime('horaFim', { optional: true }),
        body('capacidadeMaxima').optional().isInt({ min: 1 })
    ],
    async (req, res, next) => {
        const validationError = handleValidationErrors(req, res);
        if (validationError) {
            return validationError;
        }

        const patch = {};
        ['aulaId', 'instrutorId', 'diaSemana', 'horaInicio', 'horaFim', 'capacidadeMaxima'].forEach((field) => {
            if (Object.prototype.hasOwnProperty.call(req.body, field)) {
                patch[field] = req.body[field];
            }
        });

        if (!Object.keys(patch).length) {
            return res.status(400).json({ message: 'Pelo menos um campo deve ser atualizado' });
        }

        Object.keys(patch).forEach((key) => {
            if (['aulaId', 'instrutorId', 'diaSemana', 'capacidadeMaxima'].includes(key) && patch[key] !== null) {
                patch[key] = parseInt(patch[key], 10);
            }
        });

        try {
            const horario = await horarioService.updateHorario(
                parseInt(req.params.id, 10),
                req.user.academiaId,
                patch
            );
            return res.json({ success: true, data: horario });
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
            await horarioService.deleteHorario(parseInt(req.params.id, 10), req.user.academiaId);
            return res.sendStatus(204);
        } catch (error) {
            return handleServiceError(error, res, next);
        }
    }
);

export default router;
