const bcrypt = require("bcrypt");

exports.hashPassword = async (password) => {
  return await bcrypt.hash(password, 10);
};

exports.comparePassword = async (plain, hashed) => {
  return await bcrypt.compare(plain, hashed);
};
