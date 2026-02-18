import express from 'express';
import db from '../config/db.js';

const router = express.Router();

router.get('/', async (req, res, next) => {
    try {
        const academias = await db.query('SELECT id, nome, cnpj, created_at FROM Academias');
        return res.json({
            success: true,
            count: academias.length,
            data: academias
        });
    } catch (error) {
        next(error);
    }
});

export default router;
