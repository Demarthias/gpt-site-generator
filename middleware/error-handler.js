const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  logger.error({
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip
  });

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      details: err.message
    });
  }

  if (err.name === 'MulterError') {
    return res.status(400).json({
      error: 'File Upload Error',
      details: err.message
    });
  }

  res.status(500).json({
    error: 'Internal Server Error',
    details: process.env.NODE_ENV === 'production' ? 
      'An unexpected error occurred' : 
      err.message
  });
};

const notFoundHandler = (req, res) => {
  logger.warn({
    message: 'Route not found',
    path: req.path,
    method: req.method,
    ip: req.ip
  });

  res.status(404).json({
    error: 'Not Found',
    details: 'The requested resource was not found'
  });
};

module.exports = {
  errorHandler,
  notFoundHandler
};
