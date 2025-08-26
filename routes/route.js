const { Router } = require("express");
const {
    generateSlip,
    getEmployeesData,
    getEmployeeDetail,
    departmentDropdown,
    getMonthlyStats,
    getEmployeesMonthlyStatus,
} = require("../controllers/controller");

const router = Router();

router.post("/generate-slip", generateSlip);
router.get("/employees", getEmployeesData);
router.get("/employee/:empId", getEmployeeDetail);

router.get("/stats", getMonthlyStats);
router.get("/employees-monthly-status", getEmployeesMonthlyStatus);
router.get("/department", departmentDropdown);

module.exports = router;
