import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getUserContext, listLoops } from '../lib/store';
import type { LoopDisplay } from '../lib/store';
import { PlusCircle, Settings, Mailbox, Send, Newspaper } from 'lucide-react';

export default function Dashboard() {
    const [loops, setLoops] = useState<LoopDisplay[]>([]);
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);

    const loadLoops = async () => {
        setLoading(true);
        try {
            const [context, data] = await Promise.all([getUserContext(), listLoops()]);
            setIsAdmin(context.isAdmin);
            setLoops(data);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to load loops.';
            alert(message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadLoops();
    }, []);

    const phaseLabel = (phase: number) => {
        if (phase === 1) return 'Questions open';
        if (phase === 2) return 'Answering open';
        return 'Published';
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1>Your Loops</h1>
                    <p>Manage your group newsletters and collections</p>
                </div>
                {isAdmin ? (
                    <Link to="/create" className="btn">
                        <PlusCircle size={18} />
                        New Loop
                    </Link>
                ) : null}
            </div>

            {loading ? (
                <div className="spinner" style={{ marginTop: '20vh' }}></div>
            ) : loops.length === 0 ? (
                <div className="empty-state">
                    <Mailbox size={48} style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }} />
                    <h3>No loops yet</h3>
                    <p style={{ marginBottom: '1.5rem' }}>Create your first loop to start collecting updates.</p>
                    {isAdmin ? (
                        <Link to="/create" className="btn btn-secondary">Create a Loop</Link>
                    ) : (
                        <p>Loops created by admins will appear here automatically.</p>
                    )}
                </div>
            ) : (
                <div className="grid">
                    {loops.map(loop => (
                        <div key={loop.id} className="card card-interactive">
                            <h3>{loop.title}</h3>
                            {loop.description && <p style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>{loop.description}</p>}
                            <p style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
                                Status: <strong>{phaseLabel(loop.phase)}</strong>
                            </p>

                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
                                {loop.phase !== 3 && loop.is_admin ? (
                                    <Link to={`/admin/${loop.id}`} className="btn btn-secondary" style={{ flex: 1, padding: '0.5rem', fontSize: '0.9rem' }}>
                                        <Settings size={16} />
                                        Manage Loop
                                    </Link>
                                ) : null}

                                {loop.phase !== 3 ? (
                                    <Link to={`/submit/${loop.id}`} className="btn btn-secondary" style={{ flex: 1, padding: '0.5rem', fontSize: '0.9rem' }}>
                                        <Send size={16} />
                                        Open Loop
                                    </Link>
                                ) : null}

                                {loop.phase === 3 ? (
                                    <Link to={`/newsletter/${loop.id}`} className="btn btn-secondary" style={{ flex: 1, padding: '0.5rem', fontSize: '0.9rem' }}>
                                        <Newspaper size={16} />
                                        View Published
                                    </Link>
                                ) : null}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
