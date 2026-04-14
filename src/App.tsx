import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import CreateLoop from './pages/CreateLoop';
import SubmitUpdate from './pages/SubmitUpdate';
import Newsletter from './pages/Newsletter';
import Admin from './pages/Admin';

function App() {
  return (
    <Router>
      <header className="header-bar">
        <Link to="/" className="logo">
          <Mail className="logo-icon" />
          Pulse
        </Link>
      </header>

      <main className="fade-in">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/create" element={<CreateLoop />} />
          <Route path="/admin/:loopId" element={<Admin />} />
          <Route path="/submit/:loopId/:contributorId" element={<SubmitUpdate />} />
          <Route path="/newsletter/:loopId" element={<Newsletter />} />
        </Routes>
      </main>
    </Router>
  );
}

export default App;
