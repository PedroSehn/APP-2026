import express from 'express';
import { body, param, validationResult } from 'express-validator';
import planoService from '../services/planoService.js';
import { getAlunoPlano } from '../services/presencaService.js';
import { reassignAlunoPlano } from '../services/planoService.js';
import { requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get(
    '/',
    requireRole(['admin', 'dono', 'funcionario', 'aluno']),
    async (req, res, next) => {
        try {
            const planos = await planoService.listPlanos(req.user.academiaId);
            return res.json({ success: true, count: planos.length, data: planos });
        } catch (error) {
            next(error);
        }
    }
);

router.get(
    '/meu',
    requireRole('aluno'),
    async (req, res, next) => {
        try {
            const plano = await getAlunoPlano(req.user.id, req.user.academiaId);
            return res.json({ success: true, data: plano });
        } catch (error) {
            next(error);
        }
    }
);

router.patch(
    '/alunos/:alunoId',
    requireRole(['admin', 'dono']),
    [param('alunoId').isInt({ min: 1 }), body('planoId').isInt({ min: 1 })],
    async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const assinatura = await reassignAlunoPlano(
                parseInt(req.params.alunoId, 10),
                req.user.academiaId,
                parseInt(req.body.planoId, 10)
            );
            return res.json({ success: true, data: assinatura });
        } catch (error) {
            return res.status(400).json({ message: error.message });
        }
    }
);

export default router;
