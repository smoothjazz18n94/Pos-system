import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';
import { useAuthStore, useSyncStore } from './store/syncStore';
import { startAutoSync, initialDataSync, updatePendingCount } from './services/syncEngine';

// Layouts
import AppLayout from './components/ui/AppLayout';
import AuthLayout from './components/auth/AuthLayout';

// Pages
import LoginPage from './pages/LoginPage';
import POSPage from './pages/POSPage';
import DashboardPage from './pages/DashboardPage';
import ProductsPage from './pages/ProductsPage';
import SalesPage from './pages/SalesPage';
import ReportsPage from './pages/ReportsPage';
import InventoryPage from './pages/InventoryPage';
import UsersPage from './pages/UsersPage';
import SettingsPage from './pages/SettingsPage';

const ProtectedRoute = ({ children, roles }) => {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user?.role)) return <Navigate to="/pos" replace />;
  return children;
};

export default function App() {
  const { isAuthenticated } = useAuthStore();
  const { setOnline } = useSyncStore();

  useEffect(() => {
    // Network status listeners
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (isAuthenticated) {
      // Generate device ID
      if (!localStorage.getItem('deviceId')) {
        localStorage.setItem('deviceId', `device-${uuidv4()}`);
      }

      initialDataSync();
      startAutoSync();
      updatePendingCount();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isAuthenticated]);

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: { background: '#1e293b', color: '#f1f5f9', border: '1px solid #334155' },
        }}
      />
      <Routes>
        <Route path="/login" element={
          isAuthenticated ? <Navigate to="/pos" replace /> : <AuthLayout><LoginPage /></AuthLayout>
        } />

        <Route path="/" element={
          <ProtectedRoute><AppLayout /></ProtectedRoute>
        }>
          <Route index element={<Navigate to="/pos" replace />} />
          <Route path="pos" element={<POSPage />} />
          <Route path="dashboard" element={
            <ProtectedRoute roles={['ADMIN', 'MANAGER']}><DashboardPage /></ProtectedRoute>
          } />
          <Route path="products" element={
            <ProtectedRoute roles={['ADMIN', 'MANAGER']}><ProductsPage /></ProtectedRoute>
          } />
          <Route path="sales" element={<SalesPage />} />
          <Route path="inventory" element={
            <ProtectedRoute roles={['ADMIN', 'MANAGER']}><InventoryPage /></ProtectedRoute>
          } />
          <Route path="reports" element={
            <ProtectedRoute roles={['ADMIN', 'MANAGER']}><ReportsPage /></ProtectedRoute>
          } />
          <Route path="users" element={
            <ProtectedRoute roles={['ADMIN']}><UsersPage /></ProtectedRoute>
          } />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/pos" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
