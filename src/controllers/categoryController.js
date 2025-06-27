const db = require('../db');

// Get all categories
exports.getAllCategories = async (req, res) => {
  try {
    const [results] = await db.query('SELECT * FROM categories');
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create new category
exports.createCategory = async (req, res) => {
  const { category_name } = req.body;
  // console.log("category_name",category_name)
  try {
    const [result] = await db.query(
      'INSERT INTO categories (category_name) VALUES (?)',
      [category_name]
    );
    res.json({ message: 'Category added', id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update category by ID
exports.updateCategoryById = async (req, res) => {
  const { id } = req.params;
  const { category_name } = req.body;
  try {
    const [result] = await db.query(
      'UPDATE categories SET category_name = ? WHERE id = ?',
      [category_name, id]
    );
    res.json({ message: 'Category updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete category
exports.deleteCategory = async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.query(
      'DELETE FROM categories WHERE id = ?',
      [id]
    );
    res.json({ message: 'Category deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
