import { supabase } from '../../../lib/supabase';
import { getWeekId, addWeeks } from '../../../lib/helpers';

const GROUP_ROW_ID = 1;

function defaultGroup() {
  return {
    id: GROUP_ROW_ID,
    limit_hours: 7,
    penalty_text: '5 km run',
    current_week: getWeekId(new Date()),
    members: {},
    penalties_owed: [],
    challenge: null,
    week_history: [],
    challenge_summary: null,
  };
}

// Archive the given week's results and compute penalties for anyone over the limit.
function archiveWeek(data, weekId) {
  const results = {};
  Object.entries(data.members).forEach(([name, member]) => {
    const sub = member.submissions?.[weekId];
    if (sub && sub.image && typeof sub.hours === 'number') {
      results[name] = sub.hours;
    }
  });

  const newPenalties = [];
  Object.entries(results).forEach(([name, hours]) => {
    if (hours > data.limit_hours) {
      newPenalties.push({ name, text: data.penalty_text, week: weekId });
    }
  });

  const weekRecord = {
    week: weekId,
    limit_hours: data.limit_hours,
    penalty_text: data.penalty_text,
    results,
  };

  return { weekRecord, newPenalties };
}

// Advance current_week forward, archiving any fully-elapsed weeks, and
// handle challenge progression (advance challenge week count, end challenge if done).
function rollForward(data) {
  const today = getWeekId(new Date());
  let weekHistory = [...(data.week_history || [])];
  let penaltiesOwed = [...(data.penalties_owed || [])];
  let currentWeek = data.current_week;
  let challenge = data.challenge ? { ...data.challenge } : null;
  let challengeSummary = data.challenge_summary || null;
  let changed = false;

  while (currentWeek < today) {
    const { weekRecord, newPenalties } = archiveWeek(data, currentWeek);
    weekHistory.push(weekRecord);
    penaltiesOwed.push(...newPenalties);
    changed = true;

    currentWeek = addWeeks(currentWeek, 1);

    if (challenge) {
      challenge.weeks_completed = (challenge.weeks_completed || 0) + 1;
      if (challenge.weeks_completed >= challenge.total_weeks) {
        const challengeWeeks = weekHistory.filter(
          (w) => w.week >= challenge.start_week && w.week < currentWeek
        );
        challengeSummary = {
          start_week: challenge.start_week,
          total_weeks: challenge.total_weeks,
          limit_hours: challenge.limit_hours,
          penalty_text: challenge.penalty_text,
          weeks: challengeWeeks,
        };
        challenge = null;
      }
    }
  }

  return { currentWeek, weekHistory, penaltiesOwed, challenge, challengeSummary, changed };
}

export async function GET() {
  let { data, error } = await supabase
    .from('group_state')
    .select('*')
    .eq('id', GROUP_ROW_ID)
    .maybeSingle();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    const fresh = defaultGroup();
    const { error: insertError } = await supabase.from('group_state').insert(fresh);
    if (insertError) {
      return Response.json({ error: insertError.message }, { status: 500 });
    }
    data = fresh;
  }

  if (data.week_history === undefined || data.week_history === null) data.week_history = [];
  if (data.challenge === undefined) data.challenge = null;
  if (data.challenge_summary === undefined) data.challenge_summary = null;

  const { currentWeek, weekHistory, penaltiesOwed, challenge, challengeSummary, changed } = rollForward(data);

  if (changed) {
    const update = {
      current_week: currentWeek,
      week_history: weekHistory,
      penalties_owed: penaltiesOwed,
      challenge,
      challenge_summary: challengeSummary,
    };
    const { data: updated, error: updateError } = await supabase
      .from('group_state')
      .update(update)
      .eq('id', GROUP_ROW_ID)
      .select()
      .single();
    if (!updateError) data = updated;
  }

  return Response.json(data);
}

export async function PATCH(request) {
  const body = await request.json();
  const allowedFields = [
    'limit_hours',
    'penalty_text',
    'members',
    'penalties_owed',
    'current_week',
    'challenge',
    'week_history',
    'challenge_summary',
  ];
  const update = {};
  for (const key of allowedFields) {
    if (key in body) update[key] = body[key];
  }

  const { data, error } = await supabase
    .from('group_state')
    .update(update)
    .eq('id', GROUP_ROW_ID)
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}
