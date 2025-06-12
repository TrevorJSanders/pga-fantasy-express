const cors = require('cors');

const API_ENDPOINT_URI = process.env.API_ENDPOINT_URI;

const corsOptions = {
  origin: true,  
/*
  origin: [
    'http://localhost:3000',  // Local React development
    'http://localhost:3001',  // Local server
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',  // Add this - Vite dev server
    'http://localhost:5173',  // Add this too - alternative localhost
    API_ENDPOINT_URI,             // Your Railway production URL
    // Add any other frontend URLs you need
  ],
  */
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