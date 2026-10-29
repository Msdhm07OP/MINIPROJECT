import { useState } from 'react';
import Dashboard from './components/Dashboard';
import BookingForm from './components/BookingForm';
import BookingList from './components/BookingList';
import { LayoutDashboard, Calendar, PlusCircle } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleBookingSuccess = () => {
    setRefreshTrigger(prev => prev + 1);
    setActiveTab('bookings');
  };

  const tabs = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
    { id: 'create', name: 'Create Booking', icon: PlusCircle },
    { id: 'bookings', name: 'View Bookings', icon: Calendar },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div>
              <h1 className="text-2xl font-bold text-primary-600">EventSync</h1>
              <p className="text-xs text-gray-600">Multi-Client Event Scheduling & Resource Management</p>
            </div>
            <div className="text-sm text-gray-500">
              Operating Hours: 8:00 AM - 10:00 PM
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${activeTab === tab.id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <tab.icon className="w-5 h-5" />
                <span>{tab.name}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && <Dashboard key={refreshTrigger} />}
        {activeTab === 'create' && <BookingForm onSuccess={handleBookingSuccess} />}
        {activeTab === 'bookings' && <BookingList refreshTrigger={refreshTrigger} />}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-sm text-gray-500">
            EventSync - Mini Project ESE Hackathon 2026 |
            Events reserve halls and resources 30 minutes before start until 30 minutes after end
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
