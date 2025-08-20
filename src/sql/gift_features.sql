CREATE TABLE GiftThreshold (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    image_url VARCHAR(512),
    threshold_amount DECIMAL(12,2) NOT NULL,
    start_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    end_date DATETIME NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE CustomerGiftHistory (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,                      -- FK to Users
    gift_threshold_id BIGINT NOT NULL,            -- FK to GiftThreshold
    cumulative_purchase DECIMAL(12,2) DEFAULT 0,  -- Purchases within this threshold
    eligible BOOLEAN DEFAULT FALSE,               -- True if threshold reached
    reached_at DATETIME DEFAULT NULL,            -- Timestamp when eligible
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY (user_id, gift_threshold_id),     -- One record per user per threshold
    FOREIGN KEY (gift_threshold_id) REFERENCES GiftThreshold(id)
);
