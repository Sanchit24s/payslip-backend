const config = require("../config/config");
const logger = require("../config/logger");
const moment = require("moment");
const {
    buildPayslipHistory,
    buildDetailEmployeeObject,
} = require("../utils/googleSheetUtils");
const { generateAllPayslips } = require("../utils/pdfGenerator");
const {
    getMergedEmployeeAttendance,
    getEmployeeData,
    getFilteredEmployeeData,
    fetchEmployeeById,
    fetchEmployeeAttendance,
    getDepartments,
    getMonthlyAttendance,
    getEmployeesWithMonthlyStatus,
} = require("../utils/sheet");

const generateSlip = async (req, res, next) => {
    try {
        const { month } = req.body;

        const [year, monthNum] = month.split("-");
        const formattedMonth = `${monthNum}/${year}`;
        // fetch the employee data and monthly attendance from the google sheet
        const data = await getMergedEmployeeAttendance(
            config.google.sheet_id,
            formattedMonth
        );
        await generateAllPayslips(data, config.google.sheet_id, formattedMonth);

        // generate slip pdf

        // save it to google drive

        res.status(200).json({ success: true, message: "All payslips generated successfully!" });
    } catch (error) {
        console.log(error);
        logger.error("Error generating payslips:", error.message);
        res.status(500).render("error", {
            message: "An unexpected error occurred while generating payslips.",
        });
    }
};

const getEmployeesData = async (req, res, next) => {
    try {
        let {
            page = 1,
            limit = 10,
            search = "",
            department = "All",
            status = "All",
        } = req.query;

        page = parseInt(page, 10);
        limit = parseInt(limit, 10);

        const data = await getFilteredEmployeeData(
            config.google.sheet_id,
            page,
            limit,
            search,
            department,
            status
        );

        res.status(200).json({
            success: true,
            ...data,
            hasPrevPage: data.currentPage > 1,
            hasNextPage: data.currentPage < data.totalPages,
        });
    } catch (error) {
        return next(error);
    }
};

const getEmployeeDetail = async (req, res, next) => {
    try {
        const { empId } = req.params;

        if (!empId) {
            return res
                .status(400)
                .json({ success: false, message: "empId is required" });
        }
        const sheetId = config.google.sheet_id;
        const employee = await fetchEmployeeById(sheetId, empId);
        if (!employee) {
            return res
                .status(404)
                .json({ success: false, message: "Employee not found" });
        }

        // 2️⃣ Fetch attendance history for this employee
        const employeeHistory = await fetchEmployeeAttendance(sheetId, empId);

        const payslipHistory = buildPayslipHistory(employeeHistory);

        const employeeDetails = buildDetailEmployeeObject(employee, payslipHistory);

        return res.status(200).json({ success: true, employee: employeeDetails });
    } catch (error) {
        return next(error);
    }
};

const departmentDropdown = async (req, res, next) => {
    try {
        const departments = await getDepartments(config.google.sheet_id);
        if (departments.length === 0) {
            return res
                .status(404)
                .json({ success: false, message: "No departments found" });
        }

        return res.status(200).json({ success: true, departments });
    } catch (error) {
        return next(error);
    }
};

const getMonthlyStats = async (req, res, next) => {
    try {
        const { month } = req.query; // YYYY-MM
        if (!moment(month, "YYYY-MM", true).isValid()) {
            return res.status(400).json({
                success: false,
                message: "Month is required in YYYY-MM format (e.g., 2025-07)",
            });
        }

        const sheetId = config.google.sheet_id;
        const [year, monthNum] = month.split("-");
        const formattedMonth = `${+monthNum}/${year}`;
        const endOfMonth = moment(month, "YYYY-MM").endOf("month");

        // 1️⃣ Fetch attendance & employees in parallel
        const [attendance, employees] = await Promise.all([
            getMonthlyAttendance(sheetId, formattedMonth),
            getEmployeeData(sheetId),
        ]);

        // 2️⃣ Active employees (joined on/before end of month)
        const activeEmployees = employees.filter((emp) =>
            moment(
                emp["Date of Joining"],
                ["DD-MMM-YYYY", "YYYY-MM-DD"],
                true
            ).isSameOrBefore(endOfMonth)
        );

        // 3️⃣ Total salaries (from employee data)
        const totalSalaries = activeEmployees.reduce(
            (sum, emp) => sum + (parseFloat(emp["Net Pay"]) || 0),
            0
        );

        // 4️⃣ Slips + emails (from attendance)
        const { slipsGenerated, emailsSent } = attendance.reduce(
            (acc, row) => ({
                slipsGenerated: acc.slipsGenerated + (row["Payslip Link"] ? 1 : 0),
                emailsSent:
                    acc.emailsSent +
                    ((row["Email Sent"] || "").toLowerCase() === "yes" ? 1 : 0),
            }),
            { slipsGenerated: 0, emailsSent: 0 }
        );

        // ✅ Response
        res.status(200).json({
            success: true,
            month: moment(month, "YYYY-MM").format("MMMM YYYY"),
            stats: {
                totalEmployees: activeEmployees.length,
                totalSalaries,
                slipsGenerated,
                emailsSent,
            },
        });
    } catch (error) {
        next(error);
    }
};

const getEmployeesMonthlyStatus = async (req, res, next) => {
    try {
        let {
            month,               // YYYY-MM
            page = 1,
            limit = 10,
            search = "",
            department = "All",
        } = req.query;

        // Validate month format
        if (!moment(month, "YYYY-MM", true).isValid()) {
            return res.status(400).json({
                success: false,
                message: "Month is required in YYYY-MM format (e.g., 2025-07)",
            });
        }

        page = parseInt(page, 10);
        limit = parseInt(limit, 10);

        const [year, monthNum] = month.split("-");
        const formattedMonth = `${+monthNum}/${year}`; // M/YYYY format for service

        const employeesData = await getEmployeesWithMonthlyStatus(
            config.google.sheet_id,
            formattedMonth,
            page,
            limit,
            search,
            department
        );

        res.status(200).json({
            success: true,
            ...employeesData,
            hasPrevPage: employeesData.currentPage > 1,
            hasNextPage: employeesData.currentPage < employeesData.totalPages,
        });
    } catch (error) {
        next(error);
    }
};


module.exports = {
    generateSlip,
    getEmployeesData,
    getEmployeeDetail,
    departmentDropdown,
    getMonthlyStats,
    getEmployeesMonthlyStatus,
};
