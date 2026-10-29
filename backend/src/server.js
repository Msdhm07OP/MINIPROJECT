import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

import logger from './utils/logger/index.js';
import { checkHealth, closePool } from './database/config.js';

// Routes
import bookingRoutes from './routes/v1/bookings.js';
import venueRoutes from './routes/v1/venues.js';
import clientRoutes from './routes/v1/clients.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// =============================================================================
// SECURITY & MIDDLEWARE
// =============================================================================

// Security headers
app.use(helmet());

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// HTTP request logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim())
    }
  }));
}

// Correlation ID middleware
app.use((req, res, next) => {
  req.correlationId = req.headers['x-correlation-id'] || uuidv4();
  res.setHeader('X-Correlation-ID', req.correlationId);
  next();
});

// Request logging
app.use((req, res, next) => {
  logger.debug('Incoming request', {
    method: req.method,
    path: req.path,
    correlationId: req.correlationId,
    ip: req.ip
  });
  next();
});

// =============================================================================
// ROUTES
// =============================================================================

// Health check
app.get('/health', async (req, res) => {
  try {
    const dbHealth = await checkHealth();
    const isHealthy = dbHealth.healthy;

    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbHealth,
      version: '2.0.0'
    });
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    res.status(503).json({
      status: 'error',
      message: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

// API info
app.get('/', (req, res) => {
  res.json({
    name: 'EventSync API',
    version: '2.0.0',
    description: 'Production Event Scheduling and Resource Management System',
    endpoints: {
      health: '/health',
      bookings: '/api/v1/bookings',
      venues: '/api/v1/venues',
      clients: '/api/v1/clients'
    },
    features: [
      'Database-level concurrency safety',
      'Advisory locks for resource allocation',
      'Idempotency support',
      'Comprehensive audit trail',
      'Automatic retry on serialization failures'
    ]
  });
});

// API routes
app.use('/api/v1/bookings', bookingRoutes);
app.use('/api/v1/venues', venueRoutes);
app.use('/api/v1/clients', clientRoutes);

// Backward compatibility with v1.0 routes
app.use('/api/bookings', bookingRoutes);
app.use('/api/venues', venueRoutes);
app.use('/api/clients', clientRoutes);

// =============================================================================
// ERROR HANDLING
// =============================================================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    correlationId: req.correlationId
  });
});

// Global error handler
app.use((err, req, res, next) => {
  // Log error
  logger.error('Error occurred', {
    error: err.message,
    stack: err.stack,
    correlationId: req.correlationId,
    path: req.path,
    method: req.method
  });

  // Handle specific error types
  if (err.code === '23505') { // PostgreSQL unique violation
    return res.status(409).json({
      success: false,
      error: 'Conflict',
      message: 'A booking with these details already exists',
      correlationId: req.correlationId
    });
  }

  if (err.code === '23P01') { // PostgreSQL exclusion violation
    return res.status(409).json({
      success: false,
      error: 'Booking Conflict',
      message: 'This time slot is no longer available due to a conflicting booking',
      correlationId: req.correlationId
    });
  }

  if (err.code === '40001') { // Serialization failure
    return res.status(503).json({
      success: false,
      error: 'Service Temporarily Unavailable',
      message: 'High concurrency detected. Please retry your request.',
      correlationId: req.correlationId,
      retryable: true
    });
  }

  if (err.code === '40P01') { // Deadlock
    return res.status(503).json({
      success: false,
      error: 'Service Temporarily Unavailable',
      message: 'Database contention detected. Please retry your request.',
      correlationId: req.correlationId,
      retryable: true
    });
  }

  // Default error response
  const statusCode = err.status || err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' && statusCode === 500
    ? 'An unexpected error occurred'
    : err.message;

  res.status(statusCode).json({
    success: false,
    error: err.name || 'Internal Server Error',
    message,
    correlationId: req.correlationId,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// =============================================================================
// SERVER LIFECYCLE
// =============================================================================

let server;

// Start server
function startServer() {
  server = app.listen(PORT, () => {
    logger.info(`EventSync 2.0 server started`, {
      port: PORT,
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version
    });
    console.log(`\n✓ EventSync 2.0 Server running on port ${PORT}`);
    console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`✓ Health check: http://localhost:${PORT}/health`);
    console.log(`✓ API endpoint: http://localhost:${PORT}/api/v1\n`);
  });
}

// Graceful shutdown
async function gracefulShutdown(signal) {
  logger.info(`${signal} received, starting graceful shutdown`);
  console.log(`\n${signal} received. Shutting down gracefully...`);

  // Stop accepting new connections
  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed');

      // Close database pool
      try {
        await closePool();
        logger.info('Database connections closed');
      } catch (error) {
        logger.error('Error closing database pool', { error: error.message });
      }

      console.log('✓ Server shut down complete');
      process.exit(0);
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      console.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 30000);
  } else {
    process.exit(0);
  }
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', {
    error: error.message,
    stack: error.stack
  });
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled promise rejection', {
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined
  });
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the server (unless in test mode)
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;
