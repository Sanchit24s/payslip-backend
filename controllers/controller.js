const config = require("../config/config");
const logger = require("../config/logger");
const moment = require("moment");
const axios = require("axios");
const {
    buildPayslipHistory,
    buildDetailEmployeeObject,
} = require("../utils/googleSheetUtils");
const {
    generateAllPayslips,
    generatePayslip,
} = require("../utils/pdfGenerator");
const {
    getMergedEmployeeAttendance,
    getEmployeeData,
    getFilteredEmployeeData,
    fetchEmployeeById,
    fetchEmployeeAttendance,
    getDepartments,
    getMonthlyAttendance,
    getEmployeesWithMonthlyStatus,
    getEmployeeWithAttendance,
    updatePayslipData,
    getPayslipLink,
    getAllPayslipLinks,
} = require("../utils/sheet");
const { sendPayslipEmail } = require("../utils/sendEmail");
const { uploadPDFToCloudinary } = require("../utils/cloudinaryUpload");
const {
    validateMonth,
    formatMonth,
    validateEmpId,
    getEndOfMonth,
} = require("../utils/validators");
const { filterActiveEmployees } = require("../utils/employeeUtils");
const { processAllPayslips } = require("../services/payslipService");

// ✅ Generate slips for all employees
const generateSlip = async (req, res, next) => {
    try {
        const { month } = req.body;

        const validation = validateMonth(month);
        if (!validation.valid)
            return res
                .status(400)
                .json({ success: false, message: validation.message });

        const formattedMonth = formatMonth(month);
        // fetch the employee data and monthly attendance from the google sheet
        const data = await getMergedEmployeeAttendance(
            config.google.sheet_id,
            formattedMonth
        );

        if (!data.success) {
            return res.status(400).json({ success: false, message: data.message });
        }

        await generateAllPayslips(
            data.employees,
            config.google.sheet_id,
            formattedMonth
        );

        res
            .status(200)
            .json({ success: true, message: "All payslips generated successfully!" });
    } catch (error) {
        console.log(error);
        logger.error("Error generating payslips:", error.message);
        res.status(500).render("error", {
            message: "An unexpected error occurred while generating payslips.",
        });
    }
};

// ✅ Sent all payslip emails
const sendAllPayslipEmails = async (req, res, next) => {
    try {
        const { month } = req.body;
        const monthCheck = validateMonth(month);
        if (!monthCheck.valid)
            return res
                .status(400)
                .json({ success: false, message: monthCheck.message });

        const formattedMonth = formatMonth(month);

        const data = await getMergedEmployeeAttendance(
            config.google.sheet_id,
            formattedMonth
        );

        if (!data.success) {
            return res.status(400).json({ success: false, message: data.message });
        }

        const links = await getAllPayslipLinks(
            config.google.sheet_id,
            formattedMonth
        );
        if (!links.length) {
            return res.status(404).json({
                success: false,
                message: "No payslip links found for this month",
            });
        }

        // Process all payslips
        const results = await processAllPayslips(links, formattedMonth);

        // Build summary
        const sent = results.filter((r) => r.success).length;
        res.status(200).json({
            success: true,
            summary: {
                total: results.length,
                sent,
                failed: results.length - sent,
            },
            results,
        });
    } catch (error) {
        return next(error);
    }
};

// ✅ Generate slip for single employee
const generateSlipByEmpId = async (req, res, next) => {
    try {
        const { empId, month } = req.body;

        const idCheck = validateEmpId(empId);
        if (!idCheck.valid)
            return res.status(400).json({ success: false, message: idCheck.message });

        const monthCheck = validateMonth(month);
        if (!monthCheck.valid)
            return res
                .status(400)
                .json({ success: false, message: monthCheck.message });

        const formattedMonth = formatMonth(month);

        // Fetch employee + attendance for that month
        const response = await getEmployeeWithAttendance(
            config.google.sheet_id,
            empId,
            formattedMonth
        );

        if (!response.success) {
            return res
                .status(400)
                .json({ success: false, message: response.message });
        }

        const empWithData = response.data;

        // Generate payslip (single)
        const fileName = `${empWithData["Employee Code"]}_Payslip.pdf`;
        const pdfBuffer = await generatePayslip(empWithData);

        // Upload to Cloudinary
        const folderPath = `Payslips/${empWithData.Month.replace(/\s+/g, "_")}`;
        const uploadResult = await uploadPDFToCloudinary(
            pdfBuffer,
            fileName,
            folderPath
        );

        // Update sheet for this emp/month only
        await updatePayslipData(config.google.sheet_id, formattedMonth, {
            [empId]: {
                link: uploadResult.secure_url,
                generatedDate: new Date().toLocaleDateString("en-GB"),
            },
        });

        return res.status(200).json({
            success: true,
            message: `Payslip generated for ${empId} (${month})`,
            url: uploadResult.secure_url,
        });
    } catch (error) {
        logger.error("Error generating payslip:", error.message);
        next(error);
    }
};

