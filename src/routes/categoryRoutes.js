const express = require("express");
const router = express.Router();
const categoryController = require("../controllers/categoryController");
const { authenticate } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");
const {encryptResponse,decryptMiddleware,} = require("../middleware/encryption");
router.get("/", categoryController.getAllCategories);
router.post("/", authenticate,authorizeRoles('admin','super-admin'),decryptMiddleware,encryptResponse,categoryController.createCategory);
router.put("/:id",authenticate,authorizeRoles('admin','super-admin'),decryptMiddleware,encryptResponse, categoryController.updateCategoryById);
router.delete("/:id",authenticate,authorizeRoles('admin','super-admin'),decryptMiddleware, encryptResponse,categoryController.deleteCategory);

module.exports = router;
