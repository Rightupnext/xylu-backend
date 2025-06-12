const express = require("express");
const cors = require("cors");
const path = require("path"); // ✅ FIXED: Add this line
require("dotenv").config();

const app = express();

const authRoutes = require("./src/routes/authRoutes");
const userRoutes = require("./src/routes/userRoutes");
const categoryRoutes = require("./src/routes/categoryRoutes");
const productRoutes = require('./src/routes/productRoutes');

app.use(cors());
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/categories", categoryRoutes);
app.use('/products', productRoutes);

app.use(
  "/uploads/products",
  express.static(path.join(__dirname, "uploads/products")) // ✅ FIXED
);

app.get("/", (req, res) => {
  res.send("API Running...");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
