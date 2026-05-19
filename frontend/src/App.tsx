import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { Manage } from './pages/Manage';

function Layout() {
  return (
    <div className="relative min-h-screen w-screen overflow-hidden bg-background text-foreground font-sans">
      {/* Floating Header Navigation Pill */}
      <header className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center justify-between w-[calc(100%-2rem)] max-w-5xl bg-background border border-border px-6 py-3.5 rounded-full shadow-sm">
        <div className="font-semibold text-sm tracking-tight flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          Perimeter AI
        </div>
        <nav className="flex items-center gap-6">
          <Link to="/" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Dashboard</Link>
          <Link to="/manage" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Management</Link>
        </nav>
      </header>

      {/* Viewport content area */}
      <main className="w-full h-screen relative">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/manage" element={<Manage />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Layout />
    </Router>
  );
}

export default App;
