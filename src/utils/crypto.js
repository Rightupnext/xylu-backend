const CryptoJS = require("crypto-js");

const SECRET_KEY = process.env.SECRET_KEY; 

exports.encrypt = (data) => {
  const ciphertext = CryptoJS.AES.encrypt(JSON.stringify(data), SECRET_KEY).toString();
  return ciphertext;
};

exports.decrypt = (ciphertext) => {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);

    if (!decrypted) {
      throw new Error('Decryption failed or SECRET_KEY mismatch.');
    }

    return JSON.parse(decrypted);
  } catch (err) {
    console.error('❌ Invalid encrypted payload:', err.message);
    throw new Error('Invalid encrypted payload');
  }
};
