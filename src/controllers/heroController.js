const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');
const sharp = require('sharp');
const multer = require('multer');
const db = require('../db');

const uploadPath = path.join(__dirname, '../../uploads/hero');

// Ensure folder exists at startup
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

// Get next available number for hero image
const getNextHeroNumber = () => {
  const files = fs.readdirSync(uploadPath)
    .filter(file => file.startsWith("hero") && /\.(jpg|jpeg|png|webp)$/i.test(file));

  const numbers = files.map(file => {
    const match = file.match(/hero(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  });

  return (Math.max(...numbers, 0) + 1);
};

// Use memory storage for multer
const storage = multer.memoryStorage();
exports.upload = multer({ storage });

// Upload hero image with optimization
exports.uploadHeroImage = async (req, res) => {
  const file = req.file;
  const url = req.body.url || null;
  const size = req.body.size || null;
  if (!file) return res.status(400).json({ message: 'No file uploaded' });

  try {
    const ext = path.extname(file.originalname).toLowerCase();
    const nextNumber = getNextHeroNumber();

    // Determine format and filename
    const mime = file.mimetype.toLowerCase();
    let format = 'jpeg';
    let filename = `hero${nextNumber}.jpg`;

    if (mime.includes('png')) {
      format = 'png';
      filename = `hero${nextNumber}.png`;
    } else if (mime.includes('webp')) {
      format = 'webp';
      filename = `hero${nextNumber}.webp`;
    } else if (mime.includes('jpeg') || mime.includes('jpg')) {
      format = 'jpeg';
      filename = `hero${nextNumber}.jpg`;
    }

    const fullPath = path.join(uploadPath, filename);

    // Ensure upload path exists
    await fsPromises.mkdir(uploadPath, { recursive: true });

    // Optimize image using sharp
    let transformer = sharp(file.buffer).resize({ width: 1280 });

    if (format === 'jpeg') transformer = transformer.jpeg({ quality: 80 });
    else if (format === 'png') transformer = transformer.png({ compressionLevel: 8 });
    else if (format === 'webp') transformer = transformer.webp({ quality: 80 });

    await transformer.toFile(fullPath);

    // Save filename to DB
    const sql = 'INSERT INTO hero_images (filename,url,size) VALUES (?, ?,?)';
   await db.execute(sql, [filename, url,size]);

    res.json({ message: 'Upload successful', filename, url,size });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error saving optimized image' });
  }
};

// Delete hero image
exports.deleteHeroImage = async (req, res) => {
  const { filename } = req.params;
  if (!filename) return res.status(400).json({ message: 'Filename is required' });

  try {
    const filePath = path.join(uploadPath, filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    } else {
      return res.status(404).json({ message: 'File not found on server' });
    }

    const sql = 'DELETE FROM hero_images WHERE filename = ?';
    const [result] = await db.execute(sql, [filename]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'File record not found in database' });
    }

    res.json({ message: 'File deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error while deleting file' });
  }
};

// Fetch all hero images
exports.getAllHeroImages = async (req, res) => {
  try {
    const sql = 'SELECT * FROM hero_images ORDER BY id DESC';
    const [rows] = await db.execute(sql);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error fetching hero images' });
  }
};
exports.updateHeroImage = async (req, res) => {
  const { id } = req.params;        // The hero image DB record id to update
  const url = req.body.url || null; // New URL (optional)
  const file = req.file;            // New uploaded image file (optional)
const size = req.body.size || null;
  try {
    // Fetch existing record to get old filename
    const [rows] = await db.execute('SELECT filename FROM hero_images WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Hero image not found' });
    }
    const oldFilename = rows[0].filename;

    let filename = oldFilename;

    if (file) {
      // If new file uploaded, delete old image file
      const oldFilePath = path.join(uploadPath, oldFilename);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }

      // Determine new filename and format
      const mime = file.mimetype.toLowerCase();
      let format = 'jpeg';

      if (mime.includes('png')) {
        format = 'png';
        filename = `hero${id}.png`;
      } else if (mime.includes('webp')) {
        format = 'webp';
        filename = `hero${id}.webp`;
      } else if (mime.includes('jpeg') || mime.includes('jpg')) {
        format = 'jpeg';
        filename = `hero${id}.jpg`;
      } else {
        // Default fallback
        filename = `hero${id}.jpg`;
      }

      const fullPath = path.join(uploadPath, filename);
      await fsPromises.mkdir(uploadPath, { recursive: true });

      // Optimize and save new image
      let transformer = sharp(file.buffer).resize({ width: 1280 });
      if (format === 'jpeg') transformer = transformer.jpeg({ quality: 80 });
      else if (format === 'png') transformer = transformer.png({ compressionLevel: 8 });
      else if (format === 'webp') transformer = transformer.webp({ quality: 80 });

      await transformer.toFile(fullPath);
    }

    // Update DB record with new filename (if changed) and new URL
    const sql = 'UPDATE hero_images SET filename = ?, url = ?, size=? WHERE id = ?';
    await db.execute(sql, [filename, url,size, id]);

    res.json({ message: 'Hero image updated successfully', filename, url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error updating hero image' });
  }
};
