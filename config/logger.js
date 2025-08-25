const { createLogger, format, transports } = require("winston");
const path = require("path");

const isProduction = process.env.NODE_ENV === "production";

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

if (isProduction) {
    loggerTransports.push(
        new transports.File({
            filename: path.join("logs", "error.log"),
            level: "error",
        }),
        new transports.File({
            filename: path.join("logs", "combined.log"),
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