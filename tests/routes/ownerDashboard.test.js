process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

import request from 'supertest';
import { expect } from 'chai';
import sinon from 'sinon';
import jwt from 'jsonwebtoken';

import app from '../../src/server/server.js';
import planoService from '../../src/services/planoService.js';
import dashboardService from '../../src/services/dashboardService.js';

describe('Owner dashboard routes', () => {
    const payload = { sub: 1, email: 'owner@example.com', role: 'dono', academiaId: 10 };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

    afterEach(() => {
        sinon.restore();
    });

    it('lists planos for the owner academy', async () => {
        const planos = [
            {
                id: 5,
                nome: 'Premium',
                valor: 199.9,
                academiaId: 10,
                descricao: 'Premium total',
                maxAulasPorSemana: 0,
                aulas: [
                    { id: 21, nome: 'Funcional', descricao: 'Alta intensidade' }
                ]
            }
        ];
        sinon.stub(planoService, 'listPlanos').resolves(planos);

        const response = await request(app).get('/owner/planos').set('Authorization', `Bearer ${token}`);

        expect(response.status).to.equal(200);
        expect(response.body.success).to.equal(true);
        expect(response.body.data).to.deep.equal(planos);
        expect(response.body.count).to.equal(planos.length);
        sinon.assert.calledWithExactly(planoService.listPlanos, payload.academiaId);
    });

    it('creates a new plano', async () => {
        const novoPlano = { id: 6, nome: 'Elite', valor: 249.9, academiaId: 10 };
        sinon.stub(planoService, 'createPlano').resolves(novoPlano);

        const response = await request(app)
            .post('/owner/planos')
            .send({ nome: 'Elite', valor: 249.9, descricao: 'Tudo incluso' })
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).to.equal(201);
        expect(response.body.success).to.equal(true);
        expect(response.body.data).to.deep.equal(novoPlano);
        sinon.assert.calledWithMatch(planoService.createPlano, {
            academiaId: payload.academiaId,
            nome: 'Elite',
            valor: 249.9,
            descricao: 'Tudo incluso'
        });
    });

    it('returns 409 when creating duplicate plano', async () => {
        const duplicateError = new Error('Já existe um plano');
        duplicateError.code = 'PLANO_DUPLICATE';
        sinon.stub(planoService, 'createPlano').rejects(duplicateError);

        const response = await request(app)
            .post('/owner/planos')
            .send({ nome: 'Elite', valor: 249.9 })
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).to.equal(409);
        expect(response.body).to.have.property('message', duplicateError.message);
    });

    it('lists pending subscriptions with pagination hints', async () => {
        sinon.stub(dashboardService, 'listPendingSubscriptions').resolves([]);

        const response = await request(app)
            .get('/owner/dashboard/pending-subscriptions?limit=30&offset=5')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).to.equal(200);
        expect(response.body.success).to.equal(true);
        sinon.assert.calledWithMatch(dashboardService.listPendingSubscriptions, {
            academiaId: payload.academiaId,
            limit: 30,
            offset: 5
        });
    });

    it('returns filtered invoices and respects query params', async () => {
        const invoices = [{ faturaId: 1 }];
        sinon.stub(dashboardService, 'listInvoices').resolves(invoices);

        const response = await request(app)
            .get('/owner/dashboard/faturas?status=PENDENTE&month=4&year=2025&limit=20&offset=10')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).to.equal(200);
        expect(response.body.success).to.equal(true);
        expect(response.body.data).to.deep.equal(invoices);
        sinon.assert.calledWithMatch(dashboardService.listInvoices, {
            academiaId: payload.academiaId,
            status: 'PENDENTE',
            month: 4,
            year: 2025,
            limit: 20,
            offset: 10
        });
    });

    it('returns revenue forecast per month', async () => {
        const forecast = [{ year: 2025, month: 1, total: 1000.0 }];
        sinon.stub(dashboardService, 'getMonthlyRevenueForecast').resolves(forecast);

        const response = await request(app)
            .get('/owner/dashboard/financas?year=2025')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).to.equal(200);
        expect(response.body.success).to.equal(true);
        expect(response.body.data).to.deep.equal(forecast);
        sinon.assert.calledWithMatch(dashboardService.getMonthlyRevenueForecast, {
            academiaId: payload.academiaId,
            year: 2025
        });
    });
});
