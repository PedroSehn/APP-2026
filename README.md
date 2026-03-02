## Projeto de API com SQL Server e JWT

Uma API mínima em **Express** que conecta com um banco **SQL Server**, gerencia usuários com registro/login e protege recursos com **tokens JWT**.

- ### Ideia principal
- Suporta registro e login de usuários vinculados a academias e define quatro papéis principais: `admin`, `dono`, `funcionario` e `aluno`.
- Gera JWTs assinados com `process.env.JWT_SECRET` (e.g. `JWT_EXPIRES_IN`) para autorizar rotas como `/academias`.
- Usa `bcryptjs` para hash de senhas e `jsonwebtoken` para verificar credenciais em cada requisição protegida.
- Mantém a lógica de banco centralizada em `src/config/db.js`, com pool `mssql` e helpers reutilizáveis.

### Tecnologias
- Node.js + Express 5
- SQL Server via `mssql`
- Autenticação: `jsonwebtoken` + middleware customizado
- Validação: `express-validator`
- Segurança: `helmet`, `cors`

### Scripts
- `npm run dev` – inicia o servidor via `nodemon`.
- `npm start` – inicia o servidor com `node`.
- `npm test` – executa os testes Mocha que validam os fluxos de autenticação e as rotas protegidas.

### Variáveis de ambiente
Defina em um `.env`:
- `PORT` (opcional, padrão `3001`)
- `JWT_SECRET`
- `JWT_EXPIRES_IN` (ex.: `1h`)
- `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_INSTANCE`

### Endpoints principais
- `POST /auth/register` – registra usuário (nome, email, password, role opcional, academiaId opcional). Donos precisam informar uma academia e recebem `Academias.owner_id` associado automaticamente.
- `POST /auth/login` – valida credenciais e retorna `{ token, expiresIn, user }`.
- `GET /academias` – protegido; exige token JWT válido e role `admin` para listar academias. As listas incluem `owner_id`, enquanto rotas com controle de dono verificam `role = 'dono'` e `Academias.owner_id` para garantir que apenas o proprietário manipule seus dados.
- `POST /assinaturas` – protegido; só `admin` e `dono` podem abrir novas assinaturas (`alunoId`, `planoId`, `dataInicio` obrigatórios). O serviço garante que o aluno/plano pertencem à mesma academia, que não haja outra assinatura `ATIVA` para o aluno, normaliza os status para letras maiúsculas e cria automaticamente a primeira `Faturas` usando o valor do plano (`status` padrão `ATIVA`, `faturaStatus` padrão `PENDENTE`, `dataVencimento = dataInicio` ou override informado).
- `POST /assinaturas/:id/cancel` – permite que alunos cancelem a recorrência. Planos mensais só podem ser cancelados se a próxima fatura ainda não vence (data_vencimento >= hoje); o cancelamento desativa `recorrente` e impede que o plano renove no fim do ciclo atual.
- `/alunos` – GET/GET por ID pode ser dirigido tanto por `dono` quanto por `funcionario` para revisar alunos atrelados à academia do mesmo `academiaId`. POST/PUT/DELETE continuam restritos ao `dono`.
- `/aulas` – CRUD protegido por JWT e `requireRole(['admin', 'dono'])`. `GET /aulas` e `GET /aulas/:id` consultam apenas aulas da academia do token, enquanto `POST`, `PUT` e `DELETE` aceitam `nome` obrigatório e `descricao` opcional para criar/atualizar registros do mesmo `academiaId`.
- `GET /health` – rota pública para verificar saúde da API.

### Fluxo de autenticação
1. Cliente envia credenciais para `/auth/login` ou `/auth/register`.
2. `userService` trata hashing/validação e `.mapUserRecord()` padroniza o usuário retornado.
3. `authRouter` cria o JWT com `sub`, `email`, `role` e `academiaId`.
4. Rotas protegidas usam `middleware/auth.authenticate` para verificar o cabeçalho `Authorization`.
5. O helper `requireRole('admin')` (ou o papel desejado) garante que apenas usuários com a role correta acessem cada rota.

