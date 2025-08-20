const fs = require("fs");
const path = require("path");
const db = require("../db");

const parseActive = (active) => {
  if (active === undefined || active === null) return 1; // default = 1
  if (active === true || active === "true" || active === 1 || active === "1") return 1;
  return 0;
};


// ✅ safer date formatter (accepts YYYY-MM-DD or ISO)
const formatDateTime = (dateStr) => {
  if (!dateStr) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return `${dateStr} 00:00:00`;
  }
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return d.toISOString().slice(0, 19).replace("T", " ");
};

exports.giftThresholdController = {
  // 🔹 Get latest gift threshold
  get: async (req, res) => {
    try {
      const [rows] = await db.execute(
        `SELECT * FROM GiftThreshold ORDER BY id DESC LIMIT 1`
      );
      if (rows.length === 0) {
        return res.status(404).json({ message: "No gift threshold found" });
      }
      res.json(rows[0]);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  },

  // 🔹 Create or update gift threshold
  createOrUpdate: async (req, res) => {
    try {
      let { title, description, threshold_amount, start_date, end_date, active } =
        req.body;

      threshold_amount = threshold_amount ? Number(threshold_amount) : 0;

      // ✅ If new file uploaded → save relative path
      const newImageUrl = req.file ? `/uploads/gifts/${req.file.filename}` : null;

      const startDate = formatDateTime(start_date);
      const endDate = formatDateTime(end_date);
      const isActive = parseActive(active);

      // 🔹 check if record exists
      const [existingRows] = await db.execute(
        `SELECT * FROM GiftThreshold ORDER BY id DESC LIMIT 1`
      );

      if (existingRows.length === 0) {
        // 👉 On INSERT → image IS required
        if (!newImageUrl) {
          return res.status(400).json({ message: "Gift image is required" });
        }

        const sql = `INSERT INTO GiftThreshold 
          (title, description, image_url, threshold_amount, start_date, end_date, active)
          VALUES (?, ?, ?, ?, ?, ?, ?)`;
        const [result] = await db.execute(sql, [
          title || "",
          description || "",
          newImageUrl,
          threshold_amount,
          startDate,
          endDate,
          isActive,
        ]);
        return res.status(201).json({
          message: "Gift threshold created successfully",
          giftId: result.insertId,
          image_url: newImageUrl,
        });
      } else {
        // 👉 On UPDATE → image is optional
        const existingId = existingRows[0].id;
        const oldImage = existingRows[0].image_url;

        let finalImageUrl = oldImage; // keep old if no new image
        if (newImageUrl) {
          finalImageUrl = newImageUrl;

          // delete old image if exists
          if (oldImage && oldImage !== newImageUrl) {
            const oldImagePath = path.join(
              __dirname,
              "..",
              "..",
              oldImage.replace(/^[/\\]+/, "")
            );
            fs.unlink(oldImagePath, (err) => {
              if (err) {
                console.warn("⚠️ Could not delete old image:", oldImagePath, err.message);
              } else {
                console.log("🗑️ Old image deleted:", oldImagePath);
              }
            });
          }
        }

        const sql = `UPDATE GiftThreshold 
          SET title=?, description=?, image_url=?, threshold_amount=?, start_date=?, end_date=?, active=? 
          WHERE id=?`;
        await db.execute(sql, [
          title || "",
          description || "",
          finalImageUrl,
          threshold_amount,
          startDate,
          endDate,
          isActive,
          existingId,
        ]);

        return res.status(200).json({
          message: "Gift threshold updated successfully",
          giftId: existingId,
          image_url: finalImageUrl,
        });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  },
};
