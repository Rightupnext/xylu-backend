const express = require("express");
const router = express.Router();
const {
  upload,
  uploadHeroImage,
  getAllHeroImages,
  deleteHeroImage,
  updateHeroImage,
} = require("../controllers/heroController");
const { authenticate } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");
const {
  decryptMiddleware,
  wrapEncryptedHandler,
  encryptResponse,
} = require("../middleware/encryption");

const isEncryptionEnabled = process.env.ENCRYPTION_ENABLED === "true";

// Helper to wrap route handlers with encryption if enabled
const withEncryption = (handler) =>
  isEncryptionEnabled
    ? [decryptMiddleware, wrapEncryptedHandler(handler)]
    : [handler];

// POST /upload-hero - decrypt request, encrypt response, and upload single hero image
router.post(
  "/upload-hero",
  authenticate,
  authorizeRoles("admin"),
  ...withEncryption(upload.single("heroImage")),
  ...withEncryption(uploadHeroImage)
);
router.put(
  "/update-hero/:id",
  authenticate,
   authorizeRoles("admin"),
  ...withEncryption(upload.single("heroImage")),
  ...withEncryption(updateHeroImage)
);

// GET /get-heroes - decrypt request and encrypt response
router.get("/get-heroes", ...withEncryption(getAllHeroImages));

// DELETE /delete-hero/:filename - No encryption wrapper here (add if needed)
router.delete("/delete-hero/:filename",authenticate,
   authorizeRoles("admin"), ...withEncryption(deleteHeroImage));

module.exports = router;
