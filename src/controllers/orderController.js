// controllers/orderController.js
const db = require("../db");
const crypto = require("crypto");
require("dotenv").config();
const Razorpay = require("razorpay");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// CREATE Razorpay Order and Save Temp Order with failed status
exports.createOrder = async (req, res) => {
  const {
    customer,
    cartItems,
    subtotal,
    shipping,
    tax,
    total
  } = req.body;

  try {
    const razorOrder = await razorpay.orders.create({
      amount: total * 100, // in paise
      currency: "INR",
      receipt: "receipt_order_" + Date.now(),
    });

    // Save to DB with default razor_payment = 'failed'
    await db.query(`
      INSERT INTO full_orders (
        customer_id, customer_name, customer_email, customer_phone, customer_address,
        subtotal, shipping, tax, total,
        razorpay_order_id,
        cart_items,
        razor_payment
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customer.id,
        customer.name,
        customer.email,
        customer.phone,
        customer.address,
        subtotal,
        shipping,
        tax,
        total,
        razorOrder.id,
        JSON.stringify(cartItems),
        "failed"
      ]
    );

    res.json(razorOrder);
  } catch (err) {
    console.error("Create Order Error:", err);
    res.status(500).json({ error: "Failed to create order" });
  }
};

// CONFIRM Order After Payment
exports.confirmOrder = async (req, res) => {
  const {
    paymentDetails
  } = req.body;

  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature
  } = paymentDetails;

  try {
    // Signature verify
    const hmac = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (hmac !== razorpay_signature) {
      // Payment invalid, delete that order
      await db.query("DELETE FROM full_orders WHERE razorpay_order_id = ?", [razorpay_order_id]);
      return res.status(400).json({ error: "Invalid payment signature. Order deleted." });
    }

    // Update that order to razor_payment = done + save payment details
    await db.query(`
      UPDATE full_orders
      SET razorpay_payment_id = ?, razorpay_signature = ?, razor_payment = 'done'
      WHERE razorpay_order_id = ?`,
      [razorpay_payment_id, razorpay_signature, razorpay_order_id]
    );

    res.json({ message: "Order confirmed and payment successful." });
  } catch (err) {
    console.error("Confirm Order Error:", err);
    res.status(500).json({ error: "Failed to confirm order" });
  }
};


// Update Order
exports.updateOrder = async (req, res) => {
  const { orderId } = req.params;
  const {
    order_status,
    deliveryman_name,
    deliveryman_phone,
    issue_type,
    issue_product_code,
    issue_description,
  } = req.body;

  try {
    await db.query(
      `UPDATE full_orders
       SET order_status = ?, deliveryman_name = ?, deliveryman_phone = ?, issue_type = ?, issue_product_code = ?, issue_description = ?
       WHERE id = ?`,
      [
        order_status,
        deliveryman_name,
        deliveryman_phone,
        issue_type,
        issue_product_code,
        issue_description,
        orderId,
      ]
    );

    res.json({ message: "Order updated successfully" });
  } catch (error) {
    console.error("Update Order Error:", error);
    res.status(500).json({ error: "Failed to update order" });
  }
};
