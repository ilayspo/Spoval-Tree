(async () => {
  const config=window.SUPABASE_CONFIG;
  const $=id=>document.getElementById(id);
  const status=message=>{ $('status').textContent=message; };
  if (!config?.url || !config?.key) { $('setup').hidden=false; return; }
  const base=config.url.replace(/\/$/,'');
  let session=JSON.parse(sessionStorage.getItem('family-session')||'null');
  let profiles=[],units=[],members=[],selected=null;
  const peopleName=id=>profiles.find(p=>p.id===id)?.name_he||id;
  const visiblePeople=()=>profiles.filter(p=>p.is_visible);
  const labelStatus={unknown:'לא ידוע',married:'נשואים',partnered:'בני זוג',divorced:'גרושים',separated:'פרודים',former:'קשר קודם'};
  async function api(path, options={},retry=true) {
    const response=await fetch(base+path,{...options,headers:{apikey:config.key,...(session?.access_token?{Authorization:'Bearer '+session.access_token}:{}),...(options.body && !(options.body instanceof File)?{'Content-Type':'application/json'}:{}),...options.headers}});
    if (response.status===401 && retry && !path.startsWith('/auth/v1/token?grant_type=refresh_token') && await refreshSession()) return api(path,options,false);
    const body=await response.text(); let result;
    try{result=body?JSON.parse(body):null;}catch{result=body;}
    if(!response.ok)throw Error(result?.msg||result?.message||result?.error_description||`שגיאה ${response.status}`);
    return result;
  }
  async function refreshSession(){
    if(!session?.refresh_token)return false;
    try{session=await api('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:session.refresh_token})},false);sessionStorage.setItem('family-session',JSON.stringify(session));return true;}
    catch{session=null;sessionStorage.removeItem('family-session');return false;}
  }
  async function reloadData(){
    [profiles,units,members]=await Promise.all([
      api('/rest/v1/family_people?select=*&order=id'),
      api('/rest/v1/family_units?select=*&order=id'),
      api('/rest/v1/family_members?select=*&order=sort_order')
    ]);
    drawList(); if(selected)edit(selected,false);
  }
  async function load(){
    if(!session){$('login').hidden=false;$('editor').hidden=true;return;}
    try{
      const admins=await api('/rest/v1/family_admins?select=user_id');
      if(!admins.length){status('החשבון מחובר אך אינו מורשה לניהול העץ.');$('login').hidden=false;return;}
      await reloadData();$('login').hidden=true;$('editor').hidden=false;
    }catch(error){status(error.message);$('login').hidden=false;}
  }
  function drawList(){
    const query=$('filter').value.trim().toLocaleLowerCase();$('person-list').replaceChildren();
    for(const person of profiles.filter(p=>(p.name_he+' '+p.name_ru).toLocaleLowerCase().includes(query))){
      const button=document.createElement('button');button.type='button';button.textContent=person.name_he+(person.is_visible?'':' · מוסתר/ת');
      button.className=[person.id===selected?'active':'',person.is_visible?'':'hidden-person'].join(' ');
      button.addEventListener('click',()=>edit(person.id));$('person-list').append(button);
    }
  }
  function fillSelect(select,exclude=[],prompt='בחרו אדם',allowEmpty=true){
    const old=select.value;select.replaceChildren();
    if(allowEmpty)select.append(new Option(prompt,''));
    for(const person of visiblePeople().filter(p=>!exclude.includes(p.id))) select.append(new Option(person.name_he+' · '+person.name_ru,person.id));
    if([...select.options].some(option=>option.value===old))select.value=old;
  }
  function displayDate(value){if(!value)return '';const [year,month,day]=value.split('-');return day?`${day}.${month}.${year}`:month?`${month}.${year}`:year;}
  function parseDate(value){
    value=value.trim();if(!value)return null;
    let year,month,day;
    if(/^\d{4}(-\d{2}){0,2}$/.test(value)){[year,month,day]=value.split('-');}
    else if(/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(value)){[day,month,year]=value.split('.');}
    else if(/^\d{1,2}\.\d{4}$/.test(value)){[month,year]=value.split('.');}
    else if(/^\d{4}$/.test(value))year=value;
    else throw Error('תאריך לא תקין. השתמשו בפורמט יום.חודש.שנה, חודש.שנה או שנה.');
    if(month && (+month<1||+month>12))throw Error('חודש לא תקין.');
    if(day){const date=new Date(Date.UTC(+year,+month-1,+day));if(date.getUTCFullYear()!==+year||date.getUTCMonth()+1!==+month||date.getUTCDate()!==+day)throw Error('יום לא תקין בתאריך.');}
    return year+(month?'-'+month.padStart(2,'0'):'')+(day?'-'+day.padStart(2,'0'):'');
  }
  function edit(id,resetStatus=true){
    selected=id;const person=profiles.find(p=>p.id===id);const form=$('person-form');form.hidden=false;
    form.elements.id.value=person?.id||'';
    for(const field of ['name_he','name_ru'])form.elements[field].value=person?.[field]||'';
    for(const field of ['birth_date','death_date'])form.elements[field].value=displayDate(person?.[field]);
    form.elements.deceased.checked=!!person?.deceased;
    $('editor-title').textContent=person?'עריכת פרופיל':'הוספת אדם';
    $('photo-input').value='';const preview=$('photo-preview');preview.hidden=!person?.photo_path;
    if(person?.photo_path)preview.src=base+'/storage/v1/object/public/'+person.photo_path.split('/').map(encodeURIComponent).join('/');
    $('remove-photo').hidden=!person?.photo_path;
    $('new-person-link').hidden=!!person;$('connections').hidden=!person;
    const toggle=$('visibility-toggle');toggle.hidden=!person;toggle.textContent=person?.is_visible?'הסרה מהעץ':'החזרה לעץ';
    fillSelect(form.elements.initial_target);fillSelect(form.elements.initial_other_parent,[],'לא ידוע / אין לציין');
    if(person){fillSelect($('connection-form').elements.target,[person.id],'בחרו אדם',false);fillSelect($('connection-form').elements.other_parent,[person.id],'לא ידוע / אין לציין');renderFamilies(person.id);}
    drawList();if(resetStatus)status('');
  }
  function unitMembers(unit,role){return members.filter(m=>m.family_id===unit.id&&m.role===role).sort((a,b)=>a.sort_order-b.sort_order).map(m=>m.person_id);}
  function renderFamilies(id){
    const list=$('family-list');list.replaceChildren();const relevant=units.filter(u=>members.some(m=>m.family_id===u.id&&m.person_id===id));
    if(!relevant.length){const empty=document.createElement('p');empty.className='field-help';empty.textContent='אין עדיין קשרים לאדם הזה.';list.append(empty);}
    for(const unit of relevant){
      const box=document.createElement('article');box.className='family-unit';
      const parentIds=unitMembers(unit,'parent'),childIds=unitMembers(unit,'child');
      const title=document.createElement('div');title.className='family-unit-title';title.textContent=parentIds.map(peopleName).join(' + ')||'יחידה ללא הורים ידועים';box.append(title);
      const row=document.createElement('div');row.className='family-unit-members';
      for(const role of ['parent','child'])for(const personId of unitMembers(unit,role)){
        const button=document.createElement('button');button.type='button';button.title='הסרת הקשר של '+peopleName(personId)+' מהיחידה הזאת';button.textContent=(role==='parent'?'הורה: ':'ילד/ה: ')+peopleName(personId)+' ×';
        button.addEventListener('click',async()=>{
          if(!confirm('להסיר את הקשר של '+peopleName(personId)+' מהיחידה הזאת? הפרופיל עצמו יישאר.'))return;
          try{await api('/rest/v1/family_members?family_id=eq.'+encodeURIComponent(unit.id)+'&person_id=eq.'+encodeURIComponent(personId)+'&role=eq.'+role,{method:'DELETE'});await reloadData();status('הקשר הוסר.');}catch(e){status(e.message);}
        });row.append(button);
      }
      box.append(row);
      if(parentIds.length===2){
        const controls=document.createElement('div');controls.className='family-unit-controls';
        const statusLabel=document.createElement('label');statusLabel.textContent='מצב הזוגיות';const statusSelect=document.createElement('select');
        for(const [value,label] of Object.entries(labelStatus))statusSelect.append(new Option(label,value));statusSelect.value=unit.relationship_status;statusLabel.append(statusSelect);
        const currentLabel=document.createElement('label');currentLabel.textContent='הקשר כיום';const currentSelect=document.createElement('select');
        for(const [value,label] of [['','לא ידוע'],['true','נוכחי'],['false','לא נוכחי']])currentSelect.append(new Option(label,value));currentSelect.value=unit.is_current===null?'':String(unit.is_current);currentLabel.append(currentSelect);
        const save=document.createElement('button');save.type='button';save.textContent='שמירת מצב';save.addEventListener('click',async()=>{
          try{const is_current=['divorced','separated','former'].includes(statusSelect.value)?false:currentSelect.value===''?null:currentSelect.value==='true';
            await api('/rest/v1/family_units?id=eq.'+encodeURIComponent(unit.id),{method:'PATCH',body:JSON.stringify({relationship_status:statusSelect.value,is_current})});await reloadData();status('מצב הזוגיות נשמר.');}catch(e){status(e.message);}
        });controls.append(statusLabel,currentLabel,save);box.append(controls);
      }
      const remove=document.createElement('button');remove.type='button';remove.className='secondary';remove.textContent='הסרת היחידה המשפחתית הזאת';
      remove.addEventListener('click',async()=>{if(!confirm('להסיר את כל הקשרים ביחידה הזאת? הפרופילים עצמם יישארו.'))return;try{await api('/rest/v1/family_units?id=eq.'+encodeURIComponent(unit.id),{method:'DELETE'});await reloadData();status('היחידה הוסרה.');}catch(e){status(e.message);}});box.append(remove);list.append(box);
    }
  }
  async function addRelation(personId,kind,target,otherParent='',relationship_status='unknown',currentValue=''){
    if(!target||target===personId)throw Error('בחרו אדם אחר לקשר.');
    if(kind==='partner'){
      const parentIds=[personId,target];const existing=units.find(u=>parentIds.every(id=>unitMembers(u,'parent').includes(id))&&unitMembers(u,'parent').length===2);
      const is_current=['divorced','separated','former'].includes(relationship_status)?false:currentValue===''?null:currentValue==='true';
      if(existing)await api('/rest/v1/family_units?id=eq.'+encodeURIComponent(existing.id),{method:'PATCH',body:JSON.stringify({relationship_status,is_current})});
      else{const id='F-'+crypto.randomUUID();await api('/rest/v1/family_units',{method:'POST',body:JSON.stringify({id,relationship_status,is_current})});
        await api('/rest/v1/family_members',{method:'POST',body:JSON.stringify(parentIds.map((person_id,sort_order)=>({family_id:id,person_id,role:'parent',sort_order})))});}
      return;
    }
    const childId=kind==='parent'?personId:target;
    const firstParent=kind==='parent'?target:personId;
    const parentIds=[firstParent,...(otherParent&&otherParent!==firstParent&&otherParent!==childId?[otherParent]:[])];
    if(parentIds.includes(childId))throw Error('אדם אינו יכול להיות ההורה של עצמו.');
    let matching=units.find(u=>{const ids=unitMembers(u,'parent');return ids.length===parentIds.length&&parentIds.every(id=>ids.includes(id));});
    const origin=units.filter(u=>unitMembers(u,'child').includes(childId));
    if(origin.some(u=>u.id!==matching?.id)){
      const incompatible=origin.filter(u=>u.id!==matching?.id);
      if(incompatible.length!==1||!unitMembers(incompatible[0],'parent').every(id=>parentIds.includes(id)))throw Error('האדם כבר משויך ליחידת הורים אחרת. הסירו תחילה את קשר הילד/ה מן היחידה הישנה.');
      await api('/rest/v1/family_members?family_id=eq.'+encodeURIComponent(incompatible[0].id)+'&person_id=eq.'+encodeURIComponent(childId)+'&role=eq.child',{method:'DELETE'});
    }
    if(!matching){const id='F-'+crypto.randomUUID();await api('/rest/v1/family_units',{method:'POST',body:JSON.stringify({id,relationship_status:'unknown',is_current:null})});
      await api('/rest/v1/family_members',{method:'POST',body:JSON.stringify(parentIds.map((person_id,sort_order)=>({family_id:id,person_id,role:'parent',sort_order})))});
      matching={id};}
    if(!members.some(m=>m.family_id===matching.id&&m.person_id===childId&&m.role==='child'))await api('/rest/v1/family_members',{method:'POST',body:JSON.stringify({family_id:matching.id,person_id:childId,role:'child',sort_order:unitMembers(matching,'child').length})});
  }
  $('login').addEventListener('submit',async event=>{
    event.preventDefault();status('');
    try{const f=new FormData(event.currentTarget);session=await api('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email:f.get('email'),password:f.get('password')})});sessionStorage.setItem('family-session',JSON.stringify(session));await load();}catch(e){status(e.message);}
  });
  $('logout').addEventListener('click',async()=>{try{await api('/auth/v1/logout',{method:'POST'});}catch{}session=null;sessionStorage.removeItem('family-session');location.reload();});
  $('filter').addEventListener('input',drawList);
  $('new-person').addEventListener('click',()=>edit(null));
  $('person-form').addEventListener('submit',async event=>{
    event.preventDefault();status('');const form=event.currentTarget;const existing=profiles.find(p=>p.id===selected);const id=existing?.id||crypto.randomUUID();
    try{
      const birth_date=parseDate(form.elements.birth_date.value),death_date=parseDate(form.elements.death_date.value);
      let photo_path=existing?.photo_path||null;const file=$('photo-input').files[0];
      if(file){if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024)throw Error('יש לבחור JPG, PNG או WebP עד 5 MB.');
        const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];photo_path='family-photos/'+id+'/'+crypto.randomUUID()+'.'+ext;
        await api('/storage/v1/object/'+photo_path,{method:'POST',body:file,headers:{'Content-Type':file.type}});}
      const record={id,name_he:form.elements.name_he.value.trim(),name_ru:form.elements.name_ru.value.trim(),birth_date,death_date,deceased:form.elements.deceased.checked||!!death_date,photo_path,updated_at:new Date().toISOString()};
      await api('/rest/v1/family_people'+(existing?'?id=eq.'+encodeURIComponent(id):''),{method:existing?'PATCH':'POST',body:JSON.stringify(existing?Object.fromEntries(Object.entries(record).filter(([key])=>key!=='id')):record)});
      if(!existing&&form.elements.initial_kind.value){
        try{await addRelation(id,form.elements.initial_kind.value==='parent'?'child':form.elements.initial_kind.value==='child'?'parent':'partner',form.elements.initial_target.value,form.elements.initial_other_parent.value);}catch(error){await reloadData();edit(id);throw Error('הפרופיל נשמר, אבל הקשר לא נוסף: '+error.message);}
      }
      await reloadData();edit(id);status(existing?'הפרופיל נשמר.':'האדם נוסף לעץ.');
    }catch(error){status(error.message);}
  });
  $('connection-form').addEventListener('submit',async event=>{
    event.preventDefault();const f=event.currentTarget;
    try{await addRelation(selected,f.elements.kind.value,f.elements.target.value,f.elements.other_parent.value,f.elements.relationship_status.value,f.elements.is_current.value);await reloadData();status('הקשר נוסף או עודכן.');}catch(e){status(e.message);}
  });
  $('visibility-toggle').addEventListener('click',async()=>{
    const person=profiles.find(p=>p.id===selected);if(!person)return;
    if(person.is_visible&&!confirm('להסיר את '+person.name_he+' מהאתר? הפרופיל והקשרים יישמרו ויהיה אפשר להחזיר אותם.'))return;
    try{const wasVisible=person.is_visible;await api('/rest/v1/family_people?id=eq.'+encodeURIComponent(person.id),{method:'PATCH',body:JSON.stringify({is_visible:!wasVisible})});await reloadData();status(wasVisible?'האדם הוסר מן האתר ונשמר לשחזור.':'האדם הוחזר לעץ.');}catch(e){status(e.message);}
  });
  $('remove-photo').addEventListener('click',async()=>{
    const person=profiles.find(p=>p.id===selected);if(!person?.photo_path)return;
    try{await api('/rest/v1/family_people?id=eq.'+encodeURIComponent(person.id),{method:'PATCH',body:JSON.stringify({photo_path:null})});await reloadData();status('התמונה הוסרה מן הפרופיל.');}catch(e){status(e.message);}
  });
  await load();
})();
