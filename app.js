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

// Helper functions for generating 3-page websites
function generateCSS(styling) {
  return `
/* Reset and Base Styles */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Inter', sans-serif;
  line-height: 1.6;
  color: ${styling.textColor};
  background: ${styling.backgroundColor};
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
}

/* Navigation */
nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  z-index: 1000;
  padding: 1rem 0;
  box-shadow: 0 2px 20px rgba(0,0,0,0.1);
}

.nav-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo {
  font-size: 1.5rem;
  font-weight: 700;
  color: ${styling.primaryColor};
  text-decoration: none;
}

.nav-links {
  display: flex;
  gap: 2rem;
  list-style: none;
}

.nav-links a {
  text-decoration: none;
  color: ${styling.textColor};
  font-weight: 500;
  transition: color 0.3s ease;
}

.nav-links a:hover {
  color: ${styling.primaryColor};
}

/* Hero Section */
.hero {
  padding: 8rem 0 4rem;
  background: linear-gradient(135deg, ${styling.primaryColor}, ${styling.secondaryColor});
  color: white;
  text-align: center;
}

.hero h1 {
  font-size: 3.5rem;
  margin-bottom: 1rem;
  font-weight: 800;
}

.hero p {
  font-size: 1.3rem;
  margin-bottom: 2rem;
  opacity: 0.9;
}

.btn {
  display: inline-block;
  background: ${styling.accentColor};
  color: white;
  padding: 1rem 2rem;
  text-decoration: none;
  border-radius: 50px;
  font-weight: 600;
  transition: transform 0.3s ease;
}

.btn:hover {
  transform: translateY(-3px);
}

/* Sections */
section {
  padding: 5rem 0;
}

.section-title {
  font-size: 2.5rem;
  text-align: center;
  margin-bottom: 3rem;
  color: ${styling.primaryColor};
}

/* Cards */
.card {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 5px 15px rgba(0,0,0,0.1);
  transition: transform 0.3s ease;
}

.card:hover {
  transform: translateY(-5px);
}

.services-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}

.values-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
}

.team-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 2rem;
}

/* Contact Form */
.contact-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4rem;
  align-items: start;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 1rem;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 1rem;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: ${styling.primaryColor};
}

/* Footer */
footer {
  background: #2c3e50;
  color: white;
  padding: 3rem 0 1rem;
  text-align: center;
}

/* Responsive */
@media (max-width: 768px) {
  .hero h1 { font-size: 2.5rem; }
  .nav-links { display: none; }
  .contact-grid { grid-template-columns: 1fr; gap: 2rem; }
  .container { padding: 0 1rem; }
}
`;
}

