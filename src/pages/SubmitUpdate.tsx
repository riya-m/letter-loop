import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { fetchBlobState, updateBlobState } from '../lib/store';
import type { BlobState } from '../lib/store';

export default function SubmitUpdate() {
    const { loopId } = useParams();
    const [name, setName] = useState('');
    const [hasName, setHasName] = useState(false);
    const [data, setData] = useState<BlobState | null>(null);

    const [newQuestion, setNewQuestion] = useState('');
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);

    useEffect(() => {
        if (loopId) {
            fetchBlobState(loopId).then(setData)
                .catch(() => alert("Could not load the loop. It might not exist."))
                .finally(() => setLoading(false));
        }
    }, [loopId]);

    const handleAddQuestion = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newQuestion.trim() || !data || !loopId) return;

        setSyncing(true);
        const updatedState = { ...data };
        updatedState.questions.push({
            id: Math.random().toString(36).substring(7),
            text: newQuestion,
            author: name,
            created_at: new Date().toISOString()
        });

        await updateBlobState(loopId, updatedState);
        setData(updatedState);
        setNewQuestion('');
        setSyncing(false);
    };

    const handleAddAnswer = async (e: React.FormEvent, questionId: string) => {
        e.preventDefault();
        const txt = answers[questionId];
        if (!txt?.trim() || !data || !loopId) return;

        setSyncing(true);
        const updatedState = { ...data };
        updatedState.answers.push({
            id: Math.random().toString(36).substring(7),
            question_id: questionId,
            text: txt,
            author: name,
            created_at: new Date().toISOString()
        });

        await updateBlobState(loopId, updatedState);
        setData(updatedState);
        setAnswers({ ...answers, [questionId]: '' });
        setSyncing(false);
    };

    if (loading) return <div className="spinner" style={{ marginTop: '20vh' }}></div>;
    if (!data) return <div className="empty-state">Loop not found.</div>;

    const phase = data.loop.phase || 1;

    if (phase === 3) {
        return (
            <div className="container" style={{ marginTop: '10vh', textAlign: 'center' }}>
                <h2>This Loop is Closed!</h2>
                <p>The admin is currently reviewing all answers.</p>
            </div>
        );
    }

    if (!hasName) {
        return (
            <div className="container" style={{ marginTop: '5vh' }}>
                <div className="card" style={{ maxWidth: '400px', margin: '0 auto' }}>
                    <h2>Join the Loop</h2>
                    <p style={{ marginBottom: '2rem' }}>Enter your name to view and participate in {data.loop.title}.</p>
                    <form onSubmit={e => { e.preventDefault(); setHasName(true); }}>
                        <input
                            autoFocus
                            placeholder="Your name"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            required
                            style={{ marginBottom: '1rem' }}
                        />
                        <button className="btn" style={{ width: '100%' }}>Enter</button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="container" style={{ marginTop: '5vh', maxWidth: '700px' }}>
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ color: 'white' }}>{data.loop.title}</h1>
                <p>{data.loop.description}</p>
                <div style={{ display: 'inline-block', padding: '0.2rem 0.6rem', background: 'var(--primary-color)', borderRadius: '1rem', fontSize: '0.8rem', marginTop: '1rem', fontWeight: 'bold' }}>
                    Phase {phase}: {phase === 1 ? 'Proposing Questions' : 'Submitting Answers'}
                </div>
            </div>

            {phase === 1 && (
                <div className="card" style={{ marginBottom: '2rem' }}>
                    <h3>Propose a Question</h3>
                    <p style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>Ask the group something! Everyone will see it.</p>
                    <form onSubmit={handleAddQuestion} style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                            placeholder="e.g. What was your favorite moment this month?"
                            value={newQuestion}
                            onChange={e => setNewQuestion(e.target.value)}
                            disabled={syncing}
                            required
                            style={{ flex: 1 }}
                        />
                        <button className="btn" disabled={syncing}>Add</button>
                    </form>
                </div>
            )}

            <h3 style={{ marginBottom: '1rem' }}>Group Questions</h3>

            {data.questions.length === 0 ? (
                <div className="empty-state" style={{ padding: '2rem' }}>No questions proposed yet.</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {data.questions.map(q => {
                        return (
                            <div key={q.id} style={{ background: 'var(--surface-color)', padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
                                <div style={{ marginBottom: phase === 2 ? '1rem' : 0 }}>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--primary-color)', fontWeight: 'bold' }}>{q.author} asked:</span>
                                    <p style={{ color: 'white', fontSize: '1.1rem', fontWeight: 500, marginTop: '0.2rem' }}>{q.text}</p>
                                </div>

                                {phase === 2 && (
                                    <form onSubmit={(e) => handleAddAnswer(e, q.id)} style={{ display: 'flex', gap: '0.5rem' }}>
                                        <input
                                            placeholder="Your secret answer..."
                                            value={answers[q.id] || ''}
                                            onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })}
                                            disabled={syncing}
                                            required
                                            style={{ flex: 1, padding: '0.5rem 1rem' }}
                                        />
                                        <button className="btn btn-secondary" disabled={syncing} style={{ padding: '0.5rem 1rem' }}>Send</button>
                                    </form>
                                )}
                                {phase === 2 && data.answers.some(a => a.question_id === q.id && a.author === name) && (
                                    <p style={{ fontSize: '0.85rem', color: '#10b981', marginTop: '0.5rem' }}>✓ You answered this.</p>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
