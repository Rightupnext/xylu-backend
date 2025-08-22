// routes/giftRoutes.js
const express = require("express");
const router = express.Router();
const giftController = require("../controllers/giftController");
const {upload,optimizeGiftImage} = require("../middleware/GiftUploads");

// GET current gift threshold
router.get("/", giftController.giftThresholdController.get);

// CREATE or UPDATE gift threshold
router.post("/",   upload.single("image"),
  optimizeGiftImage, giftController.giftThresholdController.createOrUpdate);
router.get("/check/:userId", giftController.checkUserGiftThreshold);

// Get all users progress
router.get("/progress", giftController.getAllUsersGiftProgress);
module.exports = router;
