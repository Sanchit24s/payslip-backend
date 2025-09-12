const { google } = require("googleapis");
const logger = require("../config/logger");
const moment = require("moment");
const {
    calculateWorkingDays,
    numberToIndianCurrencyWords,
} = require("./salary");
const config = require("../config/config");
const {
    mapSheetToObjects,
    emptyResponse,
    mapFieldIndices,
    buildEmployee,
    buildSummary,
    applyFilters,
    paginate,
    normalizeMonth,
    findColumnIndices,
    mapRowsToObjects,
    ensureColumn,
    columnToLetter,
} = require("./googleSheetUtils");

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

async function fetchSheetWithHeaders(sheetId, range = "A:Z") {
    const sheets = await authorizeGoogleSheets();
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range,
    });

    const [headers, ...rows] = response.data.values || [];
    if (!headers) throw new Error(`No headers found in ${range}`);

    return { headers, rows };
}

async function fetchSheetData(sheetId, range) {
    const sheets = await authorizeGoogleSheets();
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range,
    });
    return response.data.values;
}

async function getEmployeeData(sheetId) {
    const data = await fetchSheetData(sheetId, "Employee_Details");
    const [headers, ...rows] = data;
    return mapSheetToObjects(headers, rows);
}

async function getFilteredEmployeeData(
    sheetId,
    page = 1,
    pageSize = 10,
    searchTerm = "",
    selectedDepartment = "All",
    selectedStatus = "All"
) {
    const data = await fetchSheetData(sheetId, "Employee_Details");
    if (!data || data.length === 0) {
        return emptyResponse();
    }

    const [headers, ...rows] = data;

    // Required columns
    const requiredFields = [
        "Employee Name",
        "Employee Code",
        "Department",
        "Status",
        "Net Pay",
    ];
    const indices = mapFieldIndices(headers, requiredFields);
    if (!indices) {
        logger.warn("One or more required fields are missing in the sheet.");
        throw new Error("One or more required fields are missing in the sheet.");
    }

    // Convert rows -> employee objects
    let employees = rows.map((row) =>
        buildEmployee(row, indices, requiredFields)
    );

    // Summary BEFORE filters
    const summary = buildSummary(employees);

    // Apply filters
    const filteredEmployees = applyFilters(
        employees,
        searchTerm,
        selectedDepartment,
        selectedStatus
    );

    // Paginate
    const paginatedEmployees = paginate(filteredEmployees, page, pageSize);

    return {
        employees: paginatedEmployees.data,
        totalRecords: filteredEmployees.length,
        totalPages: paginatedEmployees.totalPages,
        currentPage: paginatedEmployees.currentPage,
        pageSize: paginatedEmployees.pageSize,
        summary: {
            ...summary,
            filteredEmployees: filteredEmployees.length,
        },
    };
}

async function getMonthlyAttendance(sheetId, selectedMonth) {
    const data = await fetchSheetData(sheetId, "Monthly_Attendance");
    const [headers, ...rows] = data;
    const mapped = mapSheetToObjects(headers, rows);
    return mapped.filter((entry) => entry.Month === selectedMonth);
}

async function getEmployeesWithMonthlyStatus(
    sheetId,
    selectedMonth,
    page = 1,
    pageSize = 10,
    searchTerm = "",
    selectedDepartment = "All"
) {
    const [employees, attendance] = await Promise.all([
        getEmployeeData(sheetId), // fetch all employees
        getMonthlyAttendance(sheetId, selectedMonth), // fetch attendance for month
    ]);

    // Map attendance by Employee ID for quick lookup
    const attendanceMap = Object.fromEntries(
        attendance.map((a) => [a["Employee Code"], a])
    );

    const formattedMonth = moment(selectedMonth, "M/YYYY").format("MMMM YYYY");
    const lowerSearch = searchTerm.toLowerCase();

    // Filter and map in one step
    const merged = employees
        .map((emp) => {
            const att = attendanceMap[emp["Employee Code"]] || {};
            return {
                id: emp["Employee Code"],
                name: emp["Employee Name"],
                department: emp["Department"],
                salary: emp["Net Pay"],
                month: formattedMonth,
                isSlipGenerated: Boolean(att["Payslip Link"]),
                paySlipLink: att["Payslip Link"],
                isEmailSent: att["Email Sent"] === "Yes",
            };
        })
        .filter((emp) => {
            const matchesSearch =
                !searchTerm ||
                emp.name.toLowerCase().includes(lowerSearch) ||
                emp.id.toLowerCase().includes(lowerSearch);
            const matchesDept =
                selectedDepartment === "All" || emp.department === selectedDepartment;
            return matchesSearch && matchesDept;
        });

    const paginated = paginate(merged, page, pageSize);

    return {
        employees: paginated.data,
        totalRecords: merged.length,
        totalPages: paginated.totalPages,
        currentPage: paginated.currentPage,
        pageSize: paginated.pageSize,
    };
}

