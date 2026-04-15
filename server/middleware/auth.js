const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'Access Denied: No Token Provided' });

    jwt.verify(token, process.env.JWT_SECRET || 'this_is_a_secret_key', (err, user) => {
        if (err) return res.status(403).json({ message: 'Access Denied: Invalid Token' });
        req.user = user;
        next();
    });
};

module.exports = authenticateToken;
