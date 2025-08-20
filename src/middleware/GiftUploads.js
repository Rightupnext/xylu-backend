const multer = require("multer");
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");

// Store files in memory before processing
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed!"), false);
  }
};

const upload = multer({ storage, fileFilter });

const optimizeGiftImage = async (req, res, next) => {
  if (!req.file) return next();

  try {
    // ✅ save inside ../../uploads/gifts
    const folderPath = path.join(__dirname, "../../uploads/gifts");

    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    const filename = `gift-${Date.now()}${ext}`;
    const filepath = path.join(folderPath, filename);

    const image = sharp(req.file.buffer);
    const metadata = await image.metadata();

    if (metadata.format === "jpeg" || metadata.format === "jpg") {
      await image.jpeg({ quality: 80 }).toFile(filepath);
    } else if (metadata.format === "png") {
      await image.png({ compressionLevel: 9 }).toFile(filepath);
    } else if (metadata.format === "webp") {
      await image.webp({ quality: 80 }).toFile(filepath);
    } else {
      await image.toFile(filepath);
    }

    // ✅ set filename and public URL for controller
    req.file.filename = filename;
    req.file.path = filepath;
    req.file.url = `/uploads/gifts/${filename}`; // <-- only relative path saved

    next();
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ message: "Image processing failed", error: err.message });
  }
};

module.exports = { upload, optimizeGiftImage };
