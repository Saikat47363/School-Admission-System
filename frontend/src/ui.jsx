const STATUS = {
  HELD: 'HELD – Seat ধরা আছে',
  CONFIRMED: 'CONFIRMED – ভর্তি নিশ্চিত',
  EXPIRED: 'EXPIRED – মেয়াদ শেষ',
  CANCELLED: 'CANCELLED – বাতিল',
};

export function StatusBadge({ status }) {
  return (
    <span className={`badge badge-${status}`} data-testid="status">
      {STATUS[status] || status}
    </span>
  );
}

export function Banner({ type = 'error', children }) {
  if (!children) return null;
  return (
    <div className={`banner banner-${type}`} role={type === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

export function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
