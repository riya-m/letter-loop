import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  buildNicknameMap,
  clearQuestionDraft,
  fetchLoopBundle,
  getDisplayName,
  getSessionEmail,
  getQuestionDraft,
  listAnswerDrafts,
  addQuestion,
  saveAnswerDraft,
  saveQuestionDraft,
  uploadAnswerImage,
} from '../lib/store';
import type { LoopBundle, UploadedImage } from '../lib/store';

export default function SubmitUpdate() {
  const { loopId } = useParams();
  const [data, setData] = useState<LoopBundle | null>(null);
  const [viewerEmail, setViewerEmail] = useState<string | null>(null);

  const [newQuestion, setNewQuestion] = useState('');
  const [promptAnswers, setPromptAnswers] = useState<Record<string, string>>({});
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>({});
  const [promptImageDrafts, setPromptImageDrafts] = useState<Record<string, UploadedImage | null>>({});
  const [questionImageDrafts, setQuestionImageDrafts] = useState<Record<string, UploadedImage | null>>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [draftState, setDraftState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [draftTimer, setDraftTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const loadData = useCallback(async () => {
    if (!loopId) return;
    setLoading(true);
    try {
      const [bundle, email, questionDraft, answerDrafts] = await Promise.all([
        fetchLoopBundle(loopId),
        getSessionEmail(),
        getQuestionDraft(loopId),
        listAnswerDrafts(loopId),
      ]);
      setData(bundle);
      setViewerEmail(email);
      if (questionDraft?.text) {
        setNewQuestion(questionDraft.text);
      }
      if (answerDrafts.length > 0) {
        const promptDrafts: Record<string, string> = {};
        const questionDraftMap: Record<string, string> = {};
        const promptImagesDraftMap: Record<string, UploadedImage | null> = {};
        const questionImagesDraftMap: Record<string, UploadedImage | null> = {};
        answerDrafts.forEach((draft) => {
          if (draft.item_type === 'prompt') {
            promptDrafts[draft.item_id] = draft.text;
            promptImagesDraftMap[draft.item_id] = draft.image_url
              ? {
                  image_url: draft.image_url,
                  image_path: draft.image_path ?? '',
                  image_mime: draft.image_mime ?? '',
                  image_size: draft.image_size ?? 0,
                }
              : null;
          } else {
            questionDraftMap[draft.item_id] = draft.text;
            questionImagesDraftMap[draft.item_id] = draft.image_url
              ? {
                  image_url: draft.image_url,
                  image_path: draft.image_path ?? '',
                  image_mime: draft.image_mime ?? '',
                  image_size: draft.image_size ?? 0,
                }
              : null;
          }
        });
        setPromptAnswers((prev) => ({ ...promptDrafts, ...prev }));
        setQuestionAnswers((prev) => ({ ...questionDraftMap, ...prev }));
        setPromptImageDrafts((prev) => ({ ...promptImagesDraftMap, ...prev }));
        setQuestionImageDrafts((prev) => ({ ...questionImagesDraftMap, ...prev }));
      }
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

  const uploadIfPresent = async (file: File | null | undefined): Promise<UploadedImage | undefined> => {
    if (!file || !loopId) return undefined;
    return uploadAnswerImage(loopId, file);
  };

  useEffect(() => {
    return () => {
      if (draftTimer) {
        clearTimeout(draftTimer);
      }
    };
  }, [draftTimer]);

  const scheduleDraftSave = (saveAction: () => Promise<void>) => {
    if (!loopId) return;
    if (draftTimer) {
      clearTimeout(draftTimer);
    }

    setDraftState('saving');
    const timer = setTimeout(() => {
      saveAction()
        .then(() => setDraftState('saved'))
        .catch(() => setDraftState('idle'));
    }, 900);

    setDraftTimer(timer);
  };

  const handleAddQuestion = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newQuestion.trim() || !data || !loopId) return;

    setSyncing(true);
    try {
      await addQuestion(loopId, newQuestion);
      setNewQuestion('');
      await clearQuestionDraft(loopId);
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add question.';
      alert(message);
    } finally {
      setSyncing(false);
    }
  };

  const handlePromptImageChange = async (promptId: string, file: File | null) => {
    if (!file || !loopId) {
      setPromptImageDrafts((prev) => ({ ...prev, [promptId]: null }));
      scheduleDraftSave(() => saveAnswerDraft(loopId, 'prompt', promptId, promptAnswers[promptId] ?? ''));
      return;
    }

    setSyncing(true);
    try {
      const image = await uploadIfPresent(file);
      if (image) {
        setPromptImageDrafts((prev) => ({ ...prev, [promptId]: image }));
        await saveAnswerDraft(loopId, 'prompt', promptId, promptAnswers[promptId] ?? '', image);
        setDraftState('saved');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to upload image.';
      alert(message);
    } finally {
      setSyncing(false);
    }
  };

  const handleQuestionImageChange = async (questionId: string, file: File | null) => {
    if (!file || !loopId) {
      setQuestionImageDrafts((prev) => ({ ...prev, [questionId]: null }));
      scheduleDraftSave(() => saveAnswerDraft(loopId, 'question', questionId, questionAnswers[questionId] ?? ''));
      return;
    }

    setSyncing(true);
    try {
      const image = await uploadIfPresent(file);
      if (image) {
        setQuestionImageDrafts((prev) => ({ ...prev, [questionId]: image }));
        await saveAnswerDraft(loopId, 'question', questionId, questionAnswers[questionId] ?? '', image);
        setDraftState('saved');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to upload image.';
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

  return (
    <div className="container" style={{ marginTop: '4vh', maxWidth: '780px' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ color: 'var(--text-primary)' }}>{data.loop.title}</h1>
        <p>{data.loop.description}</p>
        <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
          Signed in as <strong>{viewerName}</strong>
        </p>
        {phase !== 3 ? (
          <p style={{ marginTop: '0.35rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Drafts: {draftState === 'saving' ? 'Saving...' : draftState === 'saved' ? 'Saved' : 'Not saved'}
          </p>
        ) : null}
        <div className="phase-chip">
          {phase === 1 ? 'Phase 1: Add Questions ❓' : phase === 2 ? 'Phase 2: Share Answers ✍️' : 'Phase 3: Published 🎉'}
        </div>
      </div>

      {phase === 1 ? (
        <>
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h3>❓ Questions</h3>
            <p style={{ marginBottom: '0.8rem', fontSize: '0.92rem' }}>
              Add any question you want the group to answer in phase 2.
            </p>
            <form onSubmit={handleAddQuestion}>
              <textarea
                placeholder="Ask something fun, thoughtful, or reflective..."
                value={newQuestion}
                onChange={(e) => {
                  const value = e.target.value;
                  setNewQuestion(value);
                  if (loopId) {
                    scheduleDraftSave(() => saveQuestionDraft(loopId, value));
                  }
                }}
                disabled={syncing}
                required
              />
              <div style={{ marginTop: '0.8rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn" disabled={syncing}>
                  Add Question
                </button>
              </div>
            </form>
          </div>

          {data.questions.length === 0 ? (
            <div className="empty-state">No questions yet. Be the first one ✨</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {data.questions.map((question) => (
                <div className="card" key={question.id}>
                  <p style={{ fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                    Asked by <strong>{getDisplayName(question.author_email, nicknameMap)}</strong>
                  </p>
                  <p style={{ color: 'var(--text-primary)' }}>{question.text}</p>
                </div>
              ))}
            </div>
          )}
        </>
      ) : null}

      {phase === 2 ? (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', marginBottom: '2rem' }}>
            {data.sectionPrompts.map((prompt) => (
              <div className="card" key={prompt.id}>
                <h3>{prompt.title === 'Announcements' ? '📣 Announcements' : prompt.title === 'Shout-outs' ? '🙌 Shout-outs' : '💭 Mann-ki-baat'}</h3>
                <div>
                  <textarea
                    placeholder="Write your response (optional if uploading image)..."
                    value={promptAnswers[prompt.id] ?? ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setPromptAnswers((prev) => ({ ...prev, [prompt.id]: value }));
                      if (loopId) {
                        scheduleDraftSave(() => saveAnswerDraft(loopId, 'prompt', prompt.id, value, promptImageDrafts[prompt.id] ?? undefined));
                      }
                    }}
                    disabled={syncing}
                  />
                  <div style={{ marginTop: '0.6rem' }}>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      disabled={syncing}
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        void handlePromptImageChange(prompt.id, file);
                      }}
                    />
                  </div>
                  {promptImageDrafts[prompt.id]?.image_url ? (
                    <div style={{ marginTop: '0.8rem' }}>
                      <img
                        src={promptImageDrafts[prompt.id]?.image_url ?? ''}
                        alt="Draft upload"
                        style={{ width: 'min(220px, 100%)', borderRadius: '10px', border: '1px solid var(--surface-border)' }}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          <h3 style={{ marginBottom: '0.8rem' }}>❓ Questions</h3>
          {data.questions.length === 0 ? (
            <div className="empty-state">No questions were added in phase 1.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {data.questions.map((question) => (
                <div className="card" key={question.id}>
                  <p style={{ marginBottom: '0.6rem', color: 'var(--text-primary)' }}>
                    <strong>{getDisplayName(question.author_email, nicknameMap)}</strong> asked: {question.text}
                  </p>
                  <div>
                    <textarea
                      placeholder="Write your response (optional if uploading image)..."
                      value={questionAnswers[question.id] ?? ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        setQuestionAnswers((prev) => ({ ...prev, [question.id]: value }));
                        if (loopId) {
                          scheduleDraftSave(() => saveAnswerDraft(loopId, 'question', question.id, value, questionImageDrafts[question.id] ?? undefined));
                        }
                      }}
                      disabled={syncing}
                    />
                    <div style={{ marginTop: '0.6rem' }}>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        disabled={syncing}
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null;
                          void handleQuestionImageChange(question.id, file);
                        }}
                      />
                    </div>
                    {questionImageDrafts[question.id]?.image_url ? (
                      <div style={{ marginTop: '0.8rem' }}>
                        <img
                          src={questionImageDrafts[question.id]?.image_url ?? ''}
                          alt="Draft upload"
                          style={{ width: 'min(220px, 100%)', borderRadius: '10px', border: '1px solid var(--surface-border)' }}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : null}

      {phase === 3 ? (
        <div className="empty-state">
          This loop is published 🎉 Please open the published view from the dashboard.
        </div>
      ) : null}
    </div>
  );
}
