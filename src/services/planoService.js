import db from '../config/db.js';

const throwIfNotFound = (rows) => {
    if (!rows.length) {
        const error = new Error('Plano não encontrado');
        error.code = 'PLANO_NOT_FOUND';
        throw error;
    }
};

const throwAulaNotFound = () => {
    const error = new Error('Aula não encontrada para esta academia');
    error.code = 'AULA_NOT_FOUND';
    throw error;
};

const throwPlanoPermissaoNotFound = () => {
    const error = new Error('Permissão não encontrada para este plano');
    error.code = 'PLANO_PERMISSAO_NOT_FOUND';
    throw error;
};

const handleDuplicateError = (error) => {
    const duplicateErrorNumbers = [2627, 2601];
    if (duplicateErrorNumbers.includes(error?.number)) {
        const duplicate = new Error('Já existe um plano com esse nome nesta academia');
        duplicate.code = 'PLANO_DUPLICATE';
        throw duplicate;
    }
    throw error;
};

const handlePlanoAulaDuplicateError = (error) => {
    const duplicateErrorNumbers = [2627, 2601];
    if (duplicateErrorNumbers.includes(error?.number)) {
        const duplicate = new Error('Aula já vinculada a este plano');
        duplicate.code = 'PLANO_AULA_DUPLICATE';
        throw duplicate;
    }
    throw error;
};

const mapPlanoRecord = (record) => ({
    id: record.id,
    academiaId: record.academia_id,
    nome: record.nome,
    valor: Number(record.valor),
    descricao: record.descricao,
    maxAulasPorSemana: record.max_aulas_por_semana
});

const listPlanos = async (academiaId) => {
    const rows = await db.query(
        `
            SELECT
                p.id,
                p.academia_id,
                p.nome,
                p.valor,
                p.descricao,
                p.max_aulas_por_semana,
                a.id AS aula_id,
                a.nome AS aula_nome,
                a.descricao AS aula_descricao
            FROM Planos p
            LEFT JOIN PlanoAulas pa ON pa.plano_id = p.id
            LEFT JOIN Aulas a ON a.id = pa.aula_id AND a.academia_id = @academiaId
            WHERE p.academia_id = @academiaId
            ORDER BY p.nome, a.nome
        `,
        { academiaId }
    );

    const planosMap = new Map();
    rows.forEach((record) => {
        const existingPlano = planosMap.get(record.id);
        if (!existingPlano) {
            planosMap.set(record.id, {
                id: record.id,
                academiaId: record.academia_id,
                nome: record.nome,
                valor: Number(record.valor),
                descricao: record.descricao,
                maxAulasPorSemana: record.max_aulas_por_semana,
                aulas: []
            });
        }

        if (record.aula_id) {
            planosMap.get(record.id).aulas.push({
                id: record.aula_id,
                nome: record.aula_nome,
                descricao: record.aula_descricao
            });
        }
    });

    return Array.from(planosMap.values());
};

const getPlanoById = async (id, academiaId) => {
    const rows = await db.query(
        `
            SELECT id, academia_id, nome, valor, descricao, max_aulas_por_semana
            FROM Planos
            WHERE id = @id AND academia_id = @academiaId
        `,
        { id, academiaId }
    );
    throwIfNotFound(rows);
    return mapPlanoRecord(rows[0]);
};

const createPlano = async ({ academiaId, nome, valor, descricao, maxAulasPorSemana = 0 }) => {
    try {
        const rows = await db.query(
            `
                INSERT INTO Planos (academia_id, nome, valor, descricao, max_aulas_por_semana)
                OUTPUT INSERTED.*
                VALUES (@academiaId, @nome, @valor, @descricao, @maxAulasPorSemana)
            `,
            {
                academiaId,
                nome,
                valor,
                descricao,
                maxAulasPorSemana
            }
        );
        return mapPlanoRecord(rows[0]);
    } catch (error) {
        handleDuplicateError(error);
    }
};

const updatePlano = async (id, academiaId, patch) => {
    const updates = [];
    const params = { id, academiaId };

    if (Object.prototype.hasOwnProperty.call(patch, 'nome')) {
        updates.push('nome = @nome');
        params.nome = patch.nome;
    }
    if (typeof patch.valor !== 'undefined') {
        updates.push('valor = @valor');
        params.valor = patch.valor;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'descricao')) {
        updates.push('descricao = @descricao');
        params.descricao = patch.descricao;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'maxAulasPorSemana')) {
        updates.push('max_aulas_por_semana = @maxAulasPorSemana');
        params.maxAulasPorSemana = patch.maxAulasPorSemana;
    }

    if (!updates.length) {
        const error = new Error('Nenhum campo para atualizar');
        error.code = 'PLANO_NO_UPDATES';
        throw error;
    }

    try {
        const rows = await db.query(
            `
                UPDATE Planos
                SET ${updates.join(', ')}
                OUTPUT INSERTED.*
                WHERE id = @id AND academia_id = @academiaId
            `,
            params
        );
        throwIfNotFound(rows);
        return mapPlanoRecord(rows[0]);
    } catch (error) {
        handleDuplicateError(error);
    }
};

