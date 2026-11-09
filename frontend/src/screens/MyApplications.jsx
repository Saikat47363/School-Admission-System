import { api } from '../api.js';
import { secondsLeft, useNow, usePolling } from '../hooks.js';
import { Banner, StatusBadge, formatTime } from '../ui.jsx';

export default function MyApplications({ studentId, onOpenHold }) {
  const now = useNow(1000);
  const { data, error, loading } = usePolling(
    () => (studentId ? api.myHolds(studentId) : Promise.resolve([])),
    3000,
    [studentId],
  );

  return (
    <section>
      <h2>আমার আবেদন</h2>
      {!studentId && <Banner type="info">আপনার আবেদন দেখতে উপরের ঘরে ১৭ অঙ্কের জন্ম নিবন্ধন নম্বর দিন।</Banner>}
      <Banner>{error && `${error} (আবার চেষ্টা করা হচ্ছে…)`}</Banner>
      {studentId && loading && !data && <p className="muted">লোড হচ্ছে…</p>}
      {studentId && data && data.length === 0 && <p className="muted">এই নম্বরে এখনো কোনো আবেদন নেই।</p>}

      {studentId && data && data.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Class</th><th>অবস্থা</th><th>বাকি সময়</th><th></th></tr>
            </thead>
            <tbody>
              {data.map((h) => {
                const left = secondsLeft(h.expiresAt, now);
                const status = h.status === 'HELD' && left <= 0 ? 'EXPIRED' : h.status;
                return (
                  <tr key={h.holdId}>
                    <td>{h.className}</td>
                    <td><StatusBadge status={status} /></td>
                    <td>{status === 'HELD' ? formatTime(left) : '—'}</td>
                    <td><button className="btn" onClick={() => onOpenHold(h.holdId)}>দেখুন</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
