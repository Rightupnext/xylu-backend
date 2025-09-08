const express = require("express");
const router = express.Router();
const deliveryPartnerController = require("../controllers/deliveryPartnerController");
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
// Routes
router.post("/", authenticate,
    authorizeRoles('admin', 'super-admin', 'customer','D-partner'),
    ...withEncryption(deliveryPartnerController.createDeliveryPartner));
router.get("/", authenticate,
    authorizeRoles('admin', 'super-admin', 'customer','D-partner'),
    ...withEncryption(deliveryPartnerController.getAllDeliveryPartners));
router.put("/:id", authenticate,
    authorizeRoles('admin', 'super-admin', 'customer','D-partner'),
    ...withEncryption(deliveryPartnerController.updateDeliveryPartner));
router.delete("/:id", authenticate,
    authorizeRoles('admin', 'super-admin', 'customer','D-partner'),
    ...withEncryption(deliveryPartnerController.deleteDeliveryPartner));

module.exports = router;
