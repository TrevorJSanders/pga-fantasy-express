const cors = require('cors');

const isLocal = process.env.NODE_ENV !== 'production';

const corsOptions = {
  origin: (origin, callback) => {
    const allowed = [process.env.API_ENDPOINT_URI, process.env.FRONTEND_URI];

    if (!origin || allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};

const configureCors = (app) => {
  app.use(cors(corsOptions));
};

module.exports = { configureCors };
