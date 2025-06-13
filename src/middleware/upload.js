// middleware/upload.js
const multer = require("multer");
const path = require("path");
const sharp = require("sharp");
const fs = require("fs");

// Use memory storage for processing with sharp
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  fileFilter(req, file, cb) {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed!"), false);
    }
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // Max 5MB
});

const mimeToExtension = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/tiff": "tiff",
  "image/bmp": "bmp",
};

const processImage = async (req, res, next) => {
  if (!req.file) return next();

  const ext = mimeToExtension[req.file.mimetype];
  if (!ext) return next(new Error("Unsupported image format"));

  const filename = `product_${Date.now()}.${ext}`;
  const outputDir = path.join(__dirname, "../../uploads/products");
  const outputPath = path.join(outputDir, filename);

  try {
    // Ensure directory exists
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    let sharpInstance = sharp(req.file.buffer).resize({ width: 800, fit: "inside" });

    switch (ext) {
      case "jpg":
      case "jpeg":
        sharpInstance = sharpInstance.jpeg({ quality: 70 });
        break;
      case "png":
        sharpInstance = sharpInstance.png({ compressionLevel: 9 });
        break;
      case "webp":
        sharpInstance = sharpInstance.webp({ quality: 70 });
        break;
      case "tiff":
        sharpInstance = sharpInstance.tiff({ quality: 70 });
        break;
      case "bmp":
        sharpInstance = sharpInstance.bmp();
        break;
      case "gif":
        fs.writeFileSync(outputPath, req.file.buffer);
        req.imageFilename = `products/${filename}`;
        return next();
    }

    await sharpInstance.toFile(outputPath);
    req.imageFilename = `products/${filename}`;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { upload, processImage };
