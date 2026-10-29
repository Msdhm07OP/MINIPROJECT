import { useEffect, useState } from 'react';
import { getBookingStats } from '../services/api';
import { Calendar, CheckCircle, XCircle, Ban, Clock } from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await getBookingStats();
      setStats(response.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading statistics...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center text-gray-500 py-8">
        Failed to load statistics
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Bookings',
      value: stats.total || 0,
      icon: Calendar,
      color: 'bg-blue-500',
    },
    {
      title: 'Confirmed',
      value: stats.confirmed || 0,
      icon: CheckCircle,
      color: 'bg-green-500',
    },
    {
      title: 'Cancelled',
      value: stats.cancelled || 0,
      icon: Ban,
      color: 'bg-yellow-500',
    },
    {
      title: 'Rejected',
      value: stats.rejected || 0,
      icon: XCircle,
      color: 'bg-red-500',
    },
    {
      title: 'Upcoming Events',
      value: stats.upcoming || 0,
      icon: Clock,
      color: 'bg-purple-500',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-gray-600 mt-1">Overview of booking statistics and venue utilization</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map((stat) => (
          <div key={stat.title} className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{stat.title}</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
              </div>
              <div className={`${stat.color} p-3 rounded-lg`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Venue Utilization */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Venue Utilization (Confirmed Bookings)</h3>
        <div className="space-y-4">
          {stats.venueUtilization && stats.venueUtilization.length > 0 ? (
            stats.venueUtilization.map((venue) => (
              <div key={venue.name} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-primary-500 rounded-full"></div>
                  <span className="font-medium text-gray-900">{venue.name}</span>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-600">{venue.booking_count} bookings</span>
                  <div className="w-48 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary-500 h-2 rounded-full"
                      style={{
                        width: `${Math.min((venue.booking_count / (stats.confirmed || 1)) * 100, 100)}%`
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-gray-500 text-center py-4">No venue data available</p>
          )}
        </div>
      </div>
    </div>
  );
}
