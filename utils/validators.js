const moment = require("moment");

function validateMonth(month) {
    if (!month || !moment(month, "YYYY-MM", true).isValid()) {
        return {
            valid: false,
            message: "Month must be in YYYY-MM format (e.g., 2025-07)",
        };
    }
    return { valid: true };
}

function validateEmpId(empId) {
    if (!empId) {
        return { valid: false, message: "empId is required" };
    }
    return { valid: true };
}

function formatMonth(month) {
    const [year, monthNum] = month.split("-");
    return `${+monthNum}/${year}`;
}

module.exports = { validateMonth, validateEmpId, formatMonth };
