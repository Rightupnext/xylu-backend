// controllers/orderController.js
const db = require("../db");
const crypto = require("crypto");
require("dotenv").config();
const Razorpay = require("razorpay");
const { generateBarcodeForOrder } = require('./barcodeController');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// CREATE Razorpay Order and Save Temp Order with failed status
exports.createOrder = async (req, res) => {
  const { customer, cartItems, subtotal, shipping, tax, total } = req.body;

  try {
    const razorOrder = await razorpay.orders.create({
      amount: total * 100, // in paise
      currency: "INR",
      receipt: "receipt_order_" + Date.now(),
    });

    // Save to DB with default razor_payment = 'failed'
    await db.query(
      `
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
        "failed",
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
  const { paymentDetails } = req.body;
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
    paymentDetails;

  try {
    // Step 1: Verify Razorpay signature
    const hmac = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (hmac !== razorpay_signature) {
      // Invalid signature - delete the order
      await db.query("DELETE FROM full_orders WHERE razorpay_order_id = ?", [
        razorpay_order_id,
      ]);
      return res
        .status(400)
        .json({ error: "Invalid payment signature. Order deleted." });
    }

    // Step 2: Generate 4-digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    // Step 3: Update the order with payment details and OTP
    await db.query(
      `UPDATE full_orders
       SET razorpay_payment_id = ?, 
           razorpay_signature = ?, 
           razor_payment = 'done',
           otp = ?
       WHERE razorpay_order_id = ?`,
      [razorpay_payment_id, razorpay_signature, otp, razorpay_order_id]
    );

    // Step 4: Fetch order
    const [rows] = await db.query(
      `SELECT * FROM full_orders WHERE razorpay_order_id = ?`,
      [razorpay_order_id]
    );

    if (rows.length > 0) {
      const order = rows[0];

      // Generate barcodes and get array of objects
      const barcodes = await generateBarcodeForOrder(order);

      // Extract product codes for JSON column
      const barcodeCodes = barcodes.map(b => b.barcode_text);

      // Update full_orders.Barcode JSON column
      await db.query(
        `UPDATE full_orders SET Barcode = ? WHERE id = ?`,
        [JSON.stringify(barcodeCodes), order.id]
      );
    }

    res.json({
      message: "Order confirmed, payment successful, and barcodes saved.",
      otp,
    });
  } catch (err) {
    console.error("Confirm Order Error:", err);
    res.status(500).json({ error: "Failed to confirm order" });
  }
};


// Update Order
exports.updateOrder = async (req, res) => {
  const { orderId } = req.params;
  const {
    deliveryman_name,
    deliveryman_phone,
    otp,
    order_status,
    admin_issue_returnReply,
  } = req.body;

  // console.log("Incoming Body:", req.body);

  try {
    // Fetch existing order info
    const [rows] = await db.query(
      `SELECT otp, order_status, deliveryman_name, deliveryman_phone, admin_issue_returnReply FROM full_orders WHERE id = ?`,
      [orderId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    const existing = rows[0];
    const cleanedOtp = (otp || "").toString().trim();
    const updates = [];
    let finalStatus = existing.order_status;

    // Check OTP
    if (cleanedOtp) {
      if (cleanedOtp !== existing.otp) {
        return res.status(400).json({ error: "Invalid OTP provided." });
      } else {
        finalStatus = "delivered";
        updates.push("OTP verified and status updated to 'delivered'");
      }
    } else if (order_status && order_status !== existing.order_status) {
      finalStatus = order_status;
      updates.push("Order status updated");
    }

    // Compare other fields and record changes
    if (deliveryman_name && deliveryman_name !== existing.deliveryman_name) {
      updates.push("Deliveryman name updated");
    }

    if (deliveryman_phone && deliveryman_phone !== existing.deliveryman_phone) {
      updates.push("Deliveryman phone updated");
    }

    if (
      admin_issue_returnReply &&
      admin_issue_returnReply !== existing.admin_issue_returnReply
    ) {
      updates.push("Admin issue reply updated");
    }

    // If nothing actually changed, notify
    if (updates.length === 0) {
      return res.json({
        message: "No changes detected.",
        updated: false,
      });
    }

    // Perform update
    const [updateResult] = await db.query(
      `UPDATE full_orders
       SET 
         deliveryman_name = ?, 
         deliveryman_phone = ?, 
         order_status = ?, 
         admin_issue_returnReply = ?
       WHERE id = ?`,
      [
        deliveryman_name || existing.deliveryman_name,
        deliveryman_phone || existing.deliveryman_phone,
        finalStatus,
        admin_issue_returnReply || existing.admin_issue_returnReply,
        orderId,
      ]
    );

    return res.json({
      message: updates.join(", "),
      updated: true,
      finalStatus,
    });
  } catch (error) {
    console.error("Update Order Error:", error);
    return res.status(500).json({ error: "Failed to update order" });
  }
};

exports.clientUpdateOrderIssue = async (req, res) => {
  const { orderId } = req.params;
  const { issue_type, issue_description } = req.body;

  // console.log("🔧 Updating Order Issue:");
  // console.log("Order ID:", orderId);
  // console.log("Issue Type:", issue_type);
  // console.log("Issue Description:", issue_description);

  try {
    // Validate input
    if (!issue_type || !issue_description) {
      return res.status(400).json({ error: "Missing issue details." });
    }

    // Perform update
    const [result] = await db.query(
      `UPDATE full_orders 
       SET issue_type = ?, issue_description = ?
       WHERE id = ?`,
      [issue_type, issue_description, orderId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Order not found or not updated." });
    }

    // Fetch updated row for confirmation
    const [updatedRow] = await db.query(
      `SELECT id, issue_type, issue_description FROM full_orders WHERE id = ?`,
      [orderId]
    );

    // console.log("✅ Updated DB Row:", updatedRow[0]);

    res.json({
      message: "Issue details updated successfully.",
      updated: updatedRow[0],
    });
  } catch (error) {
    console.error("❌ Client Issue Update Error:", error);
    res.status(500).json({ error: "Failed to update issue details." });
  }
};

exports.getAllOrders = async (req, res) => {
  try {
    const [orders] = await db.query(`
      SELECT fo.*, u.username, u.email
      FROM full_orders fo
      JOIN users u ON fo.customer_id = u.id
      ORDER BY fo.id DESC
    `);

    res.json(orders);
  } catch (error) {
    console.error("Get All Orders Error:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
};
exports.getUserIdByOrder = async (req, res) => {
  const { customer_id } = req.query;

  try {
    let query = "SELECT * FROM full_orders";
    const params = [];

    if (customer_id) {
      query += " WHERE customer_id = ?";
      params.push(customer_id);
    }

    const [rows] = await db.query(query, params);

    res.json(rows);
  } catch (error) {
    console.error("Get All Orders Error:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
};
exports.getOrderAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let dateFilter = "";
    if (startDate && endDate) {
      dateFilter = `AND DATE(created_at) BETWEEN '${startDate}' AND '${endDate}'`;
    }

    // 1. Grouped analytics by status
    const [statusResults] = await db.query(`
      SELECT order_status, COUNT(*) as count, SUM(total) as totalAmount
      FROM full_orders
      WHERE razor_payment = 'done' ${dateFilter}
      GROUP BY order_status
    `);

    // 2. Overall summary
    const [overall] = await db.query(`
      SELECT COUNT(*) as totalOrders, SUM(total) as totalRevenue
      FROM full_orders
      WHERE razor_payment = 'done' ${dateFilter}
    `);

    // 3. Payment history
    const [paymentHistory] = await db.query(`
      SELECT 
        DATE(created_at) AS date, 
        COUNT(*) AS orders,
        SUM(total) AS totalAmount
      FROM full_orders
      WHERE razor_payment = 'done' ${dateFilter}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);

    // Format results
    const statusAnalytics = {
      pending: { count: 0, totalAmount: 0 },
      packed: { count: 0, totalAmount: 0 },
      shipped: { count: 0, totalAmount: 0 },
      delivered: { count: 0, totalAmount: 0 },
      "order-cancelled": { count: 0, totalAmount: 0 },
    };

    statusResults.forEach((row) => {
      if (statusAnalytics[row.order_status]) {
        statusAnalytics[row.order_status] = {
          count: row.count,
          totalAmount: parseFloat(row.totalAmount),
        };
      }
    });

    const analytics = {
      ...statusAnalytics,
      totalOrders: overall[0].totalOrders,
      totalRevenue: parseFloat(overall[0].totalRevenue),
      paymentHistory: paymentHistory.map((entry) => ({
        date: entry.date,
        orders: entry.orders,
        totalAmount: parseFloat(entry.totalAmount),
      })),
    };

    res.json(analytics);
  } catch (error) {
    console.error("Order Analytics Error:", error);
    res.status(500).json({ error: "Failed to generate order analytics" });
  }
};
