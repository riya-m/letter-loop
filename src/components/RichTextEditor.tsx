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
  minWidth: '32px',
  height: '32px',
  padding: '0 0.5rem',
  fontSize: '0.85rem',
  background: '#fff',
  border: '1px solid var(--surface-border)',
  borderRadius: '6px',
  cursor: 'pointer',
  color: 'var(--text-primary)',
  fontWeight: 600,
  transition: 'all 0.15s ease',
};

const toolbarContainerStyle: CSSProperties = {
  display: 'flex',
  gap: '0.3rem',
  marginBottom: '0.5rem',
  flexWrap: 'wrap',
  padding: '0.5rem',
  background: '#f8fafc',
  borderRadius: '8px',
  border: '1px solid var(--surface-border)',
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
