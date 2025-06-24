const { decrypt, encrypt } = require("../utils/crypto");

// ✅ Middleware to decrypt incoming request body
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

// ✅ Middleware to encrypt response data
exports.encryptResponse = (req, res, next) => {
  const originalJson = res.json;
  res.json = function (data) {
    const encrypted = encrypt(data);
    return originalJson.call(this, { encryptedData: encrypted });
  };
  next();
};

// ✅ Utility function to directly encrypt data (used in wrappers)
const encryptResponseData = (data) => encrypt(data);
exports.encryptResponseData = encryptResponseData;

// ✅ Wrapper for route handlers to encrypt response
exports.wrapEncryptedHandler = (handler) => {
  return async (req, res, next) => {
    try {
      const originalJson = res.json.bind(res);
      res.json = (data) => {
        const encrypted = encryptResponseData(data);
        return originalJson({ encryptedData: encrypted });
      };

      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
};
