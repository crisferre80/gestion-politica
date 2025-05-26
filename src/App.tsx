import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import RecyclerProfile from './pages/RecyclerProfile';
import CollectionPoints from './pages/CollectionPoints';
import AddCollectionPoint from './pages/AddCollectionPoint';
import Dashboard from './pages/Dashboard';
import AdminAds from './pages/AdminAds';
import { UserProvider } from './context/UserContext';

function App() {
  return (
    <UserProvider>
      <div className="flex flex-col min-h-screen bg-gray-50">
        <Toaster position="top-right" />
        <Navbar />
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/recycler-profile/:id" element={<RecyclerProfile />} />
            <Route path="/collection-points" element={<CollectionPoints />} />
            <Route path="/add-collection-point" element={<AddCollectionPoint />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/admin/ads" element={<AdminAds />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </UserProvider>
  );
}

export default App;