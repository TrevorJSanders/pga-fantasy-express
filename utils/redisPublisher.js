const Redis = require('ioredis');
const logger = require('./logger'); // Assuming you have a logger utility

const redis = new Redis(process.env.REDIS_URL);

redis.on('connect', () => {
  logger.info('Connected to Redis for publishing');
});

redis.on('error', (err) => {
  logger.error('Redis Publisher Error', err);
});

const publish = (channel, message) => {
  const payload = JSON.stringify(message);
  logger.info({ channel, payload }, '[Redis] Publishing message');
  redis.publish(channel, payload);
};

module.exports = { publish, redis };
