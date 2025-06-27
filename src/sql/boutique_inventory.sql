CREATE TABLE boutique_inventory (
    id INT PRIMARY KEY AUTO_INCREMENT,
    product_name VARCHAR(255) NOT NULL,
    product_code VARCHAR(100) UNIQUE,
    category VARCHAR(100),
    description TEXT,
    image TEXT,
    price INT NOT NULL,              -- Changed from DECIMAL(10, 2) to INT
    discount INT DEFAULT 0,          -- Changed from DECIMAL(5, 2) to INT
    Bulk_discount INT DEFAULT 0,  
    offerExpiry JSON,
    trend ENUM('new', 'bestseller', 'regular') DEFAULT 'regular',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE inventory_variants (
    id INT PRIMARY KEY AUTO_INCREMENT,
    product_id INT,
    color VARCHAR(50),
    size VARCHAR(100),  -- comma-separated sizes
    quantity INT DEFAULT 0,
    FOREIGN KEY (product_id) REFERENCES boutique_inventory(id) ON DELETE CASCADE
);
