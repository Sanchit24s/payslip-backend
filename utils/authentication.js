const bcrypt = require("bcryptjs");

const matchPassword = async (enteredPassword, hashedPassword) => {
    return await bcrypt.compare(enteredPassword, hashedPassword);
};

module.exports = { matchPassword };
