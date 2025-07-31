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
    const { biz, niche, theme = 'light', websiteType = 'business', images = [] } = req.body;

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
        model: "gpt-4",
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

// Start server
const PORT = process.env.PORT || 3000;
app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});

