import { supabase } from '../../../lib/supabase';
import { getWeekId } from '../../../lib/helpers';

const GROUP_ROW_ID = 1;

function defaultGroup() {
  return {
    id: GROUP_ROW_ID,
    limit_hours: 7,
    penalty_text: '5 km run',
    current_week: getWeekId(new Date()),
    members: {},
    penalties_owed: [],
  };
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

  const currentWeek = getWeekId(new Date());
  if (data.current_week !== currentWeek) {
    const { error: updateError } = await supabase
      .from('group_state')
      .update({ current_week: currentWeek })
      .eq('id', GROUP_ROW_ID);
    if (!updateError) data.current_week = currentWeek;
  }

  return Response.json(data);
}

export async function PATCH(request) {
  const body = await request.json();
  const allowedFields = ['limit_hours', 'penalty_text', 'members', 'penalties_owed', 'current_week'];
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
