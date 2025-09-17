const fs = require("fs");
const path = require("path");
const bwipjs = require("bwip-js");
const db = require("../db"); // MySQL connection

const BARCODE_DIR = path.join(__dirname, "../../uploads/barcodes");
if (!fs.existsSync(BARCODE_DIR)) fs.mkdirSync(BARCODE_DIR, { recursive: true });

/**
 * Generate barcodes for all products in an order
 * Each variant gets a unique barcode using: customer_id, order_id, product_id, color, size, index
 * customer_id-order_id-product_id-selectedColor-selectedSize-index
 */
async function generateBarcodeForOrder(order) {
  try {
    const cartItems = Array.isArray(order.cart_items)
      ? order.cart_items
      : JSON.parse(order.cart_items);

    const allBarcodes = [];

    for (const item of cartItems) {
      // Loop for quantity if >1
      for (let i = 0; i < item.quantity; i++) {
        // Include customer_id to make it unique per customer
        const uniqueCode = `${order.customer_id}-${order.id}-${item.id}-${item.selectedColor}-${item.selectedSize}-${i + 1}`;
        const barcodeFileName = `barcode_${uniqueCode}.png`;
        const barcodePathAbsolute = path.join(BARCODE_DIR, barcodeFileName);

        // Generate barcode image
        const buffer = await bwipjs.toBuffer({
          bcid: "code128",
          text: uniqueCode,
          scale: 3,
          height: 10,
          includetext: true,
          textxalign: "center",
        });
        fs.writeFileSync(barcodePathAbsolute, buffer);

        // Use relative path for DB
        const barcodePathRelative = `uploads/barcodes/${barcodeFileName}`;

        await db.query(
          `INSERT INTO order_barcodes (order_id, customer_id, product_id, product_code, barcode_image_path)
           VALUES (?, ?, ?, ?, ?)`,
          [order.id, order.customer_id, item.id, uniqueCode, barcodePathRelative]
        );

        allBarcodes.push({
          product_id: item.id,
          product_name: item.product_name,
          selectedSize: item.selectedSize,
          selectedColor: item.selectedColor,
          barcode_text: uniqueCode,
          barcode_image_path: barcodePathRelative
        });
      }
    }

    console.log("✅ All barcodes for order generated and saved to DB");
    return allBarcodes;
  } catch (err) {
    console.error("❌ Error generating barcodes:", err);
    throw err;
  }
}

module.exports = { generateBarcodeForOrder };
