(async () => {
  const config = window.SUPABASE_CONFIG;
  const $ = id => document.getElementById(id);
  const status = message => { $('status').textContent = message; };
  if (!config?.url || !config?.key) { $('setup').hidden = false; return; }
  const base = config.url.replace(/\/$/, '');
  const stored = JSON.parse(sessionStorage.getItem('family-session') || 'null');
  let session = stored;
  let profiles = [];
  let selected = null;
  async function api(path, options={}) {
    const response = await fetch(base + path, { ...options, headers: { apikey:config.key, ...(session?.access_token ? {Authorization:'Bearer '+session.access_token} : {}), ...(options.body && !(options.body instanceof File) ? {'Content-Type':'application/json'} : {}), ...options.headers } });
    const body = await response.text();
    const result = body ? JSON.parse(body) : null;
    if (!response.ok) throw Error(result?.msg || result?.message || result?.error_description || `שגיאה ${response.status}`);
    return result;
  }
  async function refreshSession() {
    if (!session?.refresh_token) return false;
    try {
      session = await api('/auth/v1/token?grant_type=refresh_token', {method:'POST', body:JSON.stringify({refresh_token:session.refresh_token})});
      sessionStorage.setItem('family-session',JSON.stringify(session)); return true;
    } catch { session=null; sessionStorage.removeItem('family-session'); return false; }
  }
  async function load() {
    if (!session && !await refreshSession()) { $('login').hidden=false; $('editor').hidden=true; return; }
    try {
      const admins = await api('/rest/v1/family_admins?select=user_id');
      if (!admins.length) { status('החשבון מחובר אך עדיין לא הוגדר כמנהל. יש להוסיף את מזהה המשתמש לטבלת family_admins.'); $('login').hidden=false; return; }
      profiles = await api('/rest/v1/family_people?select=*&order=id');
      $('login').hidden=true; $('editor').hidden=false; drawList();
    } catch(e) { status(e.message); $('login').hidden=false; }
  }
  function drawList() {
    const query=$('filter').value.trim().toLocaleLowerCase(); $('person-list').replaceChildren();
    for (const person of profiles.filter(p => (p.name_he+' '+p.name_ru).toLocaleLowerCase().includes(query))) {
      const button=document.createElement('button'); button.type='button'; button.textContent=person.name_he+' · '+person.name_ru;
      if (person.id===selected) button.className='active';
      button.addEventListener('click',()=>edit(person.id)); $('person-list').append(button);
    }
  }
  function edit(id) {
    selected=id; const person=profiles.find(p=>p.id===id); const form=$('person-form'); form.hidden=false;
    form.elements.id.value=person?.id || '';
    for (const field of ['name_he','name_ru','notes']) form.elements[field].value=person?.[field] || '';
    form.elements.deceased.checked=!!person?.deceased;
    $('editor-title').textContent=person ? 'עריכת פרופיל' : 'הוספת אדם';
    $('photo-input').value=''; const preview=$('photo-preview'); preview.hidden=!person?.photo_path;
    if (person?.photo_path) preview.src=base+'/storage/v1/object/public/family-photos/'+person.photo_path.split('/').map(encodeURIComponent).join('/');
    drawList();
  }
  $('login').addEventListener('submit', async e => {
    e.preventDefault(); status('');
    try { const f=new FormData(e.currentTarget); session=await api('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email:f.get('email'),password:f.get('password')})}); sessionStorage.setItem('family-session',JSON.stringify(session)); await load(); }
    catch(error){status(error.message);}
  });
  $('logout').addEventListener('click',async()=>{ try { await api('/auth/v1/logout',{method:'POST'}); } catch {} session=null; sessionStorage.removeItem('family-session'); location.reload(); });
  $('filter').addEventListener('input',drawList);
  $('new-person').addEventListener('click',()=>edit(null));
  $('person-form').addEventListener('submit',async e=>{
    e.preventDefault(); status('');
    const f=e.currentTarget; const existing=profiles.find(p=>p.id===selected); const id=existing?.id || crypto.randomUUID();
    let photo_path=existing?.photo_path || null;
    try {
      const file=$('photo-input').files[0];
      if (file) {
        if (!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024) throw Error('יש לבחור JPG, PNG או WebP עד 5 MB.');
        const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];
        photo_path=id+'/'+crypto.randomUUID()+'.'+ext;
        await api('/storage/v1/object/family-photos/'+photo_path,{method:'POST',body:file,headers:{'Content-Type':file.type}});
      }
      const record={id,name_he:f.elements.name_he.value.trim(),name_ru:f.elements.name_ru.value.trim(),deceased:f.elements.deceased.checked,notes:f.elements.notes.value.trim(),photo_path,updated_at:new Date().toISOString()};
      await api('/rest/v1/family_people'+(existing?'?id=eq.'+encodeURIComponent(id):''), {method:existing?'PATCH':'POST',body:JSON.stringify(existing?Object.fromEntries(Object.entries(record).filter(([key])=>key!=='id')):record),headers:{Prefer:'return=minimal'}});
      if (existing) Object.assign(existing,record); else profiles.push(record);
      edit(id); status('הפרופיל נשמר. התמונה והשם מופיעים בעץ.');
    } catch(error) { status(error.message); }
  });
  $('remove-photo').addEventListener('click',async()=>{
    const person=profiles.find(p=>p.id===selected); if (!person?.photo_path) return;
    try { await api('/rest/v1/family_people?id=eq.'+encodeURIComponent(person.id),{method:'PATCH',body:JSON.stringify({photo_path:null}),headers:{Prefer:'return=minimal'}}); person.photo_path=null; edit(person.id); status('התמונה הוסרה מהפרופיל.'); }
    catch(e){status(e.message);}
  });
  await load();
})();
