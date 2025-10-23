const fs = require("fs");
const path = require("path");
const bwipjs = require("bwip-js");
const { createCanvas, loadImage } = require("canvas");
const db = require("../db");

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
      for (let i = 0; i < item.quantity; i++) {
        const uniqueCode = `${order.customer_id}-${order.id}-${item.id}-${
          item.selectedColor
        }-${item.selectedSize}-${i + 1}`;
        const barcodeFileName = `barcode_${uniqueCode}.png`;
        const barcodePathAbsolute = path.join(BARCODE_DIR, barcodeFileName);

        // ✅ Generate high-quality barcode buffer
        const barcodeBuffer = await bwipjs.toBuffer({
          bcid: "code128",
          text: uniqueCode,
          scale: 5, // Wider bars for easier scanning
          height: 40, // Taller barcode
          includetext: true,
          textxalign: "center",
          backgroundcolor: "FFFFFF",
        });

        // ✅ Create canvas to add product info + barcode
        const canvasWidth = 600;
        const canvasHeight = 600;
        const canvas = createCanvas(canvasWidth, canvasHeight);
        const ctx = canvas.getContext("2d");

        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        ctx.fillStyle = "black";
        ctx.textAlign = "center";

        // Product info
        const maxWidth = canvasWidth - 40; // leave some padding
        let fontSize = 36;
        ctx.font = `bold ${fontSize}px Arial`;

        while (
          ctx.measureText(item.product_name.toUpperCase()).width > maxWidth &&
          fontSize > 12
        ) {
          fontSize -= 2;
          ctx.font = `bold ${fontSize}px Arial`;
        }

        ctx.fillText(item.product_name.toUpperCase(), canvasWidth / 2, 80);

        ctx.font = "bold 28px Arial";
        ctx.fillText(`Color: ${item.selectedColor}`, canvasWidth / 4, 140);
        ctx.fillText(`Size: ${item.selectedSize}`, (canvasWidth / 4) * 3, 140);

        // Barcode image
        const barcodeImg = await loadImage(barcodeBuffer);
        const barcodeWidth = 500;
        const barcodeHeight = 150;
        const barcodeX = (canvasWidth - barcodeWidth) / 2;
        const barcodeY = 250;

        ctx.drawImage(
          barcodeImg,
          barcodeX,
          barcodeY,
          barcodeWidth,
          barcodeHeight
        );

        // Barcode text below
        ctx.font = "bold 30px Arial";
        ctx.fillText(uniqueCode, canvasWidth / 2, 450);

        // Save final PNG
        const out = fs.createWriteStream(barcodePathAbsolute);
        const stream = canvas.createPNGStream();
        stream.pipe(out);

        await new Promise((resolve) => out.on("finish", resolve));

        // Save path in DB
        const barcodePathRelative = `uploads/barcodes/${barcodeFileName}`;
        await db.query(
          `INSERT INTO order_barcodes (order_id, customer_id, product_id, product_code, barcode_image_path)
           VALUES (?, ?, ?, ?, ?)`,
          [
            order.id,
            order.customer_id,
            item.id,
            uniqueCode,
            barcodePathRelative,
          ]
        );

        allBarcodes.push({
          product_id: item.id,
          product_name: item.product_name,
          selectedSize: item.selectedSize,
          selectedColor: item.selectedColor,
          barcode_text: uniqueCode,
          barcode_image_path: barcodePathRelative,
        });
      }
    }

    console.log("✅ All barcodes for order generated successfully");
    return allBarcodes;
  } catch (err) {
    console.error("❌ Error generating barcodes:", err);
    throw err;
  }
}

module.exports = { generateBarcodeForOrder };
