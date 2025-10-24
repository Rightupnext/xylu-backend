const fs = require("fs");
const path = require("path");
const db = require("./src/db");

// 📁 Upload directories
const uploadDirs = {
  products: {
    folder: path.join(__dirname, "uploads/products"),
    dbTables: ["boutique_inventory"], // image or images
    dbColumns: ["image", "images"],
  },
  hero: {
    folder: path.join(__dirname, "uploads/hero"),
    dbTables: ["hero_images"],
    dbColumns: ["filename", "url"],
  },
  gifts: {
    folder: path.join(__dirname, "uploads/gifts"),
    dbTables: ["GiftThreshold"],
    dbColumns: ["image_url"],
  },
  barcodes: {
    folder: path.join(__dirname, "uploads/barcodes"),
    dbTables: ["order_barcodes"],
    dbColumns: ["barcode_image_path"],
  },
};

// 🧠 Helper: normalize filenames
function normalizeName(file) {
  if (!file) return "";
  return path.basename(file).trim().toLowerCase().replace(/\s+/g, "");
}

// 🗑️ Main Cleanup Function
async function cleanUnusedFiles() {
  const connection = await db.getConnection();

  try {
    console.log("🧹 Starting full upload cleanup...");

    for (const [key, cfg] of Object.entries(uploadDirs)) {
      const { folder, dbTables, dbColumns } = cfg;

      console.log(`\n📂 Checking folder: ${folder}`);

      if (!fs.existsSync(folder)) {
        console.warn(`⚠️ Folder not found: ${folder}`);
        continue;
      }

      // 🧾 Collect DB image filenames
      const dbFiles = new Set();

      for (const table of dbTables) {
        for (const column of dbColumns) {
          try {
            const [rows] = await connection.query(`SELECT ${column} FROM ${table}`);
            rows.forEach((row) => {
              const value = row[column];
              if (!value) return;

              if (typeof value === "string" && value.trim() !== "") {
                if (value.includes("[") && value.includes("]")) {
                  // JSON array of images
                  try {
                    const arr = JSON.parse(value);
                    arr.forEach((img) => dbFiles.add(normalizeName(img)));
                  } catch {
                    dbFiles.add(normalizeName(value));
                  }
                } else {
                  dbFiles.add(normalizeName(value));
                }
              }
            });
          } catch (err) {
            console.error(`❌ Query failed for ${table}.${column}:`, err.message);
          }
        }
      }

      console.log(`🗂️ DB image count: ${dbFiles.size}`);

      // 🧾 Read local folder files
      const localFiles = fs.readdirSync(folder);
      let deletedCount = 0;

      for (const file of localFiles) {
        const normalizedFile = normalizeName(file);
        const existsInDB = dbFiles.has(normalizedFile);

        if (!existsInDB) {
          const filePath = path.join(folder, file);
          try {
            fs.unlinkSync(filePath);
            deletedCount++;
            console.log(`🗑️ Deleted unused file: ${filePath}`);
          } catch (err) {
            console.warn(`⚠️ Failed to delete ${filePath}: ${err.message}`);
          }
        }
      }

      console.log(`✅ ${key.toUpperCase()} cleanup complete. Deleted: ${deletedCount} files.`);
    }

    console.log("\n🎯 All upload folders cleaned successfully!");
  } catch (err) {
    console.error("❌ Cleanup failed:", err.message);
  } finally {
    connection.release();
  }
}

module.exports = cleanUnusedFiles;

// Run directly (manual trigger)
if (require.main === module) {
  cleanUnusedFiles();
}
