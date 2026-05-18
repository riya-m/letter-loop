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
  width: '34px',
  height: '34px',
  padding: 0,
  fontSize: '0.85rem',
  background: 'transparent',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  color: '#5f5145',
  fontWeight: 600,
  transition: 'all 0.15s ease',
};

const toolbarContainerStyle: CSSProperties = {
  display: 'flex',
  gap: '0.2rem',
  marginBottom: '0.5rem',
  padding: '0.3rem',
  background: '#f8f6f2',
  borderRadius: '8px',
  border: '1px solid #e8e0d6',
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
        <button type="button" style={toolbarBtnStyle} disabled={disabled} onMouseDown={(e) => { e.preventDefault(); saveSelection(); }} onClick={() => exec('bold')} onMouseEnter={(e) => { e.currentTarget.style.background = '#e8e0d6'; e.currentTarget.style.color = '#31281f'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#5f5145'; }}>
          <strong>B</strong>
        </button>
        <button type="button" style={toolbarBtnStyle} disabled={disabled} onMouseDown={(e) => { e.preventDefault(); saveSelection(); }} onClick={() => exec('italic')} onMouseEnter={(e) => { e.currentTarget.style.background = '#e8e0d6'; e.currentTarget.style.color = '#31281f'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#5f5145'; }}>
          <em>I</em>
        </button>
        <button type="button" style={toolbarBtnStyle} disabled={disabled} onMouseDown={(e) => { e.preventDefault(); saveSelection(); }} onClick={() => exec('underline')} onMouseEnter={(e) => { e.currentTarget.style.background = '#e8e0d6'; e.currentTarget.style.color = '#31281f'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#5f5145'; }}>
          <u>U</u>
        </button>
        <div style={{ width: '1px', background: '#e8e0d6', margin: '0 0.2rem', alignSelf: 'center' }} />
        <button type="button" style={toolbarBtnStyle} disabled={disabled} onMouseDown={(e) => { e.preventDefault(); saveSelection(); }} onClick={() => exec('insertOrderedList')} onMouseEnter={(e) => { e.currentTarget.style.background = '#e8e0d6'; e.currentTarget.style.color = '#31281f'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#5f5145'; }}>
          1.
        </button>
        <button type="button" style={toolbarBtnStyle} disabled={disabled} onMouseDown={(e) => { e.preventDefault(); saveSelection(); }} onClick={() => exec('insertUnorderedList')} onMouseEnter={(e) => { e.currentTarget.style.background = '#e8e0d6'; e.currentTarget.style.color = '#31281f'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#5f5145'; }}>
          •
        </button>
        <div style={{ width: '1px', background: '#e8e0d6', margin: '0 0.2rem', alignSelf: 'center' }} />
        <button type="button" style={toolbarBtnStyle} disabled={disabled} onMouseDown={(e) => { e.preventDefault(); saveSelection(); }} onClick={handleLink} onMouseEnter={(e) => { e.currentTarget.style.background = '#e8e0d6'; e.currentTarget.style.color = '#31281f'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#5f5145'; }}>
          🔗
        </button>
        <button type="button" style={toolbarBtnStyle} disabled={disabled} onMouseDown={(e) => { e.preventDefault(); saveSelection(); }} onClick={() => exec('removeFormat')} onMouseEnter={(e) => { e.currentTarget.style.background = '#e8e0d6'; e.currentTarget.style.color = '#31281f'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#5f5145'; }}>
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
