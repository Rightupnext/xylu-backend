const express = require("express");
const cors = require("cors");
const path = require("path"); // ✅ FIXED: Add this line
require("dotenv").config();

const app = express();

const authRoutes = require("./src/routes/authRoutes");
const userRoutes = require("./src/routes/userRoutes");
const HeroRoutes = require("./src/routes/heroRoutes");
const categoryRoutes = require("./src/routes/categoryRoutes");
const productRoutes = require("./src/routes/productRoutes");
const OrderRoutes = require("./src/routes/orderRoutes");
const ReviewRoutes = require("./src/routes/reviewRoutes");
const giftRoute = require("./src/routes/giftRoutes");
const deliveryPartnerRoutes = require("./src/routes/deliveryPartnerRoutes");
const barcodeTrackingRoutes = require("./src/routes/barcodeTrackingRoutes");
// app.use(cors());
app.use(cors({ origin: "*" }));
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/hero", HeroRoutes);
app.use("/categories", categoryRoutes);
app.use("/products", productRoutes);
app.use("/order", OrderRoutes);
app.use("/reviews", ReviewRoutes);
app.use("/gift", giftRoute);
app.use("/delivery-partners", deliveryPartnerRoutes);
app.use("/barcode", barcodeTrackingRoutes);
app.use(
  "/uploads/products",
  express.static(path.join(__dirname, "uploads/products")) // ✅ FIXED
);
app.use(
  "/uploads/hero",
  express.static(path.join(__dirname, "uploads/hero")) // ✅ FIXED
);
app.use(
  "/uploads/gifts",
  express.static(path.join(__dirname, "uploads/gifts")) // ✅ FIXED
);
app.get("/", (req, res) => {
  res.send("API Running...");
});

const PORT = process.env.PORT || 5000;
const IP = "192.168.1.8";
// app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
app.listen(PORT, IP, () => {
  console.log(`Server running at http://${IP}:${PORT}/`);
});

console.log("ENV ENCRYPTION_ENABLED:", process.env.ENCRYPTION_ENABLED);
console.log(
  "ENCRYPTION_ENABLED === 'true':",
  process.env.ENCRYPTION_ENABLED === "true"
);
