const { Router } = require("express");
const reportRouter = require("./report");
const payslipRouter = require("./route");
const authRouter = require("./auth");
const { authenticate } = require("../middlewares/authMiddleware");
const errorHandler = require("../middlewares/errorHandler");

const router = Router();

router.use("/", authenticate, payslipRouter);
router.use("/report", authenticate, reportRouter);
router.use("/auth", authRouter);
router.use(errorHandler);

module.exports = router; 