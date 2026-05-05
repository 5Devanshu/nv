import React          from 'react';
import { NavLink }    from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { clearCredentials }         from '../../app/authSlice';
import {
  Building2, LayoutDashboard, Home,
  ClipboardList, IndianRupee, BookOpen,
  Users, Receipt, BarChart2, FileText,
  Bell, LogOut, ChevronLeft, ChevronRight,
} from 'lucide-react';

const NAV = [
  { to: '/dashboard',    label: 'Dashboard',   icon: LayoutDashboard },
  { to: '/projects',     label: 'Projects',    icon: Building2       },
  { to: '/flats',        label: 'Flats',       icon: Home            },
  { to: '/bookings',     label: 'Bookings',    icon: ClipboardList   },
  { to: '/payments',     label: 'Payments',    icon: IndianRupee     },
  { to: '/ledger',       label: 'Ledger',      icon: BookOpen        },
  { to: '/brokers',      label: 'Brokers',     icon: Users           },
  { to: '/expenses',     label: 'Expenses',    icon: Receipt         },
  { to: '/reports',      label: 'Reports',     icon: BarChart2       },
  { to: '/documents',    label: 'Documents',   icon: FileText        },
  { to: '/notifications',label: 'Alerts',      icon: Bell            },
];

export default function Sidebar({ open, onToggle }) {
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);

  const handleLogout = () => {
    dispatch(clearCredentials());
  };

  return (
    <aside className={`flex flex-col h-screen bg-[#1a365d] transition-all duration-300 flex-shrink-0 ${
      open ? 'w-56' : 'w-16'
    }`}>

      {/* Brand */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
        <div className="w-8 h-8 bg-[#6D94C5] rounded-xl flex items-center justify-center flex-shrink-0">
          <Building2 size={16} className="text-white" />
        </div>
        {open && (
          <div className="min-w-0">
            <p className="text-white font-bold text-sm truncate">Nivara</p>
            <p className="text-[#CBDCEB] text-xs truncate">Ventures ERP</p>
          </div>
        )}
      </div>

      {/* Nav links */}
      <nav className="flex-1 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 mx-2 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-[#6D94C5] text-white'
                  : 'text-[#CBDCEB] hover:bg-white/10 hover:text-white'
              }`
            }
            title={!open ? label : undefined}
          >
            <Icon size={17} className="flex-shrink-0" />
            {open && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User + logout */}
      <div className="border-t border-white/10 p-3 space-y-1">
        {open && user && (
          <div className="px-2 py-1.5 mb-1">
            <p className="text-white text-xs font-semibold truncate">{user.name}</p>
            <p className="text-[#CBDCEB] text-xs capitalize truncate">{user.role}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-2 py-2.5 rounded-xl text-[#CBDCEB] hover:bg-red-500/20 hover:text-red-300 transition-all text-sm font-medium"
          title={!open ? 'Sign Out' : undefined}
        >
          <LogOut size={16} className="flex-shrink-0" />
          {open && <span>Sign Out</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="absolute top-1/2 -translate-y-1/2 -right-3 w-6 h-6 bg-[#6D94C5] text-white rounded-full flex items-center justify-center shadow-md hover:bg-[#5a7eb0] transition-all z-10"
        style={{ position: 'fixed', left: open ? '212px' : '52px', top: '50%' }}
      >
        {open ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
      </button>
    </aside>
  );
}