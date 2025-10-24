const express = require("express");
const router = express.Router();
const barcodeTrackingController = require("../controllers/barcodeTrackingController");

// ✅ Route to track barcode
router.get("/track/:userId/:product_code", barcodeTrackingController.trackByBarcode);
router.get("/:id", barcodeTrackingController.updateDeliveryPartner);

module.exports = router;
