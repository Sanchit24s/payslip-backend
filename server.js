require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const logger = require("./config/logger");
const config = require("./config/config");
const router = require("./routes/index");
const path = require("path");


const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
    morgan("combined", {
        stream: {
            write: (message) => logger.info(message.trim())
        }
    })
);

app.get("/", (req, res) => {
    logger.info("Root route hit");
    res.render("generate-slip");
});

app.use("/api/v1", router);

const PORT = config.port || 8000;

app.listen(PORT, () => {
    logger.info(`🚀 Server running locally at http://localhost:${PORT}`);
});