import { useState, useEffect, useRef, type CSSProperties } from 'react';
import { normalizeLineBreaks } from '../lib/richText';

interface RichTextEditorProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

const toolbarBtnStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '36px',
  height: '36px',
  padding: '0 0.6rem',
  fontSize: '0.9rem',
  background: '#ffffff',
  border: '2px solid #d97706',
  borderRadius: '8px',
  cursor: 'pointer',
  color: '#31281f',
  fontWeight: 700,
  transition: 'all 0.15s ease',
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
};

const toolbarContainerStyle: CSSProperties = {
  display: 'flex',
  gap: '0.4rem',
  marginBottom: '0.6rem',
  flexWrap: 'wrap',
  padding: '0.6rem',
  background: '#fffbeb',
  borderRadius: '10px',
  border: '2px solid #d97706',
  boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
};

export default function RichTextEditor({
  value,
  onChange,
  placeholder,
  disabled,
}: RichTextEditorProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [focused, setFocused] = useState(false);
  const selectionRef = useRef<Range | null>(null);
  const isInternalChange = useRef(false);

  useEffect(() => {
    if (!ref.current || focused || isInternalChange.current) return;
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
    const normalized = normalizeLineBreaks(html);
    onChange(normalized === '<p><br></p>' ? '' : normalized);
  };

  const handleLink = () => {
    if (disabled) return;
    const url = window.prompt('Enter link');
    if (!url) return;
    const normalized = url.startsWith('http') ? url : `https://${url}`;
    exec('createLink', normalized);
  };

  return (
    <div>
      <div style={toolbarContainerStyle}>
        <button type="button" style={toolbarBtnStyle} disabled={disabled} onMouseDown={(e) => { e.preventDefault(); saveSelection(); }} onClick={() => exec('bold')} onMouseEnter={(e) => { e.currentTarget.style.background = '#d97706'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.color = '#31281f'; }}>
          <strong>B</strong>
        </button>
        <button type="button" style={toolbarBtnStyle} disabled={disabled} onMouseDown={(e) => { e.preventDefault(); saveSelection(); }} onClick={() => exec('italic')} onMouseEnter={(e) => { e.currentTarget.style.background = '#d97706'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.color = '#31281f'; }}>
          <em>I</em>
        </button>
        <button type="button" style={toolbarBtnStyle} disabled={disabled} onMouseDown={(e) => { e.preventDefault(); saveSelection(); }} onClick={() => exec('underline')} onMouseEnter={(e) => { e.currentTarget.style.background = '#d97706'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.color = '#31281f'; }}>
          <u>U</u>
        </button>
        <button type="button" style={toolbarBtnStyle} disabled={disabled} onMouseDown={(e) => { e.preventDefault(); saveSelection(); }} onClick={() => exec('insertOrderedList')} onMouseEnter={(e) => { e.currentTarget.style.background = '#d97706'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.color = '#31281f'; }}>
          1.
        </button>
        <button type="button" style={toolbarBtnStyle} disabled={disabled} onMouseDown={(e) => { e.preventDefault(); saveSelection(); }} onClick={() => exec('insertUnorderedList')} onMouseEnter={(e) => { e.currentTarget.style.background = '#d97706'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.color = '#31281f'; }}>
          •
        </button>
        <button type="button" style={toolbarBtnStyle} disabled={disabled} onMouseDown={(e) => { e.preventDefault(); saveSelection(); }} onClick={handleLink} onMouseEnter={(e) => { e.currentTarget.style.background = '#d97706'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.color = '#31281f'; }}>
          🔗
        </button>
        <button type="button" style={toolbarBtnStyle} disabled={disabled} onMouseDown={(e) => { e.preventDefault(); saveSelection(); }} onClick={() => exec('removeFormat')} onMouseEnter={(e) => { e.currentTarget.style.background = '#d97706'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.color = '#31281f'; }}>
          ✕
        </button>
      </div>
      <div
        ref={ref}
        className="rich-editor"
        contentEditable={!disabled}
        onInput={() => {
          isInternalChange.current = true;
          const html = ref.current?.innerHTML ?? '';
          const normalized = normalizeLineBreaks(html);
          onChange(normalized === '<p><br></p>' ? '' : normalized);
          setTimeout(() => {
            isInternalChange.current = false;
          }, 0);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        data-placeholder={placeholder}
        suppressContentEditableWarning
        style={{ minHeight: '140px' }}
      />
    </div>
  );
}