### Protegendo rotas privadas
- Importe `authenticate` e `requireRole` de `src/middleware/auth.js` e aplique-os antes de montar o roteador privado (ex.: `app.use('/academias', authenticate, requireRole('admin'), academiasRouter)`).
- Ambos os middlewares compartilham o payload do JWT via `req.user`, então rotas mais finas podem conferir `req.user.academiaId` ou outras propriedades adicionais antes de responder.

### Painel do dono (`/owner`)
- Montado em `app.use('/owner', authenticate, requireRole('dono'), ownerDashboardRouter)` e disponível apenas para usuários com `role = 'dono'`.
- `GET /owner/planos` retorna os planos da academia do dono (`req.user.academiaId`) em `{ success, count, data }`.
- Cada plano no retorno inclui `maxAulasPorSemana` e um array `aulas` com `{ id, nome, descricao }`, permitindo entender quais aulas aquele plano permite. As vezes também expõe `descricao` e `valor` para contextualizar a oferta.
- `POST /owner/planos` cria um novo plano (`nome`, `valor`, `descricao?`) e dispara `409` caso já exista um plano com o mesmo nome na academia.
- Cada plano do dono agora inclui `duracaoMeses` (1, 3, 6 ou 12) e a flag `recorrente`; rotas de criação/atualização expõem esses campos para controlar os ciclos e permitir que assinaturas recorrentes parem de renovar mas permaneçam ativas até o fim do período em andamento.
- `GET /owner/dashboard/pending-subscriptions` lista assinaturas pendentes e vencidas por padrão (limit 25, offset 0, max 100) e aceita `limit/offset` como query params para paginação; cada item inclui fatura, assinatura, plano e aluno relacionados.
- `GET /owner/dashboard/faturas` permite filtrar por `status`, `month`, `year`, `limit`, `offset` para revisar cobranças e traz metadados da assinatura/aluno.
- `GET /owner/faturas` oferece filtros idênticos (`status`, `month`, `year`, `limit`, `offset`) para donos/admins listarem faturas de toda a academia; reutiliza `dashboardService.listInvoices`.
- `PATCH /owner/faturas/:id` atualiza `status` (e.g. `PAGO`, `CANCELADA`) e `dataPagamento` para faturas da academia, retornando o registro atualizado.
- `GET /faturas` permite que cada `aluno` autenticado veja suas próprias cobranças (`status`, `month`, `year`, `limit`, `offset` são opcionais) e garante que apenas faturas da academia do aluno sejam retornadas.
- `GET /owner/dashboard/financas` retorna a previsão de receita mensal por ano opcional (`year`), com totais agrupados por mês.
- Todos os endpoints do painel reutilizam `planoService` e `dashboardService` para manter as queries isoladas em `src/services`.

### Testes automatizados
- `tests/routes/auth.test.js` cobre `/auth/login` e `/auth/register`, garantindo tokens válidos e tratamento de credenciais duplicadas/invalidas com `userService` mockado.
- `tests/routes/academias.test.js` valida as respostas de `/academias` quando um JWT válido (role `admin`) é fornecido e garante respostas 401 para tokens ausentes ou inválidos; o acesso ao banco também é mockado.
- `tests/routes/ownerDashboard.test.js` garante o comportamento do painel do dono (listagem/criação de planos, filtros de faturas, assinaturas pendentes e previsão de receita) e valida os códigos HTTP esperados.

### Banco de dados
- Tabelas esperadas: `Usuarios` (com `email`, `password_hash`, `nome`, `role`, `academia_id`), `Academias` (com `owner_id` apontando para o dono da unidade), `Planos` (cada plano ligado a uma `academia_id`), `Assinaturas` (referencia `aluno_id` e `plano_id`) e `Faturas` (com `assinatura_id`, `valor`, `data_vencimento`, `status` e `data_pagamento`).
- As queries usam `db.query(...)` com parâmetros nomeados para evitar SQL injection e garantir que cada dono só leia/altere dados da própria academia.