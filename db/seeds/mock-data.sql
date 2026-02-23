USE academias_gestao;

-- Seed a couple of academias, each with planos, aulas and horarios that can run without Usuario data.

DECLARE @academiaAtivoId INT;
DECLARE @academiaCorpoTotalId INT;
DECLARE @aulaFuncionalId INT;
DECLARE @aulaSpinningId INT;
DECLARE @aulaYogaId INT;
DECLARE @aulaCrossfitId INT;

INSERT INTO Academias (nome, cnpj)
VALUES ('Ativo Center', '12.345.678/0001-91');
SET @academiaAtivoId = SCOPE_IDENTITY();

INSERT INTO Academias (nome, cnpj)
VALUES ('Corpo Total Studio', '98.765.432/0001-10');
SET @academiaCorpoTotalId = SCOPE_IDENTITY();

-- Ativo Center planos
INSERT INTO Planos (academia_id, nome, valor, descricao)
VALUES
    (@academiaAtivoId, 'Plano Bronze', 129.90, 'Acesso ilimitado à musculação e sala funcional'),
    (@academiaAtivoId, 'Plano Prata', 179.90, 'Inclui musculação, funcional e duas aulas guiadas por semana');

-- Corpo Total Studio planos
INSERT INTO Planos (academia_id, nome, valor, descricao)
VALUES
    (@academiaCorpoTotalId, 'Plano Vital', 199.00, 'Sala premium + aulas guiadas diária'),
    (@academiaCorpoTotalId, 'Plano Master', 249.90, 'Acesso total + avaliação física mensal');

-- Ativo Center aulas
INSERT INTO Aulas (academia_id, nome, descricao)
VALUES
    (@academiaAtivoId, 'Funcional Performance', 'Treino funcional com circuitos baseados em movimentos reais'),
    (@academiaAtivoId, 'Spinning Power', 'Aula de ciclismo indoor com foco em potência aeróbica');
SET @aulaFuncionalId = (SELECT id FROM Aulas WHERE nome = 'Funcional Performance' AND academia_id = @academiaAtivoId);
SET @aulaSpinningId = (SELECT id FROM Aulas WHERE nome = 'Spinning Power' AND academia_id = @academiaAtivoId);

-- Corpo Total Studio aulas
INSERT INTO Aulas (academia_id, nome, descricao)
VALUES
    (@academiaCorpoTotalId, 'Yoga Flow', 'Sequência fluida para mobilidade e respiração'),
    (@academiaCorpoTotalId, 'Crossfit Express', 'Treinos curtos, intensos e escaláveis');
SET @aulaYogaId = (SELECT id FROM Aulas WHERE nome = 'Yoga Flow' AND academia_id = @academiaCorpoTotalId);
SET @aulaCrossfitId = (SELECT id FROM Aulas WHERE nome = 'Crossfit Express' AND academia_id = @academiaCorpoTotalId);

-- Horarios for Ativo Center (instrutor_id is nullable and left null for now)
INSERT INTO Horarios (aula_id, instrutor_id, dia_semana, hora_inicio, hora_fim, capacidade_maxima)
VALUES
    (@aulaFuncionalId, NULL, 2, '06:00', '07:00', 20),
    (@aulaFuncionalId, NULL, 4, '18:30', '19:30', 18),
    (@aulaSpinningId, NULL, 3, '07:00', '08:00', 16);

-- Horarios for Corpo Total Studio
INSERT INTO Horarios (aula_id, instrutor_id, dia_semana, hora_inicio, hora_fim, capacidade_maxima)
VALUES
    (@aulaYogaId, NULL, 1, '09:00', '10:00', 14),
    (@aulaCrossfitId, NULL, 5, '19:00', '20:00', 12);

-- Placeholder variables for user-dependent tables.
-- Replace the NULL value with a valid user ID once real users exist in the database.
DECLARE @alunoId INT = NULL;
DECLARE @instrutorId INT = NULL;

-- Example inserts for Assinaturas and Presencas (commented out).
-- Uncomment and provide valid @alunoId and @instrutorId values after users are registered.
/*
INSERT INTO Assinaturas (aluno_id, plano_id, data_inicio, status)
VALUES
    (@alunoId, (SELECT TOP 1 id FROM Planos WHERE academia_id = @academiaAtivoId), GETDATE(), 'ATIVA');

INSERT INTO Presencas (aluno_id, horario_id, data_aula, status)
VALUES
    (@alunoId, (SELECT TOP 1 id FROM Horarios WHERE aula_id = @aulaFuncionalId), CAST(GETDATE() AS DATE), 'CONFIRMADA');

INSERT INTO Horarios (aula_id, instrutor_id, dia_semana, hora_inicio, hora_fim, capacidade_maxima)
VALUES
    (@aulaSpinningId, @instrutorId, 6, '10:00', '11:00', 16);
*/
