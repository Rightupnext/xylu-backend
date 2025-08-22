const jwt = require("jsonwebtoken");
const secret = process.env.JWT_SECRET;

exports.generateToken = (user) => {
  return jwt.sign(
    { id: user.id, role: user.role, username: user.username,email:user.email,phone:user.phone },
    secret,
    { expiresIn: "1d" }
  );
};

exports.verifyToken = (token) => {
  return jwt.verify(token, secret);
};
