-- ========== TABELA USUARIOS ==========
CREATE TABLE Usuarios (
    id INT IDENTITY(1,1) PRIMARY KEY,
    academia_id INT NULL,
    nome NVARCHAR(100) NOT NULL,
    email NVARCHAR(100) NOT NULL UNIQUE,
    password_hash NVARCHAR(255) NOT NULL,
    role NVARCHAR(20) NOT NULL,
    created_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (academia_id) REFERENCES Academias(id)
);

--  LOGIN rápido (busca por email)
CREATE INDEX IX_Usuarios_Email ON Usuarios(email);

--  Listar alunos de uma academia
CREATE INDEX IX_Usuarios_AcademiaId ON Usuarios(academia_id);

--  Filtrar por tipo (aluno vs dono)
CREATE INDEX IX_Usuarios_Role ON Usuarios(role);
