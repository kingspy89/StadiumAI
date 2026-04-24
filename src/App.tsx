import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AdminView from './pages/AdminView';
import UserNavigation from './pages/UserNavigation';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AdminView />} />
        <Route path="/user" element={<UserNavigation />} />
      </Routes>
    </BrowserRouter>
  );
}

