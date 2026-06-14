import { supabase } from '../../../lib/supabase';

export async function POST(request) {
  const formData = await request.formData();
  const file = formData.get('file');
  const name = formData.get('name');
  const week = formData.get('week');

  if (!file || !name || !week) {
    return Response.json({ error: 'Missing file, name, or week' }, { status: 400 });
  }

  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${week}/${name.replace(/[^a-zA-Z0-9_-]/g, '_')}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error: uploadError } = await supabase.storage
    .from('screenshots')
    .upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    return Response.json({ error: uploadError.message }, { status: 500 });
  }

  const { data } = supabase.storage.from('screenshots').getPublicUrl(path);

  return Response.json({ url: data.publicUrl });
}
