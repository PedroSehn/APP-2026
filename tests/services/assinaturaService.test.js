import sinon from 'sinon';
import { expect } from 'chai';

import db from '../../src/config/db.js';
import assinaturaService from '../../src/services/assinaturaService.js';

describe('assinaturaService', () => {
    afterEach(() => {
        sinon.restore();
    });

    it('creates assinatura + fatura with normalized statuses and optional due date override', async () => {
        const queryStub = sinon.stub(db, 'query');
        queryStub.onCall(0).resolves([{ id: 4, role: 'aluno' }]);
        queryStub.onCall(1).resolves([]);
        queryStub.onCall(2).resolves([{ id: 3 }]);
        queryStub.onCall(3).resolves([
            {
                id: 3,
                academia_id: 1,
                nome: 'Plano Bronze',
                valor: '199.90'
            }
        ]);
        queryStub.onCall(4).resolves([
            {
                id: 10,
                aluno_id: 4,
                plano_id: 3,
                data_inicio: '2025-03-01T00:00:00',
                status: 'ATIVA'
            }
        ]);
        queryStub.onCall(5).resolves([
            {
                id: 22,
                assinatura_id: 10,
                valor: '199.90',
                data_vencimento: '2025-04-01',
                data_pagamento: null,
                status: 'PENDENTE'
            }
        ]);

        const result = await assinaturaService.createAssinatura({
            alunoId: 4,
            planoId: 3,
            academiaId: 1,
            dataInicio: '2025-03-01',
            status: 'ativa',
            dataVencimento: '2025-04-01',
            faturaStatus: 'pendente'
        });

        expect(result.assinatura.status).to.equal('ATIVA');
        expect(result.fatura.status).to.equal('PENDENTE');
        expect(result.fatura.dataVencimento).to.equal('2025-04-01');
        sinon.assert.calledWithMatch(queryStub.getCall(4), sinon.match.string, {
            status: 'ATIVA'
        });
        sinon.assert.calledWithMatch(queryStub.getCall(5), sinon.match.string, {
            status: 'PENDENTE',
            dataVencimento: '2025-04-01'
        });
    });

    it('prevents creating assinaturas when an active one already exists', async () => {
        const queryStub = sinon.stub(db, 'query');
        queryStub.onCall(0).resolves([{ id: 5, role: 'aluno' }]);
        queryStub.onCall(1).resolves([{ id: 99 }]);

        try {
            await assinaturaService.createAssinatura({
                alunoId: 5,
                planoId: 2,
                academiaId: 1,
                dataInicio: '2025-05-01'
            });
            throw new Error('Expected to throw');
        } catch (error) {
            expect(error.code).to.equal('ASSINATURA_JA_ATIVA');
        }
    });
});
