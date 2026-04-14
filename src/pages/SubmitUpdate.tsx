import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  answerFixedPrompt,
  answerQuestion,
  buildNicknameMap,
  fetchLoopBundle,
  getDisplayName,
  getSessionEmail,
  addQuestion,
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
  const [promptImages, setPromptImages] = useState<Record<string, File | null>>({});
  const [questionImages, setQuestionImages] = useState<Record<string, File | null>>({});
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

  const uploadIfPresent = async (file: File | null | undefined): Promise<UploadedImage | undefined> => {
    if (!file || !loopId) return undefined;
    return uploadAnswerImage(loopId, file);
  };

  const handleAddQuestion = async (event: React.FormEvent) => {
    event.preventDefault();
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

  const handleSubmitPromptAnswer = async (event: React.FormEvent, promptId: string) => {
    event.preventDefault();
    if (!loopId) return;

    setSyncing(true);
    try {
      const image = await uploadIfPresent(promptImages[promptId]);
      await answerFixedPrompt(loopId, promptId, promptAnswers[promptId] ?? '', image);
      setPromptAnswers((prev) => ({ ...prev, [promptId]: '' }));
      setPromptImages((prev) => ({ ...prev, [promptId]: null }));
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to submit answer.';
      alert(message);
    } finally {
      setSyncing(false);
    }
  };

  const handleSubmitQuestionAnswer = async (event: React.FormEvent, questionId: string) => {
    event.preventDefault();
    if (!loopId) return;

    setSyncing(true);
    try {
      const image = await uploadIfPresent(questionImages[questionId]);
      await answerQuestion(loopId, questionId, questionAnswers[questionId] ?? '', image);
      setQuestionAnswers((prev) => ({ ...prev, [questionId]: '' }));
      setQuestionImages((prev) => ({ ...prev, [questionId]: null }));
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to submit answer.';
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
                onChange={(e) => setNewQuestion(e.target.value)}
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
            {data.sectionPrompts.map((prompt) => {
              const existing = data.promptAnswers.find(
                (answer) => answer.prompt_id === prompt.id && answer.author_email.toLowerCase() === viewerEmail.toLowerCase(),
              );

              return (
                <div className="card" key={prompt.id}>
                  <h3>{prompt.title === 'Announcements' ? '📣 Announcements' : prompt.title === 'Shout-outs' ? '🙌 Shout-outs' : '💭 Mann-ki-baat'}</h3>
                  {existing ? (
                    <p style={{ color: '#16a34a', marginTop: '0.6rem' }}>✓ You already responded to this section.</p>
                  ) : (
                    <form onSubmit={(event) => handleSubmitPromptAnswer(event, prompt.id)}>
                      <textarea
                        placeholder="Write your response (optional if uploading image)..."
                        value={promptAnswers[prompt.id] ?? ''}
                        onChange={(e) => setPromptAnswers((prev) => ({ ...prev, [prompt.id]: e.target.value }))}
                        disabled={syncing}
                      />
                      <div style={{ marginTop: '0.6rem' }}>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          disabled={syncing}
                          onChange={(e) => {
                            const file = e.target.files?.[0] ?? null;
                            setPromptImages((prev) => ({ ...prev, [prompt.id]: file }));
                          }}
                        />
                      </div>
                      <div style={{ marginTop: '0.8rem', display: 'flex', justifyContent: 'flex-end' }}>
                        <button className="btn" disabled={syncing}>
                          Submit
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              );
            })}
          </div>

          <h3 style={{ marginBottom: '0.8rem' }}>❓ Questions</h3>
          {data.questions.length === 0 ? (
            <div className="empty-state">No questions were added in phase 1.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {data.questions.map((question) => {
                const existing = data.questionAnswers.find(
                  (answer) => answer.question_id === question.id && answer.author_email.toLowerCase() === viewerEmail.toLowerCase(),
                );

                return (
                  <div className="card" key={question.id}>
                    <p style={{ marginBottom: '0.6rem', color: 'var(--text-primary)' }}>
                      <strong>{getDisplayName(question.author_email, nicknameMap)}</strong> asked: {question.text}
                    </p>
                    {existing ? (
                      <p style={{ color: '#16a34a' }}>✓ You already answered this question.</p>
                    ) : (
                      <form onSubmit={(event) => handleSubmitQuestionAnswer(event, question.id)}>
                        <textarea
                          placeholder="Write your response (optional if uploading image)..."
                          value={questionAnswers[question.id] ?? ''}
                          onChange={(e) => setQuestionAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))}
                          disabled={syncing}
                        />
                        <div style={{ marginTop: '0.6rem' }}>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            disabled={syncing}
                            onChange={(e) => {
                              const file = e.target.files?.[0] ?? null;
                              setQuestionImages((prev) => ({ ...prev, [question.id]: file }));
                            }}
                          />
                        </div>
                        <div style={{ marginTop: '0.8rem', display: 'flex', justifyContent: 'flex-end' }}>
                          <button className="btn" disabled={syncing}>
                            Submit
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                );
              })}
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
