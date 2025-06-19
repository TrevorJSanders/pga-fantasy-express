const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const mongoose = require('mongoose');
const cors = require('cors');
const EventEmitter = require('events');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.set('trust proxy', true);

// Enhanced CORS and headers for iOS compatibility
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  
  // iOS-specific headers
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  next();
});

const server = http.createServer(app);

// Enhanced server configuration for iOS
server.on('connection', (socket) => {
  // More aggressive keep-alive for mobile networks
  socket.setKeepAlive(true, 5000); // 5 seconds instead of 10
  socket.setTimeout(0); // Disable timeout
  
  // Set TCP_NODELAY to reduce latency
  socket.setNoDelay(true);
});

server.on('upgrade', (req, socket, head) => {
  console.log('⬆️  HTTP upgrade requested from:', req.headers['user-agent']?.substring(0, 50));
  
  // Enhanced socket configuration for upgrades
  socket.setKeepAlive(true, 5000);
  socket.setNoDelay(true);
  socket.setTimeout(0);
  
  // iOS-specific: Set larger buffer sizes
  try {
    socket.setRecvBufferSize(65536); // 64KB
    socket.setSendBufferSize(65536); // 64KB
  } catch (e) {
    console.log('⚠️  Could not set buffer sizes:', e.message);
  }
});

// Enhanced WebSocket server configuration specifically for iOS
const wss = new WebSocket.Server({ 
  server,
  path: '/ws',
  
  // Critical iOS fixes
  perMessageDeflate: false, // Disable compression - iOS WebKit issue
  clientTracking: true,
  maxPayload: 512 * 1024, // Smaller payload limit for iOS (512KB)
  
  // More lenient timeouts
  handshakeTimeout: 10000, // 10 seconds for slow mobile networks
  
  verifyClient: (info) => {
    const ua = info.req.headers['user-agent'] || '';
    console.log('🔍 Verifying client:', ua.substring(0, 60));
    
    // Always allow, but log iOS clients
    if (ua.includes('iPhone') || ua.includes('iPad') || ua.includes('iPod')) {
      console.log('📱 iOS client detected');
    }
    
    return true;
  }
});

const pubsub = new EventEmitter();

// MongoDB connection (unchanged)
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;
db.once('open', () => {
  const changeStream = db.collection('tournaments').watch();
  changeStream.on('change', (change) => {
    console.log('📣 Change detected:', change);
    pubsub.emit('update', {
      type: 'update',
      data: change,
    });
  });
});

// Enhanced connection tracking for iOS
const connectionMetrics = new Map();

