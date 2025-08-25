const nodemailer = require("nodemailer");
const config = require("../config/config");
const logger = require("./logger");

const transporter = nodemailer.createTransport({
    host: config.smtp_host,
    port: Number(config.smtp_port),
    secure: config.smtp_secure,
    auth: {
        user: config.smtp_user,
        pass: config.smtp_pass,
    },
});

// Connection check
transporter.verify((error, success) => {
    if (error) {
        logger.error("❌ Email server connection failed:", error.message);
    } else {
        logger.info("✅ Email server is ready to send messages");
    }
});

module.exports = transporter;