import { useState } from 'react';
import { api } from '../api.js';
import { Banner } from '../ui.jsx';

export default function CreateClass() {
  const [name, setName] = useState('');
  const [seats, setSeats] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setMsg(null);
    const n = name.trim();
    const total = Number(seats);
    if (!n) return setMsg({ type: 'error', text: 'Class-এর নাম লিখুন।' });
    if (!Number.isInteger(total) || total < 1 || total > 100000)
      return setMsg({ type: 'error', text: 'Seat সংখ্যা ১ থেকে ১০০০০০ এর মধ্যে একটি পূর্ণ সংখ্যা হতে হবে।' });

    setBusy(true);
    try {
      const c = await api.createClass(n, total);
      setMsg({ type: 'ok', text: `"${c.name}" তৈরি হয়েছে (${c.totalSeats} seat)।` });
      setName('');
      setSeats('');
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h2>নতুন Class তৈরি</h2>
      <p className="muted">প্রতিটা shift আলাদা class। যেমন "Class 6 - Morning Shift" আর "Class 6 - Day Shift"।</p>
      <form onSubmit={submit} className="form">
        <label htmlFor="class-name">Class-এর নাম</label>
        <input id="class-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Class 6 - Morning Shift" />
        <label htmlFor="class-seats">মোট Seat</label>
        <input id="class-seats" inputMode="numeric" value={seats} onChange={(e) => setSeats(e.target.value)} placeholder="120" />
        <button className="btn primary" disabled={busy}>{busy ? 'তৈরি হচ্ছে…' : 'Class তৈরি করুন'}</button>
      </form>
      <Banner type={msg?.type}>{msg?.text}</Banner>
    </section>
  );
}