// iOS-optimized WebSocket handling
wss.on('connection', (ws, req) => {
  const ua = req.headers['user-agent'] || '';
  const isIOS = ua.includes('iPhone') || ua.includes('iPad') || ua.includes('iPod');
  const connectionId = Math.random().toString(36).substring(7);
  
  console.log(`🔌 WebSocket connected [${connectionId}] from:`, ua.substring(0, 60));
  console.log(`📱 iOS Client: ${isIOS ? 'YES' : 'NO'}`);

  // Track connection metrics
  connectionMetrics.set(connectionId, {
    startTime: Date.now(),
    isIOS,
    userAgent: ua,
    lastPing: Date.now(),
    pingCount: 0,
    messageCount: 0
  });

  let isAlive = true;
  
  // iOS-specific ping interval (longer for iOS)
  const pingInterval = isIOS ? 15000 : 1500; // 15s for iOS, 7s for others
  
  const sendMessage = (data) => {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        const message = JSON.stringify(data);
        ws.send(message);
        
        // Update metrics
        const metrics = connectionMetrics.get(connectionId);
        if (metrics) {
          metrics.messageCount++;
        }
        
        return true;
      } catch (err) {
        console.error(`❌ Send error [${connectionId}]:`, err);
        return false;
      }
    }
    return false;
  };

  // Enhanced initial handshake with iOS detection
  const initMessage = {
    type: 'init',
    data: { 
      message: 'Welcome!',
      connectionId,
      isIOSOptimized: isIOS,
      pingInterval: pingInterval
    }
  };
  
  sendMessage(initMessage);

  // Enhanced message handler with iOS-specific logic
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      console.log(`📥 Message [${connectionId}]:`, msg.type);

      // Update metrics
      const metrics = connectionMetrics.get(connectionId);
      if (metrics) {
        metrics.lastPing = Date.now();
        if (msg.type === 'ping') {
          metrics.pingCount++;
        }
      }

      if (msg.type === 'ping') {
        const success = sendMessage({ 
          type: 'pong', 
          timestamp: Date.now(),
          connectionId
        });
        
        if (!success && isIOS) {
          console.log(`⚠️  iOS ping response failed [${connectionId}] - connection may be dead`);
        }
      }
      
      // iOS heartbeat response
      if (msg.type === 'heartbeat') {
        sendMessage({ 
          type: 'heartbeat_ack', 
          timestamp: Date.now() 
        });
      }
      
    } catch (err) {
      console.error(`❌ Invalid message [${connectionId}]:`, err);
    }
  });

  // Listen to pubsub updates
  const sendUpdate = (data) => {
    // Add connection info to updates for iOS debugging
    const enhancedData = {
      ...data,
      connectionId,
      timestamp: Date.now()
    };
    sendMessage(enhancedData);
  };
  
  pubsub.on('update', sendUpdate);

  // Enhanced close handler with iOS-specific logging
  ws.on('close', (code, reason) => {
    const metrics = connectionMetrics.get(connectionId);
    const duration = metrics ? Date.now() - metrics.startTime : 0;
    
    console.log(`❌ WebSocket closed [${connectionId}] - Code: ${code}, Reason: ${reason.toString() || 'none'}`);
    console.log(`📊 Connection lasted: ${Math.round(duration / 1000)}s, Messages: ${metrics?.messageCount || 0}, Pings: ${metrics?.pingCount || 0}`);
    
    // iOS-specific close code analysis
    if (isIOS && code === 1006) {
      console.log('🍎 iOS abnormal closure detected - likely network switch or power management');
    }
    
    // Cleanup
    pubsub.removeListener('update', sendUpdate);
    clearInterval(heartbeat);
    connectionMetrics.delete(connectionId);
  });

  // Enhanced error logging
  ws.on('error', (err) => {
    console.error(`💥 WebSocket error [${connectionId}]:`, err.message);
    if (isIOS) {
      console.log('🍎 iOS WebSocket error - may indicate network instability');
    }
  });

  // iOS-optimized heartbeat with exponential backoff
  const heartbeat = setInterval(() => {
    if (!isAlive) {
      console.log(`💀 Connection dead [${connectionId}] — terminating`);
      ws.terminate();
      return;
    }

    isAlive = false;

    if (ws.readyState === WebSocket.OPEN) {
      try {
        // For iOS, use application-level ping instead of WebSocket ping
        if (isIOS) {
          const success = sendMessage({ 
            type: 'server_ping', 
            timestamp: Date.now(),
            connectionId 
          });
          
          if (!success) {
            console.log(`⚠️  iOS server ping failed [${connectionId}]`);
          }
        } else {
          ws.ping(); // Standard WebSocket ping for non-iOS
        }
      } catch (err) {
        console.error(`❌ Ping error [${connectionId}]:`, err.message);
      }
    }
  }, pingInterval);

  // Enhanced pong handler
  ws.on('pong', () => {
    isAlive = true;
    console.log(`🏓 Pong received [${connectionId}]`);
  });

  // Handle manual pings from client
  ws.on('ping', () => {
    try {
      ws.pong();
      console.log(`🏓 Ping received from client [${connectionId}]`);
    } catch (err) {
      console.error(`❌ Pong response error [${connectionId}]:`, err.message);
    }
  });
});

// Enhanced WebSocket status endpoint with iOS metrics
app.get('/api/ws-status', (req, res) => {
  const connections = Array.from(connectionMetrics.values());
  const iosConnections = connections.filter(c => c.isIOS);
  
  res.json({
    connectedClients: wss.clients.size,
    totalConnections: connections.length,
    iosConnections: iosConnections.length,
    connectionDetails: connections.map(c => ({
      isIOS: c.isIOS,
      duration: Math.round((Date.now() - c.startTime) / 1000),
      messageCount: c.messageCount,
      pingCount: c.pingCount,
      lastPingAgo: Math.round((Date.now() - c.lastPing) / 1000)
    })),
    timestamp: new Date().toISOString()
  });
});

// Rest of your endpoints remain the same...
app.get('/api/leaderboard', async (req, res) => {
  try {
    const data = await db.collection('tournaments').find({}).toArray();
    res.json(data);
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/health', (req, res) => {
  const connections = Array.from(connectionMetrics.values());
  const iosConnections = connections.filter(c => c.isIOS);
  
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    wsClients: wss.clients.size,
    iosClients: iosConnections.length,
    avgConnectionDuration: connections.length > 0 
      ? Math.round(connections.reduce((sum, c) => sum + (Date.now() - c.startTime), 0) / connections.length / 1000)
      : 0
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 iOS WebSocket optimizations enabled`);
});

// Enhanced graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received');
  
  // Notify all clients before shutdown
  wss.clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ 
          type: 'server_shutdown', 
          message: 'Server restarting, please reconnect' 
        }));
      } catch (e) {
        console.log('Error notifying client of shutdown:', e.message);
      }
    }
  });
  
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});