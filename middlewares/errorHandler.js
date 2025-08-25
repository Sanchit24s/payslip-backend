const config = require("../config/config");
const logger = require("../config/logger");

const errorHandler = (err, req, res, next) => {
    const isProduction = config.node_env === "production";

    let statusCode = err.statusCode || 500;
    let message = err.message || "Internal Server Error";

    if (err.name === "ValidationError") {
        statusCode = 400;
        message = err.message || "Validation failed";
    }

    if (err.code && err.code === 11000) {
        statusCode = 409;
        const field = Object.keys(err.keyValue).join(", ");
        message = `Duplicate value for field(s): ${field}`;
    }

    logger.error(`[${req.method}] ${req.originalUrl} -> ${message}`);
    logger.error(err.stack);

    res.status(statusCode).json({
        success: false,
        error: message,
        ...(err.details ? { details: err.details } : {}),
        ...(isProduction ? {} : { stack: err.stack }),
    });
};

module.exports = errorHandler;