import { useState, useEffect, type CSSProperties } from 'react';
import DOMPurify from 'dompurify';

const sanitizeRichText = (value: string) => {
  const withDivsConverted = value.replace(/<div[^>]*>/gi, '<p>').replace(/<\/div>/gi, '</p>');
  const sanitized = DOMPurify.sanitize(withDivsConverted, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'a', 'div'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  });
  return sanitized.replace(/<a\s/gi, '<a target="_blank" rel="noopener noreferrer" ');
};
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Share2 } from 'lucide-react';
import { buildNicknameMap, fetchLoopBundle, getDisplayName } from '../lib/store';
import type { LoopBundle } from '../lib/store';

const cardImageStyles: CSSProperties = {
  width: 'min(380px, 100%)',
  height: 'auto',
  borderRadius: '12px',
  border: '1px solid var(--surface-border)',
};

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

  const renderAnswerCard = (
    id: string,
    authorEmail: string,
    text: string,
    richText: string | null,
    imageUrl: string | null,
  ) => {
    const displayName = getDisplayName(authorEmail, nicknameMap);
    return (
      <div
        key={id}
        style={{
          background: '#ffffff',
          border: '1px solid var(--surface-border)',
          borderRadius: '14px',
          padding: '1rem',
        }}
      >
        <p style={{ fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>{displayName}</p>
        {richText ? (
          <div
            style={{ marginBottom: imageUrl ? '0.8rem' : 0 }}
            dangerouslySetInnerHTML={{ __html: sanitizeRichText(richText) }}
          />
        ) : text ? (
          <p style={{ marginBottom: imageUrl ? '0.8rem' : 0, whiteSpace: 'pre-line' }}>{text}</p>
        ) : null}
        {imageUrl ? <img src={imageUrl} alt={`${displayName} response`} style={cardImageStyles} /> : null}
      </div>
    );
  };

  return (
    <div className="container" style={{ maxWidth: '860px' }}>
      <div style={{ marginBottom: '2rem' }}>
        <Link
          to="/"
          style={{
            color: 'var(--text-secondary)',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '1.5rem',
            fontSize: '0.9rem',
          }}
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em', fontSize: '2.6rem', marginBottom: '0.5rem' }}>
              {data.loop.title}
            </h1>
            <p style={{ color: 'var(--primary-color)', fontWeight: 600 }}>
              Issue #{issueNumber} • {data.loop.published_at ? new Date(data.loop.published_at).toLocaleDateString() : 'Unpublished'}
            </p>
          </div>
          <button onClick={handleShare} className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }} title="Copy Link">
            <Share2 size={16} /> Share
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
        {data.sectionPrompts.map((prompt) => {
          const sectionAnswers = data.promptAnswers.filter((answer) => answer.prompt_id === prompt.id);
          const title =
            prompt.key === 'announcements'
              ? '📣 Announcements'
              : prompt.key === 'shoutouts'
                ? '🙌 Shout-outs'
                : '💭 Mann-ki-baat';

          return (
            <div className="card" key={prompt.id}>
              <h3>{title}</h3>
              {sectionAnswers.length === 0 ? (
                <p>No responses yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                    {sectionAnswers.map((answer) =>
                      renderAnswerCard(answer.id, answer.author_email, answer.text, answer.rich_text, answer.image_url),
                    )}
                </div>
              )}
            </div>
          );
        })}

        <div className="card">
          <h3>❓ Questions</h3>
          {data.questions.length === 0 ? (
            <p>No questions were added this round.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {data.questions.map((question) => {
                const questionAnswers = data.questionAnswers.filter((answer) => answer.question_id === question.id);
                return (
                  <div key={question.id} style={{ borderTop: '1px solid var(--surface-border)', paddingTop: '1rem' }}>
                  {question.rich_text ? (
                    <div
                      style={{ fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}
                      dangerouslySetInnerHTML={{ __html: sanitizeRichText(question.rich_text) }}
                    />
                  ) : (
                    <p style={{ fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)', whiteSpace: 'pre-line' }}>
                      {question.text}
                    </p>
                  )}
                    <p style={{ fontSize: '0.85rem', marginBottom: '0.7rem' }}>
                      Asked by {getDisplayName(question.author_email, nicknameMap)}
                    </p>
                    {questionAnswers.length === 0 ? (
                      <p>No one answered this question.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                      {questionAnswers.map((answer) =>
                        renderAnswerCard(answer.id, answer.author_email, answer.text, answer.rich_text, answer.image_url),
                      )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div style={{ textAlign: 'center', margin: '3rem 0 1rem', paddingTop: '1.2rem', borderTop: '1px solid var(--surface-border)' }}>
        <p>
          Made with 💌 for <strong>FloorX</strong>
        </p>
      </div>
    </div>
  );
}
