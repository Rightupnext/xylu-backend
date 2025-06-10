const express = require("express");
const router = express.Router();
const { register, login } = require("../controllers/authController");
const {
  encryptResponse,
  decryptMiddleware,
} = require("../middleware/encryption");
router.post("/register", register);
router.post("/login", decryptMiddleware, encryptResponse, login);

module.exports = router;
