const { Router } = require("express");
const { login } = require("../controllers/authController");
const { authenticate } = require("../middlewares/authMiddleware");

const authRouter = Router();

authRouter.post("/login", login);
authRouter.get("/protected", authenticate, (req, res) => {
    res.json({ message: "You have access", user: req.user });
});

module.exports = authRouter;
