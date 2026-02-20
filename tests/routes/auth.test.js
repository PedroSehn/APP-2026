process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

import request from 'supertest';
import { expect } from 'chai';
import sinon from 'sinon';
import jwt from 'jsonwebtoken';

import app from '../../src/server/server.js';
import userService from '../../src/services/userService.js';
import refreshTokenService from '../../src/services/refreshTokenService.js';

describe('Auth routes', () => {
    afterEach(() => {
        sinon.restore();
    });

    const fakeUser = {
        id: 211,
        name: 'Admin User',
        email: 'admin@example.com',
        role: 'admin',
        academiaId: 1
    };

    it('allows a user to log in with valid credentials', async () => {
        sinon.stub(userService, 'authenticateUser').resolves(fakeUser);
        sinon
            .stub(refreshTokenService, 'createRefreshToken')
            .resolves({ token: 'refresh-token', expiresAt: new Date().toISOString(), expiresInDays: 14 });

        const response = await request(app)
            .post('/auth/login')
            .send({ email: fakeUser.email, password: 'secret-password' });

        expect(response.status).to.equal(200);
        expect(response.body).to.have.property('token').that.is.a('string');
        expect(response.body).to.have.property('expiresIn');
        expect(response.body).to.have.property('refreshToken', 'refresh-token');
        expect(response.body).to.have.property('refreshTokenExpiresInDays', 14);
        expect(response.body.user).to.deep.equal(fakeUser);

        const payload = jwt.verify(response.body.token, process.env.JWT_SECRET);
        expect(payload.sub).to.equal(fakeUser.id);
        expect(payload.email).to.equal(fakeUser.email);
        expect(payload.role).to.equal(fakeUser.role);
        expect(payload.academiaId).to.equal(fakeUser.academiaId);
    });

    it('rejects login when credentials are invalid', async () => {
        sinon.stub(userService, 'authenticateUser').resolves(null);

        const response = await request(app)
            .post('/auth/login')
            .send({ email: 'random@example.com', password: 'wrong' });

        expect(response.status).to.equal(401);
        expect(response.body).to.have.property('message', 'Credenciais inválidas');
    });

    it('creates a user and returns a JWT on register', async () => {
        sinon.stub(userService, 'createUser').resolves(fakeUser);
        sinon
            .stub(refreshTokenService, 'createRefreshToken')
            .resolves({ token: 'refresh-token', expiresAt: new Date().toISOString(), expiresInDays: 14 });

        const response = await request(app)
            .post('/auth/register')
            .send({
                name: fakeUser.name,
                email: fakeUser.email,
                password: 'new-password',
                role: fakeUser.role,
                academiaId: fakeUser.academiaId
            });

        expect(response.status).to.equal(201);
        expect(response.body).to.have.property('token');
        expect(response.body.user).to.deep.equal(fakeUser);

        const payload = jwt.verify(response.body.token, process.env.JWT_SECRET);
        expect(payload.sub).to.equal(fakeUser.id);
    });

    it('returns 409 when trying to register an existing email', async () => {
        const error = new Error('Já existe um usuário cadastrado com este e-mail');
        error.code = 'USER_ALREADY_EXISTS';
        sinon.stub(userService, 'createUser').rejects(error);

        const response = await request(app)
            .post('/auth/register')
            .send({
                name: fakeUser.name,
                email: fakeUser.email,
                password: 'some-password'
            });

        expect(response.status).to.equal(409);
        expect(response.body).to.have.property('message', error.message);
    });

    it('refreshes the access token with a valid refresh token', async () => {
        const refreshToken = 'old-refresh';
        sinon.stub(refreshTokenService, 'findValidRefreshToken').resolves({
            id: 1,
            user_id: fakeUser.id,
            token_hash: 'hash',
            expires_at: new Date(Date.now() + 10000).toISOString()
        });
        sinon.stub(userService, 'findById').resolves(fakeUser);
        const rotateStub = sinon
            .stub(refreshTokenService, 'rotateRefreshToken')
            .resolves({ token: 'new-refresh', expiresAt: new Date().toISOString(), expiresInDays: 14 });

        const response = await request(app).post('/auth/refresh').send({ refreshToken });

        expect(response.status).to.equal(200);
        expect(response.body).to.have.property('refreshToken', 'new-refresh');
        expect(response.body.user).to.deep.equal(fakeUser);
        expect(rotateStub.calledWith({ token: refreshToken, userId: fakeUser.id })).to.be.true;
    });

    it('rejects refresh when refresh token is invalid', async () => {
        sinon.stub(refreshTokenService, 'findValidRefreshToken').resolves(null);

        const response = await request(app).post('/auth/refresh').send({ refreshToken: 'invalid' });

        expect(response.status).to.equal(401);
        expect(response.body).to.have.property('message', 'Refresh token inválido ou expirado');
    });

    it('logs out by deleting the refresh token', async () => {
        const deleteStub = sinon.stub(refreshTokenService, 'deleteRefreshToken').resolves();

        const response = await request(app).post('/auth/logout').send({ refreshToken: 'any' });

        expect(response.status).to.equal(204);
        expect(deleteStub.calledOnceWith('any')).to.be.true;
    });
});
