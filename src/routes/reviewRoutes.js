const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');

// Routes
router.get('/', reviewController.getAllReviews);
router.get('/product_review/:productId', reviewController.getReviewsByProductId);
router.post('/', reviewController.createReview);
router.delete('/:id', reviewController.deleteReview);

module.exports = router;
