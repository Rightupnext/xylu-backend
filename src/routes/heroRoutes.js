const express = require('express');
const router = express.Router();
const { upload, uploadHeroImage,getAllHeroImages,deleteHeroImage } = require('../controllers/heroController');

router.post('/upload-hero', upload.single('heroImage'), uploadHeroImage);
// Get all hero images
router.get('/get-heroes', getAllHeroImages);

// Delete a hero image by filename
router.delete('/delete-hero/:filename', deleteHeroImage);
module.exports = router;
