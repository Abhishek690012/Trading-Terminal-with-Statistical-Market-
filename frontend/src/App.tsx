import { useWebSocket } from './hooks/useWebSocket';
import { usePortfolioReconcile } from './hooks/usePortfolioReconcile';

import Header from './components/Header';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import TradePage from './pages/TradePage';
import PortfolioPage from './pages/PortfolioPage';
import WalletPage from './pages/WalletPage';

function App() {
  // Establish a single WS connection at the root.
  // This populates the Zustand store for all child components.
  useWebSocket();
  usePortfolioReconcile();

  return (
    <BrowserRouter>
      <div className="h-screen bg-gradient-to-b from-[#0B0E11] to-[#111827] text-white flex flex-col">
        <Header />

        <main className="flex-1 overflow-hidden">
          <Routes>
            <Route path="/" element={<Navigate to="/trade" replace />} />
            <Route path="/trade" element={<TradePage />} />
            <Route path="/portfolio" element={<PortfolioPage />} />
            <Route path="/wallet" element={<WalletPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
