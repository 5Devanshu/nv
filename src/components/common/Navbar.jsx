import React                from 'react';
import { useLocation }      from 'react-router-dom';
import { useSelector }      from 'react-redux';
import { Menu }             from 'lucide-react';

const TITLES = {
  '/dashboard':     'Dashboard',
  '/projects':      'Projects',
  '/flats':         'Flat Inventory',
  '/bookings':      'Bookings & Sales',
  '/payments':      'Payment Tracking',
  '/ledger':        'Customer Ledger',
  '/brokers':       'Broker Management',
  '/expenses':      'Project Expenses',
  '/reports':       'Reports',
  '/documents':     'Documents',
  '/notifications': 'Notifications',
};

export default function Navbar({ onMenuClick }) {
  const { pathname } = useLocation();
  const { user }     = useSelector((s) => s.auth);
  const today        = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });

  return (
    <header className="h-16 bg-white border-b border-[#E8DFCA] px-6 flex items-center justify-between flex-shrink-0 shadow-sm">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="p-1.5 text-[#718096] hover:text-[#6D94C5] hover:bg-[#CBDCEB] rounded-lg transition-all md:hidden"
        >
          <Menu size={18} />
        </button>
        <div>
          <h1 className="text-base font-bold text-[#2d3748]">
            {TITLES[pathname] || 'Nivara Ventures'}
          </h1>
          <p className="text-xs text-[#718096] hidden sm:block">{today}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-right hidden sm:block">
          <p className="text-xs font-semibold text-[#2d3748]">{user?.name}</p>
          <p className="text-xs text-[#718096] capitalize">{user?.role}</p>
        </div>
        <div className="w-8 h-8 bg-[#6D94C5] rounded-xl flex items-center justify-center">
          <p className="text-white text-xs font-bold">
            {user?.name?.charAt(0)?.toUpperCase() || 'N'}
          </p>
        </div>
      </div>
    </header>
  );
}