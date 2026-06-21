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
  const [hoursInput, setHoursInput] = useState('');
  const [savingHours, setSavingHours] = useState(false);
  const [challengeWeeksInput, setChallengeWeeksInput] = useState('4');
  const [challengeLimitInput, setChallengeLimitInput] = useState('10');
  const [challengePenaltyInput, setChallengePenaltyInput] = useState('5 km run');

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
      const existing = members[myName].submissions?.[group.current_week] || {};
      members[myName] = {
        ...members[myName],
        submissions: {
          ...members[myName].submissions,
          [group.current_week]: {
            ...existing,
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

  async function handleSaveHours(e) {
    e.preventDefault();
    const hours = parseFloat(hoursInput);
    if (isNaN(hours) || hours < 0) return;
    setSavingHours(true);
    try {
      const freshRes = await fetch('/api/group');
      const fresh = await freshRes.json();
      const members = { ...fresh.members };
      if (!members[myName]) members[myName] = { submissions: {} };
      const existing = members[myName].submissions?.[fresh.current_week] || {};
      members[myName] = {
        ...members[myName],
        submissions: {
          ...members[myName].submissions,
          [fresh.current_week]: {
            ...existing,
            hours,
          },
        },
      };
      await patchGroup({ members });
      setHoursInput('');
    } catch (err) {
      console.error(err);
      alert('Saving hours failed: ' + err.message);
    } finally {
      setSavingHours(false);
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

  async function clearPenalty(index) {
    const fresh = await (await fetch('/api/group')).json();
    const penaltiesOwed = [...(fresh.penalties_owed || [])];
    penaltiesOwed.splice(index, 1);
    await patchGroup({ penalties_owed: penaltiesOwed });
  }



  async function startChallenge(weeks, limit, penalty) {
    const fresh = await (await fetch('/api/group')).json();
    await patchGroup({
      limit_hours: limit,
      penalty_text: penalty,
      challenge: {
        start_week: fresh.current_week,
        total_weeks: weeks,
        limit_hours: limit,
        penalty_text: penalty,
        weeks_completed: 0,
      },
      challenge_summary: null,
    });
    setLimitInput(String(limit));
    setPenaltyInput(penalty);
  }

  async function cancelChallenge() {
    await patchGroup({ challenge: null });
  }

  async function dismissChallengeSummary() {
    await patchGroup({ challenge_summary: null });
  }

  const ADMIN_NAME = 'Didrik';
  const isAdmin = myName === ADMIN_NAME;

  async function removeMember(name) {
    const fresh = await (await fetch('/api/group')).json();
    const members = { ...fresh.members };
    delete members[name];
    await patchGroup({ members });
  }

  async function adminEditPenaltyText(index, newText) {
    const fresh = await (await fetch('/api/group')).json();
    const penaltiesOwed = [...(fresh.penalties_owed || [])];
    if (penaltiesOwed[index]) {
      penaltiesOwed[index] = { ...penaltiesOwed[index], text: newText };
      await patchGroup({ penalties_owed: penaltiesOwed });
    }
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

        {group?.challenge && (
          <div
            className="card"
            style={{ background: 'var(--moss-light)', border: 'none', marginBottom: 20 }}
          >
            <p className="muted" style={{ fontSize: 12, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Challenge in progress
            </p>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, margin: 0 }}>
              Week {(group.challenge.weeks_completed || 0) + 1} of {group.challenge.total_weeks}
            </p>
            <p className="muted" style={{ fontSize: 13, margin: '4px 0 0' }}>
              {group.challenge.limit_hours}h limit/week · {group.challenge.penalty_text}
            </p>
          </div>
        )}

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
            disabled={!!group.challenge && !isAdmin}
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
            disabled={!!group.challenge && !isAdmin}
          />
          <button
            type="submit"
            className="primary"
            disabled={!!group.challenge && !isAdmin}
            style={{ marginTop: 16, width: '100%' }}
          >
            Save
          </button>
          {group.challenge && !isAdmin && (
            <p className="muted" style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>
              These are set by the active challenge. Only the admin can override them.
            </p>
          )}
          {group.challenge && isAdmin && (
            <p className="muted" style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>
              A challenge is active — as admin you can override the limit/penalty directly.
            </p>
          )}
          {!group.challenge && (
            <p className="muted" style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>
              These will apply when you start a new challenge below.
            </p>
          )}
        </form>

        <div className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, margin: '0 0 8px' }}>
            Challenge
          </h2>
          {group.challenge ? (
            <>
              <p style={{ fontSize: 14, margin: '0 0 4px' }}>
                Week {(group.challenge.weeks_completed || 0) + 1} of {group.challenge.total_weeks}
              </p>
              <p className="muted" style={{ fontSize: 13, margin: '0 0 12px' }}>
                {group.challenge.limit_hours}h limit/week · {group.challenge.penalty_text}. Weeks roll over automatically every Monday.
              </p>
              <button onClick={cancelChallenge} style={{ width: '100%' }}>Cancel challenge</button>
            </>
          ) : (
            <>
              <p className="muted" style={{ fontSize: 13, margin: '0 0 12px' }}>
                Set up a multi-week challenge. Weeks will roll over automatically every Monday at midnight, no button needed.
              </p>
              <label style={{ display: 'block', fontSize: 13, color: 'var(--ink-soft)', marginBottom: 8 }}>
                Number of weeks
              </label>
              <input
                type="number"
                min="1"
                max="52"
                step="1"
                value={challengeWeeksInput}
                onChange={(e) => setChallengeWeeksInput(e.target.value)}
                style={{ marginBottom: 12 }}
              />
              <label style={{ display: 'block', fontSize: 13, color: 'var(--ink-soft)', marginBottom: 8 }}>
                Weekly limit (hours)
              </label>
              <input
                type="number"
                min="1"
                max="40"
                step="0.5"
                value={challengeLimitInput}
                onChange={(e) => setChallengeLimitInput(e.target.value)}
                style={{ marginBottom: 12 }}
              />
              <label style={{ display: 'block', fontSize: 13, color: 'var(--ink-soft)', marginBottom: 8 }}>
                Penalty for going over
              </label>
              <input
                type="text"
                value={challengePenaltyInput}
                onChange={(e) => setChallengePenaltyInput(e.target.value)}
                placeholder="e.g. 5 km run"
                style={{ marginBottom: 12 }}
              />
              <button
                className="primary"
                style={{ width: '100%' }}
                onClick={() => {
                  const weeks = parseInt(challengeWeeksInput, 10);
                  const limit = parseFloat(challengeLimitInput);
                  const penalty = challengePenaltyInput.trim();
                  if (!isNaN(weeks) && weeks > 0 && !isNaN(limit) && limit > 0 && penalty) {
                    startChallenge(weeks, limit, penalty);
                  }
                }}
              >
                Start challenge
              </button>
            </>
          )}
        </div>

        {group.week_history && group.week_history.length > 0 && (
          <div className="card">
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, margin: '0 0 12px' }}>
              History
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[...group.week_history].reverse().map((w) => (
                <div key={w.week}>
                  <p style={{ fontSize: 13, fontWeight: 500, margin: '0 0 4px' }}>
                    {formatWeekRange(w.week)} <span className="muted">· limit {w.limit_hours}h</span>
                  </p>
                  {Object.keys(w.results).length === 0 ? (
                    <p className="muted" style={{ fontSize: 12, margin: 0 }}>No submissions.</p>
                  ) : (
                    Object.entries(w.results)
                      .sort((a, b) => a[1] - b[1])
                      .map(([name, hours]) => (
                        <p
                          key={name}
                          style={{
                            fontSize: 12,
                            margin: '2px 0',
                            color: hours > w.limit_hours ? 'var(--clay)' : 'var(--moss)',
                          }}
                        >
                          {name}: {hours}h {hours > w.limit_hours ? '(over)' : '(under)'}
                        </p>
                      ))
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {isAdmin && (
          <div className="card" style={{ marginTop: 16, borderColor: 'var(--clay)' }}>
            <p className="muted" style={{ fontSize: 12, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Admin
            </p>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, margin: '0 0 12px' }}>
              Manage group
            </h2>

            {Object.keys(group.members).length === 0 ? (
              <p className="muted" style={{ fontSize: 13 }}>No members yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {Object.keys(group.members).map((name) => (
                  <div
                    key={name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 0',
                      borderBottom: '1px solid var(--line)',
                    }}
                  >
                    <span style={{ fontSize: 14 }}>{name}{name === ADMIN_NAME ? ' (admin)' : ''}</span>
                    {name !== ADMIN_NAME && (
                      <button
                        onClick={() => {
                          if (window.confirm(`Remove ${name} from the group? This deletes their submission history.`)) {
                            removeMember(name);
                          }
                        }}
                        style={{ fontSize: 12, padding: '4px 10px' }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <p className="muted" style={{ fontSize: 12, margin: '0 0 8px' }}>
              As admin, you can also edit the weekly limit/penalty and manage the challenge above, even while a challenge is active.
            </p>
          </div>
        )}
      </main>
    );
  }

  const week = group.current_week;
  const names = Object.keys(group.members);
  const mySubmission = group.members[myName]?.submissions?.[week];

  const leaderboardEntries = names
    .map((name) => {
      const sub = group.members[name]?.submissions?.[week];
      const complete = !!(sub?.image && typeof sub?.hours === 'number');
      return { name, sub, complete };
    })
    .sort((a, b) => {
      if (a.complete && b.complete) return a.sub.hours - b.sub.hours;
      if (a.complete) return -1;
      if (b.complete) return 1;
      return a.name.localeCompare(b.name);
    });

  if (group.challenge_summary) {
    const summary = group.challenge_summary;
    const totals = {};
    summary.weeks.forEach((w) => {
      Object.entries(w.results).forEach(([name, hours]) => {
        if (!totals[name]) totals[name] = { weeks: 0, overCount: 0, totalHours: 0 };
        totals[name].weeks += 1;
        totals[name].totalHours += hours;
        if (hours > w.limit_hours) totals[name].overCount += 1;
      });
    });
    const ranked = Object.entries(totals).sort((a, b) => a[1].overCount - b[1].overCount);

    return (
      <main className="container">
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 600, margin: '0 0 4px' }}>
          Challenge complete
        </h1>
        <p className="muted" style={{ margin: '0 0 24px', fontSize: 13 }}>
          {formatWeekRange(summary.start_week)} · {summary.total_weeks} weeks · {summary.limit_hours}h/week limit
        </p>

        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, margin: '0 0 12px' }}>
          Final standings
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
          {ranked.map(([name, t], i) => (
            <div
              key={name}
              className="card"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}
            >
              <span style={{ fontSize: 14, fontWeight: 500 }}>
                <span className="muted" style={{ fontFamily: 'var(--font-display)', fontWeight: 600, marginRight: 8 }}>
                  #{i + 1}
                </span>
                {name}{name === myName ? ' (you)' : ''}
              </span>
              <span className="muted" style={{ fontSize: 13 }}>
                {t.overCount} week{t.overCount === 1 ? '' : 's'} over · avg {(t.totalHours / t.weeks).toFixed(1)}h
              </span>
            </div>
          ))}
        </div>

        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, margin: '0 0 12px' }}>
          Week by week
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          {summary.weeks.map((w) => (
            <div key={w.week} className="card">
              <p style={{ fontSize: 13, fontWeight: 500, margin: '0 0 8px' }}>{formatWeekRange(w.week)}</p>
              {Object.entries(w.results)
                .sort((a, b) => a[1] - b[1])
                .map(([name, hours]) => (
                  <p
                    key={name}
                    style={{ fontSize: 12, margin: '2px 0', color: hours > w.limit_hours ? 'var(--clay)' : 'var(--moss)' }}
                  >
                    {name}: {hours}h {hours > w.limit_hours ? '(over)' : '(under)'}
                  </p>
                ))}
              {Object.keys(w.results).length === 0 && (
                <p className="muted" style={{ fontSize: 12, margin: 0 }}>No submissions.</p>
              )}
            </div>
          ))}
        </div>

        <button className="primary" style={{ width: '100%' }} onClick={dismissChallengeSummary}>
          Continue
        </button>
      </main>
    );
  }

  // No active challenge — show a simple prompt screen
  if (!group.challenge) {
    return (
      <main className="container">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 600, margin: 0 }}>
            Off the Clock
          </h1>
          <button onClick={() => setView('settings')} aria-label="Settings">⚙</button>
        </div>

        <div
          className="card"
          style={{ textAlign: 'center', padding: '40px 24px', borderStyle: 'dashed', marginBottom: 16 }}
        >
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, margin: '0 0 8px' }}>
            No active challenge
          </p>
          <p className="muted" style={{ fontSize: 14, margin: '0 0 20px' }}>
            Start a challenge to begin tracking your group's screen time this week.
          </p>
          <button className="primary" onClick={() => setView('settings')}>
            Start a challenge →
          </button>
        </div>

        {group.penalties_owed && group.penalties_owed.length > 0 && (
          <>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, margin: '24px 0 12px' }}>
              Penalties owed
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {group.penalties_owed.map((p, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'var(--clay-light)',
                    borderRadius: 10,
                    padding: '10px 14px',
                    fontSize: 13,
                    gap: 8,
                  }}
                >
                  <span style={{ fontWeight: 500 }}>{p.name}</span>
                  <span className="muted" style={{ flex: 1, textAlign: 'right' }}>{p.text} ({p.week})</span>
                  <button onClick={() => clearPenalty(i)} style={{ padding: '4px 10px', fontSize: 12 }}>
                    Done
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    );
  }

  return (
    <main className="container">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 600, margin: 0 }}>
            This week
          </h1>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
            {formatWeekRange(week)}
            {group.challenge && (
              <> · Week {(group.challenge.weeks_completed || 0) + 1} of {group.challenge.total_weeks}</>
            )}
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
          {uploading ? 'Uploading…' : mySubmission?.image ? 'Replace your screenshot' : 'Upload your Screen Time screenshot'}
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

      {mySubmission?.image && (
        <form onSubmit={handleSaveHours} className="card" style={{ marginTop: 8, marginBottom: 8 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--ink-soft)', marginBottom: 8 }}>
            Your total screen time this week (hours)
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="number"
              min="0"
              step="0.1"
              placeholder={typeof mySubmission.hours === 'number' ? String(mySubmission.hours) : 'e.g. 6.5'}
              value={hoursInput}
              onChange={(e) => setHoursInput(e.target.value)}
            />
            <button type="submit" className="primary" disabled={savingHours} style={{ whiteSpace: 'nowrap' }}>
              {savingHours ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      )}

      <p className="muted" style={{ fontSize: 13, margin: '8px 0 28px' }}>
        {mySubmission?.image && typeof mySubmission.hours === 'number'
          ? `You\u2019re on the leaderboard for this week: ${mySubmission.hours}h.`
          : mySubmission?.image
          ? 'Screenshot uploaded \u2014 add your hours above to join the leaderboard.'
          : 'You haven\u2019t submitted yet this week. A screenshot is required before your hours count.'}
      </p>

      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, margin: '0 0 12px' }}>
        Leaderboard this week
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
        {names.length === 0 && <p className="muted" style={{ fontSize: 14 }}>No one has joined yet.</p>}
        {leaderboardEntries.map(({ name, sub, complete }, i) => {
          const isOver = complete && sub.hours > group.limit_hours;
          return (
            <div
              key={name}
              className="card"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                cursor: sub?.image ? 'pointer' : 'default',
                borderColor: complete ? (isOver ? 'var(--clay)' : 'var(--moss)') : 'var(--line)',
              }}
              onClick={() => sub?.image && setActiveImage({ url: sub.image, name })}
            >
              <span style={{ fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
                {complete && (
                  <span className="muted" style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>
                    #{i + 1}
                  </span>
                )}
                {name}{name === myName ? ' (you)' : ''}
              </span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: complete ? 600 : 400,
                  color: complete ? (isOver ? 'var(--clay)' : 'var(--moss)') : 'var(--ink-soft)',
                }}
              >
                {complete ? `${sub.hours}h${isOver ? ' · over' : ' · under'}` : sub?.image ? 'Awaiting hours' : 'Pending'}
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
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--clay-light)',
              borderRadius: 10,
              padding: '10px 14px',
              fontSize: 13,
              gap: 8,
            }}
          >
            <span style={{ fontWeight: 500 }}>{p.name}</span>
            <span className="muted" style={{ flex: 1, textAlign: 'right' }}>{p.text} ({p.week})</span>
            <button onClick={() => clearPenalty(i)} style={{ padding: '4px 10px', fontSize: 12 }}>
              Done
            </button>
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
