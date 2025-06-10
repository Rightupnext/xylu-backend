const { decrypt, encrypt } = require("../utils/crypto");

// Decrypt incoming request body
exports.decryptMiddleware = (req, res, next) => {
  if (req.body && req.body.encryptedData) {
    try {
      req.body = decrypt(req.body.encryptedData);
    } catch (err) {
      return res.status(400).json({ message: "Invalid encrypted payload" });
    }
  }
  next();
};

// Encrypt outgoing response
exports.encryptResponse = (req, res, next) => {
  const originalJson = res.json;

  res.json = function (data) {
    const encrypted = encrypt(data);
    return originalJson.call(this, { encryptedData: encrypted });
  };

  next();
};
