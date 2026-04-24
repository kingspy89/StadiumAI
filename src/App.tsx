import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AdminView from './pages/AdminView';
import CafeManagement from './pages/CafeManagement';
import UserNavigation from './pages/UserNavigation';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AdminView />} />
        <Route path="/cafe" element={<CafeManagement />} />
        <Route path="/user" element={<UserNavigation />} />
      </Routes>
    </BrowserRouter>
  );
}

