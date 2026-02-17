import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu } from 'lucide-react';
import Hero from './components/Hero';
import DetectionInterface from './components/DetectionInterface';
import Sidebar from './components/Sidebar';
import LiveDetection from './components/LiveDetection';
import History from './components/History';
import Settings from './components/Settings';
import SafetyAdvisor from './components/SafetyAdvisor';
import { Button } from './components/ui/button';

function App() {
  const [currentPage, setCurrentPage] = useState('home');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleGetStarted = () => {
    setCurrentPage('detection');
  };

  const handleNavigate = (page: string) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Close sidebar on desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Menu Button */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="fixed top-6 left-6 z-30"
      >
        <Button
          onClick={() => setSidebarOpen(true)}
          className="w-12 h-12 bg-card border-2 border-border rounded-xl flex items-center justify-center shadow-lg hover:shadow-xl hover:border-primary"
          variant="ghost"
        >
          <Menu className="w-6 h-6" />
        </Button>
      </motion.div>

      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        currentPage={currentPage}
        onNavigate={handleNavigate}
      />

      {/* Main Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentPage}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          {currentPage === 'home' && <Hero onGetStarted={handleGetStarted} />}
          {currentPage === 'detection' && <DetectionInterface />}
          {/* Chat page removed */}
          {currentPage === 'live-detection' && <LiveDetection />}
          {currentPage === 'history' && <History />}
          {currentPage === 'settings' && <Settings />}
          {currentPage === 'safety-advisor' && <SafetyAdvisor />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default App;