function generateLandingPage(businessName, niche, content) {
  const servicesHTML = content.landing.services.map(service => `
    <div class="card">
      <i class="${service.icon}" style="font-size: 2.5rem; color: ${content.styling.primaryColor}; margin-bottom: 1rem;"></i>
      <h3>${service.title}</h3>
      <p>${service.description}</p>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${businessName} - ${niche}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <nav>
        <div class="container">
            <div class="nav-content">
                <a href="index.html" class="logo">${businessName}</a>
                <ul class="nav-links">
                    <li><a href="index.html">Home</a></li>
                    <li><a href="about.html">About</a></li>
                    <li><a href="contact.html">Contact</a></li>
                </ul>
            </div>
        </div>
    </nav>

    <section class="hero">
        <div class="container">
            <h1>${content.landing.heroTitle}</h1>
            <p>${content.landing.heroSubtitle}</p>
            <a href="contact.html" class="btn">${content.landing.heroButton}</a>
        </div>
    </section>

    <section>
        <div class="container">
            <h2 class="section-title">About Us</h2>
            <div style="max-width: 800px; margin: 0 auto; text-align: center;">
                <p style="font-size: 1.1rem; line-height: 1.8;">${content.landing.aboutPreview}</p>
            </div>
        </div>
    </section>

    <section style="background: #f8f9fa;">
        <div class="container">
            <h2 class="section-title">Our Services</h2>
            <div class="services-grid">
                ${servicesHTML}
            </div>
        </div>
    </section>

    <section>
        <div class="container">
            <h2 class="section-title">What Our Clients Say</h2>
            <div style="max-width: 600px; margin: 0 auto; text-align: center;">
                <blockquote style="font-size: 1.2rem; font-style: italic; margin-bottom: 1rem;">
                    "${content.landing.testimonial.quote}"
                </blockquote>
                <cite style="font-weight: 600;">
                    ${content.landing.testimonial.author}, ${content.landing.testimonial.company}
                </cite>
            </div>
        </div>
    </section>

    <footer>
        <div class="container">
            <p>&copy; 2025 ${businessName}. All rights reserved.</p>
        </div>
    </footer>
</body>
</html>`;
}

function generateAboutPage(businessName, niche, content) {
  const valuesHTML = content.about.values.map(value => `
    <div class="card">
      <h3>${value.title}</h3>
      <p>${value.description}</p>
    </div>
  `).join('');

  const teamHTML = content.about.team.map(member => `
    <div class="card">
      <h3>${member.name}</h3>
      <h4 style="color: ${content.styling.primaryColor}; margin-bottom: 1rem;">${member.role}</h4>
      <p>${member.bio}</p>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>About - ${businessName}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <nav>
        <div class="container">
            <div class="nav-content">
                <a href="index.html" class="logo">${businessName}</a>
                <ul class="nav-links">
                    <li><a href="index.html">Home</a></li>
                    <li><a href="about.html">About</a></li>
                    <li><a href="contact.html">Contact</a></li>
                </ul>
            </div>
        </div>
    </nav>

    <section class="hero">
        <div class="container">
            <h1>${content.about.title}</h1>
        </div>
    </section>

    <section>
        <div class="container">
            <div style="max-width: 800px; margin: 0 auto;">
                <h2 class="section-title">Our Story</h2>
                <p style="font-size: 1.1rem; line-height: 1.8; margin-bottom: 2rem;">${content.about.story}</p>
                
                <h3 style="color: ${content.styling.primaryColor}; margin-bottom: 1rem;">Our Mission</h3>
                <p style="font-size: 1.1rem; line-height: 1.8;">${content.about.mission}</p>
            </div>
        </div>
    </section>

    <section style="background: #f8f9fa;">
        <div class="container">
            <h2 class="section-title">Our Values</h2>
            <div class="values-grid">
                ${valuesHTML}
            </div>
        </div>
    </section>

    <section>
        <div class="container">
            <h2 class="section-title">Our Team</h2>
            <div class="team-grid">
                ${teamHTML}
            </div>
        </div>
    </section>

    <footer>
        <div class="container">
            <p>&copy; 2025 ${businessName}. All rights reserved.</p>
        </div>
    </footer>
</body>
</html>`;
}

function generateContactPage(businessName, niche, content) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Contact - ${businessName}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <nav>
        <div class="container">
            <div class="nav-content">
                <a href="index.html" class="logo">${businessName}</a>
                <ul class="nav-links">
                    <li><a href="index.html">Home</a></li>
                    <li><a href="about.html">About</a></li>
                    <li><a href="contact.html">Contact</a></li>
                </ul>
            </div>
        </div>
    </nav>

    <section class="hero">
        <div class="container">
            <h1>${content.contact.title}</h1>
            <p>${content.contact.description}</p>
        </div>
    </section>

    <section>
        <div class="container">
            <div class="contact-grid">
                <div class="card">
                    <h3>Send us a message</h3>
                    <form>
                        <div class="form-group">
                            <label for="name">Name</label>
                            <input type="text" id="name" name="name" required>
                        </div>
                        <div class="form-group">
                            <label for="email">Email</label>
                            <input type="email" id="email" name="email" required>
                        </div>
                        <div class="form-group">
                            <label for="subject">Subject</label>
                            <input type="text" id="subject" name="subject" required>
                        </div>
                        <div class="form-group">
                            <label for="message">Message</label>
                            <textarea id="message" name="message" rows="5" required></textarea>
                        </div>
                        <button type="submit" class="btn" style="width: 100%;">Send Message</button>
                    </form>
                </div>
                
                <div>
                    <div class="card">
                        <h3>Get in Touch</h3>
                        <div style="margin-bottom: 1.5rem;">
                            <i class="fas fa-map-marker-alt" style="color: ${content.styling.primaryColor}; margin-right: 1rem;"></i>
                            ${content.contact.address}
                        </div>
                        <div style="margin-bottom: 1.5rem;">
                            <i class="fas fa-phone" style="color: ${content.styling.primaryColor}; margin-right: 1rem;"></i>
                            ${content.contact.phone}
                        </div>
                        <div style="margin-bottom: 1.5rem;">
                            <i class="fas fa-envelope" style="color: ${content.styling.primaryColor}; margin-right: 1rem;"></i>
                            ${content.contact.email}
                        </div>
                        <div>
                            <i class="fas fa-clock" style="color: ${content.styling.primaryColor}; margin-right: 1rem;"></i>
                            ${content.contact.hours}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <footer>
        <div class="container">
            <p>&copy; 2025 ${businessName}. All rights reserved.</p>
        </div>
    </footer>

    <script>
        document.querySelector('form').addEventListener('submit', function(e) {
            e.preventDefault();
            alert('Thank you for your message! We will get back to you soon.');
            this.reset();
        });
    </script>
</body>
</html>`;
}

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

app.post('/generate', validateGenerateInput, async (req, res) => {
  try {
    const { biz, niche, theme = 'light', websiteType = 'business', images = [] } = req.body;

    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not set');
    }

    console.log(`Generating 3-page website for ${biz} in ${niche} industry...`);

    // Generate content for all 3 pages using OpenAI
    const prompt = `Create comprehensive content for a professional 3-page website for "${biz}" in the "${niche}" industry (type: ${websiteType}). 

Return a JSON object with this exact structure:
{
  "branding": {
    "tagline": "Catchy tagline for the business",
    "description": "Brief 1-sentence description of what they do"
  },
  "colors": {
    "primary": "Primary brand color hex code",
    "secondary": "Secondary color hex",
    "accent": "Accent color hex"
  },
  "landing": {
    "hero": {
      "headline": "Compelling main headline",
      "subheading": "Supporting text (2-3 sentences)",
      "ctaText": "Call-to-action button text"
    },
    "services": [
      {
        "title": "Service 1",
        "description": "Detailed service description",
        "icon": "Font Awesome icon class (e.g., fas fa-star)"
      },
      {
        "title": "Service 2", 
        "description": "Detailed service description",
        "icon": "Font Awesome icon class"
      },
      {
        "title": "Service 3",
        "description": "Detailed service description", 
        "icon": "Font Awesome icon class"
      }
    ],
    "stats": [
      {"number": "Statistic", "label": "Description"},
      {"number": "Statistic", "label": "Description"},
      {"number": "Statistic", "label": "Description"}
    ]
  },
  "about": {
    "headline": "About page main heading",
    "story": "Company story and background (3-4 paragraphs)",
    "mission": "Mission statement",
    "values": [
      {"title": "Value 1", "description": "Value description"},
      {"title": "Value 2", "description": "Value description"},
      {"title": "Value 3", "description": "Value description"}
    ],
    "team": [
      {"name": "Team member name", "position": "Job title", "bio": "Brief bio"}
    ]
  },
  "contact": {
    "headline": "Contact page heading",
    "subtitle": "Welcoming message encouraging contact",
    "address": "Full business address",
    "phone": "Phone number",
    "email": "Professional email address",
    "hours": "Business hours"
  }
}

Make all content professional, engaging, and specific to the ${niche} industry.`;

    let gptResponse;
    let content;

    try {
      gptResponse = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7
      }, {
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }
      });
      
      console.log('OpenAI response received, parsing content...');
      content = JSON.parse(gptResponse.data.choices[0].message.content);
    } catch (err) {
      console.error('Error with OpenAI API or JSON parsing:', err);
      return res.status(500).json({ 
        error: 'OpenAI API or JSON error', 
        details: err.message 
      });
    }

    // Create the site directory
    const siteDir = path.join(__dirname, 'generated', biz.replace(/\s+/g, '_'));
    fs.mkdirSync(siteDir, { recursive: true });

    // Generate base CSS styles
    const baseCSS = `
      :root {
        --primary-color: ${content.colors.primary};
        --secondary-color: ${content.colors.secondary};
        --accent-color: ${content.colors.accent};
        --text-primary: #2c3e50;
        --text-secondary: #7f8c8d;
        --background: #ffffff;
        --light-bg: #f8f9fa;
      }
      
      * { margin: 0; padding: 0; box-sizing: border-box; }
      
      body {
        font-family: 'Inter', sans-serif;
        line-height: 1.6;
        color: var(--text-primary);
        background: var(--background);
      }
      
      .container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 0 2rem;
      }
      
      nav {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(20px);
        z-index: 1000;
        padding: 1rem 0;
        box-shadow: 0 2px 20px rgba(0,0,0,0.1);
      }
      
      .nav-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .logo {
        font-size: 1.8rem;
        font-weight: 700;
        text-decoration: none;
        color: var(--primary-color);
      }
      
      .nav-links {
        display: flex;
        gap: 2rem;
        list-style: none;
      }
      
      .nav-links a {
        text-decoration: none;
        color: var(--text-primary);
        font-weight: 500;
        transition: color 0.3s ease;
      }
      
      .nav-links a:hover { color: var(--primary-color); }
      
      .hero {
        padding: 8rem 0 4rem;
        background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
        color: white;
        text-align: center;
      }
      
      .hero h1 {
        font-size: 3.5rem;
        font-weight: 800;
        margin-bottom: 1rem;
      }
      
      .hero p {
        font-size: 1.3rem;
        margin-bottom: 2rem;
        opacity: 0.9;
      }
      
      .cta-button {
        display: inline-block;
        background: var(--accent-color);
        color: white;
        padding: 1rem 2.5rem;
        text-decoration: none;
        border-radius: 8px;
        font-weight: 600;
        transition: transform 0.3s ease;
      }
      
      .cta-button:hover { transform: translateY(-3px); }
      
      section { padding: 5rem 0; }
      .section-title {
        font-size: 2.5rem;
        font-weight: 700;
        text-align: center;
        margin-bottom: 3rem;
      }
      
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 2rem;
        margin-top: 3rem;
      }
      
      .card {
        background: white;
        padding: 2.5rem;
        border-radius: 12px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        text-align: center;
        transition: transform 0.3s ease;
      }
      
      .card:hover { transform: translateY(-10px); }
      .card .icon {
        font-size: 3rem;
        color: var(--primary-color);
        margin-bottom: 1.5rem;
      }
      
      .stats {
        background: var(--primary-color);
        color: white;
        text-align: center;
      }
      
      .stat-item h3 {
        font-size: 3rem;
        font-weight: 800;
        margin-bottom: 0.5rem;
      }
      
      footer {
        background: var(--text-primary);
        color: white;
        padding: 2rem 0;
        text-align: center;
      }
      
      .contact-form {
        background: white;
        padding: 3rem;
        border-radius: 12px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.1);
      }
      
      .form-group {
        margin-bottom: 1.5rem;
      }
      
      .form-group label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: 500;
      }
      
      .form-group input,
      .form-group textarea {
        width: 100%;
        padding: 1rem;
        border: 2px solid #e1e5e9;
        border-radius: 8px;
        font-size: 1rem;
      }
      
      .submit-btn {
        background: var(--primary-color);
        color: white;
        padding: 1rem 2rem;
        border: none;
        border-radius: 8px;
        font-size: 1.1rem;
        font-weight: 600;
        cursor: pointer;
      }
      
      @media (max-width: 768px) {
        .hero h1 { font-size: 2.5rem; }
        .nav-links { display: none; }
        .container { padding: 0 1rem; }
      }
    `;

    // Generate Landing Page (index.html)
    const landingHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${biz} - ${content.branding.tagline}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
    <style>${baseCSS}</style>
</head>
<body>
    <nav>
        <div class="container">
            <div class="nav-content">
                <a href="index.html" class="logo">${biz}</a>
                <ul class="nav-links">
                    <li><a href="index.html">Home</a></li>
                    <li><a href="about.html">About</a></li>
                    <li><a href="contact.html">Contact</a></li>
                </ul>
            </div>
        </div>
    </nav>

    <section class="hero">
        <div class="container">
            <h1>${content.landing.hero.headline}</h1>
            <p>${content.landing.hero.subheading}</p>
            <a href="contact.html" class="cta-button">${content.landing.hero.ctaText}</a>
        </div>
    </section>

    <section>
        <div class="container">
            <h2 class="section-title">Our Services</h2>
            <div class="grid">
                ${content.landing.services.map(service => `
                    <div class="card">
                        <div class="icon"><i class="${service.icon}"></i></div>
                        <h3>${service.title}</h3>
                        <p>${service.description}</p>
                    </div>
                `).join('')}
            </div>
        </div>
    </section>

    <section class="stats">
        <div class="container">
            <h2 class="section-title" style="color: white;">Why Choose Us</h2>
            <div class="grid">
                ${content.landing.stats.map(stat => `
                    <div class="stat-item">
                        <h3>${stat.number}</h3>
                        <p>${stat.label}</p>
                    </div>
                `).join('')}
            </div>
        </div>
    </section>

    <footer>
        <div class="container">
            <p>&copy; 2025 ${biz}. All rights reserved.</p>
        </div>
    </footer>
</body>
</html>`;

    // Generate About Page
    const aboutHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>About - ${biz}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
    <style>${baseCSS}</style>
