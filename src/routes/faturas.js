import express from 'express';
import { query, validationResult } from 'express-validator';
import dashboardService from '../services/dashboardService.js';
import { requireRole } from '../middleware/auth.js';

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
    requireRole('aluno'),
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
            const invoices = await dashboardService.listAlunoFaturas({
                academiaId: req.user.academiaId,
                alunoId: req.user.id,
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

export default router;
