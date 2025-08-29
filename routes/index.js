const { Router } = require("express");
const reportRouter = require("./report");
const payslipRouter = require("./route");

const router = Router();

router.use("/", payslipRouter);
router.use("/report", reportRouter);

module.exports = router; 