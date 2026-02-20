process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

import request from 'supertest';
import { expect } from 'chai';
import sinon from 'sinon';
import jwt from 'jsonwebtoken';

import app from '../../src/server/server.js';
import db from '../../src/config/db.js';

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
            { id: 1, nome: 'Academia Um', cnpj: '123', created_at: '2025-01-01T00:00:00Z' }
        ];
        sinon.stub(db, 'query').resolves(academias);

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
});
