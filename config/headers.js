const configureHeaders = (app) => {
  // Configure headers for all requests
  app.use((req, res, next) => {
    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // CSP to allow WebSocket connection
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; connect-src 'self' wss://pga-fantasy-express-production.up.railway.app https://pga-fantasy-express-production.up.railway.app"
    );

    // Cache control for regular API requests
    if (!req.path.includes('/sse/')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    
    next();
  });
  
  // Specific headers for SSE endpoints
  app.use('/api/sse', (req, res, next) => {
    // Essential SSE headers - these tell the browser to keep the connection open
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Allow cross-origin requests for SSE
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');
    
    next();
  });
};

module.exports = { configureHeaders };