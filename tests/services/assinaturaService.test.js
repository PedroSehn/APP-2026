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

    it('renews an expired assinatura and creates a new fatura', async () => {
        const queryStub = sinon.stub(db, 'query');
        queryStub.onCall(0).resolves([
            {
                id: 10,
                aluno_id: 4,
                plano_id: 3,
                status: 'EXPIRADA',
                data_inicio: '2025-03-01T00:00:00',
                duracao_meses: 1,
                recorrente: 1,
                academia_id: 1
            }
        ]);
        queryStub.onCall(1).resolves([
            {
                data_vencimento: '2024-01-01'
            }
        ]);
        queryStub.onCall(2).resolves([{ id: 10, status: 'EXPIRADA' }]);
        queryStub.onCall(3).resolves([{ id: 4, role: 'aluno' }]);
        queryStub.onCall(4).resolves([]);
        queryStub.onCall(5).resolves([{ id: 3 }]);
        queryStub.onCall(6).resolves([
            {
                id: 3,
                academia_id: 1,
                nome: 'Plano Bronze',
                valor: '199.90'
            }
        ]);
        queryStub.onCall(7).resolves([
            {
                id: 11,
                aluno_id: 4,
                plano_id: 3,
                data_inicio: '2026-03-01T00:00:00',
                status: 'ATIVA'
            }
        ]);
        queryStub.onCall(8).resolves([
            {
                id: 22,
                assinatura_id: 11,
                valor: '199.90',
                data_vencimento: '2026-04-01',
                status: 'PENDENTE'
            }
        ]);

        const result = await assinaturaService.renewAssinatura({
            assinaturaId: 10,
            academiaId: 1,
            dataInicio: '2026-03-01',
            dataVencimento: '2026-04-01',
            faturaStatus: 'pendente'
        });

        expect(result.assinatura.id).to.equal(11);
        expect(result.fatura.status).to.equal('PENDENTE');
        sinon.assert.calledWithMatch(queryStub.getCall(2), sinon.match.string, {
            status: 'EXPIRADA'
        });
    });

    it('rejects renewal when assinatura is already active', async () => {
        const queryStub = sinon.stub(db, 'query');
        queryStub.onCall(0).resolves([
            {
                id: 11,
                aluno_id: 5,
                plano_id: 3,
                status: 'ATIVA',
                data_inicio: '2025-01-01T00:00:00',
                academia_id: 1
            }
        ]);

        try {
            await assinaturaService.renewAssinatura({ assinaturaId: 11, academiaId: 1 });
            throw new Error('Expected to throw');
        } catch (error) {
            expect(error.code).to.equal('ASSINATURA_ATIVA');
        }
    });

    it('allows aluno to cancel with sufficient notice for recurring planos', async () => {
        const queryStub = sinon.stub(db, 'query');
        queryStub.onCall(0).resolves([
            {
                id: 10,
                aluno_id: 4,
                plano_id: 3,
                status: 'ATIVA',
                data_inicio: '2025-01-01T00:00:00',
                duracao_meses: 1,
                recorrente: 1,
                academia_id: 1
            }
        ]);

        queryStub.onCall(1).resolves([
            {
                id: 1,
                assinatura_id: 10,
                data_vencimento: '2030-01-01',
                status: 'PENDENTE'
            }
        ]);

        queryStub.onCall(2).resolves([
            {
                id: 10,
                aluno_id: 4,
                plano_id: 3,
                data_inicio: '2025-01-01T00:00:00',
                status: 'ATIVA',
                recorrente: 0
            }
        ]);

        const result = await assinaturaService.cancelarAssinaturaPeloAluno({
            assinaturaId: 10,
            academiaId: 1,
            alunoId: 4
        });

        expect(result.status).to.equal('ATIVA');
        expect(result.recorrente).to.equal(false);
    });

    it('rejects cancel when monthly invoice is already expired', async () => {
        const queryStub = sinon.stub(db, 'query');
        queryStub.onCall(0).resolves([
            {
                id: 30,
                aluno_id: 4,
                plano_id: 3,
                status: 'ATIVA',
                data_inicio: '2025-01-01T00:00:00',
                duracao_meses: 1,
                recorrente: 1,
                academia_id: 1
            }
        ]);

        queryStub.onCall(1).resolves([
            {
                id: 2,
                assinatura_id: 30,
                data_vencimento: '2020-01-01',
                status: 'PENDENTE'
            }
        ]);

        try {
            await assinaturaService.cancelarAssinaturaPeloAluno({
                assinaturaId: 30,
                academiaId: 1,
                alunoId: 4
            });
            throw new Error('Expected to throw');
        } catch (error) {
            expect(error.code).to.equal('FATURA_VENCIDA');
        }
    });

    it('rejects cancel when no pending invoice exists', async () => {
        const queryStub = sinon.stub(db, 'query');
        queryStub.onCall(0).resolves([
            {
                id: 20,
                aluno_id: 4,
                plano_id: 3,
                status: 'ATIVA',
                data_inicio: '2025-01-01T00:00:00',
                academia_id: 1
            }
        ]);

        queryStub.onCall(1).resolves([]);

        try {
            await assinaturaService.cancelarAssinaturaPeloAluno({
                assinaturaId: 20,
                academiaId: 1,
                alunoId: 4
            });
            throw new Error('Expected to throw');
        } catch (error) {
            expect(error.code).to.equal('FATURA_PENDENTE_INEXISTENTE');
        }
    });
});
