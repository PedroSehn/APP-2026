import request from 'supertest';
import { expect } from 'chai';
import sinon from 'sinon';
import jwt from 'jsonwebtoken';

import app from '../../src/server/server.js';
import dashboardService from '../../src/services/dashboardService.js';

describe('owner faturas routes', () => {
    const payload = { sub: 1, email: 'owner@example.com', role: 'dono', academiaId: 10 };
    const token = jwt.sign(payload, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });

    afterEach(() => {
        sinon.restore();
    });

    it('returns invoices with filters', async () => {
        const invoices = [{ faturaId: 1 }];
        sinon.stub(dashboardService, 'listInvoices').resolves(invoices);

        const response = await request(app)
            .get('/owner/faturas?status=PENDENTE&month=4&year=2025&limit=15&offset=2')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).to.equal(200);
        expect(response.body.success).to.equal(true);
        expect(response.body.data).to.deep.equal(invoices);
        sinon.assert.calledWithMatch(dashboardService.listInvoices, {
            academiaId: payload.academiaId,
            status: 'PENDENTE',
            month: 4,
            year: 2025,
            limit: 15,
            offset: 2
        });
    });

    it('updates fatura status via PATCH', async () => {
        const updated = {
            faturaId: 2,
            faturaStatus: 'PAGO',
            dataPagamento: '2025-03-05'
        };
        sinon.stub(dashboardService, 'updateFaturaStatus').resolves(updated);

        const response = await request(app)
            .patch('/owner/faturas/2')
            .set('Authorization', `Bearer ${token}`)
            .send({ status: 'pago', dataPagamento: '2025-03-05' });

        expect(response.status).to.equal(200);
        expect(response.body.success).to.equal(true);
        expect(response.body.data).to.deep.equal(updated);
        sinon.assert.calledWithMatch(dashboardService.updateFaturaStatus, {
            faturaId: 2,
            academiaId: payload.academiaId,
            status: 'pago',
            dataPagamento: '2025-03-05'
        });
    });

    it('returns 400 for missing status on PATCH', async () => {
        const response = await request(app)
            .patch('/owner/faturas/2')
            .set('Authorization', `Bearer ${token}`)
            .send({ dataPagamento: '2025-03-05' });

        expect(response.status).to.equal(400);
        expect(response.body).to.have.property('errors');
    });
});
