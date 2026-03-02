IF OBJECT_ID('sqlPasswordResetTokens', 'U') IS NULL
BEGIN
    CREATE TABLE sqlPasswordResetTokens (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NOT NULL,
        token_hash VARCHAR(64) NOT NULL,
        expires_at DATETIME2 NOT NULL,
        used_at DATETIME2 NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_sqlPasswordResetTokens_Usuarios FOREIGN KEY (user_id) REFERENCES Usuarios(id) ON DELETE CASCADE,
        CONSTRAINT UQ_sqlPasswordResetTokens_TokenHash UNIQUE (token_hash)
    );

    CREATE INDEX IX_sqlPasswordResetTokens_UserId ON sqlPasswordResetTokens(user_id);
END;
