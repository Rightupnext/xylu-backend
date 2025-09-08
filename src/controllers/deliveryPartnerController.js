const pool = require("../db");

// ✅ Create Delivery Partner (user_id auto from logged-in user)
exports.createDeliveryPartner = async (req, res) => {
  try {
    const { d_partner_name, email, phone, address, district, zone } = req.body;

    // user_id comes from auth middleware (req.user)
    const userId = req.user?.id;  

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized: user not logged in" });
    }

    const [result] = await pool.query(
      `INSERT INTO delivery_partners 
        (d_partner_name, email, phone, address, district, zone, user_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [d_partner_name, email, phone, address, district, zone, userId]
    );

    res.status(201).json({ message: "Delivery Partner created", id: result.insertId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create delivery partner" });
  }
};

// ✅ Get All Delivery Partners
exports.getAllDeliveryPartners = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT dp.*, u.username, u.role 
       FROM delivery_partners dp
       JOIN users u ON dp.user_id = u.id`
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch delivery partners" });
  }
};

// ✅ Update Delivery Partner by ID
exports.updateDeliveryPartner = async (req, res) => {
  try {
    const { id } = req.params;
    const { d_partner_name, email, phone, address, district, zone } = req.body;

    const [result] = await pool.query(
      `UPDATE delivery_partners 
       SET d_partner_name=?, email=?, phone=?, address=?, district=?, zone=?, updated_at=NOW() 
       WHERE id=?`,
      [d_partner_name, email, phone, address, district, zone, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Delivery Partner not found" });
    }

    res.json({ message: "Delivery Partner updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update delivery partner" });
  }
};

// ✅ Delete Delivery Partner by ID
exports.deleteDeliveryPartner = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.query("DELETE FROM delivery_partners WHERE id=?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Delivery Partner not found" });
    }

    res.json({ message: "Delivery Partner deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete delivery partner" });
  }
};
