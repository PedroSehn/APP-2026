
CREATE TABLE RefreshTokens (
    id INT IDENTITY PRIMARY KEY,
    user_id INT NOT NULL,
    token_hash VARCHAR(128) NOT NULL,
    expires_at DATETIME2 NOT NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_RefreshTokens_Usuarios FOREIGN KEY (user_id) REFERENCES Usuarios(id) ON DELETE CASCADE,
    CONSTRAINT UQ_RefreshTokens_TokenHash UNIQUE (token_hash)
);

CREATE INDEX IX_RefreshTokens_UserId ON RefreshTokens(user_id);
