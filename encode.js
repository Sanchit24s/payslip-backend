const fs = require("fs");
const credentials = fs.readFileSync("./credentials.json", "utf8");
const encoded = Buffer.from(credentials).toString("base64");
console.log(encoded);
