// controllers/orderController.js
const db = require("../db");
const crypto = require("crypto");
require("dotenv").config();
const Razorpay = require("razorpay");
const { generateBarcodeForOrder } = require("./barcodeController");

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
  const { paymentDetails, cartItems } = req.body;

  if (!paymentDetails) return res.status(400).json({ error: "Payment details missing" });

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = paymentDetails;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: "Invalid request data" });
  }

  if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
    return res.status(400).json({ error: "Cart items missing or invalid" });
  }

  let connection;
  try {
    // Step 0: Start transaction
    connection = await db.getConnection();
    await connection.beginTransaction();

    // Step 1: Verify Razorpay signature
    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      await connection.query(
        "DELETE FROM full_orders WHERE razorpay_order_id = ?",
        [razorpay_order_id]
      );
      await connection.commit();
      return res.status(400).json({ error: "Invalid payment signature. Order deleted." });
    }

    // Step 2: Deduct inventory with row-level locks
    for (const item of cartItems) {
      const { id: productId, selectedColor, selectedSize, quantity } = item;

      const [rows] = await connection.query(
        `SELECT quantity FROM inventory_variants 
         WHERE product_id = ? AND color = ? AND size = ? FOR UPDATE`,
        [productId, selectedColor, selectedSize]
      );

      if (rows.length === 0) {
        await connection.rollback();
        return res.status(400).json({ error: `Variant not found: ${productId}` });
      }

      const currentQty = rows[0].quantity;
      if (quantity > currentQty) {
        await connection.rollback();
        return res.status(400).json({
          error: `Insufficient stock for product ${productId} (${selectedColor}, ${selectedSize})`,
        });
      }

      await connection.query(
        `UPDATE inventory_variants SET quantity = ? 
         WHERE product_id = ? AND color = ? AND size = ?`,
        [currentQty - quantity, productId, selectedColor, selectedSize]
      );
    }

    // Step 3: Generate OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    // Step 4: Update order as confirmed
    await connection.query(
      `UPDATE full_orders 
       SET razorpay_payment_id = ?, razorpay_signature = ?, razor_payment = 'done', otp = ? 
       WHERE razorpay_order_id = ?`,
      [razorpay_payment_id, razorpay_signature, otp, razorpay_order_id]
    );

    // Step 5: Fetch updated order
    const [orderRows] = await connection.query(
      `SELECT * FROM full_orders WHERE razorpay_order_id = ?`,
      [razorpay_order_id]
    );

    if (orderRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Order not found" });
    }

    const order = orderRows[0];

    // ✅ Commit transaction BEFORE barcode generation to prevent lock timeout
    await connection.commit();

    // Step 6: Generate barcodes outside transaction
    const barcodes = await generateBarcodeForOrder(order);
    const barcodeCodes = barcodes.map(b => b.barcode_text);

    // Step 7: Update order with barcode paths
    await db.query(
      `UPDATE full_orders SET Barcode = ? WHERE id = ?`,
      [JSON.stringify(barcodeCodes), order.id]
    );

    res.json({
      message: "Order confirmed, payment successful, inventory updated, barcodes generated",
      otp,
      barcodes: barcodeCodes,
    });

  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Confirm Order Error:", err);
    res.status(500).json({ error: "Failed to confirm order" });
  } finally {
    if (connection) connection.release();
  }
};

// Update Order
exports.updateOrder = async (req, res) => {
  const { orderId } = req.params;
  const { deliveryman_name, deliveryman_phone, otp, admin_issue_returnReply, products = [] } = req.body;

  try {
    // 1️⃣ Fetch existing order
    const [rows] = await db.query(`SELECT * FROM full_orders WHERE id = ?`, [orderId]);
    if (rows.length === 0) return res.status(404).json({ error: "Order not found" });

    const existing = rows[0];
    const updates = [];

    // 2️⃣ Update only given products
    const statuses = [];
    if (products.length > 0) {
      for (const prod of products) {
        const { order_barcode, order_barcode_status } = prod;

        await db.query(
          `UPDATE order_barcodes 
           SET barcode_status = ? 
           WHERE order_id = ? AND product_code = ?`,
          [order_barcode_status, orderId, order_barcode]
        );

        statuses.push(order_barcode_status);
        updates.push(`Product ${order_barcode} → ${order_barcode_status}`);
      }
    }

    // 3️⃣ Strict 5-stage logic (lowest stage wins)
    const stageOrder = ["pending", "packed", "shipped", "received", "delivered"];
    let finalStatus = "pending";
    for (const stage of stageOrder) {
      if (statuses.includes(stage)) {
        finalStatus = stage;
        break;
      }
    }

    // 4️⃣ Update full_orders
    await db.query(
      `UPDATE full_orders 
       SET deliveryman_name = ?, deliveryman_phone = ?, otp = ?, admin_issue_returnReply = ?, order_status = ? 
       WHERE id = ?`,
      [
        deliveryman_name || existing.deliveryman_name,
        deliveryman_phone || existing.deliveryman_phone,
        otp || existing.otp,
        admin_issue_returnReply || existing.admin_issue_returnReply,
        finalStatus,
        orderId,
      ]
    );

    updates.push(`Full order status recalculated as '${finalStatus}'`);

    // 5️⃣ Response
    return res.json({
      message: updates.length ? updates.join(", ") : "No changes detected",
      updated: updates.length > 0,
      finalStatus,
      allStatuses: statuses,
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
    // 1️⃣ Get all orders with user info
    const [orders] = await db.query(`
      SELECT fo.*, u.username, u.email
      FROM full_orders fo
      JOIN users u ON fo.customer_id = u.id
      ORDER BY fo.id DESC
    `);

    // 2️⃣ Loop through each order
    for (const order of orders) {
      // Parse cart_items JSON if stored as string
      const cartItems = Array.isArray(order.cart_items)
        ? order.cart_items
        : JSON.parse(order.cart_items || "[]");

      const barcodeArray = Array.isArray(order.Barcode)
        ? order.Barcode
        : JSON.parse(order.Barcode || "[]");

      // Fetch barcodes for this order if available
      let orderBarcodes = [];
      if (barcodeArray.length > 0) {
        const [barcodes] = await db.query(
          `SELECT product_code, barcode_image_path, barcode_status FROM order_barcodes WHERE order_id = ?`,
          [order.id]
        );
        orderBarcodes = barcodes;
      }

      // Map cart items with barcode info
      order.cart_items = cartItems.map(item => {
        // Try to match barcode by product_code
        const matchedBarcode = orderBarcodes.find(b =>
          b.product_code === item.order_barcode ||
          (b.product_code.includes(item.selectedColor) &&
            b.product_code.includes(item.selectedSize))
        );

        return {
          ...item,
          order_barcode_status: matchedBarcode ? matchedBarcode.barcode_status : null,
          order_barcode: matchedBarcode ? matchedBarcode.product_code : item.order_barcode || null,
          barcode_image_path: matchedBarcode ? matchedBarcode.barcode_image_path : null,
        };
      });
    }

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
