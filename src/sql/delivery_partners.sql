CREATE TABLE delivery_partners (
  id INT AUTO_INCREMENT PRIMARY KEY,
  d_partner_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20) NOT NULL,
  address TEXT,
  district VARCHAR(100),
  zone VARCHAR(100),
  user_id INT,
  Count INT,
  Deivery_Products JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- relation with users table (only those with role = 'D-partner')
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
