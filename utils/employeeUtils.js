const moment = require("moment");

/**
 * Filters employees who joined on or before the given date
 */
const filterActiveEmployees = (employees, endOfMonth) => {
    return employees.filter((emp) =>
        moment(
            emp["Date of Joining"],
            ["DD-MMM-YYYY", "YYYY-MM-DD"],
            true
        ).isSameOrBefore(endOfMonth)
    );
};

/**
 * Filters employees by department
 */
const filterByDepartment = (employees, department) => {
    if (!department || department === "All") return employees;
    return employees.filter(
        (emp) => (emp.Department || "").toLowerCase() === department.toLowerCase()
    );
};

/**
 * Filters employees who have attendance
 */
const filterWithAttendance = (employees, attendance) => {
    const attendedEmployeeKeys = new Set(
        attendance.map((row) => row["Employee Code"])
    );
    return employees.filter((emp) =>
        attendedEmployeeKeys.has(emp["Employee Code"])
    );
};

module.exports = {
    filterActiveEmployees,
    filterByDepartment,
    filterWithAttendance,
};
