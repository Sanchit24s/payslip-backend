const { Router } = require("express");
const { generateSlip, getEmployeesData } = require("../controllers/controller");

const router = Router();

router.post("/generate-slip", generateSlip);
router.get("/employees", getEmployeesData);

module.exports = router;