import express from 'express';
import { body, query, validationResult } from 'express-validator';
import planoService from '../services/planoService.js';
import dashboardService from '../services/dashboardService.js';

const router = express.Router();
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

const handleValidationErrors = (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    return null;
};

const parseLimit = (value) => {
    if (typeof value === 'undefined') {
        return DEFAULT_LIMIT;
    }
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
        return DEFAULT_LIMIT;
    }
    return Math.min(parsed, MAX_LIMIT);
};

const parseOffset = (value) => {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
        return 0;
    }
    return parsed;
};

router.get('/planos', async (req, res, next) => {
    try {
        const planos = await planoService.listPlanos(req.user.academiaId);
        return res.json({ success: true, count: planos.length, data: planos });
    } catch (error) {
        next(error);
    }
});

router.post(
    '/planos',
    [
        body('nome').trim().notEmpty(),
        body('valor').isFloat({ min: 0 }),
        body('descricao').optional().trim(),
        body('maxAulasPorSemana').optional().isInt({ min: 0 })
    ],
    async (req, res, next) => {
        const validationError = handleValidationErrors(req, res);
        if (validationError) {
            return validationError;
        }

        const { nome, valor, descricao, maxAulasPorSemana } = req.body;
        try {
            const plano = await planoService.createPlano({
                academiaId: req.user.academiaId,
                nome,
                valor,
                descricao: descricao || null,
                maxAulasPorSemana: typeof maxAulasPorSemana !== 'undefined' ? maxAulasPorSemana : 0
            });
            return res.status(201).json({ success: true, data: plano });
        } catch (error) {
            if (error.code === 'PLANO_DUPLICATE') {
                return res.status(409).json({ message: error.message });
            }
            next(error);
        }
    }
);

router.get(
    '/dashboard/pending-subscriptions',
    [
        query('limit').optional().isInt({ min: 1, max: MAX_LIMIT }),
        query('offset').optional().isInt({ min: 0 })
    ],
    async (req, res, next) => {
        const validationError = handleValidationErrors(req, res);
        if (validationError) {
            return validationError;
        }

        try {
            const limit = parseLimit(req.query.limit);
            const offset = parseOffset(req.query.offset);
            const subscriptions = await dashboardService.listPendingSubscriptions({
                academiaId: req.user.academiaId,
                limit,
                offset
            });
            return res.json({ success: true, count: subscriptions.length, data: subscriptions });
        } catch (error) {
            next(error);
        }
    }
);

router.get(
    '/dashboard/faturas',
    [
        query('status').optional().trim(),
        query('limit').optional().isInt({ min: 1, max: MAX_LIMIT }),
        query('offset').optional().isInt({ min: 0 }),
        query('month').optional().isInt({ min: 1, max: 12 }),
        query('year').optional().isInt({ min: 1970 })
    ],
    async (req, res, next) => {
        const validationError = handleValidationErrors(req, res);
        if (validationError) {
            return validationError;
        }

        try {
            const invoices = await dashboardService.listInvoices({
                academiaId: req.user.academiaId,
                status: req.query.status,
                month: req.query.month ? parseInt(req.query.month, 10) : undefined,
                year: req.query.year ? parseInt(req.query.year, 10) : undefined,
                limit: parseLimit(req.query.limit),
                offset: parseOffset(req.query.offset)
            });
            return res.json({ success: true, count: invoices.length, data: invoices });
        } catch (error) {
            next(error);
        }
    }
);

router.get(
    '/dashboard/financas',
    [query('year').optional().isInt({ min: 1970 })],
    async (req, res, next) => {
        const validationError = handleValidationErrors(req, res);
        if (validationError) {
            return validationError;
        }

        try {
            const forecast = await dashboardService.getMonthlyRevenueForecast({
                academiaId: req.user.academiaId,
                year: req.query.year ? parseInt(req.query.year, 10) : undefined
            });
            return res.json({ success: true, data: forecast });
        } catch (error) {
            next(error);
        }
    }
);

export default router;
