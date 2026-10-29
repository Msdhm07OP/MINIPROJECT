import express from 'express';
import cors from 'cors';
import { initDatabase } from './config/database.js';
import venueRoutes from './routes/venues.js';
import clientRoutes from './routes/clients.js';
import bookingRoutes from './routes/bookings.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Initialize database
initDatabase();

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'EventSync API',
    version: '1.0.0',
    endpoints: {
      venues: '/api/venues',
      clients: '/api/clients',
      bookings: '/api/bookings'
    }
  });
});

app.use('/api/venues', venueRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/bookings', bookingRoutes);

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`\n✓ EventSync Backend Server running on port ${PORT}`);
  console.log(`✓ API available at http://localhost:${PORT}`);
  console.log(`✓ Database initialized\n`);
});

export default app;
