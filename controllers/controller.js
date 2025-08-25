const config = require("../config/config");
const logger = require("../config/logger");
const { generateAllPayslips } = require("../utils/pdfGenerator");
const {
    getMergedEmployeeAttendance,
    getEmployeeData,
    getFilteredEmployeeData,
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

        res.render("success", {
            title: "Payslip Generation Successful",
            month: `${monthNum}-${year}`,
            count: data.length,
        });
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
        let { page = 1, limit = 10 } = req.query;
        page = parseInt(page, 10);
        limit = parseInt(limit, 10);

        const data = await getFilteredEmployeeData(
            config.google.sheet_id,
            page,
            limit
        );

        const { totalPages, currentPage } = data;

        res.status(200).json({
            success: true,
            ...data,
            hasPrevPage: currentPage > 1,
            hasNextPage: currentPage < totalPages
        });
    } catch (error) {
        return next(error);
    }
};

module.exports = { generateSlip, getEmployeesData };
