const db = require("../db");

exports.getAllUsers = async (req, res) => {
  try {
    const [users] = await db.query("SELECT id, username, email, role FROM users");
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Error", error: err });
  }
};
