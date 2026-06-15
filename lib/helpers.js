export function getWeekId(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  return d.toISOString().slice(0, 10);
}

export function addWeeks(weekId, n) {
  const d = new Date(weekId);
  d.setDate(d.getDate() + n * 7);
  return d.toISOString().slice(0, 10);
}

export function weeksBetween(fromWeekId, toWeekId) {
  const from = new Date(fromWeekId);
  const to = new Date(toWeekId);
  const diffMs = to.getTime() - from.getTime();
  return Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
}

export function formatWeekRange(weekId) {
  const start = new Date(weekId);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${fmt(start)} - ${fmt(end)}`;
}
