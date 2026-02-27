import express from 'express';
import { body, param, validationResult } from 'express-validator';
import { listPlanoAulas, addAulaToPlano, removeAulaFromPlano } from '../services/planoService.js';

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

    if (error.code === 'PLANO_NOT_FOUND' || error.code === 'AULA_NOT_FOUND') {
        return res.status(404).json({ message: error.message });
    }

    if (error.code === 'PLANO_PERMISSAO_NOT_FOUND') {
        return res.status(404).json({ message: error.message });
    }

    if (error.code === 'PLANO_AULA_DUPLICATE') {
        return res.status(409).json({ message: error.message });
    }

    return next(error);
};

router.get(
    '/:planoId/aulas',
    [param('planoId').isInt({ min: 1 })],
    async (req, res, next) => {
        const validationError = handleValidationErrors(req, res);
        if (validationError) {
            return validationError;
        }

        try {
            const aulas = await listPlanoAulas(
                parseInt(req.params.planoId, 10),
                req.user.academiaId
            );
            return res.json({ success: true, data: aulas });
        } catch (error) {
            return handleServiceError(error, res, next);
        }
    }
);

router.post(
    '/:planoId/aulas',
    [
        param('planoId').isInt({ min: 1 }),
        body('aulaId').isInt({ min: 1 })
    ],
    async (req, res, next) => {
        const validationError = handleValidationErrors(req, res);
        if (validationError) {
            return validationError;
        }

        try {
            const aula = await addAulaToPlano(
                parseInt(req.params.planoId, 10),
                parseInt(req.body.aulaId, 10),
                req.user.academiaId
            );
            return res.status(201).json({ success: true, data: aula });
        } catch (error) {
            return handleServiceError(error, res, next);
        }
    }
);

router.delete(
    '/:planoId/aulas/:aulaId',
    [
        param('planoId').isInt({ min: 1 }),
        param('aulaId').isInt({ min: 1 })
    ],
    async (req, res, next) => {
        const validationError = handleValidationErrors(req, res);
        if (validationError) {
            return validationError;
        }

        try {
            const aula = await removeAulaFromPlano(
                parseInt(req.params.planoId, 10),
                parseInt(req.params.aulaId, 10),
                req.user.academiaId
            );
            return res.json({ success: true, data: aula });
        } catch (error) {
            return handleServiceError(error, res, next);
        }
    }
);

export default router;
