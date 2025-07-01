const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");
const { upload, processImage } = require("../middleware/upload");
const { authenticate } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");
const {
  decryptMiddleware,
  wrapEncryptedHandler,
} = require("../middleware/encryption");

const isEncryptionEnabled = process.env.ENCRYPTION_ENABLED === "true";

const withEncryption = (handler) => {
  return isEncryptionEnabled
    ? [decryptMiddleware, wrapEncryptedHandler(handler)]
    : [handler];
};

// Public routes without encryption
router.get("/:id", ...withEncryption(productController.getProductById));
router.get("/", ...withEncryption(productController.getAllProducts));

// Protected routes with authentication, authorization and conditional encryption
router.post(
  "/",
  upload.single("image"),
  processImage,
  authenticate,
  authorizeRoles("admin"),
  ...withEncryption(productController.createProductWithVariants)
);

router.put(
  "/:id",
  upload.single("image"),
  processImage,
  authenticate,
  authorizeRoles("admin"),
  ...withEncryption(productController.updateProductWithVariants)
);

router.delete(
  "/:id",
  authenticate,
  authorizeRoles("admin"),
  ...withEncryption(productController.deleteProduct)
);

module.exports = router;
