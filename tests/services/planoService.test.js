import sinon from 'sinon';
import { expect } from 'chai';

import db from '../../src/config/db.js';
import planoService from '../../src/services/planoService.js';

describe('planoService', () => {
    afterEach(() => {
        sinon.restore();
    });

    it('lists planos scoped to academia', async () => {
        const rows = [{ id: 1, academia_id: 4, nome: 'Plano A', valor: '120.50', descricao: 'desc' }];
        const queryStub = sinon.stub(db, 'query').resolves(rows);

        const planos = await planoService.listPlanos(4);

        expect(planos).to.deep.equal([
            { id: 1, academiaId: 4, nome: 'Plano A', valor: 120.5, descricao: 'desc' }
        ]);
        sinon.assert.calledWithMatch(queryStub, sinon.match.string, { academiaId: 4 });
    });

    it('creates a new plano', async () => {
        const inserted = { id: 2, academia_id: 5, nome: 'Plano B', valor: '199.00', descricao: 'premium' };
        const queryStub = sinon.stub(db, 'query').resolves([inserted]);

        const plano = await planoService.createPlano({ academiaId: 5, nome: 'Plano B', valor: 199, descricao: 'premium' });

        expect(plano).to.deep.equal({
            id: 2,
            academiaId: 5,
            nome: 'Plano B',
            valor: 199,
            descricao: 'premium'
        });
        sinon.assert.calledWithMatch(queryStub, sinon.match.string, {
            academiaId: 5,
            nome: 'Plano B',
            valor: 199,
            descricao: 'premium'
        });
    });

    it('updates an existing plano', async () => {
        const updated = { id: 3, academia_id: 6, nome: 'Super Plano', valor: '220.00', descricao: 'nova' };
        const queryStub = sinon.stub(db, 'query').resolves([updated]);

        const plano = await planoService.updatePlano(3, 6, { nome: 'Super Plano', valor: 220, descricao: 'nova' });

        expect(plano).to.deep.equal({
            id: 3,
            academiaId: 6,
            nome: 'Super Plano',
            valor: 220,
            descricao: 'nova'
        });
        sinon.assert.calledWithMatch(queryStub, sinon.match.string, {
            id: 3,
            academiaId: 6,
            nome: 'Super Plano',
            valor: 220,
            descricao: 'nova'
        });
    });

    it('deletes a plano', async () => {
        const deleted = { id: 4, academia_id: 7, nome: 'Removido', valor: '100.00', descricao: 'old' };
        const queryStub = sinon.stub(db, 'query').resolves([deleted]);

        const plano = await planoService.deletePlano(4, 7);

        expect(plano).to.deep.equal({
            id: 4,
            academiaId: 7,
            nome: 'Removido',
            valor: 100,
            descricao: 'old'
        });
        sinon.assert.calledWithMatch(queryStub, sinon.match.string, { id: 4, academiaId: 7 });
    });
});
