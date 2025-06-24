const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const { authenticate } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");
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

// GET all users — admin only
router.get(
  "/",
  authenticate,
  authorizeRoles("admin"),
  ...withEncryption(userController.getAllUsers)
);



module.exports = router;