async function getMergedEmployeeAttendance(sheetId, selectedMonth) {
    const [employees, attendance] = await Promise.all([
        getEmployeeData(sheetId),
        getMonthlyAttendance(sheetId, selectedMonth),
    ]);

    if (!attendance || attendance.length === 0) {
        return {
            success: false,
            message: `Attendance data are not present for ${selectedMonth}`,
        };
    }

    const attendanceMap = Object.fromEntries(
        attendance.map((a) => [a["Emp ID"], a])
    );

    const workingDays = calculateWorkingDays(selectedMonth);
    const formattedMonth = moment(selectedMonth, "M/YYYY").format("MMMM - YYYY");

    return {
        success: true,
        employees: employees.map((emp) => {
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
        }),
    };
}

async function updatePayslipData(sheetId, monthLabel, payslipData) {
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

    const payslipColIndex = await ensureColumn("Payslip Link", headers);
    const dateColIndex = await ensureColumn("Generated Date", headers);
    const emailColIndex = await ensureColumn("Email Sent", headers);

    // Prepare batch update requests
    const updates = [];
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const month = row[monthIndex];
        const empId = row[empIdIndex];

        if (month === normalizedMonth && payslipData[empId]) {
            const { link, generatedDate, emailSent } = payslipData[empId];

            if (link) {
                updates.push({
                    range: `Monthly_Attendance!${columnToLetter(payslipColIndex)}${i + 1
                        }`,
                    values: [[link]],
                });
            }

            if (generatedDate) {
                updates.push({
                    range: `Monthly_Attendance!${columnToLetter(dateColIndex)}${i + 1}`,
                    values: [[generatedDate]],
                });
            }

            if (emailSent !== undefined) {
                updates.push({
                    range: `Monthly_Attendance!${columnToLetter(emailColIndex)}${i + 1}`,
                    values: [[emailSent ? "Yes" : "No"]],
                });
            }

            logger.info(
                `Updating row ${i + 1
                }: ${empId} (${month}) → Link: ${link}, Date: ${generatedDate}, Email: ${emailSent ? "Yes" : "No"
                }`
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
        logger.info(`✅ Payslip data updated successfully for ${monthLabel}`);
    } else {
        logger.warn(`⚠️ No matching rows found for ${monthLabel}`);
    }
}

async function fetchEmployeeById(sheetId, empId) {
    const sheets = await authorizeGoogleSheets();

    // Fetch ONLY Employee Code column
    const idColumn = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: "Employee_Details!C:C", // adjust column of "Employee Code"
    });

    const rows = idColumn.data.values;
    if (!rows || rows.length === 0) return null;

    const rowIndex = rows.findIndex(
        (r) => r[0]?.toString().trim() === empId.toString().trim()
    );

    if (rowIndex === -1) return null;

    // Fetch full row data for that employee
    const empRow = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `Employee_Details!A${rowIndex + 1}:Z${rowIndex + 1}`, // adjust columns as per sheet
    });

    // Fetch headers to map row into object
    const headerRes = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: "Employee_Details!A1:Z1",
    });

    const headers = headerRes.data.values[0];
    const values = empRow.data.values[0];
    const empObj = {};
    headers.forEach((h, i) => (empObj[h] = values[i] || ""));
    return empObj;
}

