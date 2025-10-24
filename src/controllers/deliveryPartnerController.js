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
    // 1) Fetch all delivery partners with user info
    const [partners] = await pool.query(
      `SELECT dp.*, u.username, u.role 
       FROM delivery_partners dp
       JOIN users u ON dp.user_id = u.id`
    );

    if (!partners || partners.length === 0) return res.json([]);

    // 2) Collect partner names, phones, order_ids, and barcode_product_codes
    const partnerNames = [];
    const partnerPhones = [];
    let orderIds = [];
    let barcodeProductCodes = [];

    partners.forEach((p) => {
      if (p.d_partner_name) partnerNames.push(p.d_partner_name);
      if (p.phone) partnerPhones.push(p.phone);

      if (p.Deivery_Products) {
        try {
          const arr = typeof p.Deivery_Products === "string"
            ? JSON.parse(p.Deivery_Products)
            : p.Deivery_Products;

          if (Array.isArray(arr)) {
            arr.forEach((prod) => {
              if (prod.order_id) orderIds.push(prod.order_id);

              if (prod.cart_items && Array.isArray(prod.cart_items)) {
                prod.cart_items.forEach((ci) => {
                  if (ci.barcode_product_code) {
                    barcodeProductCodes.push(ci.barcode_product_code);
                  }
                });
              }
            });
          }
        } catch {}
      }
    });

    orderIds = Array.from(new Set(orderIds));

    // 3) Fetch related full_orders
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
    const [orders] = await pool.query(`SELECT * FROM full_orders ${whereSQL}`, params);

    // 4) Normalize cart_items and map orders
    const orderMap = {};
    orders.forEach((o) => {
      if (o.cart_items && typeof o.cart_items === "string") {
        try { o.cart_items = JSON.parse(o.cart_items); } catch { o.cart_items = []; }
      }
      orderMap[o.id] = o;
    });

    // 5) Fetch all order_barcodes to map barcode_product_code -> current status/image
    const [barcodes] = await pool.query(`SELECT * FROM order_barcodes`);

    const barcodeMap = {};
    barcodes.forEach((b) => {
      if (b.product_code) {
        barcodeMap[b.product_code] = b; // includes barcode_status & barcode_image_path
      }
    });

    // 6) Enrich partners → products → cart_items
    const enrichedPartners = partners.map((partner) => {
      let existing = [];
      if (partner.Deivery_Products) {
        try {
          existing = typeof partner.Deivery_Products === "string"
            ? JSON.parse(partner.Deivery_Products)
            : partner.Deivery_Products;
        } catch { existing = []; }
      }
      if (!Array.isArray(existing)) existing = [];

      const enrichedProducts = existing.map((prod) => {
        const matchedOrder = orderMap[prod.order_id];
        let enrichedProd = { ...prod };

        // attach customer/order info
        if (matchedOrder) {
          enrichedProd = {
            ...enrichedProd,
            order_status: matchedOrder.order_status,
            customer_name: matchedOrder.customer_name,
            customer_phone: matchedOrder.customer_phone,
            customer_email: matchedOrder.customer_email,
            customer_address: matchedOrder.customer_address,
          };
        }

        // enrich each cart_item with barcode status/image from order_barcodes
        const enrichedCartItems = (prod.cart_items || []).map((ci) => {
          if (ci.barcode_product_code && barcodeMap[ci.barcode_product_code]) {
            return {
              ...ci,
              barcode_status: barcodeMap[ci.barcode_product_code].barcode_status || ci.order_status,
              barcode_image_path: barcodeMap[ci.barcode_product_code].barcode_image_path,
            };
          }
          return ci;
        });

        return {
          ...enrichedProd,
          cart_items: enrichedCartItems
        };
      });

      return {
        ...partner,
        Deivery_Products: enrichedProducts
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
    // Exclude only pending and packed orders
    const shippedProducts = newProducts.filter(
      (item) => {
        const status = orderStatusMap[item.order_id];
        return status !== "pending" && status !== "packed";
      }
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

    // Flatten existing items for duplicate checking
    const existingItems = currentProducts.flatMap(order =>
      order.cart_items?.map(ci => ({
        customer_id: order.customer_id,
        order_id: order.order_id,
        product_id: order.product_id,
        selectedColor: ci.selectedColor,
        selectedSize: ci.selectedSize,
        index: ci.index
      })) || []
    );

    // Collect duplicates in barcode-like format
    const duplicates = [];

    // Filter shippedProducts to exclude exact duplicates
    const filteredNewProducts = shippedProducts.filter(newOrder => {
      const isDuplicate = newOrder.cart_items.some(ci =>
        existingItems.some(exItem => {
          const match =
            exItem.customer_id === newOrder.customer_id &&
            exItem.order_id === newOrder.order_id &&
            exItem.product_id === newOrder.product_id &&
            exItem.selectedColor === ci.selectedColor &&
            exItem.selectedSize === ci.selectedSize &&
            exItem.index === ci.index;

          if (match) {
            duplicates.push(`${exItem.customer_id}-${exItem.order_id}-${exItem.product_id}-${exItem.selectedColor}-${exItem.selectedSize}-${exItem.index}`);
          }

          return match;
        })
      );

      return !isDuplicate; // keep only non-duplicates
    });

    if (filteredNewProducts.length === 0) {
      const dupMessage = duplicates.join("; ");
      return res.status(400).json({
        status: "error",
        message: `${dupMessage} - are already saved. Nothing added.`
      });
    }


    // Append filtered new products
    currentProducts.push(...filteredNewProducts);

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

exports.deletePartnerByBarcode = async (req, res) => {
  const { id, barcode_product_code } = req.body;

  if (!id || !barcode_product_code) {
    return res.status(400).json({ message: "id and barcode_product_code are required" });
  }

  try {
    const partnerId = Number(id);

    // 1. Get partner by ID
    const [rows] = await pool.query(
      `SELECT id, Deivery_Products, Count FROM delivery_partners WHERE id = ?`,
      [partnerId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Delivery partner not found" });
    }

    const partner = rows[0];
    let deiveryProducts = partner.Deivery_Products || [];
    let currentCount = partner.Count || 0;

    // 2. Remove cart items that match the barcode_product_code & count removed items
    let removedItemsCount = 0;
    let updatedProducts = deiveryProducts.map((order) => {
      const originalLength = (order.cart_items || []).length;
      const updatedCartItems = (order.cart_items || []).filter(
        (item) => item.barcode_product_code !== barcode_product_code
      );
      removedItemsCount += originalLength - updatedCartItems.length;
      return { ...order, cart_items: updatedCartItems };
    });

    // 3. Remove orders that now have no cart_items
    updatedProducts = updatedProducts.filter((order) => order.cart_items.length > 0);

    // 4. Update DB with new Deivery_Products and reduce Count
    const newCount = currentCount - removedItemsCount;
    await pool.query(
      `UPDATE delivery_partners SET Deivery_Products = ?, Count = ? WHERE id = ?`,
      [JSON.stringify(updatedProducts), newCount, partnerId]
    );

    return res.json({
      message: "Cart item removed successfully",
      id: partnerId,
      barcode_product_code,
      removedItemsCount,
      newCount,
    });
  } catch (error) {
    console.error("deletePartnerByBarcode error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};


