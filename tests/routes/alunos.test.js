process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

import request from 'supertest';
import { expect } from 'chai';
import sinon from 'sinon';
import jwt from 'jsonwebtoken';

import app from '../../src/server/server.js';
import alunoService from '../../src/services/alunoService.js';

describe('Alunos route', () => {
    afterEach(() => {
        sinon.restore();
    });

    const payload = {
        sub: 1,
        email: 'dono@example.com',
        role: 'dono',
        academiaId: 10
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
    const funcionarioPayload = {
        sub: 2,
        email: 'funcionario@example.com',
        role: 'funcionario',
        academiaId: 10
    };
    const funcionarioToken = jwt.sign(funcionarioPayload, process.env.JWT_SECRET, { expiresIn: '1h' });
    const alunoPayload = {
        sub: 5,
        email: 'aluno@example.com',
        role: 'aluno',
        academiaId: 10
    };
    const alunoToken = jwt.sign(alunoPayload, process.env.JWT_SECRET, { expiresIn: '1h' });

    it('lists alunos scoped to academia', async () => {
        const alunos = [
            { id: 1, name: 'Aluno A', email: 'a@a.com', role: 'aluno', academiaId: 10 }
        ];
        sinon.stub(alunoService, 'listAlunos').resolves(alunos);

        const response = await request(app)
            .get('/alunos')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).to.equal(200);
        expect(response.body.success).to.equal(true);
        expect(response.body.count).to.equal(alunos.length);
        expect(response.body.data).to.deep.equal(alunos);
    });

    it('returns aluno by id', async () => {
        const aluno = { id: 2, name: 'Aluno B', email: 'b@b.com', role: 'aluno', academiaId: 10 };
        sinon.stub(alunoService, 'getAluno').resolves(aluno);

        const response = await request(app)
            .get('/alunos/2')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).to.equal(200);
        expect(response.body).to.deep.equal({ success: true, data: aluno });
    });

    it('returns 404 when aluno not found', async () => {
        const notFoundError = new Error('Aluno não encontrado');
        notFoundError.code = 'ALUNO_NOT_FOUND';
        sinon.stub(alunoService, 'getAluno').rejects(notFoundError);

        const response = await request(app)
            .get('/alunos/99')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).to.equal(404);
        expect(response.body).to.have.property('message', notFoundError.message);
    });

    it('creates a new aluno', async () => {
        const payload = { name: 'Aluno C', email: 'c@c.com', password: 'secret123' };
        const created = { id: 3, name: payload.name, email: payload.email, role: 'aluno', academiaId: 10 };
        sinon.stub(alunoService, 'createAluno').resolves(created);

        const response = await request(app)
            .post('/alunos')
            .send(payload)
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).to.equal(201);
        expect(response.body).to.deep.equal({ success: true, data: created });
    });

    it('returns 409 when creating aluno with duplicate email', async () => {
        const duplicateError = new Error('Já existe um aluno com esse e-mail');
        duplicateError.code = 'ALUNO_DUPLICATE_EMAIL';
        sinon.stub(alunoService, 'createAluno').rejects(duplicateError);

        const response = await request(app)
            .post('/alunos')
            .send({ name: 'Aluno D', email: 'd@d.com', password: 'password' })
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).to.equal(409);
        expect(response.body).to.have.property('message', duplicateError.message);
    });

    it('updates an aluno', async () => {
        const patch = { name: 'Aluno Atualizado' };
        const updated = { id: 4, name: patch.name, email: 'e@e.com', role: 'aluno', academiaId: 10 };
        sinon.stub(alunoService, 'updateAluno').resolves(updated);

        const response = await request(app)
            .put('/alunos/4')
            .send(patch)
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).to.equal(200);
        expect(response.body).to.deep.equal({ success: true, data: updated });
    });

    it('returns 404 when updating missing aluno', async () => {
        const notFoundError = new Error('Aluno não encontrado');
        notFoundError.code = 'ALUNO_NOT_FOUND';
        sinon.stub(alunoService, 'updateAluno').rejects(notFoundError);

        const response = await request(app)
            .put('/alunos/99')
            .send({ name: 'Sem' })
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).to.equal(404);
        expect(response.body).to.have.property('message', notFoundError.message);
    });

    it('requires at least one field to update', async () => {
        const response = await request(app)
            .put('/alunos/1')
            .send({})
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).to.equal(400);
        expect(response.body).to.have.property('message');
    });

    it('allows funcionario to list alunos', async () => {
        const alunos = [
            { id: 7, name: 'Aluno E', email: 'e@e.com', role: 'aluno', academiaId: 10 }
        ];
        sinon.stub(alunoService, 'listAlunos').resolves(alunos);

        const response = await request(app)
            .get('/alunos')
            .set('Authorization', `Bearer ${funcionarioToken}`);

        expect(response.status).to.equal(200);
        expect(response.body.count).to.equal(alunos.length);
        expect(response.body.data).to.deep.equal(alunos);
    });

    it('rejects funcionario when trying to create an aluno', async () => {
        const response = await request(app)
            .post('/alunos')
            .send({ name: 'Aluno F', email: 'f@f.com', password: 'secret123' })
            .set('Authorization', `Bearer ${funcionarioToken}`);

        expect(response.status).to.equal(403);
        expect(response.body).to.have.property('message', 'Permissão insuficiente');
    });

    it('rejects funcionario when trying to update an aluno', async () => {
        const response = await request(app)
            .put('/alunos/1')
            .send({ name: 'Novo Nome' })
            .set('Authorization', `Bearer ${funcionarioToken}`);

        expect(response.status).to.equal(403);
        expect(response.body).to.have.property('message', 'Permissão insuficiente');
    });

    it('rejects funcionario when trying to delete an aluno', async () => {
        const response = await request(app)
            .delete('/alunos/1')
            .set('Authorization', `Bearer ${funcionarioToken}`);

        expect(response.status).to.equal(403);
        expect(response.body).to.have.property('message', 'Permissão insuficiente');
    });

    it('deletes an aluno', async () => {
        sinon.stub(alunoService, 'deleteAluno').resolves({ id: 5 });

        const response = await request(app)
            .delete('/alunos/5')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).to.equal(204);
    });

    it('returns 404 when deleting missing aluno', async () => {
        const notFoundError = new Error('Aluno não encontrado');
        notFoundError.code = 'ALUNO_NOT_FOUND';
        sinon.stub(alunoService, 'deleteAluno').rejects(notFoundError);

        const response = await request(app)
            .delete('/alunos/99')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).to.equal(404);
        expect(response.body).to.have.property('message', notFoundError.message);
    });

    it('allows aluno to view their own profile', async () => {
        const aluno = { id: 5, name: 'Aluno G', email: 'g@g.com', role: 'aluno', academiaId: 10 };
        sinon.stub(alunoService, 'getAluno').resolves(aluno);

        const response = await request(app)
            .get('/alunos/me')
            .set('Authorization', `Bearer ${alunoToken}`);

        expect(response.status).to.equal(200);
        expect(response.body).to.deep.equal({ success: true, data: aluno });
    });

    it('returns 404 when aluno profile is missing', async () => {
        const notFoundError = new Error('Aluno não encontrado');
        notFoundError.code = 'ALUNO_NOT_FOUND';
        sinon.stub(alunoService, 'getAluno').rejects(notFoundError);

        const response = await request(app)
            .get('/alunos/me')
            .set('Authorization', `Bearer ${alunoToken}`);

        expect(response.status).to.equal(404);
        expect(response.body).to.have.property('message', notFoundError.message);
    });

    it('allows aluno to update their profile', async () => {
        const patch = { name: 'Aluno Atualizado' };
        const updated = { id: 5, name: patch.name, email: 'g@g.com', role: 'aluno', academiaId: 10 };
        sinon.stub(alunoService, 'updateAluno').resolves(updated);

        const response = await request(app)
            .put('/alunos/me')
            .send(patch)
            .set('Authorization', `Bearer ${alunoToken}`);

        expect(response.status).to.equal(200);
        expect(response.body).to.deep.equal({ success: true, data: updated });
    });

    it('rejects aluno update with no fields', async () => {
        const response = await request(app)
            .put('/alunos/me')
            .send({})
            .set('Authorization', `Bearer ${alunoToken}`);

        expect(response.status).to.equal(400);
        expect(response.body).to.have.property('message');
    });

    it('propagates not-found when aluno update target is missing', async () => {
        const notFoundError = new Error('Aluno não encontrado');
        notFoundError.code = 'ALUNO_NOT_FOUND';
        sinon.stub(alunoService, 'updateAluno').rejects(notFoundError);

        const response = await request(app)
            .put('/alunos/me')
            .send({ name: 'Novo Nome' })
            .set('Authorization', `Bearer ${alunoToken}`);

        expect(response.status).to.equal(404);
        expect(response.body).to.have.property('message', notFoundError.message);
    });

    it('rejects aluno update when password is provided', async () => {
        const response = await request(app)
            .put('/alunos/me')
            .send({ password: 'novaSenha123' })
            .set('Authorization', `Bearer ${alunoToken}`);

        expect(response.status).to.equal(400);
        expect(response.body).to.have.property('message').that.includes('senha');
    });
});
