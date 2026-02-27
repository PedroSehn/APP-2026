import express from 'express';
import planoService from '../services/planoService.js';
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

export default router;
