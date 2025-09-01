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
const { authenticate } = require("../middlewares/authMiddleware");

const router = Router();

router.post("/generate-slip", authenticate, generateSlip);
router.post("/generate-slip-by-id", authenticate, generateSlipByEmpId);
router.post("/resend-email", authenticate, resendPayslipEmail);
router.post("/download-all", authenticate, downloadPayslips);
router.get("/employees", authenticate, getEmployeesData);
router.get("/employee/:empId", authenticate, getEmployeeDetail);

router.get("/stats", authenticate, getMonthlyStats);
router.get("/employees-monthly-status", authenticate, getEmployeesMonthlyStatus);
router.get("/department", authenticate, departmentDropdown);

module.exports = router;
