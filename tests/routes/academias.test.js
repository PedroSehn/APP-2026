process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

import request from 'supertest';
import { expect } from 'chai';
import sinon from 'sinon';
import jwt from 'jsonwebtoken';

import app from '../../src/server/server.js';
import academiaService from '../../src/services/academiaService.js';

describe('Academias route', () => {
    afterEach(() => {
        sinon.restore();
    });

    const payload = {
        sub: 42,
        email: 'admin@example.com',
        role: 'admin',
        academiaId: 1
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

    it('returns academias when a valid token is provided', async () => {
        const academias = [
            { id: 1, nome: 'Academia Um', cnpj: '123', createdAt: '2025-01-01T00:00:00Z' }
        ];
        sinon.stub(academiaService, 'listAcademias').resolves(academias);

        const response = await request(app)
            .get('/academias')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).to.equal(200);
        expect(response.body).to.have.property('success', true);
        expect(response.body.data).to.deep.equal(academias);
        expect(response.body.count).to.equal(academias.length);
    });

    it('rejects access when the Authorization header is missing', async () => {
        const response = await request(app).get('/academias');

        expect(response.status).to.equal(401);
        expect(response.body).to.have.property('message', 'Token de autorização ausente');
    });

    it('rejects access when the token is invalid', async () => {
        const response = await request(app)
            .get('/academias')
            .set('Authorization', 'Bearer invalid-token');

        expect(response.status).to.equal(401);
        expect(response.body).to.have.property('message', 'Token inválido ou expirado');
    });

    it('returns academia by id', async () => {
        const academia = { id: 2, nome: 'Dupla', cnpj: '999', createdAt: '2025-02-01T00:00:00Z' };
        sinon.stub(academiaService, 'getAcademiaById').resolves(academia);

        const response = await request(app)
            .get('/academias/2')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).to.equal(200);
        expect(response.body).to.deep.equal({ success: true, data: academia });
    });

    it('returns 404 when academia id not found', async () => {
        const notFoundError = new Error('Academia não encontrada');
        notFoundError.code = 'ACADEMIA_NOT_FOUND';
        sinon.stub(academiaService, 'getAcademiaById').rejects(notFoundError);

        const response = await request(app)
            .get('/academias/99')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).to.equal(404);
        expect(response.body).to.have.property('message', 'Academia não encontrada');
    });

    it('creates a new academia', async () => {
        const payload = { nome: 'Nova', cnpj: '555' };
        const created = { id: 3, ...payload, createdAt: '2025-03-01T00:00:00Z' };
        sinon.stub(academiaService, 'createAcademia').resolves(created);

        const response = await request(app)
            .post('/academias')
            .send(payload)
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).to.equal(201);
        expect(response.body).to.deep.equal({ success: true, data: created });
    });

    it('returns 409 when duplicate academia is created', async () => {
        const duplicateError = new Error('Já existe uma academia com esse nome ou CNPJ');
        duplicateError.code = 'ACADEMIA_DUPLICATE';
        sinon.stub(academiaService, 'createAcademia').rejects(duplicateError);

        const response = await request(app)
            .post('/academias')
            .send({ nome: 'Nova', cnpj: '555' })
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).to.equal(409);
        expect(response.body).to.have.property('message', duplicateError.message);
    });

    it('updates an existing academia', async () => {
        const payload = { nome: 'Atualizada', cnpj: '888' };
        const updated = { id: 4, ...payload, createdAt: '2025-04-01T00:00:00Z' };
        sinon.stub(academiaService, 'updateAcademia').resolves(updated);

        const response = await request(app)
            .put('/academias/4')
            .send(payload)
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).to.equal(200);
        expect(response.body).to.deep.equal({ success: true, data: updated });
    });

    it('returns 404 when updating missing academia', async () => {
        const notFoundError = new Error('Academia não encontrada');
        notFoundError.code = 'ACADEMIA_NOT_FOUND';
        sinon.stub(academiaService, 'updateAcademia').rejects(notFoundError);

        const response = await request(app)
            .put('/academias/99')
            .send({ nome: 'X', cnpj: '000' })
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).to.equal(404);
        expect(response.body).to.have.property('message', notFoundError.message);
    });

    it('returns 409 when updating duplicate academia', async () => {
        const duplicateError = new Error('Já existe uma academia com esse nome ou CNPJ');
        duplicateError.code = 'ACADEMIA_DUPLICATE';
        sinon.stub(academiaService, 'updateAcademia').rejects(duplicateError);

        const response = await request(app)
            .put('/academias/1')
            .send({ nome: 'Duplicada', cnpj: '000' })
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).to.equal(409);
        expect(response.body).to.have.property('message', duplicateError.message);
    });

    it('deletes an academia', async () => {
        sinon.stub(academiaService, 'deleteAcademia').resolves({ id: 5 });

        const response = await request(app)
            .delete('/academias/5')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).to.equal(204);
    });

    it('returns 404 when deleting missing academia', async () => {
        const notFoundError = new Error('Academia não encontrada');
        notFoundError.code = 'ACADEMIA_NOT_FOUND';
        sinon.stub(academiaService, 'deleteAcademia').rejects(notFoundError);

        const response = await request(app)
            .delete('/academias/99')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).to.equal(404);
        expect(response.body).to.have.property('message', notFoundError.message);
    });
});
