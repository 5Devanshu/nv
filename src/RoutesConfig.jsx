import React                from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute       from './components/protected/ProtectedRoute';
import Layout               from './components/common/Layout';
import Login                from './components/pages/Login';
import Projects             from './components/pages/Projects';
import Flats                from './components/pages/Flats';
import Bookings             from './components/pages/Bookings';
import Payments             from './components/pages/Payments';
import Ledger               from './components/pages/Ledger';
import Brokers              from './components/pages/Brokers';
import ProjectExpenses      from './components/pages/ProjectExpenses';
import Reports              from './components/pages/Reports';
import Documents            from './components/pages/Documents';
import Notifications        from './components/pages/Notifications';

// Simple dashboard placeholder — swap with a full Dashboard page if needed
import { BarChart2 }        from 'lucide-react';
const Dashboard = () => (
  <div className="flex items-center justify-center h-64">
    <div className="text-center">
      <BarChart2 size={48} className="text-[#CBDCEB] mx-auto mb-3" />
      <p className="text-[#2d3748] font-bold text-lg">Welcome to Nivara Ventures ERP</p>
      <p className="text-[#718096] text-sm mt-1">Select a module from the sidebar to get started.</p>
    </div>
  </div>
);

export default function RoutesConfig() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<Login />} />

      {/* Protected — wrapped in Layout */}
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/"              element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard"     element={<Dashboard />} />
          <Route path="/projects"      element={<Projects />} />
          <Route path="/flats"         element={<Flats />} />
          <Route path="/bookings"      element={<Bookings />} />
          <Route path="/payments"      element={<Payments />} />
          <Route path="/ledger"        element={<Ledger />} />
          <Route path="/brokers"       element={<Brokers />} />
          <Route path="/expenses"      element={<ProjectExpenses />} />
          <Route path="/reports"       element={<Reports />} />
          <Route path="/documents"     element={<Documents />} />
          <Route path="/notifications" element={<Notifications />} />
        </Route>
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}