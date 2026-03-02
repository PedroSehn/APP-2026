import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
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

router.get(
    '/',
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

router.patch(
    '/:id',
    [
        param('id').isInt({ min: 1 }),
        body('status').trim().notEmpty(),
        body('dataPagamento').optional().isISO8601()
    ],
    async (req, res, next) => {
        const validationError = handleValidationErrors(req, res);
        if (validationError) {
            return validationError;
        }

        try {
            const updated = await dashboardService.updateFaturaStatus({
                faturaId: parseInt(req.params.id, 10),
                academiaId: req.user.academiaId,
                status: req.body.status,
                dataPagamento: req.body.dataPagamento
            });
            return res.json({ success: true, data: updated });
        } catch (error) {
            if (['FATURA_NOT_FOUND', 'FATURA_STATUS_OBRIGATORIO', 'FATURA_DATA_INVALIDA'].includes(error.code)) {
                return res.status(400).json({ message: error.message });
            }
            return next(error);
        }
    }
);

export default router;
