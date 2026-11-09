const BASE =
  (window.__CONFIG__ && window.__CONFIG__.API_URL) ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:8080';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// Server messages (English) -> readable Bangla messages.
const MESSAGES = [
  ['No seats', 'দুঃখিত, এই class-এ আর কোনো seat খালি নেই।'],
  ['already has a confirmed', 'এই শিক্ষার্থীর এই class-এ ইতিমধ্যে ভর্তি নিশ্চিত হয়ে আছে।'],
  ['already has an active', 'এই শিক্ষার্থীর এই class-এ ইতিমধ্যে একটি চলমান আবেদন আছে।'],
  ['has expired', 'আবেদনের মেয়াদ শেষ হয়ে গেছে। আবার আবেদন করুন।'],
  ['was cancelled', 'এই আবেদন বাতিল করা হয়েছে।'],
  ['different student', 'এই আবেদনটি অন্য একজন শিক্ষার্থীর।'],
  ['Application not found', 'আবেদনটি খুঁজে পাওয়া যায়নি।'],
  ['Class not found', 'Class খুঁজে পাওয়া যায়নি।'],
  ['confirmed admission cannot', 'নিশ্চিত হয়ে যাওয়া ভর্তি বাতিল করা যায় না।'],
  ['17-digit', 'জন্ম নিবন্ধন নম্বর ঠিক ১৭ অঙ্কের হতে হবে।'],
  ['Class name is required', 'Class-এর নাম লিখুন।'],
  ['too long', 'Class-এর নাম অনেক বড় হয়ে গেছে।'],
  ['totalSeats', 'Seat সংখ্যা ১ থেকে ১০০০০০ এর মধ্যে একটি পূর্ণ সংখ্যা হতে হবে।'],
];

function translate(serverMessage, status) {
  if (status >= 500) return 'সার্ভারে একটি সমস্যা হয়েছে। একটু পরে আবার চেষ্টা করুন।';
  const hit = MESSAGES.find(([key]) => serverMessage && serverMessage.includes(key));
  return hit ? hit[1] : 'কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।';
}

async function request(method, path, { studentId, body } = {}) {
  const headers = {};
  if (studentId) headers['X-Student-Id'] = studentId;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(
      'সার্ভারের সাথে যোগাযোগ করা যাচ্ছে না। ইন্টারনেট সংযোগ দেখুন, অথবা একটু পরে আবার চেষ্টা করুন।',
      0,
    );
  }

  if (res.status === 204) return null;
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* response was not JSON */
  }
  if (!res.ok) throw new ApiError(translate(data && data.error, res.status), res.status);
  return data;
}

export const api = {
  createClass: (name, totalSeats) => request('POST', '/classes', { body: { name, totalSeats } }),
  listClasses: () => request('GET', '/classes'),
  getClass: (id) => request('GET', `/classes/${id}`),
  apply: (classId, studentId) => request('POST', `/classes/${classId}/holds`, { studentId }),
  getHold: (id) => request('GET', `/holds/${id}`),
  confirm: (id, studentId) => request('POST', `/holds/${id}/confirm`, { studentId }),
  cancel: (id, studentId) => request('DELETE', `/holds/${id}`, { studentId }),
  myHolds: (studentId) => request('GET', '/me/holds', { studentId }),
};
