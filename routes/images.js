const express = require('express');
const router = express.Router();
const multer = require('multer');
const ImageProcessor = require('../utils/image-processor');
const { uploadLimiter } = require('../middleware/security');
const logger = require('../utils/logger');

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG and WebP are allowed.'));
    }
  }
});

// Handle image upload
router.post('/upload', uploadLimiter, upload.array('images', 5), async (req, res) => {
  try {
    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const processedImages = await Promise.all(
      files.map(file => ImageProcessor.processUploadedImage(file))
    );

    res.json({ images: processedImages });
  } catch (error) {
    logger.error('Error processing uploads:', error);
    res.status(500).json({ error: 'Failed to process uploaded images' });
  }
});

// Generate AI image
router.post('/generate-image', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Image prompt is required' });
    }

    const generatedImage = await ImageProcessor.generateImageWithDALLE(prompt);
    res.json({ image: generatedImage });
  } catch (error) {
    logger.error('Error generating image:', error);
    res.status(500).json({ error: 'Failed to generate image' });
  }
});

module.exports = router;
