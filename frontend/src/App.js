import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import Explore from './pages/Explore';
import PublicProfile from './pages/PublicProfile';
import AiHelpperWidget from './components/AiHelpperWidget';
import './styles/App.css';

const routerBasename = process.env.PUBLIC_URL || '/';

const ProtectedRoute = ({ children }) => {
  const { token, loading } = useAuth();

  if (loading) {
    return <div className="app-loading">Loading...</div>;
  }

  return token ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <BrowserRouter basename={routerBasename}>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/users/:userId" element={<PublicProfile />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
        <AiHelpperWidget />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
