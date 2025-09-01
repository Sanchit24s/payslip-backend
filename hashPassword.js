// hashPassword.js
const bcrypt = require("bcryptjs");

/**
 * Generate a hashed password
 * @param {string} plainPassword - The plain text password
 * @returns {Promise<string>} - The hashed password
 */
async function hashPassword(plainPassword) {
    try {
        const saltRounds = 10;
        const salt = await bcrypt.genSalt(saltRounds);
        const hashedPassword = await bcrypt.hash(plainPassword, salt);
        return hashedPassword;
    } catch (error) {
        console.error("Error hashing password:", error);
        throw error;
    }
}

(async () => {
    const password = "Pass@1234";
    const hashed = await hashPassword(password);
    console.log("Hashed Password:", hashed);
})();
