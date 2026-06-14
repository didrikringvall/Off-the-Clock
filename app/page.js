'use client';

import { useEffect, useState } from 'react';
import { formatWeekRange, getWeekId } from '../lib/helpers';

const NAME_KEY = 'otc-name';

export default function Home() {
  const [group, setGroup] = useState(null);
  const [myName, setMyName] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('main');
  const [uploading, setUploading] = useState(false);
  const [activeImage, setActiveImage] = useState(null);
  const [limitInput, setLimitInput] = useState('');
  const [penaltyInput, setPenaltyInput] = useState('');

  useEffect(() => {
    const stored = window.localStorage.getItem(NAME_KEY);
    if (stored) setMyName(stored);
    fetchGroup();
  }, []);

  async function fetchGroup() {
    try {
      const res = await fetch('/api/group');
      const data = await res.json();
      setGroup(data);
      setLimitInput(String(data.limit_hours));
      setPenaltyInput(data.penalty_text);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function patchGroup(update) {
    const res = await fetch('/api/group', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    });
    const data = await res.json();
    setGroup(data);
    return data;
  }

  function handleNameSubmit(e) {
    e.preventDefault();
    const val = nameInput.trim();
    if (!val) return;
    window.localStorage.setItem(NAME_KEY, val);
    setMyName(val);
    ensureMember(val);
  }

  async function ensureMember(name) {
    const res = await fetch('/api/group');
    const current = await res.json();
    if (!current.members[name]) {
      const updatedMembers = { ...current.members, [name]: { submissions: {} } };
      await patchGroup({ members: updatedMembers });
    } else {
      setGroup(current);
    }
  }

  async function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file || !group) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', myName);
      formData.append('week', group.current_week);

      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
      const uploadData = await uploadRes.json();
      if (uploadData.error) throw new Error(uploadData.error);

      const freshRes = await fetch('/api/group');
      const fresh = await freshRes.json();
      const members = { ...fresh.members };
      if (!members[myName]) members[myName] = { submissions: {} };
      members[myName] = {
        ...members[myName],
        submissions: {
          ...members[myName].submissions,
          [group.current_week]: {
            image: uploadData.url,
            uploadedAt: new Date().toISOString(),
          },
        },
      };
      await patchGroup({ members });
    } catch (err) {
      console.error(err);
      alert('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  }

  async function saveSettings(e) {
    e.preventDefault();
    const limit = parseFloat(limitInput);
    const update = {};
    if (!isNaN(limit) && limit > 0) update.limit_hours = limit;
    if (penaltyInput.trim()) update.penalty_text = penaltyInput.trim();
    await patchGroup(update);
    setView('main');
  }

  async function startNewWeek() {
    await patchGroup({ current_week: getWeekId(new Date()) });
    setView('main');
  }

  if (loading) {
    return (
      <main className="container">
        <p className="muted">Loading…</p>
      </main>
    );
  }

  if (!myName) {
    return (
      <main className="container">
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 600, margin: '40px 0 8px' }}>
          Off the Clock
        </h1>
        <p className="muted" style={{ marginBottom: 24 }}>
          A weekly screen time challenge for your group. Stay under the limit, or pay the penalty.
        </p>
        <form onSubmit={handleNameSubmit} className="card">
          <label style={{ display: 'block', fontSize: 13, color: 'var(--ink-soft)', marginBottom: 8 }}>
            What should we call you?
          </label>
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="e.g. Erik"
            autoFocus
          />
          <button type="submit" className="primary" style={{ marginTop: 12, width: '100%' }}>
            Join the group
          </button>
        </form>
      </main>
    );
  }

  if (view === 'settings') {
    return (
      <main className="container">
        <button onClick={() => setView('main')} style={{ marginBottom: 16 }}>← Back</button>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 600, margin: '0 0 20px' }}>
          Settings
        </h1>
        <form onSubmit={saveSettings} className="card" style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--ink-soft)', marginBottom: 8 }}>
            Weekly screen time limit (hours)
          </label>
          <input
            type="number"
            min="1"
            max="40"
            step="0.5"
            value={limitInput}
            onChange={(e) => setLimitInput(e.target.value)}
            style={{ marginBottom: 16 }}
          />
          <label style={{ display: 'block', fontSize: 13, color: 'var(--ink-soft)', marginBottom: 8 }}>
            Penalty for going over
          </label>
          <input
            type="text"
            value={penaltyInput}
            onChange={(e) => setPenaltyInput(e.target.value)}
            placeholder="e.g. 5 km run"
          />
          <button type="submit" className="primary" style={{ marginTop: 16, width: '100%' }}>
            Save
          </button>
        </form>
        <div className="card">
          <p className="muted" style={{ fontSize: 13, marginTop: 0, marginBottom: 12 }}>
            Start a new week. This won't delete past screenshots, but the leaderboard will show this week as fresh and unsubmitted for everyone.
          </p>
          <button onClick={startNewWeek} style={{ width: '100%' }}>Start new week</button>
        </div>
      </main>
    );
  }

  const week = group.current_week;
  const names = Object.keys(group.members);
  const mySubmission = group.members[myName]?.submissions?.[week];

  return (
    <main className="container">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 600, margin: 0 }}>
            This week
          </h1>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
            {formatWeekRange(week)}
          </p>
        </div>
        <button onClick={() => setView('settings')} aria-label="Settings">⚙</button>
      </div>

      <div
        className="card"
        style={{ background: 'var(--moss-light)', border: 'none', marginBottom: 24 }}
      >
        <p className="muted" style={{ fontSize: 13, margin: '0 0 4px' }}>Weekly limit</p>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, margin: 0 }}>
          {group.limit_hours} hours
        </p>
        <p className="muted" style={{ fontSize: 13, margin: '6px 0 0' }}>
          Penalty: {group.penalty_text}
        </p>
      </div>

      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, margin: '0 0 12px' }}>
        Submit your screenshot
      </h2>
      <label
        htmlFor="screenshot-input"
        className="card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          textAlign: 'center',
          cursor: 'pointer',
          borderStyle: 'dashed',
          marginBottom: 8,
        }}
      >
        <span style={{ fontSize: 14 }}>
          {uploading ? 'Uploading…' : mySubmission ? 'Replace your screenshot' : 'Upload your Screen Time screenshot'}
        </span>
        <span className="muted" style={{ fontSize: 12 }}>From Settings → Screen Time</span>
      </label>
      <input
        type="file"
        id="screenshot-input"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
        disabled={uploading}
      />

      <p className="muted" style={{ fontSize: 13, margin: '8px 0 28px' }}>
        {mySubmission ? 'You\u2019ve submitted for this week.' : 'You haven\u2019t submitted yet this week.'}
      </p>

      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, margin: '0 0 12px' }}>
        Group this week
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
        {names.length === 0 && <p className="muted" style={{ fontSize: 14 }}>No one has joined yet.</p>}
        {names.map((name) => {
          const sub = group.members[name]?.submissions?.[week];
          return (
            <div
              key={name}
              className="card"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                cursor: sub ? 'pointer' : 'default',
              }}
              onClick={() => sub && setActiveImage({ url: sub.image, name })}
            >
              <span style={{ fontSize: 14, fontWeight: 500 }}>
                {name}{name === myName ? ' (you)' : ''}
              </span>
              <span className="muted" style={{ fontSize: 13 }}>
                {sub ? 'Submitted' : 'Pending'}
              </span>
            </div>
          );
        })}
      </div>

      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, margin: '0 0 12px' }}>
        Penalties owed
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(!group.penalties_owed || group.penalties_owed.length === 0) && (
          <p className="muted" style={{ fontSize: 14 }}>None yet.</p>
        )}
        {group.penalties_owed?.map((p, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              background: 'var(--clay-light)',
              borderRadius: 10,
              padding: '10px 14px',
              fontSize: 13,
            }}
          >
            <span style={{ fontWeight: 500 }}>{p.name}</span>
            <span className="muted">{p.text} ({p.week})</span>
          </div>
        ))}
      </div>

      {activeImage && (
        <div
          style={{
            position: 'relative',
            minHeight: '100vh',
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            zIndex: 1000,
          }}
          onClick={() => setActiveImage(null)}
        >
          <div
            className="card"
            style={{ maxWidth: 360, width: '100%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ fontSize: 14, fontWeight: 500, margin: '0 0 8px' }}>
              {activeImage.name}'s screen time
            </p>
            <img
              src={activeImage.url}
              alt={`${activeImage.name}'s screen time screenshot`}
              style={{ width: '100%', borderRadius: 10, display: 'block', marginBottom: 8 }}
            />
            <button onClick={() => setActiveImage(null)} style={{ width: '100%' }}>Close</button>
          </div>
        </div>
      )}
    </main>
  );
}
