import { createContext, useContext, useState, ReactNode } from 'react';
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
import Chat from './pages/Chat';

interface MessagesContextType {
  messages: string[];
  addMessage: (msg: string) => void;
}

const MessagesContext = createContext<MessagesContextType | undefined>(undefined);

export const MessagesProvider = ({ children }: { children: ReactNode }) => {
  const [messages, setMessages] = useState<string[]>([]);

  const addMessage = (msg: string) => setMessages((prev) => [...prev, msg]);

  return (
    <MessagesContext.Provider value={{ messages, addMessage }}>
      {children}
    </MessagesContext.Provider>
  );
};

export const useMessages = () => {
  const context = useContext(MessagesContext);
  if (!context) {
    throw new Error('useMessages must be used within a MessagesProvider');
  }
  return context;
};

function App() {
  return (
    <UserProvider>
      <MessagesProvider>
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
              {/* Nueva ruta para el chat */}
              <Route path="/chat/:otherUserId" element={<Chat />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </MessagesProvider>
    </UserProvider>
  );
}

export default App;