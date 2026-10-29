import axios from 'axios';

const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Venues
export const getVenues = () => api.get('/venues');
export const getVenue = (id) => api.get(`/venues/${id}`);
export const getVenueBookings = (id, date) => api.get(`/venues/${id}/bookings`, { params: { date } });

// Clients
export const getClients = () => api.get('/clients');
export const getClient = (id) => api.get(`/clients/${id}`);
export const createClient = (data) => api.post('/clients', data);
export const getClientBookings = (id) => api.get(`/clients/${id}/bookings`);

// Bookings
export const getBookings = (params) => api.get('/bookings', { params });
export const getBooking = (id) => api.get(`/bookings/${id}`);
export const getBookingStats = () => api.get('/bookings/stats');
export const createBooking = (data) => api.post('/bookings', data);
export const cancelBooking = (id) => api.post(`/bookings/${id}/cancel`);
export const rescheduleBooking = (id, data) => api.put(`/bookings/${id}/reschedule`, data);
export const getAlternatives = (data) => api.post('/bookings/alternatives', data);

export default api;
