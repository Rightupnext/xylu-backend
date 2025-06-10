const express = require("express");
const router = express.Router();
const { getAllUsers } = require("../controllers/userController");
const { authenticate } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");
const {
  encryptResponse,
  decryptMiddleware,
} = require("../middleware/encryption");
router.get("/", authenticate, authorizeRoles("admin"), getAllUsers);

module.exports = router;
