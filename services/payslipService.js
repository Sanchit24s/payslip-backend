const axios = require("axios");
const config = require("../config/config");
const logger = require("../config/logger");
const {
    getEmployeeWithAttendance,
    updatePayslipData,
} = require("../utils/sheet");
const { sendPayslipEmail } = require("../utils/sendEmail");

const extractEmpId = (link) => {
    const match = link.match(/(FINZ\d+)_Payslip/);
    return match ? match[1] : null;
};

const processPayslip = async (link, formattedMonth) => {
    const empId = extractEmpId(link);
    if (!empId) {
        logger.warn(`Invalid payslip link format: ${link}`);
        return { empId: null, success: false, error: "Invalid link format" };
    }

    try {
        // Download PDF + fetch employee data in parallel
        const [pdfResponse, empData] = await Promise.all([
            axios.get(link, { responseType: "arraybuffer" }),
            getEmployeeWithAttendance(config.google.sheet_id, empId, formattedMonth),
        ]);

        const pdfBuffer = Buffer.from(pdfResponse.data, "binary");

        // Send email + update sheet in parallel
        await Promise.all([
            sendPayslipEmail(empData, pdfBuffer),
            updatePayslipData(config.google.sheet_id, formattedMonth, {
                [empId]: { emailSent: true },
            }),
        ]);

        logger.info(`✅ Payslip email sent to ${empId}`);
        return { empId, success: true };
    } catch (err) {
        logger.error(`❌ Failed to send payslip to ${empId}: ${err.message}`);
        return { empId, success: false, error: err.message };
    }
};

const processAllPayslips = async (links, formattedMonth) => {
    const tasks = links.map((link) => processPayslip(link, formattedMonth));
    const results = await Promise.allSettled(tasks);

    return results.map((r) =>
        r.status === "fulfilled"
            ? r.value
            : { success: false, error: r.reason?.message || "Unknown error" }
    );
};

module.exports = { processAllPayslips };
