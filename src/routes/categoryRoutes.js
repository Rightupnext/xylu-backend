const express = require("express");
const router = express.Router();
const categoryController = require("../controllers/categoryController");
const { authenticate } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");
const { decryptMiddleware, wrapEncryptedHandler } = require("../middleware/encryption");

const isEncryptionEnabled = process.env.ENCRYPTION_ENABLED === "true";

// Helper to conditionally apply encryption middleware
const withEncryption = (handler) => {
  return isEncryptionEnabled
    ? [decryptMiddleware, wrapEncryptedHandler(handler)]
    : [handler];
};

// Public route (no encryption)
router.get("/", ...withEncryption(categoryController.getAllCategories));

// Protected routes with conditional encryption
router.post(
  "/",
  authenticate,
  authorizeRoles("admin", "super-admin"),
  ...withEncryption(categoryController.createCategory)
);

router.put(
  "/:id",
  authenticate,
  authorizeRoles("admin", "super-admin"),
  ...withEncryption(categoryController.updateCategoryById)
);

router.delete(
  "/:id",
  authenticate,
  authorizeRoles('admin'),
  authorizeRoles("admin", "super-admin"),
  ...withEncryption(categoryController.deleteCategory)
);

module.exports = router;
