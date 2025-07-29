const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const cloudinary = require('cloudinary').v2;
const logger = require('./logger');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

class ImageProcessor {
  static async processUploadedImage(file) {
    try {
      const filename = `${uuidv4()}-${file.originalname}`;
      const outputPath = path.join(__dirname, '../uploads', filename);

      // Upload to Cloudinary
      const result = await cloudinary.uploader.upload(outputPath, {
        folder: 'gpt-site-gen',
        format: 'webp'
      });

      // Clean up local files
      fs.unlinkSync(file.path);
      fs.unlinkSync(outputPath);

      return {
        url: result.secure_url,
        width: result.width,
        height: result.height,
        format: result.format
      };
    } catch (error) {
      logger.error('Error processing image:', error);
      throw new Error('Failed to process image');
    }
  }

  static async generateImageWithDALLE(prompt) {
    try {
      const openai = new require('openai')(process.env.OPENAI_API_KEY);
      
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: "1024x1024",
      });

      // Download the generated image
      const imageUrl = response.data[0].url;
      const imageResponse = await fetch(imageUrl);
      const imageBuffer = await imageResponse.buffer();

      // Save temporarily and process like uploaded images
      const tempPath = path.join(__dirname, '../uploads', `${uuidv4()}.png`);
      fs.writeFileSync(tempPath, imageBuffer);

      // Process and upload to Cloudinary
      const result = await cloudinary.uploader.upload(tempPath, {
        folder: 'gpt-site-gen/ai-generated',
        format: 'webp'
      });

      // Clean up
      fs.unlinkSync(tempPath);

      return {
        url: result.secure_url,
        width: result.width,
        height: result.height,
        format: result.format
      };
    } catch (error) {
      logger.error('Error generating image with DALL-E:', error);
      throw new Error('Failed to generate image');
    }
  }
}

module.exports = ImageProcessor;
