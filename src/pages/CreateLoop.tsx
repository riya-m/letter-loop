import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createLoop } from '../lib/store';
import { supabase } from '../lib/supabase';

const notifyLoop = async (loopId: string, eventType: 'phase1' | 'phase2' | 'phase3') => {
    try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) return;

        await fetch('/api/notify-loop', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ loopId, eventType }),
        });
    } catch {
        return;
    }
};

export default function CreateLoop() {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const loopId = await createLoop(title, description);
            await notifyLoop(loopId, 'phase1');
            navigate('/');
        } catch (err) {
            console.error(err);
            const message = err instanceof Error ? err.message : 'Failed to create loop.';
            alert(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container">
            <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
                <h2>Create a New Loop</h2>
                <p style={{ marginBottom: '2rem' }}>Start a new newsletter loop to collect updates from your team or friends.</p>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="title">Loop Title</label>
                        <input
                            id="title"
                            type="text"
                            placeholder="e.g. Weekly Engineering Sync"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="description">Description (Optional)</label>
                        <textarea
                            id="description"
                            placeholder="What kind of updates are you collecting?"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                        <button type="submit" className="btn" disabled={loading} style={{ flex: 1 }}>
                            {loading ? 'Creating...' : 'Create Loop'}
                        </button>
                        <button type="button" className="btn btn-secondary" onClick={() => navigate('/')} style={{ flex: 1 }}>
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
