import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAdminLoops } from '../lib/store';
import { PlusCircle, Settings, Mailbox } from 'lucide-react';

interface AdminLoop {
    id: string;
    title: string;
    description: string;
    created_at: string;
}

export default function Dashboard() {
    const [loops, setLoops] = useState<AdminLoop[]>([]);

    useEffect(() => {
        setLoops(getAdminLoops());
    }, []);

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1>Your Loops</h1>
                    <p>Manage your group newsletters and collections</p>
                </div>
                <Link to="/create" className="btn">
                    <PlusCircle size={18} />
                    New Loop
                </Link>
            </div>

            {loops.length === 0 ? (
                <div className="empty-state">
                    <Mailbox size={48} style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }} />
                    <h3>No loops yet</h3>
                    <p style={{ marginBottom: '1.5rem' }}>Create your first loop to start collecting updates.</p>
                    <Link to="/create" className="btn btn-secondary">Create a Loop</Link>
                </div>
            ) : (
                <div className="grid">
                    {loops.map(loop => (
                        <div key={loop.id} className="card card-interactive">
                            <h3>{loop.title}</h3>
                            {loop.description && <p style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>{loop.description}</p>}

                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
                                <Link to={`/admin/${loop.id}`} className="btn btn-secondary" style={{ flex: 1, padding: '0.5rem', fontSize: '0.9rem' }}>
                                    <Settings size={16} />
                                    Manage Loop
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
