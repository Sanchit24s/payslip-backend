const jwt = require("jsonwebtoken");
const config = require("../config/config");

const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, config.jwt_secret);

        const user = config.user;
        if (user.email !== decoded.email) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        req.user = user;
        next();
    } catch (error) {
        if (
            error.name === "JsonWebTokenError" ||
            error.name === "TokenExpiredError"
        ) {
            error.statusCode = 401;
            error.message = "Invalid or expired token";
        }

        next(error);
    }
};

module.exports = { authenticate };
