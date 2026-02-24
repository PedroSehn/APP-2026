# 📋 PROMPT COMPLETO - Micro SaaS Academias

## 🎯 OBJETIVO
Servir de contexto para a equipe: a base é uma API em Node.js que dá suporte à gestão de academias, com usuários ligados a academias, níveis de acesso (aluno/dono) e tabelas projetadas para planos, aulas, horários, assinaturas, faturas e presença.

## 🧱 ARQUITETURA ATUAL
- **Backend:** Node.js + Express 5 (`src/server/server.js`) com `helmet`, `cors`, parsing JSON e roteamento modular.
- **Banco:** SQL Server local; as credenciais vêm do `.env` (`DB_*`) e o `src/config/db.js` expõe um pool `mssql`. O padrão usa base `padrao` e porta `1434`.
- **Segurança:** JWT (`jsonwebtoken`) e `bcryptjs` (`src/services/userService.js`) para registrar/login. `middleware/auth.js` valida o token e injeta `req.user`.
- **Scripts:** `npm run dev` (nodemon) e `npm start`.
- **Rotas ativas:** `/auth` (registro/login), `/academias` (protegida) e `/health`.

## 🚀 FUNCIONALIDADES IMPLEMENTADAS
- `POST /auth/register` – valida `name`, `email`, `password`, opcional `role` e `academiaId`, cria o usuário (`Usuarios`) com `bcrypt.hash`, devolvendo JWT com `sub`, `email`, `role`, `academiaId`.
- `POST /auth/login` – autentica com `bcrypt.compare`, emite JWT e responde `{ token, expiresIn, user }`.
- `GET /academias` – protegido por `authenticate`, lista `id`, `nome`, `cnpj`, `created_at`.
- `POST /alunos`, `GET /alunos`, `PUT /alunos/:id`, `DELETE /alunos/:id` – CRUD protegido por `authenticate` + `requireRole('dono')`, filtra por `academia_id` e força `role = 'aluno'`.
- `GET /health` – health check que tenta executar `SELECT TOP 1 * FROM Academias` e retorna status, carimbo e amostra.
- `GET /` – rota raiz com versão e resumo de endpoints.

## 🗂️ ESTRUTURA DO BANCO (fonte definitiva: `Docs/Extrutura-banco-dados`)
- `Academias` (`id`, `nome`, `cnpj`, `created_at`).
- `Usuarios` (`academia_id`, `nome`, `email`, `password_hash`, `role`, `created_at`) com `academia_id` opcional e `role` indicando `aluno` ou `dono`.
- `Planos`, `Aulas`, `Horarios`, `Assinaturas`, `Faturas` e `Presencas` com as chaves estrangeiras necessárias para relacionar usuários, academias, planos, aulas e presenças.

## 🧰 CONVENÇÕES E PADRÕES
- `db.query(sql, params)` usa `request.input()` para evitar SQL injection; mantenha essa abordagem ao adicionar queries.
- `userService.findByEmail`, `authenticateUser` e `createUser` centralizam lógica de senha e mapeamento (`mapUserRecord`).
- Os tokens carregam `role` e `academiaId`; a função `requireRole` em `middleware/auth.js` está pronta para ser usada quando rotas exigirem papéis específicos.
- Erros são tratados no middleware global (`src/server/server.js`) e os logs incluem dicas sobre credenciais/porta.
- O projeto está focado na API backend — o frontend React ainda não existe e os testes estão em `tests/`.

