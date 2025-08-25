const transporter = require("../config/mailer");
const logger = require("./../config/logger");
const path = require("path");
const fs = require("fs");


async function sendPayslipEmail(employee, pdfData) {
    try {
        const pdfBuffer = Buffer.isBuffer(pdfData)
            ? pdfData
            : Buffer.from(pdfData instanceof Uint8Array ? pdfData : fs.readFileSync(path.resolve(pdfData)));

        const mailOptions = {
            from: `"HR Department" <${process.env.SMTP_USER}>`,
            to: employee["Email"],
            subject: `Payslip for ${employee["Month"] || ""}`,
            text: `Dear ${employee["Employee Name"]},\n\nPlease find attached your payslip for ${employee["Month"]}.\n\nRegards,\nHR Department`,
            attachments: [
                {
                    filename: `${employee["Employee Code"]}_Payslip.pdf`,
                    content: pdfBuffer,
                    contentType: "application/pdf",
                },
            ],
        };

        const info = await transporter.sendMail(mailOptions);
        logger.info(
            `📧 Payslip sent to ${employee["Email"]} (Message ID: ${info.messageId})`
        );
        return true;
    } catch (error) {
        logger.error(
            `❌ Failed to send payslip to ${employee["Email"]}: ${error.message}`
        );
        return false;
    }
}

module.exports = { sendPayslipEmail };
