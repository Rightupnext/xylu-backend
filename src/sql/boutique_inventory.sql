CREATE TABLE boutique_inventory (
    product_id INT PRIMARY KEY AUTO_INCREMENT,
    product_name VARCHAR(255) NOT NULL,
    product_code VARCHAR(100) UNIQUE,
    category VARCHAR(100),
    description TEXT,
    image TEXT,   
    price DECIMAL(10, 2) NOT NULL,
    discount DECIMAL(5, 2) DEFAULT 0.00,
    trend ENUM('new', 'bestseller', 'regular') DEFAULT 'regular',
    available_sizes JSON NOT NULL,
    available_colors JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
