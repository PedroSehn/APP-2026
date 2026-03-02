import request from 'supertest';
import { expect } from 'chai';
import sinon from 'sinon';
import jwt from 'jsonwebtoken';

import app from '../../src/server/server.js';
import dashboardService from '../../src/services/dashboardService.js';

describe('aluno faturas routes', () => {
    const payload = { sub: 2, email: 'aluno@example.com', role: 'aluno', academiaId: 5 };
    const token = jwt.sign(payload, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });

    afterEach(() => {
        sinon.restore();
    });

    it('returns the logged in aluno invoices', async () => {
        const invoices = [{ faturaId: 7 }];
        sinon.stub(dashboardService, 'listAlunoFaturas').resolves(invoices);

        const response = await request(app)
            .get('/faturas?status=PENDENTE&limit=10')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).to.equal(200);
        expect(response.body.success).to.equal(true);
        expect(response.body.data).to.deep.equal(invoices);
        sinon.assert.calledWithMatch(dashboardService.listAlunoFaturas, {
            academiaId: payload.academiaId,
            alunoId: payload.sub,
            status: 'PENDENTE',
            limit: 10
        });
    });

    it('returns 400 for invalid limit', async () => {
        const response = await request(app)
            .get('/faturas?limit=0')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).to.equal(400);
        expect(response.body).to.have.property('errors');
    });
});