</head>
<body>
    <nav>
        <div class="container">
            <div class="nav-content">
                <a href="index.html" class="logo">${biz}</a>
                <ul class="nav-links">
                    <li><a href="index.html">Home</a></li>
                    <li><a href="about.html">About</a></li>
                    <li><a href="contact.html">Contact</a></li>
                </ul>
            </div>
        </div>
    </nav>

    <section style="padding-top: 8rem;">
        <div class="container">
            <h1 class="section-title">${content.about.headline}</h1>
            <div style="max-width: 800px; margin: 0 auto; text-align: center; font-size: 1.1rem; line-height: 1.8;">
                <p style="margin-bottom: 2rem;">${content.about.story}</p>
                <div style="background: var(--light-bg); padding: 2rem; border-radius: 12px; margin: 3rem 0;">
                    <h3 style="color: var(--primary-color); margin-bottom: 1rem;">Our Mission</h3>
                    <p>${content.about.mission}</p>
                </div>
            </div>
        </div>
    </section>

    <section>
        <div class="container">
            <h2 class="section-title">Our Values</h2>
            <div class="grid">
                ${content.about.values.map(value => `
                    <div class="card">
                        <h3>${value.title}</h3>
                        <p>${value.description}</p>
                    </div>
                `).join('')}
            </div>
        </div>
    </section>

    ${content.about.team && content.about.team.length > 0 ? `
    <section style="background: var(--light-bg);">
        <div class="container">
            <h2 class="section-title">Meet Our Team</h2>
            <div class="grid">
                ${content.about.team.map(member => `
                    <div class="card">
                        <h3>${member.name}</h3>
                        <h4 style="color: var(--primary-color); margin-bottom: 1rem;">${member.position}</h4>
                        <p>${member.bio}</p>
                    </div>
                `).join('')}
            </div>
        </div>
    </section>
    ` : ''}

    <footer>
        <div class="container">
            <p>&copy; 2025 ${biz}. All rights reserved.</p>
        </div>
    </footer>
