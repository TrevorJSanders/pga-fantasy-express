const configureHeaders = (app) => {
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');

    const wsUrl = "https://pga-fantasy-express.onrender.com";
    res.setHeader(
      'Content-Security-Policy',
      `default-src 'self'; connect-src 'self' ${wsUrl}`
    );

    // Cache-control for APIs
    res.setHeader('Cache-Control', 'no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    next();
  });
};

module.exports = { configureHeaders };
