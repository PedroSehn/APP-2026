import express from 'express';
import { body, validationResult } from 'express-validator';
import { requireRole } from '../middleware/auth.js';
import assinaturaService from '../services/assinaturaService.js';

const router = express.Router();

const handleValidationErrors = (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    return null;
};

router.post(
    '/',
    requireRole(['admin', 'dono']),
    [
        body('alunoId').isInt({ min: 1 }),
        body('planoId').isInt({ min: 1 }),
        body('dataInicio').notEmpty().isISO8601(),
        body('status').optional().trim().notEmpty(),
        body('dataVencimento').optional().isISO8601()
    ],
    async (req, res, next) => {
        const validationError = handleValidationErrors(req, res);
        if (validationError) {
            return validationError;
        }

        try {
            const result = await assinaturaService.createAssinatura({
                alunoId: parseInt(req.body.alunoId, 10),
                planoId: parseInt(req.body.planoId, 10),
                academiaId: req.user.academiaId,
                dataInicio: req.body.dataInicio,
                status: req.body.status,
                dataVencimento: req.body.dataVencimento,
                faturaStatus: req.body.faturaStatus
            });
            return res.status(201).json({ success: true, data: result });
        } catch (error) {
            if (['ALUNO_NOT_FOUND', 'ASSINATURA_ALUNO_INVALIDO', 'ASSINATURA_JA_ATIVA', 'ASSINATURA_DATA_OBRIGATORIA', 'ASSINATURA_DATA_INVALIDA'].includes(error.code)) {
                return res.status(400).json({ message: error.message });
            }
            return next(error);
        }
    }
);

export default router;
