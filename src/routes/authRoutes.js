const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const {
  decryptMiddleware,
  wrapEncryptedHandler,
} = require("../middleware/encryption");

const isEncryptionEnabled = process.env.ENCRYPTION_ENABLED === "true";

// 🔧 Helper to conditionally wrap handlers with encryption
const withEncryption = (handler) => {
  if (isEncryptionEnabled) {
    return [decryptMiddleware, wrapEncryptedHandler(handler)];
  }
  return [handler];
};

// 👤 Register and Login routes with conditional encryption
router.post("/register", ...withEncryption(authController.register));
router.post("/login", ...withEncryption(authController.login));

module.exports = router;
