const db = require("../db");
const crypto = require("crypto");
require("dotenv").config();

const Razorpay = require("razorpay");

// Initialize Razorpay instance with credentials from .env
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

exports.createOrder = async (req, res) => {
  const { amount } = req.body;

  try {
    const options = {
      amount: amount, // amount in paise
      currency: "INR",
      receipt: "receipt_order_" + Date.now(),
    };

    const order = await razorpay.orders.create(options);
    res.json(order);
  } catch (error) {
    console.error("Create Order Error:", error);
    res.status(500).json({ error: "Failed to create Razorpay order" });
  }
};

exports.confirmOrder = async (req, res) => {
  const {
    customer,
    cartItems,
    subtotal,
    shipping,
    tax,
    total,
    paymentDetails,
  } = req.body;

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
    paymentDetails;

  try {
    // Signature verification using Razorpay secret from .env
    const hmac = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (hmac !== razorpay_signature) {
      return res.status(400).json({ error: "Invalid payment signature" });
    }

    // Save order to full_orders table
    for (let item of cartItems) {
      await db.query(
        `INSERT INTO full_orders (
          customer_name, customer_email, customer_phone, customer_address,
          subtotal, shipping, tax, total,
          razorpay_payment_id, razorpay_order_id, razorpay_signature,
          product_id, product_name, price, quantity, color, size
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          customer.name,
          customer.email,
          customer.phone,
          customer.address,
          subtotal,
          shipping,
          tax,
          total,
          razorpay_payment_id,
          razorpay_order_id,
          razorpay_signature,
          item.id,
          item.product_name,
          item.price,
          item.quantity,
          item.selectedColor,
          item.selectedSize,
        ]
      );
    }

    res.json({ message: "Order placed successfully" });
  } catch (error) {
    console.error("Confirm Order Error:", error);
    res.status(500).json({ error: "Failed to confirm and save order" });
  }
};
