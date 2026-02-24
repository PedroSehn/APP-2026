import sinon from 'sinon';
import { expect } from 'chai';

import db from '../../src/config/db.js';
import dashboardService from '../../src/services/dashboardService.js';

describe('dashboardService', () => {
    afterEach(() => {
        sinon.restore();
    });

    it('maps pending subscriptions and applies default filters', async () => {
        const rows = [
            {
                faturaId: 1,
                valor: '149.90',
                dataVencimento: '2025-03-01',
                dataPagamento: null,
                faturaStatus: 'PENDENTE',
                assinaturaId: 10,
                assinaturaStatus: 'ATIVA',
                planoId: 3,
                planoNome: 'Plano Bronze',
                planoDescricao: 'Descrição',
                alunoId: 4,
                alunoNome: 'Aluno Teste',
                alunoEmail: 'aluno@example.com'
            }
        ];
        const queryStub = sinon.stub(db, 'query').resolves(rows);

        const result = await dashboardService.listPendingSubscriptions({ academiaId: 2 });

        expect(result).to.deep.equal([
            {
                faturaId: 1,
                faturaStatus: 'PENDENTE',
                valor: 149.9,
                dataVencimento: '2025-03-01',
                dataPagamento: null,
                assinaturaId: 10,
                assinaturaStatus: 'ATIVA',
                planoId: 3,
                planoNome: 'Plano Bronze',
                planoDescricao: 'Descrição',
                alunoId: 4,
                alunoNome: 'Aluno Teste',
                alunoEmail: 'aluno@example.com'
            }
        ]);
        sinon.assert.calledWithMatch(
            queryStub,
            sinon.match.string,
            sinon.match({
                academiaId: 2,
                limit: 25,
                offset: 0,
                pendingStatus0: 'PENDENTE',
                pendingStatus1: 'VENCIDA'
            })
        );
    });

    it('passes query filters to listInvoices', async () => {
        const rows = [
            {
                faturaId: 1,
                valor: '200.00',
                dataVencimento: '2025-04-01',
                dataPagamento: null,
                faturaStatus: 'PENDENTE',
                assinaturaId: 1,
                assinaturaStatus: 'ATIVA',
                planoId: 1,
                planoNome: 'Plano',
                planoDescricao: 'desc',
                alunoId: 1,
                alunoNome: 'Aluno A',
                alunoEmail: 'a@example.com'
            }
        ];
        const queryStub = sinon.stub(db, 'query').resolves(rows);

        const invoices = await dashboardService.listInvoices({
            academiaId: 3,
            status: 'PENDENTE',
            month: 5,
            year: 2025,
            limit: 10,
            offset: 2
        });

        expect(invoices).to.deep.equal([
            {
                faturaId: 1,
                faturaStatus: 'PENDENTE',
                valor: 200,
                dataVencimento: '2025-04-01',
                dataPagamento: null,
                assinaturaId: 1,
                assinaturaStatus: 'ATIVA',
                planoId: 1,
                planoNome: 'Plano',
                planoDescricao: 'desc',
                alunoId: 1,
                alunoNome: 'Aluno A',
                alunoEmail: 'a@example.com'
            }
        ]);
        sinon.assert.calledWithMatch(
            queryStub,
            sinon.match.string,
            sinon.match({
                academiaId: 3,
                statusFilter: 'PENDENTE',
                monthFilter: 5,
                yearFilter: 2025,
                limit: 10,
                offset: 2
            })
        );
    });

    it('returns normalized revenue forecast rows', async () => {
        const rows = [{ year: 2025, month: 2, total: '3500.00' }];
        const queryStub = sinon.stub(db, 'query').resolves(rows);

        const forecast = await dashboardService.getMonthlyRevenueForecast({ academiaId: 8, year: 2025 });

        expect(forecast).to.deep.equal([{ year: 2025, month: 2, total: 3500 }]);
        sinon.assert.calledWithMatch(
            queryStub,
            sinon.match.string,
            sinon.match({
                academiaId: 8,
                yearFilter: 2025
            })
        );
    });
});
