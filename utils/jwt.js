const jwt = require("jsonwebtoken");
const config = require("../config/config");

const generateToken = (user) => {
    return jwt.sign(
        { email: user.email },
        config.jwt_secret,
        { expiresIn: "7d" }
    );
};

module.exports = { generateToken };