const deletePlano = async (id, academiaId) => {
    const rows = await db.query(
        `
            DELETE FROM Planos
            OUTPUT DELETED.*
            WHERE id = @id AND academia_id = @academiaId
        `,
        { id, academiaId }
    );
    throwIfNotFound(rows);
    return mapPlanoRecord(rows[0]);
};

const ensurePlanoBelongsToAcademia = async (planoId, academiaId) => {
    const rows = await db.query(
        `
            SELECT id
            FROM Planos
            WHERE id = @planoId AND academia_id = @academiaId
        `,
        { planoId, academiaId }
    );

    if (!rows.length) {
        throwIfNotFound(rows);
    }
};

const ensureAulaBelongsToAcademia = async (aulaId, academiaId) => {
    const rows = await db.query(
        `
            SELECT id
            FROM Aulas
            WHERE id = @aulaId AND academia_id = @academiaId
        `,
        { aulaId, academiaId }
    );

    if (!rows.length) {
        throwAulaNotFound();
    }
};

const ensurePlanoPermiteAula = async (planoId, aulaId, academiaId) => {
    await ensurePlanoBelongsToAcademia(planoId, academiaId);
    const rows = await db.query(
        `
            SELECT id
            FROM PlanoAulas
            WHERE plano_id = @planoId AND aula_id = @aulaId
        `,
        { planoId, aulaId }
    );

    if (!rows.length) {
        throwPlanoPermissaoNotFound();
    }
};

const mapPlanoAulaRecord = (record) => ({
    id: record.id,
    planoId: record.plano_id,
    aulaId: record.aula_id,
    nome: record.nome,
    descricao: record.descricao
});

const listPlanoAulas = async (planoId, academiaId) => {
    await ensurePlanoBelongsToAcademia(planoId, academiaId);
    const rows = await db.query(
        `
            SELECT
                pa.id,
                pa.plano_id,
                pa.aula_id,
                a.nome,
                a.descricao
            FROM PlanoAulas pa
            INNER JOIN Aulas a ON pa.aula_id = a.id AND a.academia_id = @academiaId
            WHERE pa.plano_id = @planoId
        `,
        { planoId, academiaId }
    );

    return rows.map(mapPlanoAulaRecord);
};

const addAulaToPlano = async (planoId, aulaId, academiaId) => {
    await ensurePlanoBelongsToAcademia(planoId, academiaId);
    await ensureAulaBelongsToAcademia(aulaId, academiaId);
    try {
        const rows = await db.query(
            `
                INSERT INTO PlanoAulas (plano_id, aula_id)
                OUTPUT INSERTED.*
                VALUES (@planoId, @aulaId)
            `,
            { planoId, aulaId }
        );

        return rows[0];
    } catch (error) {
        handlePlanoAulaDuplicateError(error);
    }
};

const removeAulaFromPlano = async (planoId, aulaId, academiaId) => {
    await ensurePlanoBelongsToAcademia(planoId, academiaId);
    const rows = await db.query(
        `
            DELETE pa
            OUTPUT DELETED.*
            FROM PlanoAulas pa
            INNER JOIN Aulas a ON pa.aula_id = a.id AND a.academia_id = @academiaId
            WHERE pa.plano_id = @planoId AND pa.aula_id = @aulaId
        `,
        { planoId, aulaId, academiaId }
    );

    if (!rows.length) {
        throwPlanoPermissaoNotFound();
    }

    return rows[0];
};


const ensureAlunoHasPlano = async (alunoId, academiaId) => {
    const rows = await db.query(
        `
            SELECT a.*
            FROM Assinaturas a
            INNER JOIN Planos p ON a.plano_id = p.id
            WHERE a.aluno_id = @alunoId
              AND p.academia_id = @academiaId
              AND a.status = 'ativa'
        `,
        { alunoId, academiaId }
    );

    if (!rows.length) {
        const error = new Error('Assinatura ativa não encontrada para este aluno');
        error.code = 'ASSINATURA_NOT_FOUND';
        throw error;
    }

    return rows[0];
};

const reassignAlunoPlano = async (alunoId, academiaId, planoId) => {
    const assinatura = await ensureAlunoHasPlano(alunoId, academiaId);
    await ensurePlanoBelongsToAcademia(planoId, academiaId);

    const rows = await db.query(
        `
            UPDATE a
            SET plano_id = @planoId
            OUTPUT INSERTED.*
            FROM Assinaturas a
            INNER JOIN Planos p ON a.plano_id = p.id
            WHERE a.id = @assinaturaId AND p.academia_id = @academiaId
        `,
        {
            planoId,
            assinaturaId: assinatura.id,
            academiaId
        }
    );

    if (!rows.length) {
        throw new Error('Falha ao atualizar assinatura');
    }

    return rows[0];
};

const planoService = {
    listPlanos,
    getPlanoById,
    createPlano,
    updatePlano,
    deletePlano
};

export {
    ensurePlanoBelongsToAcademia,
    ensurePlanoPermiteAula,
    listPlanoAulas,
    addAulaToPlano,
    removeAulaFromPlano,
    reassignAlunoPlano,
    getPlanoById
};

export default planoService;

