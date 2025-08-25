const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const logger = require("../config/logger");
const moment = require("moment");
const {
    calculateWorkingDays,
    numberToIndianCurrencyWords,
} = require("./salary");
const config = require("../config/config");

const readFile = promisify(fs.readFile);

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
// const CREDENTIALS_PATH = path.join(__dirname, "../credentials.json");

let sheetsClient;

async function authorizeGoogleSheets() {
    if (sheetsClient) return sheetsClient;

    try {
        const credentialsJSON = Buffer.from(
            config.google.credentials,
            "base64"
        ).toString("utf8");
        const credentials = JSON.parse(credentialsJSON);
        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: SCOPES,
        });
        sheetsClient = google.sheets({ version: "v4", auth });
        return sheetsClient;
    } catch (error) {
        logger.error("Failed to authorize Google Sheets API", error);
        throw error;
    }
}

async function fetchSheetData(sheetId, range) {
    const sheets = await authorizeGoogleSheets();
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range,
    });
    return response.data.values;
}

function mapSheetToObjects(headers, rows) {
    return rows.map((row) => {
        const obj = {};
        headers.forEach((header, index) => {
            obj[header.trim()] = row[index] ? row[index].trim() : "";
        });
        return obj;
    });
}

async function getEmployeeData(sheetId) {
    const data = await fetchSheetData(sheetId, "Employee_Details");
    const [headers, ...rows] = data;
    return mapSheetToObjects(headers, rows);
}

async function getFilteredEmployeeData(sheetId, page = 1, pageSize = 10) {
    const data = await fetchSheetData(sheetId, "Employee_Details");

    if (!data || data.length === 0) {
        return { employees: [], totalRecords: 0, totalPages: 0 };
    }

    const [headers, ...rows] = data;

    // Get indices of only required columns
    const requiredFields = [
        "Employee Name",
        "Employee Code",
        "Department",
        "Net Pay",
    ];
    const indices = requiredFields.map((field) => headers.indexOf(field));

    // Filter out invalid indices
    if (indices.some((i) => i === -1)) {
        throw new Error("One or more required fields are missing in the sheet.");
    }

    // Map only required fields
    const filteredData = rows.map((row) =>
        Object.fromEntries(
            indices.map((i, idx) => [requiredFields[idx], row[i] || ""])
        )
    );

    // Pagination logic
    const totalRecords = filteredData.length;
    const totalPages = Math.ceil(totalRecords / pageSize);
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const employees = filteredData.slice(start, end);

    return {
        employees,
        totalRecords,
        totalPages,
        currentPage: page,
        pageSize,
    };
}

async function getMonthlyAttendance(sheetId, selectedMonth) {
    const data = await fetchSheetData(sheetId, "Monthly_Attendance");
    const [headers, ...rows] = data;
    const mapped = mapSheetToObjects(headers, rows);
    return mapped.filter((entry) => entry.Month === selectedMonth);
}

async function getMergedEmployeeAttendance(sheetId, selectedMonth) {
    const [employees, attendance] = await Promise.all([
        getEmployeeData(sheetId),
        getMonthlyAttendance(sheetId, selectedMonth),
    ]);

    const attendanceMap = Object.fromEntries(
        attendance.map((a) => [a["Emp ID"], a])
    );

    const workingDays = calculateWorkingDays(selectedMonth);
    const formattedMonth = moment(selectedMonth, "M/YYYY").format("MMMM - YYYY");

    return employees.map((emp) => {
        const att = attendanceMap[emp["Emp ID"]] || {};
        const leavesTaken = parseInt(att["Leaves Taken"] || "0", 10);
        const effectiveWorkingDays = workingDays - leavesTaken;
        const salaryInWords = numberToIndianCurrencyWords(emp["Net Pay"]);

        return {
            ...emp,
            Month: formattedMonth,
            Leaves: leavesTaken,
            "Working Days": effectiveWorkingDays,
            "Net Pay (Words)": salaryInWords,
        };
    });
}

async function updatePayslipLinks(sheetId, monthLabel, payslipLinks) {
    const sheets = await authorizeGoogleSheets();

    // Normalize month (so 07/2025 -> 7/2025)
    const normalizedMonth = normalizeMonth(monthLabel);

    // Fetch existing sheet data
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: "Monthly_Attendance",
    });

    const rows = response.data.values;
    const headers = rows[0];
    const monthIndex = headers.indexOf("Month");
    const empIdIndex = headers.indexOf("Employee Code");

    if (monthIndex === -1 || empIdIndex === -1) {
        throw new Error("Sheet must contain 'Month' and 'Employee Code' columns");
    }

    // Ensure "Payslip Link" column exists
    let payslipColIndex = headers.indexOf("Payslip Link");
    if (payslipColIndex === -1) {
        headers.push("Payslip Link");
        payslipColIndex = headers.length - 1;

        await sheets.spreadsheets.values.update({
            spreadsheetId: sheetId,
            range: "Monthly_Attendance!A1",
            valueInputOption: "RAW",
            requestBody: { values: [headers] },
        });

        logger.info("Added new 'Payslip Link' column.");
    }

    // Helper: Convert column index to A1 notation (works beyond Z)
    function columnToLetter(col) {
        let letter = "";
        while (col >= 0) {
            letter = String.fromCharCode((col % 26) + 65) + letter;
            col = Math.floor(col / 26) - 1;
        }
        return letter;
    }

    // Prepare batch update requests
    const updates = [];
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const month = row[monthIndex];
        const empId = row[empIdIndex];

        if (month === normalizedMonth && payslipLinks[empId]) {
            const colLetter = columnToLetter(payslipColIndex);
            const cellRange = `Monthly_Attendance!${colLetter}${i + 1}`;
            updates.push({
                range: cellRange,
                values: [[payslipLinks[empId]]],
            });
            logger.info(
                `Updating row ${i + 1}: ${empId} (${month}) → ${payslipLinks[empId]}`
            );
        }
    }

    if (updates.length > 0) {
        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: sheetId,
            requestBody: {
                valueInputOption: "RAW",
                data: updates,
            },
        });
        logger.info(`✅ Payslip links updated successfully for ${monthLabel}`);
    } else {
        logger.warn(`⚠️ No matching rows found for ${monthLabel}`);
    }
}

// Format month as M/YYYY (remove leading zero)
function normalizeMonth(monthLabel) {
    const [month, year] = monthLabel.split("/");
    return `${parseInt(month, 10)}/${year}`;
}

module.exports = {
    getEmployeeData,
    getMonthlyAttendance,
    getMergedEmployeeAttendance,
    updatePayslipLinks,
    getFilteredEmployeeData,
};
