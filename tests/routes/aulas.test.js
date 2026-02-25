process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

import request from 'supertest';
import { expect } from 'chai';
import sinon from 'sinon';
import jwt from 'jsonwebtoken';

import app from '../../src/server/server.js';
import aulaService from '../../src/services/aulaService.js';

describe('Aulas routes', () => {
    const payload = { sub: 2, email: 'owner@example.com', role: 'dono', academiaId: 12 };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

    afterEach(() => {
        sinon.restore();
    });

    it('lists aulas for the owner academy', async () => {
        const aulas = [{ id: 1, nome: 'Crossfit', descricao: 'Treino funcional', academiaId: 12 }];
        sinon.stub(aulaService, 'listAulas').resolves(aulas);

        const response = await request(app).get('/aulas').set('Authorization', `Bearer ${token}`);

        expect(response.status).to.equal(200);
        expect(response.body.success).to.equal(true);
        expect(response.body.data).to.deep.equal(aulas);
        expect(response.body.count).to.equal(aulas.length);
        sinon.assert.calledWithExactly(aulaService.listAulas, payload.academiaId);
    });

    it('creates a new aula', async () => {
        const created = { id: 2, nome: 'Yoga', descricao: 'Alongamento', academiaId: 12 };
        sinon.stub(aulaService, 'createAula').resolves(created);

        const response = await request(app)
            .post('/aulas')
            .set('Authorization', `Bearer ${token}`)
            .send({ nome: 'Yoga', descricao: 'Alongamento' });

        expect(response.status).to.equal(201);
        expect(response.body.success).to.equal(true);
        expect(response.body.data).to.deep.equal(created);
        sinon.assert.calledWithMatch(aulaService.createAula, {
            academiaId: payload.academiaId,
            nome: 'Yoga',
            descricao: 'Alongamento'
        });
    });

    it('updates an existing aula', async () => {
        const updated = { id: 4, nome: 'Pilates', descricao: 'Fortalecimento', academiaId: 12 };
        sinon.stub(aulaService, 'updateAula').resolves(updated);

        const response = await request(app)
            .put('/aulas/4')
            .set('Authorization', `Bearer ${token}`)
            .send({ nome: 'Pilates', descricao: 'Fortalecimento' });

        expect(response.status).to.equal(200);
        expect(response.body.success).to.equal(true);
        expect(response.body.data).to.deep.equal(updated);
        sinon.assert.calledWithMatch(aulaService.updateAula, 4, payload.academiaId, {
            nome: 'Pilates',
            descricao: 'Fortalecimento'
        });
    });

    it('returns 400 when update has no fields', async () => {
        const response = await request(app)
            .put('/aulas/4')
            .set('Authorization', `Bearer ${token}`)
            .send({});

        expect(response.status).to.equal(400);
        expect(response.body.message).to.equal('Pelo menos um campo deve ser atualizado');
    });

    it('returns 404 when aula not found', async () => {
        const notFound = new Error('Aula não encontrada');
        notFound.code = 'AULA_NOT_FOUND';
        sinon.stub(aulaService, 'getAula').rejects(notFound);

        const response = await request(app)
            .get('/aulas/99')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).to.equal(404);
        expect(response.body.message).to.equal(notFound.message);
    });

    it('returns 409 when duplicate aula is created', async () => {
        const duplicateError = new Error('Já existe uma aula');
        duplicateError.code = 'AULA_DUPLICATE';
        sinon.stub(aulaService, 'createAula').rejects(duplicateError);

        const response = await request(app)
            .post('/aulas')
            .set('Authorization', `Bearer ${token}`)
            .send({ nome: 'Yoga', descricao: 'Alongamento' });

        expect(response.status).to.equal(409);
        expect(response.body.message).to.equal(duplicateError.message);
    });

    it('deletes an aula', async () => {
        sinon.stub(aulaService, 'deleteAula').resolves();

        const response = await request(app)
            .delete('/aulas/4')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).to.equal(204);
        sinon.assert.calledWithExactly(aulaService.deleteAula, 4, payload.academiaId);
    });
});