async function fetchEmployeeAttendance(sheetId, empId) {
    const { headers, rows } = await fetchSheetWithHeaders(
        sheetId,
        "Monthly_Attendance!A:Z"
    );
    const empIdIdx = headers.indexOf("Employee Code");
    if (empIdIdx === -1) throw new Error("Missing Employee Code column");

    return rows
        .filter((r) => r[empIdIdx]?.toString().trim() === empId.toString().trim())
        .map((row) => mapRowsToObjects(headers, [row])[0]);
}

async function getDepartments(sheetId) {
    const sheets = await authorizeGoogleSheets();

    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: "Employee_Details!F2:F",
    });

    const rows = response.data.values || [];

    // Extract unique departments
    const departments = [...new Set(rows.flat())];
    return departments;
}

async function getEmployeeWithAttendance(sheetId, empId, selectedMonth) {
    const sheets = await authorizeGoogleSheets();

    // Fetch Employee row by ID (optimized)
    const emp = await fetchEmployeeById(sheetId, empId);
    if (!emp) throw new Error(`Employee ${empId} not found`);

    // Fetch Monthly_Attendance row just for that emp + month
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: "Monthly_Attendance!A:Z", // full attendance sheet
    });

    const [headers, ...rows] = response.data.values;
    const monthIdx = headers.indexOf("Month");
    const empIdx = headers.indexOf("Employee Code");
    if (monthIdx === -1 || empIdx === -1) {
        throw new Error("Sheet missing Month or Employee Code column");
    }

    const attendanceRow = rows.find(
        (r) => r[empIdx] === empId && r[monthIdx] === selectedMonth
    );

    if (!attendanceRow) {
        return {
            success: false,
            message: `Attendance data not found for Employee ${empId} for month ${selectedMonth}`,
        };
    }

    const attendance = {};
    if (attendanceRow) {
        headers.forEach((h, i) => (attendance[h] = attendanceRow[i] || ""));
    }

    // Calculate working days & net pay words
    const workingDays = calculateWorkingDays(selectedMonth);
    const leaves = parseInt(attendance["Leaves Taken"] || "0", 10);
    const effectiveWorkingDays = workingDays - leaves;

    const data = {
        ...emp,
        ...attendance,
        Month: moment(selectedMonth, "M/YYYY").format("MMMM - YYYY"),
        Leaves: leaves,
        "Working Days": effectiveWorkingDays,
        "Net Pay (Words)": numberToIndianCurrencyWords(emp["Net Pay"]),
    };
    return {
        success: true,
        data,
    };
}

async function getPayslipLink(sheetId, empId, selectedMonth) {
    const { headers, rows } = await fetchSheetWithHeaders(
        sheetId,
        "Monthly_Attendance!A:Z"
    );
    const {
        "Employee Code": empIdIdx,
        "Month": monthIdx,
        "Payslip Link": linkIdx,
    } = findColumnIndices(headers, ["Employee Code", "Month", "Payslip Link"]);

    const normalizedMonth = normalizeMonth(selectedMonth);

    const match = rows.find(
        (r) =>
            r[empIdIdx]?.toString().trim() === empId.toString().trim() &&
            r[monthIdx]?.toString().trim() === normalizedMonth
    );

    return match ? match[linkIdx] || null : null;
}

async function getAllPayslipLinks(sheetId, selectedMonth) {
    const { headers, rows } = await fetchSheetWithHeaders(
        sheetId,
        "Monthly_Attendance!A:Z"
    );
    const { "Month": monthIdx, "Payslip Link": linkIdx } = findColumnIndices(
        headers,
        ["Month", "Payslip Link"]
    );

    const normalizedMonth = normalizeMonth(selectedMonth);

    return rows
        .filter((r) => r[monthIdx]?.toString().trim() === normalizedMonth)
        .map((r) => r[linkIdx])
        .filter(Boolean);
}

module.exports = {
    getEmployeeData,
    getMonthlyAttendance,
    getMergedEmployeeAttendance,
    updatePayslipData,
    getFilteredEmployeeData,
    fetchEmployeeById,
    fetchEmployeeAttendance,
    getDepartments,
    getEmployeesWithMonthlyStatus,
    getEmployeeWithAttendance,
    getPayslipLink,
    getAllPayslipLinks,
};
