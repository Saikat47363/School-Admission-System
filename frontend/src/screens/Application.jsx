import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { secondsLeft, useNow, usePolling } from '../hooks.js';
import { Banner, StatusBadge, formatTime } from '../ui.jsx';

export default function Application({ holdId, studentId, onBack }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const now = useNow(1000);

  const { data, error, loading, reload } = usePolling(
    async () => {
      const h = await api.getHold(holdId);
      const c = await api.getClass(h.classId);
      return { h, c };
    },
    2000,
    [holdId],
  );

  const hold = data && data.h;
  const remaining = hold ? secondsLeft(hold.expiresAt, now) : 0;
  // The moment the countdown hits zero the screen switches to EXPIRED by itself.
  const status = hold && hold.status === 'HELD' && remaining <= 0 ? 'EXPIRED' : hold && hold.status;
  const expiredLocally = hold && hold.status === 'HELD' && remaining <= 0;

  // Ask the server right away when the countdown ends, instead of waiting for the next poll.
  useEffect(() => {
    if (expiredLocally) reload();
  }, [expiredLocally, reload]);

  const notMine = hold && studentId && hold.studentId !== studentId;
  const canAct = status === 'HELD' && !!studentId && !notMine && !busy;

  async function run(action, successText) {
    setBusy(true);
    setMsg(null);
    try {
      await action();
      if (successText) setMsg({ type: 'ok', text: successText });
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setBusy(false);
      reload();
    }
  }

  const pay = () => run(() => api.confirm(holdId, studentId), 'ভর্তি ফি জমা হয়েছে। ভর্তি নিশ্চিত!');
  const cancel = () => {
    if (!window.confirm('আবেদনটি বাতিল করতে চান?')) return;
    run(() => api.cancel(holdId, studentId), 'আবেদন বাতিল করা হয়েছে।');
  };

  return (
    <section>
      <button className="btn link" onClick={onBack}>← আমার আবেদনে ফিরুন</button>
      <h2>আবেদনের অবস্থা</h2>

      <Banner>{error && `${error} (আবার চেষ্টা করা হচ্ছে…)`}</Banner>
      {loading && !data && <p className="muted">লোড হচ্ছে…</p>}

      {hold && (
        <div className="card">
          <p className="class-name">{data.c.name}</p>
          <p><StatusBadge status={status} /></p>

          {status === 'HELD' && (
            <p className="countdown" data-testid="countdown">
              বাকি সময়: <strong>{formatTime(remaining)}</strong>
              <span className="muted"> — এর মধ্যে ভর্তি ফি না দিলে seat অন্যদের জন্য খুলে যাবে।</span>
            </p>
          )}
          {status === 'CONFIRMED' && <p>আপনার ভর্তি নিশ্চিত হয়েছে।</p>}
          {status === 'EXPIRED' && <p>মেয়াদ শেষ হয়ে গেছে, seat ছেড়ে দেওয়া হয়েছে। চাইলে Class তালিকা থেকে আবার আবেদন করতে পারেন।</p>}
          {status === 'CANCELLED' && <p>এই আবেদন বাতিল করা হয়েছে।</p>}
          {notMine && <Banner type="info">এই আবেদনটি অন্য শিক্ষার্থীর, তাই এখান থেকে কিছু করা যাবে না।</Banner>}
          {!studentId && <Banner type="info">কাজ করতে উপরের ঘরে ১৭ অঙ্কের জন্ম নিবন্ধন নম্বর দিন।</Banner>}

          <div className="actions">
            <button className="btn primary" disabled={!canAct} onClick={pay}>ভর্তি ফি দিন</button>
            <button className="btn danger" disabled={!canAct} onClick={cancel}>বাতিল</button>
          </div>
        </div>
      )}
      <Banner type={msg?.type}>{msg?.text}</Banner>
    </section>
  );
}
