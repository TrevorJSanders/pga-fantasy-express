const cors = require('cors');

const allowedOrigins = [
  process.env.FRONTEND_URI,
  process.env.API_ENDPOINT_URI,
].filter(Boolean); // Filter out any undefined values

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}. Allowed origins are: ${allowedOrigins.join(', ')}`; 
      callback(new Error(msg), false);
    }
  },
  credentials: true,
};

const configureCors = (app) => {
  app.use(cors(corsOptions));
};

module.exports = { configureCors };
