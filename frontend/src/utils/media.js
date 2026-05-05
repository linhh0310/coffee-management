const API_BASE = String(process.env.REACT_APP_API_URL || '').replace(/\/$/, '');

export function resolveMediaUrl(value) {
  const url = String(value || '').trim();
  if (!url) return '';

  if (/^https?:\/\//i.test(url) || /^data:image\//i.test(url)) {
    return url;
  }

  if (url.startsWith('/')) {
    return API_BASE ? `${API_BASE}${url}` : url;
  }

  if (/^(uploads|images|assets)\//i.test(url)) {
    const normalized = `/${url}`;
    return API_BASE ? `${API_BASE}${normalized}` : normalized;
  }

  return API_BASE ? `${API_BASE}/uploads/${url}` : `/uploads/${url}`;
}