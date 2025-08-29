const { Router } = require("express");
const {
    generateSlip,
    getEmployeesData,
    getEmployeeDetail,
    departmentDropdown,
    getMonthlyStats,
    getEmployeesMonthlyStatus,
    generateSlipByEmpId,
    resendPayslipEmail,
    downloadPayslips,
} = require("../controllers/controller");

const router = Router();

router.post("/generate-slip", generateSlip);
router.post("/generate-slip-by-id", generateSlipByEmpId);
router.post("/resend-email", resendPayslipEmail);
router.post("/download-all", downloadPayslips);
router.get("/employees", getEmployeesData);
router.get("/employee/:empId", getEmployeeDetail);

router.get("/stats", getMonthlyStats);
router.get("/employees-monthly-status", getEmployeesMonthlyStatus);
router.get("/department", departmentDropdown);

module.exports = router;
