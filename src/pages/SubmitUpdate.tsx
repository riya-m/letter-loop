import { useState, useEffect, useCallback, useRef } from 'react';
import DOMPurify from 'dompurify';
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
  const [newQuestionRich, setNewQuestionRich] = useState('');
  const [promptAnswersRich, setPromptAnswersRich] = useState<Record<string, string>>({});
  const [questionAnswersRich, setQuestionAnswersRich] = useState<Record<string, string>>({});
  const [promptImageDrafts, setPromptImageDrafts] = useState<Record<string, UploadedImage | null>>({});
  const [questionImageDrafts, setQuestionImageDrafts] = useState<Record<string, UploadedImage | null>>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [draftState, setDraftState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [draftTimer, setDraftTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const sanitizeRichText = (value: string) => {
    const withDivsConverted = value.replace(/<div[^>]*>/gi, '<p>').replace(/<\/div>/gi, '</p>');
    const sanitized = DOMPurify.sanitize(withDivsConverted, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'a', 'div'],
      ALLOWED_ATTR: ['href', 'target', 'rel'],
    });
    return sanitized.replace(/<a\s/gi, '<a target="_blank" rel="noopener noreferrer" ');
  };

  const toPlainText = (value: string) => {
    const temp = document.createElement('div');
    temp.innerHTML = value;
    return temp.textContent ?? '';
  };

  const RichTextEditor = ({
    value,
    onChange,
    placeholder,
    disabled,
  }: {
    value: string;
    onChange: (next: string) => void;
    placeholder?: string;
    disabled?: boolean;
  }) => {
    const ref = useRef<HTMLDivElement | null>(null);
    const [focused, setFocused] = useState(false);
    const selectionRef = useRef<Range | null>(null);

    useEffect(() => {
      if (!ref.current || focused) return;
      if (ref.current.innerHTML !== value) {
        ref.current.innerHTML = value;
      }
    }, [value, focused]);

    const saveSelection = () => {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        selectionRef.current = sel.getRangeAt(0).cloneRange();
      }
    };

    const restoreSelection = () => {
      if (selectionRef.current) {
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(selectionRef.current);
      }
    };

    const exec = (command: string, commandValue?: string) => {
      if (disabled) return;
      restoreSelection();
      document.execCommand(command, false, commandValue);
      const html = ref.current?.innerHTML ?? '';
      onChange(html === '<p><br></p>' ? '' : html);
    };

    const handleLink = () => {
      if (disabled) return;
      const url = window.prompt('Enter link');
      if (!url) return;
      const normalized = url.startsWith('http') ? url : `https://${url}`;
      exec('createLink', normalized);
    };

    const toolbarBtnStyle: React.CSSProperties = {
      padding: '0.3rem 0.6rem',
      fontSize: '0.85rem',
      background: '#fff',
      border: '1px solid var(--surface-border)',
      borderRadius: '6px',
      cursor: 'pointer',
      color: 'var(--text-primary)',
      fontWeight: 500,
    };

    return (
      <div>
        <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.5rem', flexWrap: 'wrap', padding: '0.4rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--surface-border)' }}>
          <button type="button" style={toolbarBtnStyle} disabled={disabled} onMouseDown={(e) => { e.preventDefault(); saveSelection(); }} onClick={() => exec('bold')}>
            <strong>B</strong>
          </button>
          <button type="button" style={toolbarBtnStyle} disabled={disabled} onMouseDown={(e) => { e.preventDefault(); saveSelection(); }} onClick={() => exec('italic')}>
            <em>I</em>
          </button>
          <button type="button" style={toolbarBtnStyle} disabled={disabled} onMouseDown={(e) => { e.preventDefault(); saveSelection(); }} onClick={() => exec('underline')}>
            <u>U</u>
          </button>
          <button type="button" style={toolbarBtnStyle} disabled={disabled} onMouseDown={(e) => { e.preventDefault(); saveSelection(); }} onClick={() => exec('insertOrderedList')}>
            1.
          </button>
          <button type="button" style={toolbarBtnStyle} disabled={disabled} onMouseDown={(e) => { e.preventDefault(); saveSelection(); }} onClick={() => exec('insertUnorderedList')}>
            •
          </button>
          <button type="button" style={toolbarBtnStyle} disabled={disabled} onMouseDown={(e) => { e.preventDefault(); saveSelection(); }} onClick={handleLink}>
            🔗
          </button>
          <button type="button" style={toolbarBtnStyle} disabled={disabled} onMouseDown={(e) => { e.preventDefault(); saveSelection(); }} onClick={() => exec('removeFormat')}>
            ✕
          </button>
        </div>
        <div
          ref={ref}
          className="rich-editor"
          contentEditable={!disabled}
          onInput={() => {
            const html = ref.current?.innerHTML ?? '';
            onChange(html === '<p><br></p>' ? '' : html);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          data-placeholder={placeholder}
          suppressContentEditableWarning
          style={{ minHeight: '140px' }}
        />
      </div>
    );
  };

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
      if (questionDraft?.text || questionDraft?.rich_text) {
        const draftValue = questionDraft.rich_text ?? questionDraft.text;
        const plain = toPlainText(draftValue);
        setNewQuestion(plain);
        setNewQuestionRich(sanitizeRichText(draftValue));
      }
      if (answerDrafts.length > 0) {
        const promptDrafts: Record<string, string> = {};
        const questionDraftMap: Record<string, string> = {};
        const promptDraftsRich: Record<string, string> = {};
        const questionDraftsRich: Record<string, string> = {};
        const promptImagesDraftMap: Record<string, UploadedImage | null> = {};
        const questionImagesDraftMap: Record<string, UploadedImage | null> = {};
        answerDrafts.forEach((draft) => {
          if (draft.item_type === 'prompt') {
            const value = draft.rich_text ?? draft.text;
            const plain = toPlainText(value);
            promptDrafts[draft.item_id] = plain;
            promptDraftsRich[draft.item_id] = sanitizeRichText(value);
            promptImagesDraftMap[draft.item_id] = draft.image_url
              ? {
                  image_url: draft.image_url,
                  image_path: draft.image_path ?? '',
                  image_mime: draft.image_mime ?? '',
                  image_size: draft.image_size ?? 0,
                }
              : null;
          } else {
            const value = draft.rich_text ?? draft.text;
            const plain = toPlainText(value);
            questionDraftMap[draft.item_id] = plain;
            questionDraftsRich[draft.item_id] = sanitizeRichText(value);
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
        setPromptAnswersRich((prev) => ({ ...promptDraftsRich, ...prev }));
        setQuestionAnswersRich((prev) => ({ ...questionDraftsRich, ...prev }));
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
      const sanitized = sanitizeRichText(newQuestionRich);
      const plain = toPlainText(sanitized);
      await addQuestion(loopId, plain, sanitized);
      setNewQuestion('');
      setNewQuestionRich('');
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
      if (loopId) {
        const richValue = promptAnswersRich[promptId] ?? '';
        const sanitized = sanitizeRichText(richValue);
        const plain = toPlainText(sanitized);
        scheduleDraftSave(() => saveAnswerDraft(loopId, 'prompt', promptId, plain, undefined, sanitized));
      }
      return;
    }

    setSyncing(true);
    try {
      const image = await uploadIfPresent(file);
      if (image) {
        setPromptImageDrafts((prev) => ({ ...prev, [promptId]: image }));
        const richValue = promptAnswersRich[promptId] ?? '';
        const sanitized = sanitizeRichText(richValue);
        const plain = toPlainText(sanitized);
        await saveAnswerDraft(loopId, 'prompt', promptId, plain, image, sanitized);
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
      if (loopId) {
        const richValue = questionAnswersRich[questionId] ?? '';
        const sanitized = sanitizeRichText(richValue);
        const plain = toPlainText(sanitized);
        scheduleDraftSave(() => saveAnswerDraft(loopId, 'question', questionId, plain, undefined, sanitized));
      }
      return;
    }

    setSyncing(true);
    try {
      const image = await uploadIfPresent(file);
      if (image) {
        setQuestionImageDrafts((prev) => ({ ...prev, [questionId]: image }));
        const richValue = questionAnswersRich[questionId] ?? '';
        const sanitized = sanitizeRichText(richValue);
        const plain = toPlainText(sanitized);
        await saveAnswerDraft(loopId, 'question', questionId, plain, image, sanitized);
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
              <RichTextEditor
                value={newQuestionRich}
                onChange={(value) => {
                  const sanitized = sanitizeRichText(value);
                  const plain = toPlainText(sanitized);
                  setNewQuestionRich(sanitized);
                  setNewQuestion(plain);
                  if (loopId) {
                    scheduleDraftSave(() => saveQuestionDraft(loopId, plain, sanitized));
                  }
                }}
                placeholder="Ask something fun, thoughtful, or reflective..."
                disabled={syncing}
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
                  {question.rich_text ? (
                    <div
                      style={{ color: 'var(--text-primary)' }}
                      dangerouslySetInnerHTML={{ __html: sanitizeRichText(question.rich_text) }}
                    />
                  ) : (
                    <p style={{ color: 'var(--text-primary)', whiteSpace: 'pre-line' }}>{question.text}</p>
                  )}
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
                  <RichTextEditor
                    value={promptAnswersRich[prompt.id] ?? ''}
                    onChange={(value) => {
                      const sanitized = sanitizeRichText(value);
                      const plain = toPlainText(sanitized);
                      setPromptAnswersRich((prev) => ({ ...prev, [prompt.id]: sanitized }));
                      if (loopId) {
                        scheduleDraftSave(() => saveAnswerDraft(loopId, 'prompt', prompt.id, plain, promptImageDrafts[prompt.id] ?? undefined, sanitized));
                      }
                    }}
                    placeholder="Write your response (optional if uploading image)..."
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
                      <strong>{getDisplayName(question.author_email, nicknameMap)}</strong> asked:{' '}
                      {question.rich_text ? (
                        <span dangerouslySetInnerHTML={{ __html: sanitizeRichText(question.rich_text) }} />
                      ) : (
                        <span>{question.text}</span>
                      )}
                  </p>
                  <div>
                    <RichTextEditor
                      value={questionAnswersRich[question.id] ?? ''}
                      onChange={(value) => {
                        const sanitized = sanitizeRichText(value);
                        const plain = toPlainText(sanitized);
                        setQuestionAnswersRich((prev) => ({ ...prev, [question.id]: sanitized }));
                        if (loopId) {
                          scheduleDraftSave(() => saveAnswerDraft(loopId, 'question', question.id, plain, questionImageDrafts[question.id] ?? undefined, sanitized));
                        }
                      }}
                      placeholder="Write your response (optional if uploading image)..."
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
