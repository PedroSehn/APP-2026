import sinon from 'sinon';
import { expect } from 'chai';

import db from '../../src/config/db.js';
import planoService from '../../src/services/planoService.js';

describe('planoService', () => {
    afterEach(() => {
        sinon.restore();
    });

    it('lists planos scoped to academia with aulas', async () => {
        const rows = [
            {
                id: 1,
                academia_id: 4,
                nome: 'Plano A',
                valor: '120.50',
                descricao: 'desc',
                max_aulas_por_semana: 2,
                duracao_meses: 3,
                recorrente: 1,
                aula_id: 11,
                aula_nome: 'Yoga',
                aula_descricao: 'Relaxante'
            },
            {
                id: 1,
                academia_id: 4,
                nome: 'Plano A',
                valor: '120.50',
                descricao: 'desc',
                max_aulas_por_semana: 2,
                duracao_meses: 3,
                recorrente: 1,
                aula_id: 12,
                aula_nome: 'Pilates',
                aula_descricao: 'Fortalecimento'
            },
            {
                id: 2,
                academia_id: 4,
                nome: 'Plano B',
                valor: '199.00',
                descricao: 'premium',
                max_aulas_por_semana: 0,
                duracao_meses: 6,
                recorrente: 0,
                aula_id: null,
                aula_nome: null,
                aula_descricao: null
            }
        ];
        const queryStub = sinon.stub(db, 'query').resolves(rows);

        const planos = await planoService.listPlanos(4);

        expect(planos).to.deep.equal([
            {
                id: 1,
                academiaId: 4,
                nome: 'Plano A',
                valor: 120.5,
                descricao: 'desc',
                maxAulasPorSemana: 2,
                duracaoMeses: 3,
                recorrente: true,
                aulas: [
                    { id: 11, nome: 'Yoga', descricao: 'Relaxante' },
                    { id: 12, nome: 'Pilates', descricao: 'Fortalecimento' }
                ]
            },
            {
                id: 2,
                academiaId: 4,
                nome: 'Plano B',
                valor: 199,
                descricao: 'premium',
                maxAulasPorSemana: 0,
                duracaoMeses: 6,
                recorrente: false,
                aulas: []
            }
        ]);
        sinon.assert.calledWithMatch(queryStub, sinon.match.string, { academiaId: 4 });
    });

    it('creates a new plano', async () => {
        const inserted = {
            id: 2,
            academia_id: 5,
            nome: 'Plano B',
            valor: '199.00',
            descricao: 'premium',
            max_aulas_por_semana: 0,
            duracao_meses: 1,
            recorrente: 1
        };
        const queryStub = sinon.stub(db, 'query').resolves([inserted]);

        const plano = await planoService.createPlano({ academiaId: 5, nome: 'Plano B', valor: 199, descricao: 'premium' });

        expect(plano).to.deep.equal({
            id: 2,
            academiaId: 5,
            nome: 'Plano B',
            valor: 199,
            descricao: 'premium',
            maxAulasPorSemana: 0,
            duracaoMeses: 1,
            recorrente: true
        });
        sinon.assert.calledWithMatch(queryStub, sinon.match.string, {
            academiaId: 5,
            nome: 'Plano B',
            valor: 199,
            descricao: 'premium',
            duracaoMeses: 1,
            recorrente: 1
        });
    });

    it('updates an existing plano', async () => {
        const updated = {
            id: 3,
            academia_id: 6,
            nome: 'Super Plano',
            valor: '220.00',
            descricao: 'nova',
            max_aulas_por_semana: 5,
            duracao_meses: 12,
            recorrente: 1
        };
        const queryStub = sinon.stub(db, 'query').resolves([updated]);

        const plano = await planoService.updatePlano(3, 6, { nome: 'Super Plano', valor: 220, descricao: 'nova' });

        expect(plano).to.deep.equal({
            id: 3,
            academiaId: 6,
            nome: 'Super Plano',
            valor: 220,
            descricao: 'nova',
            maxAulasPorSemana: 5,
            duracaoMeses: 12,
            recorrente: true
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
        const deleted = {
            id: 4,
            academia_id: 7,
            nome: 'Removido',
            valor: '100.00',
            descricao: 'old',
            max_aulas_por_semana: 1,
            duracao_meses: 3,
            recorrente: 0
        };
        const queryStub = sinon.stub(db, 'query').resolves([deleted]);

        const plano = await planoService.deletePlano(4, 7);

        expect(plano).to.deep.equal({
            id: 4,
            academiaId: 7,
            nome: 'Removido',
            valor: 100,
            descricao: 'old',
            maxAulasPorSemana: 1,
            duracaoMeses: 3,
            recorrente: false
        });
        sinon.assert.calledWithMatch(queryStub, sinon.match.string, { id: 4, academiaId: 7 });
    });
});
