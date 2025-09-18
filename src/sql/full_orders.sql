CREATE TABLE full_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,

  -- Customer Info
  customer_id TEXT,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  customer_address TEXT,
  otp TEXT,
  -- Order Info
  subtotal DECIMAL(10,2),
  shipping DECIMAL(10,2),
  tax DECIMAL(10,2),
  total DECIMAL(10,2),

  -- Payment Info
  razorpay_payment_id TEXT,
  razorpay_order_id TEXT,
  razorpay_signature TEXT,
  razor_payment ENUM('done', 'failed') DEFAULT 'failed',

  -- Cart
  cart_items JSON,
  Barcode JSON,
  -- Delivery & Issue Info
  order_status ENUM('pending', 'packed', 'shipped', 'delivered','received','damaged','returned' ,'order-cancelled') DEFAULT 'pending',
  deliveryman_name TEXT,
  deliveryman_phone TEXT,
  issue_type ENUM('damaged', 'wrong-item-received', 'other','return') DEFAULT NULL,
  issue_product_code TEXT,
  issue_description TEXT,
  admin_issue_returnReply TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
