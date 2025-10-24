const fs = require("fs");
const path = require("path");
const db = require("../db");

const parseActive = (active) => {
  if (active === undefined || active === null) return 1; // default = 1
  if (active === true || active === "true" || active === 1 || active === "1")
    return 1;
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
      let {
        title,
        description,
        threshold_amount,
        start_date,
        end_date,
        active,
        inactive_reason,
      } = req.body;

      threshold_amount = threshold_amount ? Number(threshold_amount) : 0;

      // ✅ If new file uploaded → save relative path
      const newImageUrl = req.file
        ? `/uploads/gifts/${req.file.filename}`
        : null;

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
          (title, description, image_url, threshold_amount, start_date, end_date, active, inactive_reason)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
        const [result] = await db.execute(sql, [
          title || "",
          description || "",
          newImageUrl,
          threshold_amount,
          startDate,
          endDate,
          isActive,
          inactive_reason || "",
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
                console.warn(
                  "⚠️ Could not delete old image:",
                  oldImagePath,
                  err.message
                );
              } else {
                console.log("🗑️ Old image deleted:", oldImagePath);
              }
            });
          }
        }

        const sql = `UPDATE GiftThreshold 
  SET title=?, description=?, image_url=?, threshold_amount=?, start_date=?, end_date=?, active=?, inactive_reason=? 
  WHERE id=?`;

        await db.execute(sql, [
          title || "",
          description || "",
          finalImageUrl,
          threshold_amount,
          startDate,
          endDate,
          isActive,
          inactive_reason || "",
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
exports.checkUserGiftThreshold = async (req, res) => {
  const { userId } = req.params;

  try {
    if (!userId || isNaN(Number(userId))) {
    return res.status(400).json({ error: "Invalid or missing userId" });
  }
    const [thresholds] = await db.query(`SELECT * FROM GiftThreshold`);
    const now = new Date();

    let progress = [];

    for (let threshold of thresholds) {
      const startDate = new Date(threshold.start_date);
      const endDate = new Date(threshold.end_date);

      // 1️⃣ Offer not started yet
      if (now < startDate) {
        progress.push({
          threshold_id: threshold.id,
          title: threshold.title,
          description: threshold.description,
          image_url: threshold.image_url,
          required: threshold.threshold_amount,
          spent: 0,
          eligible: false,
          start_date: threshold.start_date,
          end_date: threshold.end_date,
          status: "not_started",
        });
        // ✅ Do NOT delete/reset table yet for future active offers
        continue;
      }

      // 2️⃣ Offer expired
      if (now > endDate) {
        await db.query(
          `DELETE FROM CustomerGiftHistory WHERE user_id=? AND gift_threshold_id=?`,
          [userId, threshold.id]
        );
        continue;
      }

      // 3️⃣ Offer paused (active = 0, start date reached)
      if (threshold.active === 0 && now >= startDate) {
        const [history] = await db.query(
          `SELECT * FROM CustomerGiftHistory WHERE user_id=? AND gift_threshold_id=?`,
          [userId, threshold.id]
        );

        const spent = history.length ? history[0].cumulative_purchase : 0;

        progress.push({
          threshold_id: threshold.id,
          title: threshold.title,
          description: threshold.description,
          image_url: threshold.image_url,
          required: threshold.threshold_amount,
          spent,
          eligible: history.length ? history[0].eligible : false,
          start_date: threshold.start_date,
          end_date: threshold.end_date,
          status: "paused",
          inactive_reason: threshold.inactive_reason || "",
        });
        continue;
      }

      // 4️⃣ Active offer (active=1, start date reached)
      const [totalRow] = await db.query(
        `SELECT COALESCE(SUM(total),0) AS total_spent
         FROM full_orders 
         WHERE customer_id=? AND razor_payment='done' AND created_at BETWEEN ? AND ?`,
        [userId, threshold.start_date, threshold.end_date]
      );

      const totalSpent = parseFloat(totalRow[0].total_spent);

      const [history] = await db.query(
        `SELECT * FROM CustomerGiftHistory WHERE user_id=? AND gift_threshold_id=?`,
        [userId, threshold.id]
      );

      if (totalSpent >= threshold.threshold_amount) {
        if (history.length === 0) {
          await db.query(
            `INSERT INTO CustomerGiftHistory 
             (user_id, gift_threshold_id, cumulative_purchase, eligible, reached_at)
             VALUES (?,?,?,?,NOW())`,
            [userId, threshold.id, totalSpent, true]
          );
        } else if (!history[0].eligible) {
          await db.query(
            `UPDATE CustomerGiftHistory SET cumulative_purchase=?, eligible=1, reached_at=NOW() WHERE id=?`,
            [totalSpent, history[0].id]
          );
        }
      } else {
        if (history.length === 0) {
          await db.query(
            `INSERT INTO CustomerGiftHistory 
             (user_id, gift_threshold_id, cumulative_purchase, eligible)
             VALUES (?,?,?,0)`,
            [userId, threshold.id, totalSpent]
          );
        } else {
          await db.query(
            `UPDATE CustomerGiftHistory SET cumulative_purchase=?, eligible=0 WHERE id=?`,
            [totalSpent, history[0].id]
          );
        }
      }

      progress.push({
        threshold_id: threshold.id,
        title: threshold.title,
        description: threshold.description,
        image_url: threshold.image_url,
        required: threshold.threshold_amount,
        spent: totalSpent,
        eligible: totalSpent >= threshold.threshold_amount,
        start_date: threshold.start_date,
        end_date: threshold.end_date,
        status: "active",
      });
    }

    res.json({
      success: true,
      message: "User threshold check completed successfully.",
      progress,
    });
  } catch (err) {
    console.error("❌ Error in checkUserGiftThreshold:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// Get all users who have any gift history
exports.getAllUsersGiftProgress = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        u.id AS user_id,
        u.username,
        u.email,
        u.phone,
        COALESCE(SUM(h.cumulative_purchase), 0) AS total_spent,
        GROUP_CONCAT(
          CASE WHEN h.eligible = 1 THEN gt.title ELSE NULL END
        ) AS unlocked_gifts
      FROM CustomerGiftHistory h
      INNER JOIN users u ON u.id = h.user_id
      LEFT JOIN GiftThreshold gt ON gt.id = h.gift_threshold_id
      GROUP BY u.id, u.username, u.email, u.phone
      ORDER BY total_spent DESC
    `);

    res.json({
      success: true,
      users: rows,
    });
  } catch (err) {
    console.error("❌ Error in getAllUsersGiftProgress:", err);
    res.status(500).json({ error: "Server error" });
  }
};
exports.deleteGiftThreshold = async (req, res) => {
  const { id } = req.params;

  try {
    if (!id || isNaN(Number(id))) {
      return res.status(400).json({ message: "Invalid or missing ID" });
    }

    // 1️⃣ Check if the gift threshold exists
    const [rows] = await db.query(
      `SELECT image_url FROM GiftThreshold WHERE id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Gift threshold not found" });
    }

    const imageUrl = rows[0].image_url;

    // 2️⃣ Delete the image from the server (if exists)
    if (imageUrl) {
      const imagePath = path.join(
        __dirname,
        "..",
        "..",
        imageUrl.replace(/^[/\\]+/, "")
      );

      if (fs.existsSync(imagePath)) {
        fs.unlink(imagePath, (err) => {
          if (err) {
            console.warn("⚠️ Failed to delete gift image:", imagePath, err.message);
          } else {
            console.log("🗑️ Deleted gift image:", imagePath);
          }
        });
      } else {
        console.log("⚠️ Image file not found:", imagePath);
      }
    }

    // 3️⃣ Delete related customer gift history (if any)
    await db.query(
      `DELETE FROM CustomerGiftHistory WHERE gift_threshold_id = ?`,
      [id]
    );

    // 4️⃣ Delete the gift threshold record
    await db.query(`DELETE FROM GiftThreshold WHERE id = ?`, [id]);

    res.json({
      success: true,
      message: "✅ Gift threshold and related data deleted successfully",
    });
  } catch (error) {
    console.error("❌ Error deleting gift threshold:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
};