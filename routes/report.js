const { Router } = require("express");
const { getReports } = require("../controllers/reportController");

const reportRouter = Router();

reportRouter.get("/", getReports);

module.exports = reportRouter;
