import DOMPurify from 'dompurify';

export const sanitizeRichText = (value: string) => {
  const withDivsConverted = value.replace(/<div[^>]*>/gi, '<p>').replace(/<\/div>/gi, '</p>');
  const sanitized = DOMPurify.sanitize(withDivsConverted, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'a'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  });
  return sanitized.replace(/<a\s/gi, '<a target="_blank" rel="noopener noreferrer" ');
};

export const toPlainText = (value: string) => {
  const temp = document.createElement('div');
  temp.innerHTML = value;
  return temp.textContent ?? '';
};

export const normalizeLineBreaks = (html: string) => {
  return html.replace(/<div[^>]*>/gi, '<p>').replace(/<\/div>/gi, '</p>');
};
