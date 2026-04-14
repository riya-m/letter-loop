import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Share2 } from 'lucide-react';
import { buildNicknameMap, fetchLoopBundle, getDisplayName } from '../lib/store';
import type { LoopBundle } from '../lib/store';

export default function Newsletter() {
    const { loopId } = useParams();
    const [data, setData] = useState<LoopBundle | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (loopId) {
            fetchLoopBundle(loopId)
                .then(setData)
                .catch(console.error)
                .finally(() => setLoading(false));
        }
    }, [loopId]);

    const handleShare = () => {
        navigator.clipboard.writeText(window.location.href);
        alert('Link copied to clipboard!');
    };

    if (loading) return <div className="spinner" style={{ marginTop: '20vh' }}></div>;
    if (!data) return <div className="empty-state">Newsletter not found.</div>;
    if (data.loop.phase !== 3) {
        return (
            <div className="container" style={{ marginTop: '10vh', textAlign: 'center' }}>
                <h2>This loop is not published yet.</h2>
                <p>Come back once the admin moves it to phase 3.</p>
            </div>
        );
    }

    const nicknameMap = buildNicknameMap(data.invitedUsers);
    const issueNumber = data.loop.created_at.slice(0, 10).replaceAll('-', '');

    return (
        <div className="container" style={{ maxWidth: '700px' }}>
            <div style={{ marginBottom: '2rem' }}>
                <Link to="/" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                    <ArrowLeft size={16} /> Back to Dashboard
                </Link>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1 style={{ color: 'white', letterSpacing: '-0.02em', fontSize: '3rem', marginBottom: '0.5rem' }}>{data.loop.title}</h1>
                        <p style={{ color: 'var(--primary-color)', fontWeight: '500' }}>
                            Issue #{issueNumber} &bull; {data.loop.published_at ? new Date(data.loop.published_at).toLocaleDateString() : 'Unpublished draft'}
                        </p>
                    </div>
                    <button onClick={handleShare} className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }} title="Copy Link">
                        <Share2 size={16} /> Share
                    </button>
                </div>
            </div>

            {data.questions.length === 0 ? (
                <div className="empty-state">No content was collected for this issue.</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                    {data.questions.map((q) => {
                        const ansList = data.answers.filter(a => a.question_id === q.id);
                        const questionAuthor = getDisplayName(q.author_email, nicknameMap);
                        return (
                            <div key={q.id} style={{
                                background: 'var(--surface-color)',
                                borderRadius: 'var(--radius-xl)',
                                padding: '2rem',
                                border: '1px solid var(--surface-border)'
                            }}>
                                <h2 style={{ color: 'white', fontSize: '1.4rem', marginBottom: '1.5rem', lineHeight: 1.4 }}>
                                    <span style={{ color: 'var(--primary-color)' }}>Q:</span> {q.text}
                                    <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem', fontWeight: 400 }}>Asked by {questionAuthor}</span>
                                </h2>

                                {ansList.length === 0 ? (
                                    <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>No answers provided.</p>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        {ansList.map((ans) => (
                                            <div key={ans.id} style={{
                                                background: 'rgba(255,255,255,0.03)',
                                                padding: '1rem 1.5rem',
                                                borderRadius: 'var(--radius-lg)'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--accent-color)', color: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 'bold' }}>
                                                        {getDisplayName(ans.author_email, nicknameMap).charAt(0).toUpperCase()}
                                                    </div>
                                                    <span style={{ fontWeight: 'bold', color: 'white', fontSize: '0.9rem' }}>{getDisplayName(ans.author_email, nicknameMap)}</span>
                                                </div>
                                                <p style={{ color: '#cbd5e1', lineHeight: 1.5 }}>
                                                    {ans.text}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            <div style={{ textAlign: 'center', margin: '4rem 0 2rem 0', padding: '2rem', borderTop: '1px solid var(--surface-border)' }}>
                <p style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    Collected via <strong>LetterLoop</strong>
                </p>
            </div>
        </div>
    );
}
