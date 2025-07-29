const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 file uploads per hour
  message: 'Upload limit exceeded, please try again later.'
});

module.exports = {
  limiter,
  uploadLimiter,
  setupSecurity: (app) => {
    // Basic security headers
    app.use(helmet());

    // CORS configuration
    app.use(cors({
      origin: process.env.ALLOWED_ORIGINS ? 
        process.env.ALLOWED_ORIGINS.split(',') : 
        '*',
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));

    // Rate limiting
    app.use('/generate', limiter);
    app.use('/upload', uploadLimiter);

    // Additional security headers
    app.use((req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      next();
    });
  }
};
