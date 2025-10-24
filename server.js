const express = require("express");
const cors = require("cors");
const path = require("path");
const cron = require("node-cron");
require("dotenv").config();
const http = require("http");

const app = express();
const { initSocket } = require("./src/socket/socket");

// Route imports
const authRoutes = require("./src/routes/authRoutes");
const userRoutes = require("./src/routes/userRoutes");
const heroRoutes = require("./src/routes/heroRoutes");
const categoryRoutes = require("./src/routes/categoryRoutes");
const productRoutes = require("./src/routes/productRoutes");
const orderRoutes = require("./src/routes/orderRoutes");
const reviewRoutes = require("./src/routes/reviewRoutes");
const giftRoutes = require("./src/routes/giftRoutes");
const deliveryPartnerRoutes = require("./src/routes/deliveryPartnerRoutes");
const barcodeTrackingRoutes = require("./src/routes/barcodeTrackingRoutes");
const cleanUnusedFiles = require("./cleanUnusedFiles");

// Middleware
app.use(cors({ origin: "*" }));
app.use(express.json());

// Routes
app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/hero", heroRoutes);
app.use("/categories", categoryRoutes);
app.use("/products", productRoutes);
app.use("/order", orderRoutes);
app.use("/reviews", reviewRoutes);
app.use("/gift", giftRoutes);
app.use("/delivery-partners", deliveryPartnerRoutes);
app.use("/barcode", barcodeTrackingRoutes);

// Static file serving
app.use("/uploads/products", express.static(path.join(__dirname, "uploads/products")));
app.use("/uploads/hero", express.static(path.join(__dirname, "uploads/hero")));
app.use("/uploads/gifts", express.static(path.join(__dirname, "uploads/gifts")));
app.use("/uploads/barcodes", express.static(path.join(__dirname, "uploads/barcodes")));

// Default route
app.get("/", (req, res) => {
  res.send("API Running...");
});

// Server setup
const PORT = process.env.PORT || 5000;
const IP = process.env.IP || "localhost";

const server = http.createServer(app);
initSocket(server);

// Cleanup before start
(async () => {
  console.log("🕒 Starting cleanup before server launch...");
  await cleanUnusedFiles();

  server.listen(PORT, IP, () => {
    console.log(`🚀 Server running at http://${IP}:${PORT}/`);
  });
})();

// Scheduled cleanup job every hour
cron.schedule("0 * * * *", () => {
  console.log("🕑 Running auto-clean job...");
  cleanUnusedFiles();
});
