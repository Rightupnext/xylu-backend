import pool from "../db.js";

// Get all users with optional role filter and search
export const getUsers = async (req, res) => {
  try {
    const { role, search } = req.query;
    let sql = `SELECT id, username, email, phone, role FROM users WHERE 1=1`;
    const params = [];

    if (role) {
      sql += ` AND role = ?`;
      params.push(role);
    }

    if (search) {
      sql += ` AND (username LIKE ? OR email LIKE ? OR phone LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ` ORDER BY id DESC`;

    const [users] = await pool.query(sql, params);
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
};

// Update user role
export const updateUserRole = async (req, res) => {
  try {
    const { userId, role } = req.body;

    if (!userId || !role) return res.status(400).json({ error: "Invalid data" });

    await pool.query(`UPDATE users SET role = ? WHERE id = ?`, [role, userId]);
    res.json({ success: true, userId, role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update user role" });
  }
};
