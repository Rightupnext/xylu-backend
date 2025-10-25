const fs = require("fs/promises");
const fsSync = require("fs");
const path = require("path");
const db = require("../db");

exports.createProductWithVariants = async (req, res) => {
  const {
    product_name,
    product_code,
    category,
    description,
    price,
    discount,
    trend,
    Bulk_discount,
    offerExpiry,
    variants,
  } = req.body;

  const image = req.imageFilename || null;

  // console.log("image", image);
  let parsedVariants = [];
  try {
    parsedVariants =
      typeof variants === "string" ? JSON.parse(variants) : variants;
    if (!Array.isArray(parsedVariants))
      throw new Error("Variants must be an array");
  } catch (err) {
    return res
      .status(400)
      .json({ error: "Invalid variants format. Must be valid JSON array." });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [productResult] = await connection.query(
      `INSERT INTO boutique_inventory 
   (product_name, product_code, category, description, image, price, discount, offerExpiry, trend, Bulk_discount) 
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        product_name,
        product_code,
        category,
        description,
        image,
        price,
        discount,
        JSON.stringify(offerExpiry),
        trend,
        Bulk_discount,
      ]
    );


    const productId = productResult.insertId;

    const validVariants = parsedVariants.filter(
      (v) => v.color && v.size && typeof v.quantity !== "undefined"
    );

    const variantInsertPromises = validVariants.map((variant) => {
      const sizeString = Array.isArray(variant.size)
        ? variant.size.join(",")
        : String(variant.size);
      return connection.query(
        `INSERT INTO inventory_variants (product_id, color, size, quantity)
         VALUES (?, ?, ?, ?)`,
        [productId, variant.color, sizeString, variant.quantity]
      );
    });

    await Promise.all(variantInsertPromises);
    await connection.commit();
    res.status(201).json({ message: "Product and variants added", productId });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
};

exports.updateProductWithVariants = async (req, res) => {
  const { id } = req.params;
  const {
    product_name,
    product_code,
    category,
    description,
    price,
    discount,
    Bulk_discount,
    offerExpiry,
    trend,
    variants,
    existingImage,
  } = req.body;

  const uploadDir = path.join(__dirname, "../../uploads/products");
  const newImage = req.imageFilename || null; // multer filename
  let parsedVariants = [];

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // 1️⃣ Fetch old product details
    const [rows] = await connection.query(
      `SELECT image FROM boutique_inventory WHERE id = ?`,
      [id]
    );

    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Product not found" });
    }

    // Normalize old DB image (remove any "products/" prefix)
    const oldImage = rows[0].image
      ? rows[0].image.replace(/^products\//, "").trim()
      : null;

    let finalImage = rows[0].image || null;

    // 2️⃣ Normalize image path function
    const normalizeImagePath = (img) => {
      if (!img) return null;
      return img.startsWith("products/") ? img : "products/" + img;
    };

    // 3️⃣ Handle image update logic
    if (newImage) {
      // Case A: new upload → delete old
      if (oldImage) {
        const oldImagePath = path.join(uploadDir, oldImage);
        if (fsSync.existsSync(oldImagePath)) {
          await fs.unlink(oldImagePath);
        }
      }
      finalImage = normalizeImagePath(newImage);
    } else if (existingImage) {
      const normalizedExisting = existingImage.replace(/^products\//, "").trim();
      if (oldImage && oldImage !== normalizedExisting) {
        const oldImagePath = path.join(uploadDir, oldImage);
        if (fsSync.existsSync(oldImagePath)) {
          await fs.unlink(oldImagePath);
        }
      }
      finalImage = normalizeImagePath(normalizedExisting);
    } else {
      finalImage = rows[0].image ? normalizeImagePath(rows[0].image) : null;
    }

    // 4️⃣ Normalize offerExpiry
    let finalOfferExpiry = null;
    if (offerExpiry) {
      if (Array.isArray(offerExpiry)) {
        finalOfferExpiry = JSON.stringify(offerExpiry);
      } else if (typeof offerExpiry === "string") {
        try {
          JSON.parse(offerExpiry);
          finalOfferExpiry = offerExpiry;
        } catch {
          finalOfferExpiry = JSON.stringify([offerExpiry]);
        }
      }
    }

    // 5️⃣ Update main product fields
    await connection.query(
      `UPDATE boutique_inventory 
       SET product_name = ?, product_code = ?, category = ?, description = ?, 
           image = ?, price = ?, discount = ?, Bulk_discount = ?, offerExpiry = ?, trend = ?
       WHERE id = ?`,
      [
        product_name,
        product_code,
        category,
        description,
        finalImage,
        price,
        discount,
        Bulk_discount,
        finalOfferExpiry,
        trend,
        id,
      ]
    );

    // 6️⃣ Parse and update variants
    parsedVariants = typeof variants === "string" ? JSON.parse(variants) : variants;

    if (!Array.isArray(parsedVariants)) {
      throw new Error("Variants must be an array");
    }

    // Delete old variants
    await connection.query(`DELETE FROM inventory_variants WHERE product_id = ?`, [id]);

    // Insert new variants
    const variantInsertPromises = parsedVariants.map((variant) => {
      const sizeString = Array.isArray(variant.size)
        ? variant.size.join(",")
        : String(variant.size);
      return connection.query(
        `INSERT INTO inventory_variants (product_id, color, size, quantity)
         VALUES (?, ?, ?, ?)`,
        [id, variant.color, sizeString, variant.quantity]
      );
    });

    await Promise.all(variantInsertPromises);

    await connection.commit();

    res.json({
      message: "✅ Product and variants updated successfully",
      image: finalImage, // always in format "products/filename.png"
    });
  } catch (error) {
    await connection.rollback();
    console.error("❌ Update failed:", error.message);
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
};

exports.getAllProducts = async (req, res) => {
  try {
    const [products] = await db.query(`SELECT * FROM boutique_inventory`);
    const [variants] = await db.query(`SELECT * FROM inventory_variants`);

    const grouped = {};
    for (const v of variants) {
      if (!grouped[v.product_id]) grouped[v.product_id] = [];
      grouped[v.product_id].push({
        color: v.color,
        size: v.size.split(","), // return as array
        quantity: v.quantity,
      });
    }

    const result = products.map((product) => ({
      ...product,
      variants: grouped[product.id] || [],
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.PermenantlydeleteProduct = async (req, res) => {
  const { id } = req.params;
  const uploadDir = path.join(__dirname, "../../uploads/products");

  try {
    // 1️⃣ Check if product exists
    const [rows] = await db.query(
      `SELECT image FROM boutique_inventory WHERE id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    // 2️⃣ Extract image field (single or multiple)
    let imageField = rows[0].image;
    let imagesArray = [];

    try {
      // In case "image" contains JSON (array of images)
      if (imageField && imageField.startsWith("[")) {
        imagesArray = JSON.parse(imageField);
      } else if (imageField) {
        imagesArray = [imageField];
      }
    } catch {
      imagesArray = [];
    }

    // 3️⃣ Delete product and related variants
    await db.query(`DELETE FROM inventory_variants WHERE product_id = ?`, [id]);
    await db.query(`DELETE FROM boutique_inventory WHERE id = ?`, [id]);

    // 4️⃣ Delete images from folder
    for (const img of imagesArray) {
      const cleanImage = img.replace(/^products\//, "").trim();
      const imagePath = path.join(uploadDir, cleanImage);

      try {
        if (fsSync.existsSync(imagePath)) {
          await fs.unlink(imagePath);
          console.log("🗑 Deleted image:", imagePath);
        } else {
          console.log("⚠️ Image not found (skipped):", imagePath);
        }
      } catch (err) {
        console.error("⚠️ Failed to delete image:", err.message);
      }
    }

    res.json({ message: "✅ Product and images permanently deleted" });
  } catch (error) {
    console.error("❌ Deletion failed:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
exports.softDeleteProduct = async (req, res) => {
  const { id } = req.params;

  try {
    // Check if product exists
    const [rows] = await db.query(
      `SELECT id FROM boutique_inventory WHERE id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Soft delete
    await db.query(
      `UPDATE boutique_inventory SET is_deleted = 1 WHERE id = ?`,
      [id]
    );

    res.json({ message: "✅ Product hidden successfully (soft deleted)" });
  } catch (error) {
    console.error("❌ Soft delete failed:", error.message);
    res.status(500).json({ error: error.message });
  }
};
exports.restoreProduct = async (req, res) => {
  const { id } = req.params;

  try {
    await db.query(
      `UPDATE boutique_inventory SET is_deleted = 0 WHERE id = ?`,
      [id]
    );

    res.json({ message: "✅ Product restored successfully" });
  } catch (error) {
    console.error("❌ Restore failed:", error.message);
    res.status(500).json({ error: error.message });
  }
};
exports.getProductById = async (req, res) => {
  const { id } = req.params;

  try {
    // Step 1: Get the product by ID
    const [productRows] = await db.query(
      `SELECT * FROM boutique_inventory WHERE id = ?`,
      [id]
    );

    if (productRows.length === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    const product = productRows[0];

    // Step 2: Get all variants for that product
    const [variantRows] = await db.query(
      `SELECT color, size, quantity FROM inventory_variants WHERE product_id = ?`,
      [id]
    );

    // Convert size strings to arrays (e.g., "S,M,L" => ["S", "M", "L"])
    const variants = variantRows.map((variant) => ({
      ...variant,
      size: variant.size.split(",").map((s) => s.trim()),
    }));

    // Step 3: Combine product with its variants
    const result = {
      ...product,
      variants,
    };

    res.json(result);
  } catch (error) {
    console.error("❌ Failed to fetch product:", error.message);
    res.status(500).json({ error: error.message });
  }
};
