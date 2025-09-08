const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
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

// Public routes without auth or encryption
router.post("/create-order", authenticate, authorizeRoles('admin', 'super-admin', 'customer', 'D-partner'), ...withEncryption(orderController.createOrder));
router.post("/confirm-order", authenticate, authorizeRoles('admin', 'super-admin', 'customer', 'D-partner'), ...withEncryption(orderController.confirmOrder));

// Protected routes with conditional encryption and authentication

router.get(
  "/get-all-order",
  authenticate,
  authorizeRoles("admin", 'D-partner'),
  ...withEncryption(orderController.getAllOrders)
);

router.get(
  "/get-useridby-order",
  authenticate,
  authorizeRoles('admin', 'super-admin', 'customer', 'D-partner'),
  ...withEncryption(orderController.getUserIdByOrder)
);
router.get(
  "/order-analytics",
  authenticate,
  authorizeRoles('admin', 'super-admin', 'D-partner'),
  ...withEncryption(orderController.getOrderAnalytics)
);

router.put(
  "/admin-update-order/:orderId",
  authenticate,
  authorizeRoles("admin", 'D-partner'),
  ...withEncryption(orderController.updateOrder)
);

router.put(
  "/client-update-order/:orderId",
  authenticate,
  authorizeRoles('admin', 'super-admin', 'D-partner'),
  ...withEncryption(orderController.clientUpdateOrderIssue)
);

module.exports = router;
