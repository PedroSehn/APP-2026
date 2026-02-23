import express from 'express';
import { body, param, validationResult } from 'express-validator';
import academiaService from '../services/academiaService.js';

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

    if (error.code === 'ACADEMIA_NOT_FOUND') {
        return res.status(404).json({ message: error.message });
    }

    if (error.code === 'ACADEMIA_DUPLICATE') {
        return res.status(409).json({ message: error.message });
    }

    return next(error);
};

router.get('/', async (req, res, next) => {
    try {
        const academias = await academiaService.listAcademias();
        return res.json({
            success: true,
            count: academias.length,
            data: academias
        });
    } catch (error) {
        next(error);
    }
});

router.get(
    '/:id',
    [param('id').isInt({ min: 1 })],
    async (req, res, next) => {
        const validationError = handleValidationErrors(req, res);
        if (validationError) {
            return validationError;
        }

        try {
            const academia = await academiaService.getAcademiaById(parseInt(req.params.id, 10));
            return res.json({ success: true, data: academia });
        } catch (error) {
            return handleServiceError(error, res, next);
        }
    }
);

router.post(
    '/',
    [
        body('nome').trim().notEmpty(),
        body('cnpj').trim().notEmpty()
    ],
    async (req, res, next) => {
        const validationError = handleValidationErrors(req, res);
        if (validationError) {
            return validationError;
        }

        const { nome, cnpj } = req.body;
        try {
            const academia = await academiaService.createAcademia({ nome, cnpj });
            return res.status(201).json({ success: true, data: academia });
        } catch (error) {
            return handleServiceError(error, res, next);
        }
    }
);

router.put(
    '/:id',
    [
        param('id').isInt({ min: 1 }),
        body('nome').trim().notEmpty(),
        body('cnpj').trim().notEmpty()
    ],
    async (req, res, next) => {
        const validationError = handleValidationErrors(req, res);
        if (validationError) {
            return validationError;
        }

        const { nome, cnpj } = req.body;
        try {
            const academia = await academiaService.updateAcademia(parseInt(req.params.id, 10), { nome, cnpj });
            return res.json({ success: true, data: academia });
        } catch (error) {
            return handleServiceError(error, res, next);
        }
    }
);

router.delete(
    '/:id',
    [param('id').isInt({ min: 1 })],
    async (req, res, next) => {
        const validationError = handleValidationErrors(req, res);
        if (validationError) {
            return validationError;
        }

        try {
            await academiaService.deleteAcademia(parseInt(req.params.id, 10));
            return res.sendStatus(204);
        } catch (error) {
            return handleServiceError(error, res, next);
        }
    }
);

export default router;
