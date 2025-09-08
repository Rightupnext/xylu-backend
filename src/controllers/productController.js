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
  const newImage = req.imageFilename || null; // multer saved filename
  let parsedVariants = [];

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Fetch old product details
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

    let finalImage = oldImage;

    // 2. Handle image update logic
    if (newImage) {
      // Case A: new upload → delete old
      if (oldImage) {
        const oldImagePath = path.join(uploadDir, oldImage);
        console.log("🔍 Trying to delete old image:", oldImagePath);
        if (fsSync.existsSync(oldImagePath)) {
          try {
            await fs.unlink(oldImagePath);
            console.log("🗑 Deleted old image:", oldImagePath);
          } catch (err) {
            console.warn("⚠️ Failed to delete old image:", err.message);
          }
        } else {
          console.log("⚠️ Old image not found:", oldImagePath);
        }
      }
      finalImage = newImage;
    } else if (existingImage) {
      // Case B: frontend kept an existing image
      const normalizedExisting = existingImage
        .replace(/^products\//, "")
        .trim();

      if (oldImage && oldImage !== normalizedExisting) {
        const oldImagePath = path.join(uploadDir, oldImage);
        console.log("🔍 Trying to delete replaced image:", oldImagePath);
        if (fsSync.existsSync(oldImagePath)) {
          try {
            await fs.unlink(oldImagePath);
            console.log("🗑 Deleted replaced image:", oldImagePath);
          } catch (err) {
            console.warn("⚠️ Failed to delete replaced image:", err.message);
          }
        } else {
          console.log("⚠️ Replaced image not found:", oldImagePath);
        }
      }
      finalImage = normalizedExisting;
    } else {
      // Case C: nothing given → fallback to old
      finalImage = oldImage;
    }

    // 3. Normalize offerExpiry
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

    // 4. Update product info
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

    // 5. Parse and update variants
    parsedVariants =
      typeof variants === "string" ? JSON.parse(variants) : variants;

    if (!Array.isArray(parsedVariants)) {
      throw new Error("Variants must be an array");
    }

    // Delete old variants
    await connection.query(
      `DELETE FROM inventory_variants WHERE product_id = ?`,
      [id]
    );

    // Insert new variants
    for (const variant of parsedVariants) {
      const sizeString = Array.isArray(variant.size)
        ? variant.size.join(",")
        : String(variant.size);

      await connection.query(
        `INSERT INTO inventory_variants (product_id, color, size, quantity)
         VALUES (?, ?, ?, ?)`,
        [id, variant.color, sizeString, variant.quantity]
      );
    }

    // Commit transaction
    await connection.commit();

    res.json({
      message: "✅ Product and variants updated successfully",
      image: finalImage,
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

exports.deleteProduct = async (req, res) => {
  const { id } = req.params;
  const uploadDir = path.join(__dirname, "../../uploads/products");

  try {
    // Step 1: Get image name
    const [rows] = await db.query(`SELECT image FROM boutique_inventory WHERE id = ?`, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    let image = rows[0].image;
    if (!image) image = "";

    const cleanImage = image.replace(/^products\//, "").trim();
    const imagePath = path.join(uploadDir, cleanImage);
    // console.log("🧭 Full image path to delete:", imagePath);

    // Step 2: Delete product and variants
    await db.query(`DELETE FROM boutique_inventory WHERE id = ?`, [id]);
    await db.query(`DELETE FROM inventory_variants WHERE product_id = ?`, [id]);

    // Step 3: Delete image
    if (cleanImage && fsSync.existsSync(imagePath)) {
      await fs.unlink(imagePath);
      // console.log("🗑 Deleted image from folder:", cleanImage);
    } else {
      console.log("⚠️ Image file not found or already deleted.");
    }

    res.json({ message: "✅ Product and image deleted successfully" });

  } catch (error) {
    console.error("❌ Deletion failed:", error.message);
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
