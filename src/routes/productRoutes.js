const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { upload, processImage } = require('../middleware/upload');
const { authenticate } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");
const {encryptResponse,decryptMiddleware,} = require("../middleware/encryption");

router.post('/',upload.single('image'),processImage,authenticate,authorizeRoles("admin"),encryptResponse,decryptMiddleware,productController.createProductWithVariants);
router.get("/:id", productController.getProductById);
router.put('/:id',upload.single('image'),processImage,authenticate,authorizeRoles("admin"),encryptResponse,decryptMiddleware,productController.updateProductWithVariants);

router.get('/',productController.getAllProducts);
router.delete('/:id',decryptMiddleware,encryptResponse, productController.deleteProduct);

module.exports = router;
