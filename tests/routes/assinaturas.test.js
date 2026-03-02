import request from 'supertest';
import { expect } from 'chai';
import sinon from 'sinon';
import jwt from 'jsonwebtoken';

import app from '../../src/server/server.js';
import assinaturaService from '../../src/services/assinaturaService.js';

describe('assinaturas routes', () => {
    const payload = { sub: 1, email: 'owner@example.com', role: 'dono', academiaId: 7 };
    const token = jwt.sign(payload, process.env.JWT_SECRET || 'test-jwt-secret', { expiresIn: '1h' });
const alunoPayload = { sub: 99, email: 'aluno@example.com', role: 'aluno', academiaId: 7 };
const alunoToken = jwt.sign(alunoPayload, process.env.JWT_SECRET || 'test-jwt-secret', { expiresIn: '1h' });

    afterEach(() => {
        sinon.restore();
    });

    it('creates a assinatura when payload is valid', async () => {
        const assinatura = {
            assinatura: { id: 10, alunoId: 5, planoId: 3, dataInicio: '2025-01-01', status: 'ATIVA' },
            fatura: { id: 22, assinaturaId: 10, valor: 199.9, dataVencimento: '2025-01-01', status: 'PENDENTE' }
        };
        sinon.stub(assinaturaService, 'createAssinatura').resolves(assinatura);

        const response = await request(app)
            .post('/assinaturas')
            .set('Authorization', `Bearer ${token}`)
            .send({ alunoId: 5, planoId: 3, dataInicio: '2025-01-01' });

        expect(response.status).to.equal(201);
        expect(response.body.success).to.equal(true);
        expect(response.body.data).to.deep.equal(assinatura);
        sinon.assert.calledWithMatch(assinaturaService.createAssinatura, {
            alunoId: 5,
            planoId: 3,
            academiaId: payload.academiaId,
            dataInicio: '2025-01-01'
        });
    });

    it('returns 400 for malformed payload', async () => {
        const response = await request(app)
            .post('/assinaturas')
            .set('Authorization', `Bearer ${token}`)
            .send({ alunoId: 'abc', planoId: 3 });

        expect(response.status).to.equal(400);
        expect(response.body).to.have.property('errors');
        expect(response.body.errors).to.be.an('array');
    });

    it('renews assinaturas via the owner endpoint', async () => {
        const renewed = {
            assinatura: { id: 21, alunoId: 4, planoId: 3, dataInicio: '2026-05-01', status: 'ATIVA' },
            fatura: { id: 99, assinaturaId: 21, status: 'PENDENTE' }
        };
        sinon.stub(assinaturaService, 'renewAssinatura').resolves(renewed);

        const response = await request(app)
            .post('/assinaturas/21/renew')
            .set('Authorization', `Bearer ${token}`)
            .send({ dataInicio: '2026-05-01' });

        expect(response.status).to.equal(200);
        expect(response.body.data).to.deep.equal(renewed);
    });

    it('allows alunos to cancel their own assinatura', async () => {
        const cancelled = { id: 5, alunoId: 99, status: 'CANCELADA' };
        sinon.stub(assinaturaService, 'cancelarAssinaturaPeloAluno').resolves(cancelled);

        const response = await request(app)
            .post('/assinaturas/5/cancel')
            .set('Authorization', `Bearer ${alunoToken}`);

        expect(response.status).to.equal(200);
        expect(response.body.data).to.deep.equal(cancelled);
        sinon.assert.calledWithMatch(assinaturaService.cancelarAssinaturaPeloAluno, {
            assinaturaId: 5,
            academiaId: payload.academiaId,
            alunoId: alunoPayload.sub
        });
    });
});
