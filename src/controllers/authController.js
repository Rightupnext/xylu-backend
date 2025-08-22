const db = require("../db");
const { hashPassword, comparePassword } = require("../utils/password");
const { generateToken } = require("../utils/jwt");

exports.register = async (req, res) => {
  const { name, email, password, confirmPassword, role, phone } = req.body;
  const username = name;

  if (!username || !email || !password || !confirmPassword || !phone) {
    return res.status(400).json({ message: "All fields are required" });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ message: "Passwords do not match" });
  }

  try {
    const [existing] = await db.query("SELECT id FROM users WHERE email = ?", [
      email,
    ]);
    if (existing.length > 0) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const hashed = await hashPassword(password);

    await db.query(
      "INSERT INTO users (username, email, password, phone, role) VALUES (?, ?, ?, ?, ?)",
      [username, email, hashed, phone, role || "customer"]
    );

    res.status(201).json({ message: "Registered successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error", error: err });
  }
};


exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const [userRows] = await db.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);
    const user = userRows[0];
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const match = await comparePassword(password, user.password);
    if (!match) return res.status(401).json({ message: "Invalid credentials" });

    const token = generateToken(user);
    res.json({
      message: "Login Successfull",
      token,
      user: { id: user.id, username: user.username, role: user.role,email:user.email,phone:user.phone },
    });
  } catch (err) {
    res.status(500).json({ message: "Error", error: err });
  }
};
