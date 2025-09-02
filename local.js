const app = require("./server");
const logger = require("./config/logger");
const config = require("./config/config");

const PORT = config.port || 8000;

app.listen(PORT, () => {
    logger.info(`🚀 Server running locally at http://localhost:${PORT}`);
});
