import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Copy } from 'lucide-react';
import { fetchManageLoopBundle, getSessionEmail, saveNickname, setLoopPhase } from '../lib/store';
import type { ManageLoopBundle } from '../lib/store';

export default function Admin() {
    const { loopId } = useParams();
    const [data, setData] = useState<ManageLoopBundle | null>(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [nicknameDrafts, setNicknameDrafts] = useState<Record<string, string>>({});
    const [authorized, setAuthorized] = useState(true);

    const loadData = useCallback(async () => {
        if (!loopId) return;
        setLoading(true);
        try {
            const [bundle, sessionEmail] = await Promise.all([fetchManageLoopBundle(loopId), getSessionEmail()]);
            const isLoopAdmin = sessionEmail?.toLowerCase() === bundle.loop.admin_email.toLowerCase();
            setAuthorized(Boolean(isLoopAdmin));

            if (!isLoopAdmin) {
                setData(bundle);
                return;
            }

            setData(bundle);
            const initialDrafts = bundle.invitedUsers.reduce<Record<string, string>>((acc, user) => {
                acc[user.email] = user.nickname ?? '';
                return acc;
            }, {});
            setNicknameDrafts(initialDrafts);
        } catch (error) {
            console.error(error);
            const message = error instanceof Error ? error.message : 'Failed to load loop.';
            alert(message);
        } finally {
            setLoading(false);
        }
    }, [loopId]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const advancePhase = async () => {
        if (!data || !loopId) return;

        const currentPhase = data.loop.phase;
        if (currentPhase === 3) {
            alert('Published loops are locked and cannot change phase.');
            return;
        }

        const nextPhase = (currentPhase + 1) as 2 | 3;
        setSyncing(true);
        try {
            const updatedLoop = await setLoopPhase(loopId, nextPhase);
            setData({ ...data, loop: updatedLoop });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to move phase.';
            alert(message);
        } finally {
            setSyncing(false);
        }
    };

    const copyInvite = () => {
        const url = `${window.location.origin}/submit/${loopId}`;
        navigator.clipboard.writeText(url);
        alert('Invite link copied!');
    };

    const onNicknameChange = (email: string, value: string) => {
        setNicknameDrafts((previous) => ({ ...previous, [email]: value }));
    };

    const onSaveNickname = async (email: string) => {
        const nickname = nicknameDrafts[email] ?? '';

        setSyncing(true);
        try {
            await saveNickname(email, nickname);
            await loadData();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to save nickname.';
            alert(message);
        } finally {
            setSyncing(false);
        }
    };

    if (loading) return <div className="spinner" style={{ marginTop: '20vh' }}></div>;
    if (!data) return <div className="empty-state">Loop not found.</div>;
    if (!authorized) {
        return (
            <div className="empty-state" style={{ marginTop: '10vh' }}>
                This page is only available to the loop admin.
            </div>
        );
    }

    const phase = data.loop.phase;
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
                <p style={{ marginBottom: '1.5rem', fontSize: '0.95rem' }}>Move forward only: Questions -&gt; Answers -&gt; Published.</p>

                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button onClick={advancePhase} disabled={phase === 3 || syncing} className="btn">
                        {phase === 1 ? 'Move to Phase 2: Answers' : phase === 2 ? 'Publish Loop (Phase 3)' : 'Published and Locked'}
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

            <h3>Nicknames</h3>
            <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Nicknames are global and appear everywhere in all loops.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginBottom: '2rem' }}>
                {data.invitedUsers.map((user) => (
                    <div key={user.email} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr auto', gap: '0.6rem', alignItems: 'center', background: 'var(--surface-color)', borderRadius: '8px', padding: '0.8rem' }}>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{user.email}</div>
                        <input
                            value={nicknameDrafts[user.email] ?? ''}
                            onChange={(event) => onNicknameChange(user.email, event.target.value)}
                            placeholder="Set nickname"
                            disabled={syncing}
                        />
                        <button className="btn btn-secondary" onClick={() => onSaveNickname(user.email)} disabled={syncing}>
                            Save
                        </button>
                    </div>
                ))}
            </div>

            {data.loop.phase === 3 ? (
                <div style={{ background: 'var(--surface-color)', borderRadius: 'var(--radius-lg)', padding: '1.2rem', border: '1px solid var(--surface-border)' }}>
                    <p style={{ fontSize: '0.9rem' }}>
                        This loop is published and locked. No further management actions are available.
                    </p>
                </div>
            ) : null}
        </div>
    );
}
