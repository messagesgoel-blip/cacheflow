const { v4: uuidv4 } = require('uuid');

/**
 * Middleware to track requests and correlation IDs
 */
module.exports = (req, res, next) => {
  const requestId = uuidv4();
  const correlationId = req.headers['x-correlation-id'] || req.headers['x-request-id'] || requestId;
  
  req.requestId = requestId;
  req.correlationId = correlationId;
  
  // Set headers for response
  res.setHeader('X-Request-Id', requestId);
  res.setHeader('X-Correlation-Id', correlationId);
  
  // Standard response helpers
  res.ok = (data) => {
    res.status(200).json({
      ok: true,
      data,
      requestId,
      correlationId
    });
  };
  
  res.fail = (error, code = 500, details = null) => {
    res.status(code).json({
      ok: false,
      error,
      code,
      details,
      requestId,
      correlationId
    });
  };
  
  next();
};
