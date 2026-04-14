import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { addAnswer, addQuestion, buildNicknameMap, fetchLoopBundle, getDisplayName, getSessionEmail } from '../lib/store';
import type { LoopBundle } from '../lib/store';

export default function SubmitUpdate() {
    const { loopId } = useParams();
    const [data, setData] = useState<LoopBundle | null>(null);
    const [viewerEmail, setViewerEmail] = useState<string | null>(null);

    const [newQuestion, setNewQuestion] = useState('');
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);

    const loadData = useCallback(async () => {
        if (!loopId) return;
        setLoading(true);
        try {
            const [bundle, email] = await Promise.all([fetchLoopBundle(loopId), getSessionEmail()]);
            setData(bundle);
            setViewerEmail(email);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Could not load loop.';
            alert(message);
        } finally {
            setLoading(false);
        }
    }, [loopId]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const handleAddQuestion = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newQuestion.trim() || !data || !loopId) return;

        setSyncing(true);
        try {
            await addQuestion(loopId, newQuestion);
            setNewQuestion('');
            await loadData();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to add question.';
            alert(message);
        } finally {
            setSyncing(false);
        }
    };

    const handleAddAnswer = async (e: React.FormEvent, questionId: string) => {
        e.preventDefault();
        const txt = answers[questionId];
        if (!txt?.trim() || !data || !loopId) return;

        setSyncing(true);
        try {
            await addAnswer(loopId, questionId, txt);
            setAnswers({ ...answers, [questionId]: '' });
            await loadData();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to add answer.';
            alert(message);
        } finally {
            setSyncing(false);
        }
    };

    if (loading) return <div className="spinner" style={{ marginTop: '20vh' }}></div>;
    if (!data) return <div className="empty-state">Loop not found.</div>;
    if (!viewerEmail) return <div className="empty-state">You must be logged in.</div>;

    const phase = data.loop.phase;
    const nicknameMap = buildNicknameMap(data.invitedUsers);
    const viewerName = getDisplayName(viewerEmail, nicknameMap);

    if (phase === 3) {
        return (
            <div className="container" style={{ marginTop: '10vh', textAlign: 'center' }}>
                <h2>This Loop is Closed!</h2>
                <p>The admin is currently reviewing all answers.</p>
            </div>
        );
    }

    return (
        <div className="container" style={{ marginTop: '5vh', maxWidth: '700px' }}>
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ color: 'white' }}>{data.loop.title}</h1>
                <p>{data.loop.description}</p>
                <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>Signed in as <strong>{viewerName}</strong></p>
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
                        const askedBy = getDisplayName(q.author_email, nicknameMap);
                        const alreadyAnswered = data.answers.some((a) => a.question_id === q.id && a.author_email.toLowerCase() === viewerEmail.toLowerCase());
                        return (
                            <div key={q.id} style={{ background: 'var(--surface-color)', padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
                                <div style={{ marginBottom: phase === 2 ? '1rem' : 0 }}>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--primary-color)', fontWeight: 'bold' }}>{askedBy} asked:</span>
                                    <p style={{ color: 'white', fontSize: '1.1rem', fontWeight: 500, marginTop: '0.2rem' }}>{q.text}</p>
                                </div>

                                {phase === 2 && (
                                    <form onSubmit={(e) => handleAddAnswer(e, q.id)} style={{ display: 'flex', gap: '0.5rem' }}>
                                        <input
                                            placeholder="Your secret answer..."
                                            value={answers[q.id] || ''}
                                            onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })}
                                            disabled={syncing || alreadyAnswered}
                                            required
                                            style={{ flex: 1, padding: '0.5rem 1rem' }}
                                        />
                                        <button className="btn btn-secondary" disabled={syncing || alreadyAnswered} style={{ padding: '0.5rem 1rem' }}>Send</button>
                                    </form>
                                )}
                                {phase === 2 && alreadyAnswered && (
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
