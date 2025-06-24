const bcrypt = require("bcrypt");

exports.hashPassword = async (password) => {
  if (!password) {
    throw new Error('Password is required for hashing');
  }
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
};

exports.comparePassword = async (plain, hashed) => {
  return await bcrypt.compare(plain, hashed);
};
