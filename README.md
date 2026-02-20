## Projeto de API com SQL Server e JWT

Uma API mínima em **Express** que conecta com um banco **SQL Server**, gerencia usuários com registro/login e protege recursos com **tokens JWT**.

### Ideia principal
- Suporta registro e login de usuários vinculados a academias.
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
- `POST /auth/register` – registra usuário (nome, email, password, role opcional, academiaId opcional).
- `POST /auth/login` – valida credenciais e retorna `{ token, expiresIn, user }`.
- `GET /academias` – protegido; exige token JWT válido e role `admin` para listar academias (`id`, `nome`, `cnpj`, `created_at`).
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

### Testes automatizados
- `tests/routes/auth.test.js` cobre `/auth/login` e `/auth/register`, garantindo tokens válidos e tratamento de credenciais duplicadas/invalidas com `userService` mockado.
- `tests/routes/academias.test.js` valida as respostas de `/academias` quando um JWT válido (role `admin`) é fornecido e garante respostas 401 para tokens ausentes ou inválidos; o acesso ao banco também é mockado.

### Banco de dados
- Tabelas esperadas: `Usuarios` (com `email`, `password_hash`, `nome`, `role`, `academia_id`) e `Academias`.
- As queries usam `db.query(...)` com parâmetros nomeados para evitar SQL injection.