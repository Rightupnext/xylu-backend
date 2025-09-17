const pool = require("../db");

// ✅ Create Delivery Partner (user_id auto from logged-in user)
exports.createDeliveryPartner = async (req, res) => {
  try {
    const { d_partner_name, email, phone, address, district, zone } = req.body;

    // user_id comes from auth middleware (req.user)
    const userId = req.user?.id;  

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized: user not logged in" });
    }

    const [result] = await pool.query(
      `INSERT INTO delivery_partners 
        (d_partner_name, email, phone, address, district, zone, user_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [d_partner_name, email, phone, address, district, zone, userId]
    );

    res.status(201).json({ message: "Delivery Partner created", id: result.insertId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create delivery partner" });
  }
};

// Get All Delivery Partners with enriched/derived Deivery_Products
exports.getAllDeliveryPartners = async (req, res) => {
  try {
    // 1) fetch partners + user info
    const [partners] = await pool.query(
      `SELECT dp.*, u.username, u.role 
       FROM delivery_partners dp
       JOIN users u ON dp.user_id = u.id`
    );

    if (!partners || partners.length === 0) {
      return res.json([]);
    }

    // 2) collect partner names & phones and any order_ids already stored in Deivery_Products
    const partnerNames = [];
    const partnerPhones = [];
    let orderIds = [];

    partners.forEach((p) => {
      if (p.d_partner_name) partnerNames.push(p.d_partner_name);
      if (p.phone) partnerPhones.push(p.phone);

      if (p.Deivery_Products) {
        try {
          const arr = typeof p.Deivery_Products === "string" ? JSON.parse(p.Deivery_Products) : p.Deivery_Products;
          if (Array.isArray(arr)) {
            arr.forEach(item => {
              if (item && item.order_id) orderIds.push(item.order_id);
            });
          }
        } catch (e) {
          // ignore malformed JSON for now
        }
      }
    });

    // dedupe orderIds
    orderIds = Array.from(new Set(orderIds));

    // 3) build SQL to fetch related full_orders (by deliveryman_name / phone OR by explicit order ids)
    const whereClauses = [];
    const params = [];

    if (partnerNames.length) {
      whereClauses.push(`deliveryman_name IN (?)`);
      params.push(partnerNames);
    }
    if (partnerPhones.length) {
      whereClauses.push(`deliveryman_phone IN (?)`);
      params.push(partnerPhones);
    }
    if (orderIds.length) {
      whereClauses.push(`id IN (?)`);
      params.push(orderIds);
    }

    const whereSQL = whereClauses.length ? `WHERE ${whereClauses.join(" OR ")}` : "";

    // fetch matching orders (cart_items may be JSON in DB)
    const [orders] = await pool.query(`SELECT * FROM full_orders ${whereSQL}`, params);

    // normalize cart_items and map orders by id
    const orderMap = {};
    orders.forEach((o) => {
      if (o.cart_items && typeof o.cart_items === "string") {
        try { o.cart_items = JSON.parse(o.cart_items); } catch { o.cart_items = []; }
      }
      orderMap[o.id] = o;
    });

    // 4) enrich partners
    const enrichedPartners = partners.map((partner) => {
      // parse existing Deivery_Products safely
      let existing = [];
      if (partner.Deivery_Products) {
        try { existing = typeof partner.Deivery_Products === "string" ? JSON.parse(partner.Deivery_Products) : partner.Deivery_Products; } catch { existing = []; }
      }
      if (!Array.isArray(existing)) existing = [];

      // enrich any existing items using orderMap
      const enrichedExisting = existing.map((prod) => {
        const matchedOrder = orderMap[prod.order_id];
        if (matchedOrder) {
          return {
            ...prod,
            order_status: matchedOrder.order_status,
            customer_name: matchedOrder.customer_name,
            customer_phone: matchedOrder.customer_phone,
            customer_email: matchedOrder.customer_email,
            customer_address: matchedOrder.customer_address,
          };
        }
        return prod;
      });

      // if there were no existing products, derive from full_orders assigned to this partner
      if (enrichedExisting.length === 0) {
        // find orders that match this partner by name or phone
        const matchedOrders = orders.filter(o =>
          o.deliveryman_name === partner.d_partner_name || o.deliveryman_phone === partner.phone
        );

        matchedOrders.forEach((o) => {
          const cartItems = Array.isArray(o.cart_items) ? o.cart_items : [];
          // convert each cart_item to the Deivery_Products shape (one entry per cart item)
          cartItems.forEach(ci => {
            enrichedExisting.push({
              order_id: o.id,
              cart_items: [ci],
              product_id: ci.product_id || null,
              customer_id: o.customer_id,
              product_code: ci.product_code || null,
              deliveryman_name: o.deliveryman_name || partner.d_partner_name,
              deliveryman_phone: o.deliveryman_phone || partner.phone,
              order_status: o.order_status,
              customer_name: o.customer_name,
              customer_phone: o.customer_phone,
              customer_email: o.customer_email,
              customer_address: o.customer_address
            });
          });
        });
      }

      // final partner object with Deivery_Products enriched or derived
      return {
        ...partner,
        Deivery_Products: enrichedExisting,
      };
    });

    return res.json(enrichedPartners);
  } catch (error) {
    console.error("Error fetching delivery partners:", error);
    return res.status(500).json({ error: "Failed to fetch delivery partners" });
  }
};

// ✅ Update Delivery Partner by ID
exports.updateDeliveryPartner = async (req, res) => {
  try {
    const { id } = req.params;
    const { d_partner_name, email, phone, address, district, zone } = req.body;

    const [result] = await pool.query(
      `UPDATE delivery_partners 
       SET d_partner_name=?, email=?, phone=?, address=?, district=?, zone=?, updated_at=NOW() 
       WHERE id=?`,
      [d_partner_name, email, phone, address, district, zone, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Delivery Partner not found" });
    }

    res.json({ message: "Delivery Partner updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update delivery partner" });
  }
};

// ✅ Delete Delivery Partner by ID
exports.deleteDeliveryPartner = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.query("DELETE FROM delivery_partners WHERE id=?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Delivery Partner not found" });
    }

    res.json({ message: "Delivery Partner deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete delivery partner" });
  }
};
exports.AddDeliveryProducts_D_Partner_Wise = async (req, res) => {
  try {
    const { partnerId } = req.params;
    const { payload } = req.body;

    if (!partnerId || !payload) {
      return res.status(400).json({
        status: "error",
        message: "partnerId (param) and payload (body) are required",
      });
    }

    // Ensure payload is array
    const newProducts = Array.isArray(payload) ? payload : [payload];

    // Extract all order_ids from payload
    const orderIds = newProducts.map((item) => item.order_id);

    if (orderIds.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "No order_id found in payload",
      });
    }

    // 🔍 Fetch matching orders from full_orders table
    const [orders] = await pool.query(
      `SELECT id, order_status FROM full_orders WHERE id IN (?)`,
      [orderIds]
    );

    // Map orderId -> status
    const orderStatusMap = {};
    orders.forEach((o) => {
      orderStatusMap[o.id] = o.order_status;
    });

    // Filter only shipped orders
    const shippedProducts = newProducts.filter(
      (item) => orderStatusMap[item.order_id] === "shipped"
    );

    if (shippedProducts.length === 0) {
      return res.status(400).json({
        status: "error",
        message:
          "No shipped orders found in full_orders for the given payload. Nothing saved.",
      });
    }

    // Fetch current JSON from DB
    const [rows] = await pool.query(
      "SELECT Deivery_Products, Count FROM delivery_partners WHERE id = ?",
      [partnerId]
    );

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ status: "error", message: "Delivery Partner not found" });
    }

    let currentProducts = rows[0].Deivery_Products || [];
    if (typeof currentProducts === "string") {
      try {
        currentProducts = JSON.parse(currentProducts);
      } catch {
        currentProducts = [];
      }
    }

    // Append shipped orders to current products
    currentProducts.push(...shippedProducts);

    // Update Count field — total number of products assigned
    const newCount = currentProducts.length;

    // Update DB
    await pool.query(
      "UPDATE delivery_partners SET Deivery_Products = ?, Count = ? WHERE id = ?",
      [JSON.stringify(currentProducts), newCount, partnerId]
    );

    res.status(200).json({
      status: "success",
      message: "Shipped delivery products saved successfully",
      count: newCount,
      data: currentProducts,
    });
  } catch (error) {
    console.error("Error saving delivery products:", error);
    res.status(500).json({
      status: "error",
      message: "Server error",
      error: error.message,
    });
  }
};
