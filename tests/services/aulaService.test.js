import sinon from 'sinon';
import { expect } from 'chai';

import db from '../../src/config/db.js';
import aulaService from '../../src/services/aulaService.js';

describe('aulaService', () => {
    afterEach(() => {
        sinon.restore();
    });

    it('lists aulas scoped to academia', async () => {
        const rows = [{ id: 1, academia_id: 3, nome: 'Yoga', descricao: 'Alongamento' }];
        const queryStub = sinon.stub(db, 'query').resolves(rows);

        const aulas = await aulaService.listAulas(3);

        expect(aulas).to.deep.equal([
            { id: 1, academiaId: 3, nome: 'Yoga', descricao: 'Alongamento' }
        ]);
        sinon.assert.calledWithMatch(queryStub, sinon.match.string, { academiaId: 3 });
    });

    it('creates a new aula', async () => {
        const inserted = { id: 2, academia_id: 3, nome: 'Pilates', descricao: 'Força e flexibilidade' };
        const queryStub = sinon.stub(db, 'query').resolves([inserted]);

        const aula = await aulaService.createAula({
            academiaId: 3,
            nome: 'Pilates',
            descricao: 'Força e flexibilidade'
        });

        expect(aula).to.deep.equal({
            id: 2,
            academiaId: 3,
            nome: 'Pilates',
            descricao: 'Força e flexibilidade'
        });
        sinon.assert.calledWithMatch(queryStub, sinon.match.string, {
            academiaId: 3,
            nome: 'Pilates',
            descricao: 'Força e flexibilidade'
        });
    });

    it('updates an existing aula', async () => {
        const updated = { id: 4, academia_id: 5, nome: 'HIIT', descricao: 'Alta intensidade' };
        const queryStub = sinon.stub(db, 'query').resolves([updated]);

        const aula = await aulaService.updateAula(4, 5, { nome: 'HIIT', descricao: 'Alta intensidade' });

        expect(aula).to.deep.equal({
            id: 4,
            academiaId: 5,
            nome: 'HIIT',
            descricao: 'Alta intensidade'
        });
        sinon.assert.calledWithMatch(queryStub, sinon.match.string, {
            id: 4,
            academiaId: 5,
            nome: 'HIIT',
            descricao: 'Alta intensidade'
        });
    });

    it('deletes an aula', async () => {
        const deleted = { id: 6, academia_id: 7, nome: 'Step', descricao: 'Cardio' };
        const queryStub = sinon.stub(db, 'query').resolves([deleted]);

        const aula = await aulaService.deleteAula(6, 7);

        expect(aula).to.deep.equal({
            id: 6,
            academiaId: 7,
            nome: 'Step',
            descricao: 'Cardio'
        });
        sinon.assert.calledWithMatch(queryStub, sinon.match.string, { id: 6, academiaId: 7 });
    });
});
