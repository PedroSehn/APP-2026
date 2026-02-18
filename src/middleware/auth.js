import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET must be defined to validate tokens');
}

const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Token de autorização ausente' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = {
            id: payload.sub,
            email: payload.email,
            role: payload.role,
            academiaId: payload.academiaId
        };
        return next();
    } catch (error) {
        return res.status(401).json({ message: 'Token inválido ou expirado' });
    }
};

const requireRole = (role) => {
    const expectedRoles = Array.isArray(role) ? role : [role];

    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Usuário não autenticado' });
        }

        if (!expectedRoles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Permissão insuficiente' });
        }

        return next();
    };
};

export { authenticate, requireRole };
