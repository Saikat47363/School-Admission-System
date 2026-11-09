import { useState } from 'react';
import ClassList from './screens/ClassList.jsx';
import CreateClass from './screens/CreateClass.jsx';
import MyApplications from './screens/MyApplications.jsx';
import Application from './screens/Application.jsx';

const STORAGE_KEY = 'studentId';

function loadStudentId() {
  try {
    return localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export default function App() {
  const [rawId, setRawId] = useState(loadStudentId);
  const [view, setView] = useState('classes'); // classes | my | create | hold
  const [holdId, setHoldId] = useState(null);

  const valid = /^\d{17}$/.test(rawId);
  const studentId = valid ? rawId : '';

  function onIdChange(e) {
    const v = e.target.value.replace(/\D/g, '').slice(0, 17);
    setRawId(v);
    try {
      localStorage.setItem(STORAGE_KEY, v);
    } catch {
      /* storage unavailable: the id just won't survive a refresh */
    }
  }

  function openHold(id) {
    setHoldId(id);
    setView('hold');
  }

  const tabs = [
    ['classes', 'Class তালিকা'],
    ['my', 'আমার আবেদন'],
    ['create', 'Class তৈরি (Admin)'],
  ];

  return (
    <div className="app">
      <header className="top">
        <h1>School Admission System</h1>
        <div className="student">
          <label htmlFor="student-id">শিক্ষার্থীর জন্ম নিবন্ধন নম্বর (১৭ অঙ্ক)</label>
          <input
            id="student-id"
            inputMode="numeric"
            autoComplete="off"
            placeholder="যেমন 20152691234567890"
            value={rawId}
            onChange={onIdChange}
            data-testid="student-id"
          />
          {rawId && !valid && (
            <small className="hint-error">
              {rawId.length}/১৭ অঙ্ক। ঠিক ১৭ অঙ্ক দিলে তবেই আবেদন করা যাবে।
            </small>
          )}
          {valid && <small className="hint-ok">নম্বর ঠিক আছে।</small>}
        </div>
      </header>

      <nav className="tabs">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            className={view === key || (view === 'hold' && key === 'my') ? 'tab active' : 'tab'}
            onClick={() => setView(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      <main>
        {view === 'classes' && <ClassList studentId={studentId} onOpenHold={openHold} />}
        {view === 'my' && <MyApplications studentId={studentId} onOpenHold={openHold} />}
        {view === 'create' && <CreateClass />}
        {view === 'hold' && (
          <Application
            holdId={holdId}
            studentId={studentId}
            onBack={() => setView('my')}
          />
        )}
      </main>
    </div>
  );
}
