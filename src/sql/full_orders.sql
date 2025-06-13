CREATE TABLE full_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id TEXT, -- changed from VARCHAR

  -- Customer Info
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  customer_address TEXT,

  -- Order Info
  subtotal DECIMAL(10,2),
  shipping DECIMAL(10,2),
  tax DECIMAL(10,2),
  total DECIMAL(10,2),

  -- Payment Info
  razorpay_payment_id TEXT,
  razorpay_order_id TEXT,
  razorpay_signature TEXT,

  -- Product Info
  product_id INT,
  product_name TEXT,
  price DECIMAL(10,2),
  quantity INT,
  color TEXT,
  size TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