</body>
</html>`;

    // Generate Contact Page
    const contactHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Contact - ${biz}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
    <style>${baseCSS}</style>
</head>
<body>
    <nav>
        <div class="container">
            <div class="nav-content">
                <a href="index.html" class="logo">${biz}</a>
                <ul class="nav-links">
                    <li><a href="index.html">Home</a></li>
                    <li><a href="about.html">About</a></li>
                    <li><a href="contact.html">Contact</a></li>
                </ul>
            </div>
        </div>
    </nav>

    <section style="padding-top: 8rem;">
        <div class="container">
            <h1 class="section-title">${content.contact.headline}</h1>
            <p style="text-align: center; font-size: 1.2rem; margin-bottom: 3rem;">${content.contact.subtitle}</p>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4rem; align-items: start;">
                <div class="contact-form">
                    <form>
                        <div class="form-group">
                            <label for="name">Name</label>
                            <input type="text" id="name" name="name" required>
                        </div>
                        <div class="form-group">
                            <label for="email">Email</label>
                            <input type="email" id="email" name="email" required>
                        </div>
                        <div class="form-group">
                            <label for="message">Message</label>
                            <textarea id="message" name="message" rows="5" required></textarea>
                        </div>
                        <button type="submit" class="submit-btn">Send Message</button>
                    </form>
                </div>
                
                <div>
                    <h3 style="margin-bottom: 2rem; color: var(--primary-color);">Get in Touch</h3>
                    <div style="margin-bottom: 1.5rem;">
                        <h4><i class="fas fa-map-marker-alt" style="color: var(--primary-color); margin-right: 1rem;"></i>Address</h4>
                        <p style="margin-left: 2rem;">${content.contact.address}</p>
                    </div>
                    <div style="margin-bottom: 1.5rem;">
                        <h4><i class="fas fa-phone" style="color: var(--primary-color); margin-right: 1rem;"></i>Phone</h4>
                        <p style="margin-left: 2rem;">${content.contact.phone}</p>
                    </div>
                    <div style="margin-bottom: 1.5rem;">
                        <h4><i class="fas fa-envelope" style="color: var(--primary-color); margin-right: 1rem;"></i>Email</h4>
                        <p style="margin-left: 2rem;">${content.contact.email}</p>
                    </div>
                    <div style="margin-bottom: 1.5rem;">
                        <h4><i class="fas fa-clock" style="color: var(--primary-color); margin-right: 1rem;"></i>Hours</h4>
                        <p style="margin-left: 2rem;">${content.contact.hours}</p>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <footer>
        <div class="container">
            <p>&copy; 2025 ${biz}. All rights reserved.</p>
        </div>
    </footer>

    <script>
        document.querySelector('.contact-form form').addEventListener('submit', function(e) {
            e.preventDefault();
            alert('Thank you for your message! We will get back to you soon.');
            this.reset();
        });
    </script>
</body>
</html>`;

    // Write all three pages
    fs.writeFileSync(path.join(siteDir, 'index.html'), landingHTML);
    fs.writeFileSync(path.join(siteDir, 'about.html'), aboutHTML);
    fs.writeFileSync(path.join(siteDir, 'contact.html'), contactHTML);

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
      console.log(`3-page website generated! Archive size: ${archive.pointer()} bytes`);
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

    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not set');
    }

    // Define website type specific features
    const websiteTypes = {
      retail: {
        sections: ['Products', 'Shopping Cart', 'Checkout', 'Order Tracking', 'Returns Policy'],
        features: ['Product catalog', 'Shopping cart', 'Secure checkout', 'Order management', 'Customer accounts']
      },
      blog: {
        sections: ['Featured Posts', 'Categories', 'Archives', 'Author Profiles', 'Newsletter'],
        features: ['Article feed', 'Comment system', 'Search functionality', 'Category filtering', 'Social sharing']
      },
      business: {
        sections: ['Services', 'About', 'Portfolio', 'Testimonials', 'Contact'],
        features: ['Service showcase', 'Team profiles', 'Client testimonials', 'Contact forms', 'Location map']
      },
      portfolio: {
        sections: ['Projects', 'Skills', 'Experience', 'Achievements', 'Contact'],
        features: ['Project gallery', 'Skills showcase', 'Resume download', 'Work timeline', 'Contact form']
      },
      restaurant: {
        sections: ['Menu', 'Reservations', 'Specials', 'Location', 'Reviews'],
        features: ['Online menu', 'Table booking', 'Food gallery', 'Opening hours', 'Delivery options']
      }
    };

    const prompt = `Create a visually stunning, modern multi-page website for "${biz}" in the "${niche}" industry. The design should feature a bold color scheme, playful typography, rounded corners, and an engaging layout with these specific styling elements:

    - Use a vibrant, modern color palette
    - Implement floating card designs with subtle shadows
    - Include rounded corners (16-20px radius) on all elements
    - Use playful, modern typography combinations
    - Incorporate relevant high-quality Unsplash photos
    - Add micro-interactions and hover effects
    - Use ample white space for clean layout
    - Include gradient overlays on images
    - Implement a modern grid system

    Include content for Home, About, Services, Portfolio/Gallery, Blog, and Contact pages. For each section requiring images, include specific Unsplash photo search queries. Return as JSON with the following structure:
    {
      "global": {
        "navigation": ["List of 5-6 main navigation items"],
        "footer": {
          "socialLinks": ["Array of social media platform names with Font Awesome icon classes"],
          "address": "Business full address",
          "quickLinks": ["Array of 4-5 important page links"],
          "copyright": "Copyright text"
        },
        "styling": {
          "colors": {
            "primary": "Vibrant primary color hex code",
            "secondary": "Complementary secondary color hex code",
            "accent": "Bold accent color hex code",
            "gradient": {
              "start": "Gradient start color",
              "end": "Gradient end color"
            },
            "background": "Light background color",
            "card": "Card background color",
            "text": {
              "primary": "Main text color",
              "secondary": "Secondary text color",
              "accent": "Accent text color"
            }
          },
          "typography": {
            "headingFont": "Modern display font name from Google Fonts",
            "bodyFont": "Clean sans-serif font name from Google Fonts",
            "sizes": {
              "h1": "Largest heading size (rem)",
              "h2": "Second heading size (rem)",
              "body": "Body text size (rem)"
            }
          },
          "spacing": {
            "sectionPadding": "Section padding (rem)",
            "cardPadding": "Card internal padding (rem)",
            "gridGap": "Gap between grid items (rem)"
          },
          "borderRadius": {
            "small": "Small radius for buttons (px)",
            "medium": "Medium radius for cards (px)",
            "large": "Large radius for hero sections (px)"
          },
          "shadows": {
            "card": "Box shadow value for cards",
            "button": "Box shadow value for buttons"
          }
        },
        "animations": {
          "buttonHover": "CSS transform value for button hover",
          "cardHover": "CSS transform value for card hover",
          "transition": "Base transition timing"
        }
      },
      "home": {
        "hero": {
          "headline": "Powerful main headline",
          "subheading": "Supporting subheading text",
          "ctaButton": "Call-to-action button text",
          "backgroundImage": {
            "unsplashQuery": "Specific search query for hero background",
            "overlay": "Gradient overlay color with opacity"
          }
        },
        "featuredServices": [
          {
            "title": "Service name",
            "description": "Brief service description",
            "icon": "Suggested Font Awesome icon name",
            "image": {
              "unsplashQuery": "Specific search query for this service",
              "style": "Suggested image style (e.g., minimal, colorful, abstract)"
            },
            "cardStyle": {
              "backgroundColor": "Card background color",
              "accentColor": "Card accent color"
            }
          }
        ],
        "stats": [
          {
            "number": "Impressive statistic",
            "label": "Description of the statistic"
          }
        ],
        "testimonials": [
          {
            "quote": "Customer testimonial",
            "author": "Client name and position",
            "company": "Client's company"
          }
        ]
      },
      "about": {
        "mainHeading": "About page headline",
        "introduction": "2-3 paragraphs about the company",
        "mission": "Company mission statement",
        "vision": "Company vision statement",
        "timeline": [
          {
            "year": "Year of milestone",
            "title": "Milestone title",
            "description": "Milestone description"
          }
        ],
        "team": [
          {
            "name": "Team member name",
            "position": "Job title",
            "bio": "Brief biography",
            "image": {
              "unsplashQuery": "Professional portrait style photo query",
              "style": "Portrait style (casual/professional/creative)",
              "cropStyle": "Circle/rounded square",
              "backgroundColor": "Background color for photo"
            },
            "social": ["Array of social media links"],
            "cardStyle": {
              "background": "Card background color/gradient",
              "hoverEffect": "Card hover animation"
            }
          }
        ],
        "values": [
          {
            "title": "Value name",
            "description": "Value description"
          }
        ]
      },
      "services": {
        "mainHeading": "Services page headline",
        "introduction": "Services overview paragraph",
        "categories": [
          {
            "name": "Service category name",
            "description": "Category description",
            "services": [
              {
                "title": "Specific service name",
                "description": "Detailed service description",
                "features": ["Array of key features"],
                "benefits": ["Array of benefits"],
                "pricing": "Price range or 'Contact for pricing'"
              }
            ]
          }
        ],
        "process": [
          {
            "step": "Step number",
            "title": "Step title",
            "description": "Step description"
          }
        ]
      },
      "portfolio": {
        "mainHeading": "Portfolio/Gallery headline",
        "introduction": "Portfolio introduction text",
        "categories": ["Array of project/work categories"],
        "layout": {
          "style": "grid/masonry/carousel",
          "columns": "Number of columns for different screen sizes",
          "spacing": "Gap between items (rem)"
        },
        "projects": [
          {
            "title": "Project name",
            "category": "Project category",
            "description": "Project description",
            "results": "Project outcomes or results",
            "testimonial": "Client feedback",
            "images": [
              {
                "unsplashQuery": "Specific search query for this project",
                "style": "Image style description",
                "aspectRatio": "Preferred aspect ratio",
                "focusPoint": "Main focus point of the image"
              }
            ],
            "cardDesign": {
              "layout": "Card layout style (vertical/horizontal)",
              "animation": "Hover animation effect",
              "overlayColor": "Image overlay color with opacity"
            }
          }
        ],
        "filters": {
          "style": "Filter UI style (tabs/dropdown/pills)",
          "animation": "Filter transition effect"
        }
      },
      "blog": {
        "mainHeading": "Blog page headline",
        "introduction": "Blog introduction text",
        "categories": ["Array of blog categories"],
        "featuredPosts": [
          {
            "title": "Blog post title",
            "excerpt": "Brief post summary",
            "category": "Post category",
            "readTime": "Estimated read time"
          }
        ]
      },
      "contact": {
        "mainHeading": "Contact page headline",
        "introduction": "Welcoming contact page message",
        "officeHours": "Business hours",
        "locations": [
          {
            "name": "Office/location name",
            "address": "Full address",
            "phone": "Contact number",
            "email": "Email address"
          }
        ],
        "formFields": ["Array of suggested contact form fields"],
        "faq": [
          {
            "question": "Frequently asked question",
            "answer": "Detailed answer"
          }
        ]
      }
    }`;


    let gptResponse, content, htmlTemplate;
    try {
      gptResponse = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
      }, {
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }
      });
      console.log('GPT raw response:', JSON.stringify(gptResponse.data, null, 2));
      content = JSON.parse(gptResponse.data.choices[0].message.content);
    } catch (err) {
      console.error('Error with OpenAI API or JSON parsing:', err);
      return res.status(500).json({ error: 'OpenAI API or JSON error', details: err.message, data: gptResponse && gptResponse.data });
    }
    try {
      htmlTemplate = fs.readFileSync(TEMPLATE_PATH, 'utf-8');
    } catch (err) {
      console.error('Error reading template:', err);
      return res.status(500).json({ error: 'Template read error', details: err.message });
    }

    // Add theme styles
    const themeClass = theme === 'dark' ? 'dark-theme' : 'light-theme';
    htmlTemplate = htmlTemplate.replace('<body>', `<body class="${themeClass}">`);

    // Add modern responsive styles
    const baseStyles = `
      <style>
        :root {
          --primary-color: ${content.global.styling.colors.primary};
          --secondary-color: ${content.global.styling.colors.secondary};
          --accent-color: ${content.global.styling.colors.accent};
          --text-primary: ${content.global.styling.colors.text.primary};
          --text-secondary: ${content.global.styling.colors.text.secondary};
          --gradient-start: ${content.global.styling.colors.gradient.start};
          --gradient-end: ${content.global.styling.colors.gradient.end};
          --card-shadow: ${content.global.styling.shadows.card};
          --transition-base: ${content.global.animations.transition};
        }

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          font-family: '${content.global.styling.typography.bodyFont}', sans-serif;
        }

        body {
          line-height: 1.6;
          color: var(--text-primary);
          overflow-x: hidden;
        }

        .container {
          width: 100%;
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 20px;
        }

        h1, h2, h3, h4 {
          font-family: '${content.global.styling.typography.headingFont}', sans-serif;
          margin-bottom: 1rem;
        }

        section {
          padding: ${content.global.styling.spacing.sectionPadding};
        }

        @media (max-width: 768px) {
          section {
            padding: calc(${content.global.styling.spacing.sectionPadding} / 1.5);
          }
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: ${content.global.styling.spacing.gridGap};
        }

        .card {
          background: var(--card-background);
          border-radius: ${content.global.styling.borderRadius.medium};
          padding: ${content.global.styling.spacing.cardPadding};
          box-shadow: var(--card-shadow);
          transition: var(--transition-base);
        }

        .card:hover {
          transform: ${content.global.animations.cardHover};
        }

        .button {
          display: inline-block;
          padding: 12px 24px;
          background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
          color: white;
          text-decoration: none;
          border-radius: ${content.global.styling.borderRadius.small};
          transition: var(--transition-base);
          border: none;
          cursor: pointer;
        }

        .button:hover {
          transform: ${content.global.animations.buttonHover};
          box-shadow: var(--button-shadow);
        }

        @media (max-width: 480px) {
          .button {
            width: 100%;
            text-align: center;
          }
        }

        .form-group {
          margin-bottom: 1.5rem;
        }

        .form-group input,
        .form-group textarea {
          width: 100%;
          padding: 12px;
          border: 1px solid #ddd;
          border-radius: ${content.global.styling.borderRadius.small};
          font-size: 1rem;
        }

        .image-overlay {
          position: relative;
        }

        .image-overlay::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
          opacity: 0.7;
          z-index: 1;
        }
      </style>
    `;

    // Replace content placeholders
    const filledHTML = htmlTemplate
      .replace('</head>', `${baseStyles}</head>`)
      .replace(/{{biz}}/g, biz)
      // Hero Section with Unsplash Background
      .replace('{{hero_section}}', `
        <section style="
          height: 100vh;
          background-image: url('https://source.unsplash.com/1600x900/?${encodeURIComponent(niche)}');
          background-size: cover;
          background-position: center;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          color: white;
        ">
          <div class="image-overlay"></div>
          <div style="
            position: relative;
            z-index: 2;
            max-width: 800px;
            padding: 2rem;
          ">
            <h1 style="
              font-size: clamp(2.5rem, 5vw, 4rem);
              margin-bottom: 1.5rem;
              line-height: 1.2;
            ">${content.home.hero.headline}</h1>
            <p style="
              font-size: clamp(1.1rem, 2vw, 1.5rem);
              margin-bottom: 2rem;
              opacity: 0.9;
            ">${content.home.hero.subheading}</p>
            <a href="#contact" class="button" style="
              font-size: 1.1rem;
              font-weight: 600;
            ">${content.home.hero.ctaButton}</a>
          </div>
        </section>
      `)
      // About Section with modern styling
      .replace('{{about_section}}', `
        <section id="about" style="
          background: linear-gradient(135deg, var(--gradient-start) 0%, var(--gradient-end) 100%);
          color: white;
          padding: 5rem 0;
        ">
          <div class="container" style="max-width: 1200px; margin: 0 auto; padding: 0 20px;">
            <h2 style="
              font-size: clamp(2rem, 4vw, 3rem);
              text-align: center;
              margin-bottom: 3rem;
            ">${content.about.mainHeading}</h2>
            <div style="
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
              gap: 3rem;
              align-items: start;
            ">
              <div style="
                background: rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(10px);
                padding: 2rem;
                border-radius: ${content.global.styling.borderRadius.medium};
                box-shadow: var(--card-shadow);
              ">
                <div style="margin-bottom: 2rem;">
                  ${content.about.introduction}
                </div>
                <div style="
                  background: rgba(255, 255, 255, 0.05);
                  padding: 1.5rem;
                  border-radius: ${content.global.styling.borderRadius.small};
                  margin-top: 2rem;
                ">
                  <h3 style="font-size: 1.5rem; margin-bottom: 1rem;">Our Mission</h3>
                  <p>${content.about.mission}</p>
                </div>
              </div>
              <div style="
                display: grid;
                gap: 2rem;
              ">
                <div style="
                  background: rgba(255, 255, 255, 0.1);
                  backdrop-filter: blur(10px);
                  padding: 2rem;
                  border-radius: ${content.global.styling.borderRadius.medium};
                  box-shadow: var(--card-shadow);
                ">
                  <h3 style="font-size: 1.5rem; margin-bottom: 1.5rem;">Our Values</h3>
                  <div style="
                    display: grid;
                    gap: 1.5rem;
                  ">
                    ${content.about.values.map(value => `
                      <div style="
                        background: rgba(255, 255, 255, 0.05);
                        padding: 1.5rem;
                        border-radius: ${content.global.styling.borderRadius.small};
                        transition: var(--transition-base);
                      "
                      onmouseover="this.style.transform='translateY(-5px)'"
                      onmouseout="this.style.transform='translateY(0)'">
                        <h4 style="font-size: 1.2rem; margin-bottom: 0.5rem;">${value.title}</h4>
                        <p style="opacity: 0.9;">${value.description}</p>
                      </div>
                    `).join('')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      `)
      // Services Section with modern styling
      .replace('{{services_section}}', `
        <section id="services" style="
          background: var(--background);
          padding: 5rem 0;
        ">
          <div class="container">
            <h2 style="
              font-size: clamp(2rem, 4vw, 3rem);
              text-align: center;
              margin-bottom: 1.5rem;
              background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
            ">${content.services.mainHeading}</h2>
            
            <p style="
              text-align: center;
              max-width: 800px;
              margin: 0 auto 3rem;
              color: var(--text-secondary);
              font-size: 1.1rem;
            ">${content.services.introduction}</p>

            <div style="
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
              gap: 2rem;
              padding: 1rem;
            ">
              ${content.services.categories[0].services.map(service => `
                <div style="
                  background: white;
                  border-radius: ${content.global.styling.borderRadius.medium};
                  padding: 2rem;
                  box-shadow: var(--card-shadow);
                  transition: var(--transition-base);
                  position: relative;
                  overflow: hidden;
                "
                onmouseover="this.style.transform='${content.global.animations.cardHover}'"
                onmouseout="this.style.transform='translateY(0)'">
                  <div style="
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 5px;
                    background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
                  "></div>
                  
                  <h3 style="
                    font-size: 1.5rem;
                    margin: 1rem 0;
                    color: var(--text-primary);
                  ">${service.title}</h3>
                  
                  <p style="
                    color: var(--text-secondary);
                    margin-bottom: 1.5rem;
                    line-height: 1.6;
                  ">${service.description}</p>
                  
                  <ul style="
                    list-style: none;
                    margin: 1.5rem 0;
                  ">
                    ${service.features.map(feature => `
                      <li style="
                        margin-bottom: 0.8rem;
                        padding-left: 1.5rem;
                        position: relative;
                        color: var(--text-secondary);
                      ">
                        <span style="
                          position: absolute;
                          left: 0;
                          color: var(--accent-color);
                        ">✓</span>
                        ${feature}
                      </li>
                    `).join('')}
                  </ul>
                  
                  <div style="
                    margin-top: 2rem;
                    padding-top: 1rem;
                    border-top: 1px solid #eee;
                    font-weight: 600;
                    color: var(--primary-color);
                  ">${service.pricing}</div>
                </div>
              `).join('')}
            </div>
          </div>
        </section>
      `)
      // Contact Section with modern styling
      .replace('{{contact_section}}', `
        <section id="contact" style="
          background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
          padding: 5rem 0;
          color: white;
        ">
          <div class="container">
            <h2 style="
              font-size: clamp(2rem, 4vw, 3rem);
              text-align: center;
              margin-bottom: 1.5rem;
            ">${content.contact.mainHeading}</h2>
            
            <p style="
              text-align: center;
              max-width: 800px;
              margin: 0 auto 3rem;
              opacity: 0.9;
              font-size: 1.1rem;
            ">${content.contact.introduction}</p>

            <div style="
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
              gap: 2rem;
              align-items: start;
            ">
              <div style="
                background: rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(10px);
                border-radius: ${content.global.styling.borderRadius.medium};
                padding: 2rem;
              ">
                ${content.contact.locations.map(location => `
                  <div style="
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: ${content.global.styling.borderRadius.small};
                    padding: 1.5rem;
                    margin-bottom: 1.5rem;
                  ">
                    <h3 style="
                      font-size: 1.3rem;
                      margin-bottom: 1rem;
                    ">${location.name}</h3>
                    <p style="margin-bottom: 0.5rem;">${location.address}</p>
                    <p style="margin-bottom: 0.5rem;">
                      <span style="opacity: 0.8;">Phone:</span> ${location.phone}
                    </p>
                    <p>
                      <span style="opacity: 0.8;">Email:</span> ${location.email}
                    </p>
                  </div>
                `).join('')}
                
                <div style="
                  background: rgba(255, 255, 255, 0.05);
                  border-radius: ${content.global.styling.borderRadius.small};
                  padding: 1.5rem;
                ">
                  <h3 style="
                    font-size: 1.3rem;
                    margin-bottom: 1rem;
                  ">Office Hours</h3>
                  <p>${content.contact.officeHours}</p>
                </div>
              </div>

              <form style="
                background: white;
                border-radius: ${content.global.styling.borderRadius.medium};
                padding: 2rem;
                color: var(--text-primary);
                box-shadow: var(--card-shadow);
              ">
                ${content.contact.formFields.map(field => `
                  <div style="margin-bottom: 1.5rem;">
                    <label style="
                      display: block;
                      margin-bottom: 0.5rem;
                      color: var(--text-secondary);
                      font-weight: 500;
                    " for="${field.toLowerCase()}">${field}</label>
                    <input style="
                      width: 100%;
                      padding: 0.8rem;
                      border: 1px solid #ddd;
                      border-radius: ${content.global.styling.borderRadius.small};
                      font-size: 1rem;
                      transition: var(--transition-base);
                    "
                    type="${field.toLowerCase().includes('email') ? 'email' : 
                          field.toLowerCase().includes('phone') ? 'tel' : 'text'}"
                    id="${field.toLowerCase()}"
                    name="${field.toLowerCase()}"
                    required
                    onFocus="this.style.borderColor='var(--primary-color)'"
                    onBlur="this.style.borderColor='#ddd'">
                  </div>
                `).join('')}
                <button type="submit" class="button" style="
                  width: 100%;
                  font-size: 1.1rem;
                  font-weight: 600;
                  margin-top: 1rem;
                ">Send Message</button>
              </form>
            </div>
          </div>
        </section>
      `);

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

