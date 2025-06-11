const cors = require('cors');

const API_ENDPOINT_URI = process.env.API_ENDPOINT_URI;

const corsOptions = {
  origin: [
    'http://localhost:3000',  // Local React development
    'http://localhost:3001',  // Local server
    'http://127.0.0.1:3000',
    API_ENDPOINT_URI,             // Your Railway production URL
    // Add any other frontend URLs you need
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Cache-Control',
    'Accept',
    'Accept-Encoding',
    'Connection',
    'Keep-Alive'
  ],
  exposedHeaders: [
    'Cache-Control',
    'Content-Language',
    'Content-Type',
    'Expires',
    'Last-Modified',
    'Pragma'
  ]
};

const configureCors = (app) => {
  app.use(cors(corsOptions));
  
  // Handle preflight requests explicitly
  app.options('*', cors(corsOptions));
};

module.exports = { configureCors, corsOptions };