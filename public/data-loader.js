window.loadFamilyData = async function () {
  const fallback = window.FAMILY_DATA;
  const config = window.SUPABASE_CONFIG;
  if (!config?.url || !config?.key) return fallback;
  const headers = { apikey: config.key };
  try {
    const endpoint = config.url.replace(/\/$/, '') + '/rest/v1/';
    const [peopleResponse, familiesResponse, membersResponse] = await Promise.all([
      fetch(endpoint + 'family_people?select=id,name_he,name_ru,deceased,birth_date,death_date,photo_path,is_visible&is_visible=eq.true&order=id', {headers}),
      fetch(endpoint + 'family_units?select=id,relationship_status,is_current&order=id', {headers}),
      fetch(endpoint + 'family_members?select=family_id,person_id,role,sort_order&order=sort_order', {headers})
    ]);
    if (![peopleResponse, familiesResponse, membersResponse].every(response => response.ok)) throw Error('Family data unavailable');
    const [people, units, members] = await Promise.all([peopleResponse.json(), familiesResponse.json(), membersResponse.json()]);
    if (!people.length) throw Error('No family data');
    return {
      people: people.map(person => ({ ...person, photo_url: person.photo_path ? `${config.url}/storage/v1/object/public/${person.photo_path.split('/').map(encodeURIComponent).join('/')}` : null })),
      families: units.map(unit => ({ ...unit, parents: members.filter(member => member.family_id === unit.id && member.role === 'parent').map(member => member.person_id), children: members.filter(member => member.family_id === unit.id && member.role === 'child').map(member => member.person_id) }))
    };
  } catch (error) { console.error('Family database unavailable.', error); return {people:[],families:[]}; }
};