// Test endpoint that bypasses OpenAI for testing
app.post('/test-generate', async (req, res) => {
  try {
    const { biz, niche, websiteType = 'business' } = req.body;
    
    // Generate business-specific content based on type
    const businessTypes = {
      restaurant: {
        services: [
          { title: "Fine Dining", icon: "fas fa-utensils", description: "Exquisite culinary experiences with locally sourced ingredients" },
          { title: "Private Events", icon: "fas fa-calendar-alt", description: "Perfect venue for special occasions and celebrations" },
          { title: "Catering", icon: "fas fa-truck", description: "Bring our exceptional cuisine to your location" }
        ],
        stats: [
          { number: "15+", label: "Years of Excellence" },
          { number: "5000+", label: "Happy Customers" },
          { number: "50+", label: "Menu Items" },
          { number: "4.9", label: "Star Rating" }
        ]
      },
      business: {
        services: [
          { title: "Consulting", icon: "fas fa-lightbulb", description: "Expert guidance to grow your business" },
          { title: "Strategy", icon: "fas fa-chart-line", description: "Data-driven strategies for success" },
          { title: "Support", icon: "fas fa-headset", description: "24/7 customer support and assistance" }
        ],
        stats: [
          { number: "500+", label: "Projects Completed" },
          { number: "98%", label: "Client Satisfaction" },
          { number: "24/7", label: "Support Available" },
          { number: "10+", label: "Years Experience" }
        ]
      },
      retail: {
        services: [
          { title: "Online Store", icon: "fas fa-shopping-cart", description: "Shop our complete collection online" },
          { title: "Fast Delivery", icon: "fas fa-shipping-fast", description: "Quick and reliable shipping worldwide" },
          { title: "Customer Care", icon: "fas fa-heart", description: "Dedicated support for all your needs" }
        ],
        stats: [
          { number: "10K+", label: "Products Available" },
          { number: "50K+", label: "Happy Customers" },
          { number: "99%", label: "Delivery Success" },
          { number: "4.8", label: "Customer Rating" }
        ]
      }
    };

    const currentType = businessTypes[websiteType] || businessTypes.business;
    
    // Color schemes based on business type
    const colorSchemes = {
      restaurant: {
        primary: "#D4653F", secondary: "#8B4513", accent: "#FFD700",
        gradient: { start: "#D4653F", end: "#8B4513" },
        text: { primary: "#2C3E50", secondary: "#7F8C8D" }
      },
      business: {
        primary: "#3498DB", secondary: "#2980B9", accent: "#E74C3C",
        gradient: { start: "#3498DB", end: "#2980B9" },
        text: { primary: "#2C3E50", secondary: "#7F8C8D" }
      },
      retail: {
        primary: "#E91E63", secondary: "#C2185B", accent: "#FF9800",
        gradient: { start: "#E91E63", end: "#C2185B" },
        text: { primary: "#212121", secondary: "#757575" }
      }
    };

    const colors = colorSchemes[websiteType] || colorSchemes.business;

    // Generate services cards HTML
    const servicesCards = currentType.services.map(service => `
      <div class="service-card">
        <div class="service-icon">
          <i class="${service.icon}"></i>
        </div>
        <h3>${service.title}</h3>
        <p>${service.description}</p>
      </div>
    `).join('');

    // Generate stats items HTML
    const statsItems = currentType.stats.map(stat => `
      <div class="stat-item">
        <h3>${stat.number}</h3>
        <p>${stat.label}</p>
      </div>
    `).join('');

    // Read the complete template
    const templatePath = path.join(__dirname, 'templates', 'complete.html');
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    
    // Replace ALL placeholders
    const filledHTML = templateContent
      .replace(/{{businessName}}/g, biz)
      .replace(/{{niche}}/g, niche)
      .replace(/{{primaryColor}}/g, colors.primary)
      .replace(/{{secondaryColor}}/g, colors.secondary)
      .replace(/{{accentColor}}/g, colors.accent)
      .replace(/{{textPrimary}}/g, colors.text.primary)
      .replace(/{{textSecondary}}/g, colors.text.secondary)
      .replace(/{{backgroundColor}}/g, '#F8F9FA')
      .replace(/{{cardBackground}}/g, '#FFFFFF')
      .replace(/{{cardShadow}}/g, '0 5px 15px rgba(0,0,0,0.1)')
      .replace(/{{borderRadius}}/g, '12px')
      .replace(/{{gradientStart}}/g, colors.gradient.start)
      .replace(/{{gradientEnd}}/g, colors.gradient.end)
      .replace(/{{heroImageOverlay}}/g, `linear-gradient(135deg, ${colors.primary}CC, ${colors.secondary}CC)`)
      .replace(/{{heroHeadline}}/g, `Welcome to ${biz}`)
      .replace(/{{heroSubheading}}/g, `Your premier destination for ${niche}. Experience excellence like never before.`)
      .replace(/{{ctaButton}}/g, 'Get Started Today')
      .replace(/{{aboutTitle}}/g, 'About Our Company')
      .replace(/{{aboutContent}}/g, `At ${biz}, we are passionate about delivering exceptional ${niche.toLowerCase()} services. With years of experience and a commitment to excellence, we have built a reputation for quality, reliability, and customer satisfaction. Our dedicated team works tirelessly to ensure that every client receives personalized attention and outstanding results.`)
      .replace(/{{servicesTitle}}/g, 'Our Services')
      .replace(/{{servicesCards}}/g, servicesCards)
      .replace(/{{statsTitle}}/g, 'Why Choose Us')
      .replace(/{{statsItems}}/g, statsItems)
      .replace(/{{contactTitle}}/g, 'Contact Us')
      .replace(/{{businessAddress}}/g, '123 Business Avenue, Suite 100, Your City, State 12345')
      .replace(/{{businessPhone}}/g, '(555) 123-4567')
      .replace(/{{businessEmail}}/g, `info@${biz.toLowerCase().replace(/\s+/g, '')}.com`)
      .replace(/{{businessHours}}/g, 'Mon-Fri: 9AM-6PM, Sat: 10AM-4PM')
      .replace(/{{footerDescription}}/g, `${biz} is your trusted partner for ${niche.toLowerCase()}. We deliver quality results with exceptional service.`);

    const siteDir = path.join(__dirname, 'generated', biz.replace(/\s+/g, '_'));
    const filePath = path.join(siteDir, 'index.html');

    fs.mkdirSync(siteDir, { recursive: true });
    fs.writeFileSync(filePath, filledHTML);

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
    console.error('Error in test generate:', error);
    res.status(500).json({ 
      error: 'Test generation failed',
      details: error.message
    });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});

