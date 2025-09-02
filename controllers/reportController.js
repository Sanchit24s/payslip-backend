const config = require("../config/config");
const moment = require("moment");
const { getMonthlyAttendance, getEmployeeData } = require("../utils/sheet");
const {
    validateMonth,
    formatMonth,
    getEndOfMonth,
    displayMonth,
} = require("../utils/validators");
const {
    filterActiveEmployees,
    filterByDepartment,
    filterWithAttendance,
} = require("../utils/employeeUtils");
const { calculateSalaryStats } = require("../utils/salary");

const getReports = async (req, res, next) => {
    try {
        const { month, department } = req.query;
        const validation = validateMonth(month);
        if (!validation.valid)
            return res
                .status(400)
                .json({ success: false, message: validation.message });

        const formattedMonth = formatMonth(month);
        const sheetId = config.google.sheet_id;
        const endOfMonth = getEndOfMonth(month);

        const [attendance, employees] = await Promise.all([
            getMonthlyAttendance(sheetId, formattedMonth),
            getEmployeeData(sheetId),
        ]);

        if (attendance.length === 0) {
            return res.status(200).json({
                success: true,
                month: moment(month, "YYYY-MM").format("MMMM YYYY"),
                stats: {
                    totalSalaries: 0,
                    professionalTax: 0,
                    tds: 0,
                },
            });
        }

        let activeEmployees = filterActiveEmployees(employees, endOfMonth);
        activeEmployees = filterByDepartment(activeEmployees, department);
        const employeesWithAttendance = filterWithAttendance(
            activeEmployees,
            attendance
        );

        // 🔹 Calculate salaries
        const stats = calculateSalaryStats(employeesWithAttendance);

        return res.status(200).json({
            success: true,
            month: displayMonth(month),
            stats,
        });
    } catch (error) {
        return next(error);
    }
};

module.exports = { getReports };
