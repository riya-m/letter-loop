import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import CreateLoop from './pages/CreateLoop';
import SubmitUpdate from './pages/SubmitUpdate';
import Newsletter from './pages/Newsletter';
import Admin from './pages/Admin';
import { supabase } from './lib/supabase';
import { ensureInvitedContext, getSessionEmail } from './lib/store';

function AuthScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);

    const normalized = email.trim().toLowerCase();
    const { error } = await supabase.auth.signInWithOtp({
      email: normalized,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setSentTo(normalized);
    setLoading(false);
  };

  return (
    <div className="container" style={{ marginTop: '8vh', maxWidth: '520px' }}>
      <div className="card">
        <h2>Sign in to LetterLoop</h2>
        <p style={{ marginBottom: '1.5rem' }}>
          Enter your invited email to receive a magic link.
        </p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <button className="btn" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Sending link...' : 'Send magic link'}
          </button>
        </form>
        {sentTo ? (
          <p style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
            Magic link sent to {sentTo}. Open it on this device to continue.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function App() {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [isInvited, setIsInvited] = useState(false);

  useEffect(() => {
    const refreshAuth = async () => {
      setCheckingAuth(true);
      try {
        const email = await getSessionEmail();
        setSessionEmail(email);

        if (!email) {
          setIsInvited(false);
          setCheckingAuth(false);
          return;
        }

        await ensureInvitedContext();
        setIsInvited(true);
      } catch {
        setIsInvited(false);
      } finally {
        setCheckingAuth(false);
      }
    };

    void refreshAuth();

    const { data } = supabase.auth.onAuthStateChange(() => {
      void refreshAuth();
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (checkingAuth) {
    return <div className="spinner" style={{ marginTop: '20vh' }}></div>;
  }

  if (!sessionEmail) {
    return (
      <Router>
        <header className="header-bar">
          <Link to="/" className="logo">
            <Mail className="logo-icon" />
            LetterLoop
          </Link>
        </header>
        <main className="fade-in">
          <AuthScreen />
        </main>
      </Router>
    );
  }

  if (!isInvited) {
    return (
      <Router>
        <header className="header-bar">
          <Link to="/" className="logo">
            <Mail className="logo-icon" />
            LetterLoop
          </Link>
        </header>
        <main className="fade-in">
          <div className="container" style={{ marginTop: '8vh', maxWidth: '520px' }}>
            <div className="card">
              <h2>Access pending</h2>
              <p style={{ marginBottom: '1.2rem' }}>
                {sessionEmail} is not on the invited list yet.
              </p>
              <button className="btn btn-secondary" onClick={handleLogout}>
                Sign out
              </button>
            </div>
          </div>
        </main>
      </Router>
    );
  }

  return (
    <Router>
      <header className="header-bar">
        <Link to="/" className="logo">
          <Mail className="logo-icon" />
          LetterLoop
        </Link>
        <button className="btn btn-secondary" onClick={handleLogout} style={{ padding: '0.45rem 0.9rem' }}>
          Log out
        </button>
      </header>

      <main className="fade-in">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/create" element={<CreateLoop />} />
          <Route path="/admin/:loopId" element={<Admin />} />
          <Route path="/submit/:loopId" element={<SubmitUpdate />} />
          <Route path="/newsletter/:loopId" element={<Newsletter />} />
        </Routes>
      </main>
    </Router>
  );
}

export default App;
