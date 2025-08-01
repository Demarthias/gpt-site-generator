// index.js
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');
const bodyParser = require('body-parser');
const { Configuration, OpenAIApi } = require('openai');
const cloudinary = require('cloudinary').v2;

const app = express();
const PORT = process.env.PORT || 3000;

// Set up OpenAI
const openai = new OpenAIApi(new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
}));

// Set up Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Frontend route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Generate site content with OpenAI
app.post('/generate', async (req, res) => {
  try {
    const { topic } = req.body;

    const response = await openai.createChatCompletion({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a web copywriter and designer.' },
        { role: 'user', content: `Write a fun, friendly, and personal 3-section website based on this topic: ${topic}` }
      ],
    });

    const content = response.data.choices[0].message.content;

    res.json({ success: true, content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to generate content.' });
  }
});

// Upload image to Cloudinary
app.post('/upload', async (req, res) => {
  try {
    const { imageUrl } = req.body;
    const result = await cloudinary.uploader.upload(imageUrl, {
      folder: 'generated-sites'
    });
    res.json({ success: true, url: result.secure_url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Image upload failed.' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
