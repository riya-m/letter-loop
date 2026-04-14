import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Copy } from 'lucide-react';
import { fetchBlobState, updateBlobState, isAdmin } from '../lib/store';
import type { BlobState } from '../lib/store';

export default function Admin() {
    const { loopId } = useParams();
    const [data, setData] = useState<BlobState | null>(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);

    useEffect(() => {
        if (loopId) {
            if (!isAdmin(loopId)) {
                alert("You are not the admin of this loop!");
            }

            fetchBlobState(loopId)
                .then(setData)
                .catch(console.error)
                .finally(() => setLoading(false));
        }
    }, [loopId]);

    const advancePhase = async (newPhase: 1 | 2 | 3) => {
        if (!data || !loopId) return;
        setSyncing(true);
        const updated = { ...data, loop: { ...data.loop, phase: newPhase } };
        await updateBlobState(loopId, updated);
        setData(updated);
        setSyncing(false);
    };

    const copyInvite = () => {
        const url = `${window.location.origin}/submit/${loopId}/user`;
        navigator.clipboard.writeText(url);
        alert('Invite link copied!');
    };

    if (loading) return <div className="spinner" style={{ marginTop: '20vh' }}></div>;
    if (!data) return <div className="empty-state">Loop not found.</div>;

    const phase = data.loop.phase || 1;

    return (
        <div className="container" style={{ maxWidth: '700px' }}>
            <div style={{ marginBottom: '2rem' }}>
                <Link to="/" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                    <ArrowLeft size={16} /> Back to Dashboard
                </Link>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1 style={{ color: 'white', fontSize: '2.5rem', marginBottom: '0.5rem' }}>{data.loop.title} (Admin)</h1>
                        <p style={{ color: 'var(--text-secondary)' }}>Status: Phase {phase}</p>
                    </div>
                    <button onClick={copyInvite} className="btn" style={{ padding: '0.5rem 1rem' }}>
                        <Copy size={16} /> Copy Invite Link
                    </button>
                </div>
            </div>

            <div className="card" style={{ marginBottom: '2rem', background: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.3)' }}>
                <h3>Control Panel</h3>
                <p style={{ marginBottom: '1.5rem', fontSize: '0.95rem' }}>Move the loop forward through its phases.</p>

                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button onClick={() => advancePhase(1)} disabled={phase === 1 || syncing} className={phase === 1 ? 'btn' : 'btn btn-secondary'}>
                        Phase 1: Questions
                    </button>
                    <button onClick={() => advancePhase(2)} disabled={phase === 2 || syncing} className={phase === 2 ? 'btn' : 'btn btn-secondary'}>
                        Phase 2: Answers
                    </button>
                    <button onClick={() => advancePhase(3)} disabled={phase === 3 || syncing} className={phase === 3 ? 'btn' : 'btn btn-secondary'}>
                        Phase 3: Close Loop
                    </button>
                </div>
            </div>

            {(phase === 3) && (
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <Link to={`/newsletter/${loopId}`} className="btn" style={{ fontSize: '1.1rem', padding: '1rem 3rem' }}>
                        View Final Compiled Newsletter
                    </Link>
                </div>
            )}

            <h3>Live Data Preview</h3>
            <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>You can see exactly what answers have been submitted securely.</p>

            {data.questions.map((q) => {
                const ansList = data.answers.filter(a => a.question_id === q.id);
                return (
                    <div key={q.id} style={{ background: 'var(--surface-color)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: '1.5rem', border: '1px solid var(--surface-border)' }}>
                        <h4 style={{ color: 'white', fontSize: '1.1rem', marginBottom: '1rem' }}>Q: {q.text} <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 400 }}>({q.author})</span></h4>
                        {ansList.length === 0 ? <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>No answers yet.</p> : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {ansList.map(a => (
                                    <div key={a.id} style={{ background: 'rgba(0,0,0,0.2)', padding: '0.8rem', borderRadius: '4px' }}>
                                        <strong style={{ color: 'var(--primary-color)' }}>{a.author}</strong>: {a.text}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
