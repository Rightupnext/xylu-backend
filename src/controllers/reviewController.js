const db = require('../db');

// Get all reviews
exports.getAllReviews = async (req, res) => {
  try {
    const [results] = await db.query('SELECT * FROM reviews ORDER BY created_at DESC');
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get reviews by productId
exports.getReviewsByProductId = async (req, res) => {
  const { productId } = req.params;
  try {
    const [results] = await db.query('SELECT * FROM reviews WHERE productId = ? ORDER BY created_at DESC', [productId]);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create a new review
exports.createReview = async (req, res) => {
  const { user_id, username, rating, title, review, productId } = req.body;

  if (!user_id || !username || !rating || !review || !productId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Check if user already reviewed this product
    const [existing] = await db.query(
      'SELECT * FROM reviews WHERE user_id = ? AND productId = ?',
      [user_id, productId]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'You have already reviewed this product.' });
    }

    // Insert the new review
    const [result] = await db.query(
      'INSERT INTO reviews (user_id, username, rating, title, review, productId) VALUES (?, ?, ?, ?, ?, ?)',
      [user_id, username, rating, title, review, productId]
    );

    res.json({ message: 'Review added', id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};



// Delete a review
exports.deleteReview = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM reviews WHERE review_id = ?', [id]);
    res.json({ message: 'Review deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
