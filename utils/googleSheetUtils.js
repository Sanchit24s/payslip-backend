const moment = require("moment");
const {
    calculateWorkingDays,
    numberToIndianCurrencyWords,
} = require("./salary");

// Return empty default response
function emptyResponse() {
    return {
        employees: [],
        totalRecords: 0,
        totalPages: 0,
        currentPage: 1,
        pageSize: 10,
        summary: {
            totalEmployees: 0,
            filteredEmployees: 0,
            activeEmployees: 0,
            totalPayroll: 0,
        },
    };
}

// Map required field indices
function mapFieldIndices(headers, requiredFields) {
    const indices = requiredFields.map((field) => headers.indexOf(field));
    return indices.some((i) => i === -1) ? null : indices;
}

// Build employee object with safe defaults
function buildEmployee(row, indices, fields) {
    const obj = {};
    indices.forEach((i, idx) => {
        obj[fields[idx]] = row[i] || "";
    });
    obj["Net Pay"] = parseFloat(obj["Net Pay"]) || 0;
    return obj;
}

// Calculate summary stats
function buildSummary(employees) {
    return {
        totalEmployees: employees.length,
        activeEmployees: employees.filter((e) => e["Status"] === "Active").length,
        totalPayroll: employees.reduce((sum, e) => sum + e["Net Pay"], 0),
    };
}

// Apply search + department + status filters
function applyFilters(employees, searchTerm, department, status) {
    const search = searchTerm.toLowerCase();
    return employees.filter((emp) => {
        const matchesSearch =
            emp["Employee Name"].toLowerCase().includes(search) ||
            emp["Employee Code"].toLowerCase().includes(search) ||
            (emp["Email"] && emp["Email"].toLowerCase().includes(search));

        const matchesDept =
            department === "All" || emp["Department"] === department;
        const matchesStatus = status === "All" || emp["Status"] === status;

        return matchesSearch && matchesDept && matchesStatus;
    });
}

// Handle pagination
function paginate(list, page, pageSize) {
    const totalRecords = list.length;
    const totalPages = Math.ceil(totalRecords / pageSize) || 1;
    const currentPage = Math.min(Math.max(page, 1), totalPages);

    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;

    return {
        data: list.slice(start, end),
        totalPages,
        currentPage,
        pageSize,
    };
}

// Map sheet rows to objects
function mapSheetToObjects(headers, rows) {
    return rows.map((row) => {
        const obj = {};
        headers.forEach((header, index) => {
            obj[header.trim()] = row[index] ? row[index].trim() : "";
        });
        return obj;
    });
}

// Normalize month as M/YYYY
function normalizeMonth(monthLabel) {
    const [month, year] = monthLabel.split("/");
    return `${parseInt(month, 10)}/${year}`;
}

// Format merged employee attendance
function formatMergedAttendance(employees, attendance, selectedMonth) {
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

function buildPayslipHistory(employeeHistory) {
    const payslipHistory = employeeHistory
        .filter((row) => row["Payslip Link"])
        .map((row, idx) => ({
            version: `v${idx + 1}`,
            month: moment(row["Month"], "M/YYYY").format("MMMM YYYY"),
            generatedDate: row["Generated Date"] || null,
            status: row["Email Sent"] === "Yes" ? "Sent" : "Not Sent",
            link: row["Payslip Link"] || null,
        }))
        .reverse();

    return payslipHistory;
}

function buildDetailEmployeeObject(employee, payslipHistory) {
    const parseMonth = (m) => {
        // supports "MMMM YYYY", "MMMM - YYYY", "M/YYYY"
        const mm = moment(m, ["MMMM YYYY", "MMMM - YYYY", "M/YYYY"], true);
        return mm.isValid() ? mm : null;
    };

    // Latest month that has a generated payslip (has a link)
    const lastGeneratedEntry = payslipHistory
        .filter(p => p.link && p.month)
        .reduce((latest, curr) => {
            const currM = parseMonth(curr.month);
            if (!currM) return latest;
            if (!latest || currM.isAfter(latest.m)) return { rec: curr, m: currM };
            return latest;
        }, null);

    // Latest entry that was SENT; compare by generatedDate (fallback to month)
    const lastSentEntry = payslipHistory
        .filter(p => p.status === "Sent" && (p.generatedDate || p.month))
        .reduce((latest, curr) => {
            const dateM =
                (curr.generatedDate &&
                    moment(curr.generatedDate, ["DD/MM/YYYY", "D/M/YYYY", "YYYY-MM-DD", "MM/DD/YYYY"], true).isValid() &&
                    moment(curr.generatedDate, ["DD/MM/YYYY", "D/M/YYYY", "YYYY-MM-DD", "MM/DD/YYYY"], true)) ||
                parseMonth(curr.month);
            if (!dateM) return latest;
            if (!latest || dateM.isAfter(latest.m)) return { rec: curr, m: dateM };
            return latest;
        }, null);

    const detail = {
        name: employee["Employee Name"] || "",
        employeeType: employee["Employee Type"] || "",
        employeeCode: employee["Employee Code"],
        email: employee["Email"] || "",
        designation: employee["Designation"] || "",
        department: employee["Department"] || "",
        dateOfJoining: employee["Date of Joining"] || "",
        providentFund: employee["Provident Fund"] || "",
        esicNo: employee["ESIC No."] || "",
        bankName: employee["Bank Name"] || "",
        accountNo: employee["Account No"] || "",
        ifscCode: employee["IFSC Code"] || "",
        branchName: employee["Branch Name"] || "",
        uanNo: employee["UAN No"] || "",
        panNo: employee["PAN No"] || "",

        totalArrearDays: parseInt(employee["Total Arrear Days"] || 0, 10),
        lop: parseInt(employee["LOP"] || 0, 10),
        basicSalary: parseFloat(employee["Basic Salary"] || 0),
        hra: parseFloat(employee["HRA"] || 0),
        lta: parseFloat(employee["LTA"] || 0),
        specialAllowance: parseFloat(employee["Special Allowance"] || 0),
        grossEarning: parseFloat(employee["Gross Earning"] || 0),
        professionalTax: parseFloat(employee["Professional Tax"] || 0),
        tds: parseFloat(employee["TDS"] || 0),
        totalDeductions: parseFloat(employee["Total Deductions"] || 0),
        netPay: parseFloat(employee["Net Pay"] || 0),

        leaves: parseInt(employee["Leaves"] || 0, 10),
        isSlipGenerated: payslipHistory.length > 0,
        isEmailSent: payslipHistory.some((p) => p.status === "Sent"),
        payslipHistory,
        lastGenerated: lastGeneratedEntry ? lastGeneratedEntry.m.format("MMMM YYYY") : null,
        lastSent: lastSentEntry ? lastSentEntry.m.format("MMMM D, YYYY") : null,
    };

    return detail;
}

module.exports = {
    emptyResponse,
    mapFieldIndices,
    buildEmployee,
    buildSummary,
    applyFilters,
    paginate,
    mapSheetToObjects,
    normalizeMonth,
    formatMergedAttendance,
    buildPayslipHistory,
    buildDetailEmployeeObject,
};
