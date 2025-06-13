const multer = require("multer");
const path = require("path");
const sharp = require("sharp");
const fs = require("fs");

// Use memory storage so sharp can process buffer directly
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  fileFilter(req, file, cb) {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed!"), false);
    }
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // Max file size: 5MB
});

// Map MIME types to file extensions
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
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    let sharpInstance = sharp(req.file.buffer).resize({
      width: 800,
      fit: "inside",
    });

    let buffer;

    switch (ext) {
      case "jpg":
      case "jpeg":
        buffer = await sharpInstance
          .jpeg({
            quality: 60,       // Aggressive compression
            mozjpeg: true,     // Use MozJPEG
            chromaSubsampling: "4:4:4",
          })
          .toBuffer();
        break;
      case "png":
        buffer = await sharpInstance
          .png({
            compressionLevel: 9,
            palette: true,
          })
          .toBuffer();
        break;
      case "webp":
        buffer = await sharpInstance
          .webp({
            quality: 60,
          })
          .toBuffer();
        break;
      case "tiff":
        buffer = await sharpInstance.tiff({ quality: 60 }).toBuffer();
        break;
      case "bmp":
        buffer = await sharpInstance.bmp().toBuffer();
        break;
      case "gif":
        // For GIFs, just save original buffer directly
        fs.writeFileSync(outputPath, req.file.buffer);
        req.imageFilename = `products/${filename}`;
        const gifStats = fs.statSync(outputPath);
        req.imageSizeKB = (gifStats.size / 1024).toFixed(2);
        return next();
    }

    // Write buffer to file
    fs.writeFileSync(outputPath, buffer);

    // Attach processed image info
    req.imageFilename = `products/${filename}`;
    req.imageSizeKB = (buffer.length / 1024).toFixed(2);

    next();
  } catch (err) {
    console.error("❌ Image processing failed:", err.message);
    next(err);
  }
};

module.exports = { upload, processImage };
