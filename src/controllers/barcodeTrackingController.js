// controllers/barcodeController.js
const pool = require("../db");
const { getIo } = require("../socket/socket");

// =======================
// TRACK BARCODE BY PRODUCT CODE
// =======================
exports.trackByBarcode = async (req, res) => {
  try {
    const { product_code } = req.params;
    // console.log("product_code", product_code);

    if (!product_code) {
      return res.status(400).json({ error: "product_code is required" });
    }

    const [rows] = await pool.query(
      `
      SELECT 
        ob.id AS barcode_id,
        ob.product_code AS barcode_product_code,
        ob.barcode_image_path,
        ob.barcode_status,
        ob.created_at AS barcode_created,

        -- Order Info
        fo.id AS order_id,
        fo.customer_id,
        fo.customer_name,
        fo.customer_email,
        fo.customer_phone,
        fo.customer_address,
        fo.order_status,
        fo.total,
        fo.cart_items, 
        fo.created_at AS order_date,

        -- Delivery Info
        fo.deliveryman_name,
        fo.deliveryman_phone,

        -- Product Info
        bi.id AS product_id,
        bi.product_name,
        bi.category,
        bi.price,
        bi.discount,
        bi.trend,
        bi.image

      FROM order_barcodes ob
      INNER JOIN full_orders fo ON ob.order_id = fo.id
      INNER JOIN boutique_inventory bi ON ob.product_id = bi.id
      WHERE ob.product_code = ?
      `,
      [String(product_code)]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: "No record found for this barcode" });
    }

    const order = rows[0];

    // Parse cart_items JSON
    let cartItems = [];
    if (order.cart_items) {
      try {
        cartItems = typeof order.cart_items === "string" ? JSON.parse(order.cart_items) : order.cart_items;
      } catch (err) {
        console.error("Failed to parse cart_items:", err);
      }
    }

    // Extract color/size from product_code
    const parts = product_code.split("-");
    const color = parts[3] || "";
    const size = parts[4] || "";

    // Merge barcode info into cart_items if color/size matches
    const matchedItems = cartItems
      .map((item, index) => ({
        customer_id: order.customer_id,
        order_id: order.order_id,
        product_id: item.product_id,
        selectedColor: item.selectedColor,
        selectedSize: item.selectedSize,
        index,
        product_name: item.product_name,
        product_code: item.product_code,
        quantity: item.quantity,
        price: item.price,
        image: item.image,
        discountedPrice: item.discountedPrice,
        barcode_product_code: item.selectedColor === color && item.selectedSize === size ? order.barcode_product_code : null,
        barcode_image_path: item.selectedColor === color && item.selectedSize === size ? order.barcode_image_path : null,
        barcode_status: item.selectedColor === color && item.selectedSize === size ? order.barcode_status : null,
      }))
      .filter(item => item.selectedColor === color && item.selectedSize === size);

    if (matchedItems.length === 0) {
      return res.status(404).json({ error: "No matching item in cart" });
    }

    const responseData = {
      barcode_id: order.barcode_id,
      product_code: order.barcode_product_code,
      barcode_image_path: order.barcode_image_path,
      barcode_status: order.barcode_status,
      barcode_created: order.barcode_created,
      order_id: order.order_id,
      customer_id: order.customer_id,
      customer_name: order.customer_name,
      customer_email: order.customer_email,
      customer_phone: order.customer_phone,
      customer_address: order.customer_address,
      order_status: order.order_status,
      total: order.total,
      cart_items: matchedItems,
      order_date: order.order_date,
      deliveryman_name: order.deliveryman_name,
      deliveryman_phone: order.deliveryman_phone,
      product_id: order.product_id,
      product_name: order.product_name,
      category: order.category,
      price: order.price,
      discount: order.discount,
      trend: order.trend,
      image: order.image,
    };

    // console.log("responseData", responseData);

    // Emit update globally (not per user)
    const io = getIo();
    io.emit("barcodeUpdate", responseData);

    // Return response
    res.json(responseData);
  } catch (error) {
    console.error("Barcode Tracking Error:", error);
    res.status(500).json({ error: "Failed to fetch tracking details" });
  }
};


// =======================
// UPDATE DELIVERY PARTNER
// =======================
exports.updateDeliveryPartner = async (req, res) => {
  const partnerId = req.params.id;
  const payload = req.body;

  try {
    const connection = await pool.getConnection();

    const [rows] = await connection.execute(
      "SELECT * FROM delivery_partners WHERE id = ?",
      [Number(partnerId)]
    );

    if (!rows || rows.length === 0) {
      connection.release();
      return res.status(404).json({ message: "Delivery partner not found" });
    }

    let existingProducts = rows[0].Products ? JSON.parse(rows[0].Products) : [];
    existingProducts.push(payload);

    const productsJSON = JSON.stringify(existingProducts);
    const productCount = existingProducts.length;

    await connection.execute(
      `UPDATE delivery_partners 
       SET Products = ?, Count = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [productsJSON, productCount, Number(partnerId)]
    );

    connection.release();

    // Emit via Socket.IO
    const io = getIo();
    io.emit("deliveryPartnerUpdate", {
      partnerId,
      Count: productCount,
      Products: existingProducts,
    });

    res.json({
      message: "Delivery partner products updated successfully",
      Count: productCount,
      Products: existingProducts
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error });
  }
};