// ✅ Sent payslip email for single employee
const resendPayslipEmail = async (req, res, next) => {
    try {
        const { empId, month } = req.body;

        const idCheck = validateEmpId(empId);
        if (!idCheck.valid)
            return res.status(400).json({ success: false, message: idCheck.message });

        const monthCheck = validateMonth(month);
        if (!monthCheck.valid)
            return res
                .status(400)
                .json({ success: false, message: monthCheck.message });

        const formattedMonth = formatMonth(month);

        const payslipLink = await getPayslipLink(
            config.google.sheet_id,
            empId,
            formattedMonth
        );
        if (!payslipLink) {
            return res.status(404).json({
                success: false,
                message: "No payslip found for this employee and month",
            });
        }

        // Download PDF + fetch employee data in parallel
        const [pdfResponse, empWithData] = await Promise.all([
            axios.get(payslipLink, { responseType: "arraybuffer" }),
            getEmployeeWithAttendance(config.google.sheet_id, empId, formattedMonth),
        ]);

        //  Convert PDF response to buffer
        const pdfBuffer = Buffer.from(pdfResponse.data, "binary");

        // Send email with PDF
        const [emailResult] = await Promise.allSettled([
            sendPayslipEmail(empWithData, pdfBuffer),
        ]);

        const emailSent = emailResult.status === "fulfilled";

        // update google sheet
        await updatePayslipData(config.google.sheet_id, formattedMonth, {
            [empId]: { emailSent },
        });

        res.json({ success: true, message: "Payslip email sent successfully" });
    } catch (error) {
        next(error);
    }
};

// ✅ Get employees data
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

// ✅ Get single employee data
const getEmployeeDetail = async (req, res, next) => {
    try {
        const { empId } = req.params;

        const idCheck = validateEmpId(empId);
        if (!idCheck.valid)
            return res.status(400).json({ success: false, message: idCheck.message });

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

// ✅ Get department dropdown
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

// ✅ Get montly stats
const getMonthlyStats = async (req, res, next) => {
    try {
        const { month } = req.query; // YYYY-MM

        const monthCheck = validateMonth(month);
        if (!monthCheck.valid)
            return res
                .status(400)
                .json({ success: false, message: monthCheck.message });

        const formattedMonth = formatMonth(month);

        const sheetId = config.google.sheet_id;
        const endOfMonth = getEndOfMonth(month);

        // 1️⃣ Fetch attendance & employees in parallel
        const [attendance, employees] = await Promise.all([
            getMonthlyAttendance(sheetId, formattedMonth),
            getEmployeeData(sheetId),
        ]);

        // 2️⃣ Active employees (joined on/before end of month)
        const activeEmployees = filterActiveEmployees(employees, endOfMonth);

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

// ✅ Get employee's monthly status
const getEmployeesMonthlyStatus = async (req, res, next) => {
    try {
        let {
            month, // YYYY-MM
            page = 1,
            limit = 10,
            search = "",
            department = "All",
        } = req.query;

        const monthCheck = validateMonth(month);
        if (!monthCheck.valid)
            return res
                .status(400)
                .json({ success: false, message: monthCheck.message });

        const formattedMonth = formatMonth(month);

        page = parseInt(page, 10);
        limit = parseInt(limit, 10);

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

// ✅ Get all payslips for download
const downloadPayslips = async (req, res, next) => {
    try {
        const { month } = req.body; // YYYY-MM

        const monthCheck = validateMonth(month);
        if (!monthCheck.valid)
            return res
                .status(400)
                .json({ success: false, message: monthCheck.message });

        const formattedMonth = formatMonth(month);

        const sheetId = config.google.sheet_id;

        const payslips = await getAllPayslipLinks(sheetId, formattedMonth);

        if (!payslips || payslips.length === 0) {
            return res.status(404).json({
                success: false,
                message: `No payslips found for ${formattedMonth}`,
            });
        }

        res.status(200).json({ success: true, files: payslips });
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
    generateSlipByEmpId,
    resendPayslipEmail,
    downloadPayslips,
    sendAllPayslipEmails,
};
