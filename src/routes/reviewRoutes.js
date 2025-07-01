const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { authenticate } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");
const {
  decryptMiddleware,
  wrapEncryptedHandler,
} = require("../middleware/encryption");

const isEncryptionEnabled = process.env.ENCRYPTION_ENABLED === "true";

const withEncryption = (handler) =>
  isEncryptionEnabled
    ? [decryptMiddleware, wrapEncryptedHandler(handler)]
    : [handler];

// 🟢 Public GET (optional auth — add if needed)
router.get(
  '/',
  authenticate, // optional: remove if public
  authorizeRoles('admin', 'super-admin','customer'), // or allow user, adjust as needed
  ...withEncryption(reviewController.getAllReviews)
);

router.get(
  '/product_review/:productId',
  authenticate, // optional: remove if public
  authorizeRoles('admin', 'super-admin','customer'), // or allow user/customer
  ...withEncryption(reviewController.getReviewsByProductId)
);

// 🔒 Protected POST/DELETE (users typically create reviews)
router.post(
  '/',
  authenticate,
  authorizeRoles('admin', 'super-admin','customer'), // allow users and admins
  ...withEncryption(reviewController.createReview)
);

router.delete(
  '/:id',
  authenticate,
  authorizeRoles("admin"), // usually only admins delete
  ...withEncryption(reviewController.deleteReview)
);

module.exports = router;
