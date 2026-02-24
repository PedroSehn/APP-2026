## Auth Flow Overview

This project now exposes a JWT-based authentication flow built on top of the existing Express + SQL Server stack.

-### Entry points
- `POST /auth/register`  
  - Validates `name`, `email`, `password`, optional `role` (`admin`, `dono`, `funcionario`, `aluno`) and `academiaId`.
  - Donos must provide `academiaId`; the request creates a `Usuarios` row and calls `academiaService.assignOwnerToAcademia` so `Academias.owner_id` mirrors the new user. Funcionários também precisam de `academiaId` mas mantêm o `owner_id`.
  - Hashes the password with `bcryptjs`, inserts the user into `Usuarios`, and signs a JWT that embeds `id`, `email`, `role` and `academiaId`.
- `POST /auth/login`  
  - Validates `email` and `password`.
  - Looks up the user by email, compares the body password with the stored `password_hash`, and returns a JWT on success.
  - Responds with 401 when credentials fail or 400 on schema errors.

Each response shares the same payload structure (`token`, `expiresIn`, and the user object) so the client can reuse it for both onboarding and subsequent logins.

-### Supporting services
- `src/services/userService.js`  
  - Queries `Usuarios` via `db.query`.
  - Provides `authenticateUser` and `createUser` helpers that handle bcrypt hashing/comparison, email uniqueness checks, and enforce valid roles (`admin`, `dono`, `funcionario`, `aluno`).
  - Maps database columns (`nome`, `academia_id`, etc.) into a clean DTO before returning data to callers.
- `src/services/academiaService.js`
  - `assignOwnerToAcademia` ensures each `Academias` row keeps a single owner and returns an error if a different owner already exists.

-### Middleware guard
- `src/middleware/auth.js` exports:
  - `authenticate`: checks `Authorization: Bearer <token>` headers and verifies the token with `jsonwebtoken`.
  - `requireRole`: factory that enforces a specific role (or roles) once `req.user` exists.
  - `req.user` is populated with `id`, `email`, `role`, and `academiaId` for downstream handlers.
  - `requireRole('dono')` together with `req.user.academiaId` is used when owner-only actions need to assert `Academias.owner_id = req.user.id`, while read-only handlers can accept `['dono','funcionario']`.

### Route wiring
- `src/server/server.js` mounts:
  - `/auth` (public) – all registration/login logic.
  - `/academias` – protected route that requires a valid JWT via `authenticate`.
  - `/health` and `/` remain public for diagnostics.

### Data flow
1. Client submits credentials to `/auth/login` or `/auth/register`.
2. `authRouter` validates the payload and calls `userService`.
3. `userService` interacts with the SQL Server pool and returns a user DTO.
4. `authRouter` signs a JWT with `process.env.JWT_SECRET` and returns it to the client.
5. Protected routes (like `/academias`) run `authenticate`, which verifies the JWT and populates `req.user` before delegating to the route handler.

Use the log messages in `server.js` to trace startup, and rely on the `JWT_SECRET` environment variable defined in `.env` to keep tokens secure.
