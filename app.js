require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const axios = require('axios');
const bodyParser = require('body-parser');
const multer = require('multer');
const { setupSecurity } = require('./middleware/security');
const { validateGenerateInput } = require('./middleware/validation');
const { errorHandler, notFoundHandler } = require('./middleware/error-handler');
const logger = require('./utils/logger');

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only images are allowed'));
    }
    cb(null, true);
  }
});

const app = express();

// Setup security middleware
setupSecurity(app);

// Basic middleware
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(express.static('public', {
  maxAge: '1h',
  etag: true
}));
app.use('/uploads', express.static('uploads', {
  maxAge: '1h',
  etag: true
}));

// Image handling routes
const imageRoutes = require('./routes/images');
app.use('/api/images', imageRoutes);

const TEMPLATE_PATH = path.join(__dirname, 'templates', 'basic.html');

// Handle image uploads
app.post('/upload', upload.array('images', 5), (req, res) => {
  try {
    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    const fileUrls = files.map(file => `/uploads/${file.filename}`);
    res.json({ urls: fileUrls });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/generate', async (req, res) => {
  try {
    const { biz, niche, theme = 'light', images = [] } = req.body;

    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not set');
    }

    const prompt = `Write a homepage headline, intro, about, and contact info for a business called "${biz}" in the "${niche}" niche. Return as JSON like:
    {
      "headline": "...",
      "intro": "...",
      "about": "...",
      "contact": "..."
    }`;

    const gptResponse = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
    }, {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }
    });

    const content = JSON.parse(gptResponse.data.choices[0].message.content);
    let htmlTemplate = fs.readFileSync(TEMPLATE_PATH, 'utf-8');

    // Add theme styles
    const themeClass = theme === 'dark' ? 'dark-theme' : 'light-theme';
    htmlTemplate = htmlTemplate.replace('<body>', `<body class="${themeClass}">`);

    // Replace content placeholders
    const filledHTML = htmlTemplate
      .replace(/{{biz}}/g, biz)
      .replace('{{headline}}', content.headline)
      .replace('{{intro}}', content.intro)
      .replace('{{about}}', content.about)
      .replace('{{contact}}', content.contact);

    const siteDir = path.join(__dirname, 'generated', biz.replace(/\s+/g, '_'));
    const filePath = path.join(siteDir, 'index.html');

    // Create site directory and write HTML
    fs.mkdirSync(siteDir, { recursive: true });
    fs.writeFileSync(filePath, filledHTML);

    // Copy images if they exist
    if (images.length > 0) {
      const imagesDir = path.join(siteDir, 'images');
      fs.mkdirSync(imagesDir, { recursive: true });
      
      for (const imgPath of images) {
        const filename = path.basename(imgPath);
        const sourcePath = path.join(__dirname, 'uploads', filename);
        const destPath = path.join(imagesDir, filename);
        if (fs.existsSync(sourcePath)) {
          fs.copyFileSync(sourcePath, destPath);
        }
      }
    }

    // Create zip file
    const zipPath = path.join(__dirname, 'generated', `${biz.replace(/\s+/g, '_')}.zip`);
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip');

    output.on('close', () => {
      res.download(zipPath, 'website.zip', (err) => {
        if (err) {
          console.error('Error downloading file:', err);
        }
        // Clean up files after download
        fs.unlinkSync(zipPath);
        fs.rmSync(siteDir, { recursive: true, force: true });
      });
    });

    archive.on('error', (err) => {
      throw err;
    });

    archive.pipe(output);
    archive.directory(siteDir, false);
    await archive.finalize();

  } catch (error) {
    console.error('Error generating site:', error);
    res.status(500).json({ 
      error: 'An error occurred while generating the site',
      details: error.message
    });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
