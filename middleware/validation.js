const Joi = require('joi');
const sanitizeHtml = require('sanitize-html');

const generateSchema = Joi.object({
  biz: Joi.string().trim().required().max(100),
  niche: Joi.string().trim().required().max(100),
  theme: Joi.string().valid('light', 'dark').default('light'),
  style: Joi.string().valid('modern', 'classic', 'minimalist').default('modern'),
  images: Joi.array().items(Joi.string()).max(5).default([])
});

const validateGenerateInput = (req, res, next) => {
  const { error, value } = generateSchema.validate(req.body);
  
  if (error) {
    return res.status(400).json({ 
      error: 'Invalid input', 
      details: error.details[0].message 
    });
  }

  // Sanitize text inputs
  value.biz = sanitizeHtml(value.biz);
  value.niche = sanitizeHtml(value.niche);

  req.body = value;
  next();
};

module.exports = {
  validateGenerateInput
};
