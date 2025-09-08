const { createLogger, format, transports } = require("winston");
const path = require("path");
const fs = require("fs");

const isProduction = process.env.NODE_ENV === "production";

// Ensure logs dir exists in dev
if (!isProduction) {
    const logDir = path.join(__dirname, "..", "logs");
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir);
    }
}

const logFormat = format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    format.errors({ stack: true }),
    format.printf(
        ({ timestamp, level, message, stack }) =>
            `[${timestamp}] ${level.toUpperCase()}: ${stack || message}`
    )
);

const loggerTransports = [
    new transports.Console({
        format: format.combine(
            format.colorize(),
            format.printf(
                ({ timestamp, level, message, stack }) =>
                    `[${timestamp}] ${level}: ${stack || message}`
            )
        ),
    }),
];

// Only add file logging in development
if (!isProduction) {
    loggerTransports.push(
        new transports.File({
            filename: path.join(__dirname, "..", "logs", "error.log"),
            level: "error",
        }),
        new transports.File({
            filename: path.join(__dirname, "..", "logs", "combined.log"),
        })
    );
}

const logger = createLogger({
    level: isProduction ? "info" : "debug",
    format: logFormat,
    transports: loggerTransports,
    exitOnError: false,
});

module.exports = logger;