import { useState } from 'react';
import { api } from '../api.js';
import { usePolling } from '../hooks.js';
import { Banner } from '../ui.jsx';

export default function ClassList({ studentId, onOpenHold }) {
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);

  // Seat numbers refresh every 3 seconds without a page reload.
  const { data, error, loading, reload } = usePolling(
    async () => {
      const [classes, mine] = await Promise.all([
        api.listClasses(),
        studentId ? api.myHolds(studentId) : Promise.resolve([]),
      ]);
      return { classes, mine };
    },
    3000,
    [studentId],
  );

  async function apply(c) {
    setBusy(c.id);
    setMsg(null);
    try {
      const hold = await api.apply(c.id, studentId);
      onOpenHold(hold.holdId);
    } catch (e) {
      setMsg(e.message);
      reload();
    } finally {
      setBusy(null);
    }
  }

  return (
    <section>
      <h2>Class তালিকা</h2>
      {!studentId && <Banner type="info">আবেদন করতে আগে উপরের ঘরে ১৭ অঙ্কের জন্ম নিবন্ধন নম্বর দিন।</Banner>}
      <Banner>{msg}</Banner>
      <Banner>{error && `${error} (আবার চেষ্টা করা হচ্ছে…)`}</Banner>

      {loading && !data && <p className="muted">লোড হচ্ছে…</p>}
      {data && data.classes.length === 0 && <p className="muted">এখনো কোনো class তৈরি হয়নি। "Class তৈরি" ট্যাব থেকে একটি তৈরি করুন।</p>}

      {data && data.classes.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Class</th>
                <th>মোট</th>
                <th>Hold-এ আছে</th>
                <th>নিশ্চিত</th>
                <th>খালি</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.classes.map((c) => {
                const mine = data.mine.find(
                  (h) => h.classId === c.id && (h.status === 'HELD' || h.status === 'CONFIRMED'),
                );
                return (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.totalSeats}</td>
                    <td>{c.heldSeats}</td>
                    <td>{c.confirmedSeats}</td>
                    <td><strong>{c.availableSeats}</strong></td>
                    <td>
                      {mine ? (
                        <button className="btn" onClick={() => onOpenHold(mine.holdId)}>আপনার আবেদন দেখুন</button>
                      ) : (
                        <button
                          className="btn primary"
                          disabled={!studentId || c.availableSeats === 0 || busy === c.id}
                          onClick={() => apply(c)}
                        >
                          {busy === c.id ? 'অপেক্ষা করুন…' : c.availableSeats === 0 ? 'Seat নেই' : 'আবেদন করুন'}
                        </button>
                      )}
                    </td>
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
