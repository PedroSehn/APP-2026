import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import presencaService, { getAulasByAluno } from '../services/presencaService.js';
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

    if (error.code === 'HORARIO_NOT_FOUND' || error.code === 'PRESENCA_NOT_FOUND') {
        return res.status(404).json({ message: error.message });
    }

    if (error.code === 'PLANO_NOT_FOUND') {
        return res.status(404).json({ message: error.message });
    }

    if (error.code === 'PRESENCA_CAPACIDADE_MAXIMA' || error.code === 'PRESENCA_JA_EXISTE') {
        return res.status(409).json({ message: error.message });
    }

    if (error.code === 'HORARIO_JA_PASSOU') {
        return res.status(400).json({ message: error.message });
    }

    if (error.code === 'PRESENCA_FORBIDDEN') {
        return res.status(403).json({ message: error.message });
    }

    if (error.code === 'PLANO_PERMISSAO_NOT_FOUND') {
        return res.status(403).json({ message: error.message });
    }

    if (error.code === 'PLANO_LIMITE_SEMANAL') {
        return res.status(400).json({ message: error.message });
    }

    if (error.code === 'PRESENCA_NO_UPDATES') {
        return res.status(400).json({ message: error.message });
    }

    return next(error);
};

router.post(
    '/',
    requireRole(['dono', 'aluno']),
    [
        body('horarioId').isInt({ min: 1 }),
        body('aulaId').isInt({ min: 1 }),
        body('dataAula').isISO8601()
    ],
    async (req, res, next) => {
        const validationError = handleValidationErrors(req, res);
        if (validationError) {
            return validationError;
        }

        const { horarioId, aulaId, dataAula, alunoId: payloadAlunoId } = req.body;
        const alunoId = req.user.role === 'aluno' ? req.user.id : payloadAlunoId;

        if (!alunoId) {
            return res.status(400).json({ message: 'AlunoId é obrigatório para donos' });
        }

        try {
            const presenca = await presencaService.createPresenca(
                {
                    alunoId: parseInt(alunoId, 10),
                    aulaId: parseInt(aulaId, 10),
                    horarioId: parseInt(horarioId, 10),
                    dataAula
                },
                req.user.academiaId
            );

            return res.status(201).json({ success: true, data: presenca });
        } catch (error) {
            return handleServiceError(error, res, next);
        }
    }
);

router.delete(
    '/:id',
    requireRole(['dono', 'aluno']),
    [param('id').isInt({ min: 1 })],
    async (req, res, next) => {
        const validationError = handleValidationErrors(req, res);
        if (validationError) {
            return validationError;
        }

        const options = {
            requireAlunoOwnership: req.user.role === 'aluno',
            ensureFuture: req.user.role === 'aluno',
            alunoId: req.user.role === 'aluno' ? req.user.id : null
        };

        try {
            const presenca = await presencaService.cancelPresenca(
                parseInt(req.params.id, 10),
                req.user.academiaId,
                options
            );

            return res.json({ success: true, data: presenca });
        } catch (error) {
            return handleServiceError(error, res, next);
        }
    }
);

router.patch(
    '/:id',
    requireRole(['dono']),
    [
        param('id').isInt({ min: 1 }),
        body('dataAula').optional().isISO8601(),
        body('status').optional().isString().notEmpty()
    ],
    async (req, res, next) => {
        const validationError = handleValidationErrors(req, res);
        if (validationError) {
            return validationError;
        }

        const patch = {};
        if (Object.prototype.hasOwnProperty.call(req.body, 'dataAula')) {
            patch.dataAula = req.body.dataAula;
        }

        if (Object.prototype.hasOwnProperty.call(req.body, 'status')) {
            patch.status = req.body.status;
        }

        try {
            const presenca = await presencaService.updatePresenca(
                parseInt(req.params.id, 10),
                req.user.academiaId,
                patch
            );

            return res.json({ success: true, data: presenca });
        } catch (error) {
            return handleServiceError(error, res, next);
        }
    }
);

router.get(
    '/minhas',
    requireRole('aluno'),
    async (req, res, next) => {
        try {
            const aulas = await getAulasByAluno(req.user.id, req.user.academiaId);
            return res.json({ success: true, data: aulas });
        } catch (error) {
            return handleServiceError(error, res, next);
        }
    }
);

router.get(
    '/alunos/:alunoId',
    requireRole(['admin', 'dono']),
    [param('alunoId').isInt({ min: 1 })],
    async (req, res, next) => {
        const validationError = handleValidationErrors(req, res);
        if (validationError) {
            return validationError;
        }

        try {
            const aulas = await getAulasByAluno(
                parseInt(req.params.alunoId, 10),
                req.user.academiaId
            );
            return res.json({ success: true, data: aulas });
        } catch (error) {
            return handleServiceError(error, res, next);
        }
    }
);

router.get(
    '/horarios/:horarioId/alunos',
    requireRole(['admin', 'dono', 'funcionario']),
    [
        param('horarioId').isInt({ min: 1 }),
        query('aulaId').isInt({ min: 1 })
    ],
    async (req, res, next) => {
        const validationError = handleValidationErrors(req, res);
        if (validationError) {
            return validationError;
        }

        try {
            const alunos = await presencaService.listAlunosByAulaHorario(
                parseInt(req.query.aulaId, 10),
                parseInt(req.params.horarioId, 10),
                req.user.academiaId
            );

            return res.json({ success: true, data: alunos });
        } catch (error) {
            return handleServiceError(error, res, next);
        }
    }
);

export default router;
