(() => {
  const data = window.FAMILY_DATA;
  if (!data || !Array.isArray(data.people)) return;

  const people = new Map(data.people.map(person => [person.id, person]));
  const families = data.families;
  const search = document.getElementById('search');
  const results = document.getElementById('search-results');
  const tree = document.getElementById('tree');
  const scroll = document.getElementById('tree-scroll');
  const initialId = people.has('I1') ? 'I1' : data.people[0]?.id;
  let focusId = null;

  document.getElementById('person-count').textContent = data.people.length;

  const unique = ids => [...new Set(ids)].filter(id => people.has(id));
  const sort = ids => unique(ids).sort((a, b) => people.get(a).name.localeCompare(people.get(b).name, 'he'));
  const ownFamilies = id => families.filter(family => family.parents.includes(id));
  const originFamilies = id => families.filter(family => family.children.includes(id));
  const parents = id => unique(originFamilies(id).flatMap(family => family.parents));
  const children = id => unique(ownFamilies(id).flatMap(family => family.children));
  const partners = id => unique(ownFamilies(id).flatMap(family => family.parents.filter(value => value !== id)));
  const siblings = id => sort(originFamilies(id).flatMap(family => family.children.filter(value => value !== id)));

  function makePerson(id, kind) {
    const person = people.get(id);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'person' + (id === focusId ? ' focus' : '') + (kind === 'partner' ? ' partner' : '');
    button.dataset.person = id;
    const name = document.createElement('strong');
    name.textContent = person.name;
    const caption = document.createElement('small');
    caption.textContent = id === focusId ? 'במרכז העץ' : person.deceased ? 'לזכרו/ה' : kind === 'partner' ? 'בן/בת זוג' : 'למעבר לענף';
    button.append(name, caption);
    button.addEventListener('click', () => select(id));
    return button;
  }

  function addRow(label, ids, partnerIds = []) {
    if (!ids.length) return;
    const row = document.createElement('div');
    row.className = 'generation';
    const title = document.createElement('span');
    title.className = 'generation-label';
    title.textContent = label;
    const cards = document.createElement('div');
    cards.className = 'generation-people';
    for (const id of ids) cards.append(makePerson(id, partnerIds.includes(id) ? 'partner' : 'relative'));
    row.append(title, cards);
    tree.append(row);
  }

  function drawLines() {
    const old = tree.querySelector('.tree-lines');
    if (old) old.remove();
    const width = tree.scrollWidth;
    const height = tree.scrollHeight;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'tree-lines');
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const treeRect = tree.getBoundingClientRect();
    const positions = new Map();
    for (const card of tree.querySelectorAll('[data-person]')) {
      const rect = card.getBoundingClientRect();
      positions.set(card.dataset.person, {
        cx: rect.left - treeRect.left + rect.width / 2,
        top: rect.top - treeRect.top,
        bottom: rect.bottom - treeRect.top,
      });
    }
    for (const family of families) {
      for (const parentId of family.parents) {
        const parent = positions.get(parentId);
        if (!parent) continue;
        for (const childId of family.children) {
          const child = positions.get(childId);
          if (!child || child.top <= parent.bottom) continue;
          const mid = (parent.bottom + child.top) / 2;
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          path.setAttribute('d', `M${parent.cx} ${parent.bottom} V${mid} H${child.cx} V${child.top}`);
          svg.append(path);
        }
      }
    }
    tree.prepend(svg);
  }

  function render() {
    const id = focusId;
    const directParents = parents(id);
    const grandparents = sort(directParents.flatMap(parents));
    const ownPartners = sort(partners(id));
    const ownSiblings = siblings(id);
    const ownChildren = sort(children(id));
    const grandchildren = sort(ownChildren.flatMap(children));
    const middle = unique([id, ...ownPartners, ...ownSiblings]);
    tree.replaceChildren();
    addRow('דור הסבים והסבתות', grandparents);
    addRow('דור ההורים', directParents);
    addRow('במרכז המשפחה · בני זוג ואחים', middle, ownPartners);
    addRow('דור הילדים', ownChildren);
    addRow('דור הנכדים', grandchildren);
    document.getElementById('focus-name').textContent = people.get(id).name;
    document.getElementById('focus-info').textContent = people.get(id).deceased ? 'לזכרו/ה' : '';
    requestAnimationFrame(() => {
      drawLines();
      const card = tree.querySelector('.person.focus');
      if (card) card.scrollIntoView({ block: 'nearest', inline: 'center' });
      scroll.scrollTop = 0;
    });
  }

  function hideResults() {
    results.hidden = true;
    search.setAttribute('aria-expanded', 'false');
  }

  function select(id, updateHash = true) {
    if (!people.has(id)) return;
    focusId = id;
    search.value = '';
    hideResults();
    render();
    if (updateHash) history.replaceState(null, '', '#' + encodeURIComponent(id));
  }

  function updateResults() {
    const query = search.value.trim().toLocaleLowerCase();
    results.replaceChildren();
    if (!query) { hideResults(); return; }
    const matches = data.people.filter(person => person.name.toLocaleLowerCase().includes(query)).slice(0, 15);
    if (!matches.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-result';
      empty.textContent = 'לא מצאנו שם כזה בעץ';
      results.append(empty);
    }
    for (const person of matches) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'result';
      button.setAttribute('role', 'option');
      button.textContent = person.name;
      button.addEventListener('click', () => select(person.id));
      results.append(button);
    }
    results.hidden = false;
    search.setAttribute('aria-expanded', 'true');
  }

  search.addEventListener('input', updateResults);
  search.addEventListener('keydown', event => {
    if (event.key === 'Escape') hideResults();
    if (event.key === 'Enter') {
      const first = results.querySelector('.result');
      if (first) { event.preventDefault(); first.click(); }
    }
  });
  document.addEventListener('click', event => { if (!event.target.closest('.search-wrap')) hideResults(); });
  document.getElementById('reset').addEventListener('click', () => select(initialId));
  window.addEventListener('resize', drawLines);
  window.addEventListener('hashchange', () => select(decodeURIComponent(location.hash.slice(1)), false));
  select(people.has(decodeURIComponent(location.hash.slice(1))) ? decodeURIComponent(location.hash.slice(1)) : initialId, false);
})();
