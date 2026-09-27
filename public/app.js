(() => {
  const data = window.FAMILY_DATA;
  if (!data || !Array.isArray(data.people)) return;

  const people = new Map(data.people.map(person => [person.id, person]));
  const families = data.families;
  const search = document.getElementById('search');
  const results = document.getElementById('search-results');
  const tree = document.getElementById('tree');
  const scroll = document.getElementById('tree-scroll');
  const cardView = document.getElementById('card-view');
  const branchesView = document.getElementById('branches-view');
  const initialId = people.has('I1') ? 'I1' : data.people[0]?.id;
  let focusId = null;
  let activeView = 'card';
  let trail = [];
  let openBranch = null;

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
    button.addEventListener('click', () => select(id, true, true));
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

  function renderTree() {
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
    requestAnimationFrame(() => {
      drawLines();
      const card = tree.querySelector('.person.focus');
      if (card) card.scrollIntoView({ block: 'nearest', inline: 'center' });
      scroll.scrollTop = 0;
    });
  }

  function element(tag, className, label) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (label !== undefined) node.textContent = label;
    return node;
  }

  function personButton(id, subtitle) {
    const button = element('button', 'relative-card');
    button.type = 'button';
    const name = element('strong', '', people.get(id).name);
    const meta = element('span', 'relative-meta', subtitle || (people.get(id).deceased ? 'לזכרו/ה' : 'לצפייה במשפחה'));
    button.append(name, meta, element('span', 'relative-arrow', '←'));
    button.addEventListener('click', () => select(id, true, true));
    return button;
  }

  function section(title, ids, subtitle) {
    if (!ids.length) return null;
    const box = element('section', 'relation-section');
    const heading = element('div', 'relation-heading');
    heading.append(element('h3', '', title), element('span', 'relation-count', String(ids.length)));
    const list = element('div', 'relative-list');
    for (const id of ids) list.append(personButton(id, subtitle));
    box.append(heading, list);
    return box;
  }

  function navigation() {
    const wrap = element('div', 'person-navigation');
    if (trail.length > 1) {
      const back = element('button', 'back-person', '→ חזרה אל ' + people.get(trail[trail.length - 2]).name);
      back.type = 'button';
      back.addEventListener('click', () => {
        trail.pop();
        focusId = trail[trail.length - 1];
        openBranch = null;
        history.replaceState(null, '', '#' + encodeURIComponent(focusId));
        render();
      });
      wrap.append(back);
    }
    return wrap;
  }

  function renderCard() {
    const id = focusId;
    cardView.replaceChildren();
    cardView.append(navigation());
    const hero = element('div', 'person-hero');
    hero.append(element('span', 'hero-kicker', 'המשפחה של'), element('h2', '', people.get(id).name));
    if (people.get(id).deceased) hero.append(element('span', 'memory-label', 'לזכרו/ה'));
    cardView.append(hero);
    const relations = element('div', 'relations-grid');
    for (const group of [
      section('הורים', parents(id)),
      section('בני ובנות זוג', sort(partners(id))),
      section('אחים ואחיות', siblings(id)),
      section('ילדים', sort(children(id))),
    ]) if (group) relations.append(group);
    if (!relations.children.length) relations.append(element('p', 'no-relations', 'אין עדיין קשרים נוספים לאדם הזה בעץ.'));
    cardView.append(relations);
  }

  function addBranch(key, title, description, ids, label) {
    if (!ids.length) return;
    const folder = element('div', 'branch-folder');
    const trigger = element('button', 'branch-trigger');
    trigger.type = 'button';
    trigger.setAttribute('aria-expanded', String(openBranch === key));
    const symbol = element('span', 'folder-symbol', '▤');
    symbol.setAttribute('aria-hidden', 'true');
    trigger.append(symbol);
    const wording = element('span', 'branch-wording');
    wording.append(element('strong', '', title), element('small', '', description));
    trigger.append(wording, element('span', 'folder-count', String(ids.length)), element('span', 'folder-chevron', openBranch === key ? '⌃' : '⌄'));
    trigger.addEventListener('click', () => { openBranch = openBranch === key ? null : key; renderBranches(); });
    folder.append(trigger);
    if (openBranch === key) {
      const list = element('div', 'branch-contents');
      for (const id of ids) list.append(personButton(id, label));
      folder.append(list);
    }
    branchesView.append(folder);
  }

  function renderBranches() {
    const id = focusId;
    branchesView.replaceChildren();
    branchesView.append(navigation());
    const intro = element('div', 'branches-intro');
    intro.append(element('span', 'hero-kicker', 'יוצאים מהמשפחה של'), element('h2', '', people.get(id).name), element('p', '', 'בחרו ענף, ואז אדם להמשך המסע.'));
    branchesView.append(intro);
    const directParents = parents(id);
    for (const parentId of directParents) {
      const next = sort(unique([parentId, ...parents(parentId), ...siblings(parentId)]));
      addBranch('parent-' + parentId, 'הענף של ' + people.get(parentId).name, 'הדור הקודם והמשפחה שלו', next);
    }
    const partnerIds = sort(partners(id));
    for (const partnerId of partnerIds) {
      const next = sort(unique([partnerId, ...children(id).filter(childId => ownFamilies(id).some(family => family.parents.includes(partnerId) && family.children.includes(childId)))]));
      addBranch('partner-' + partnerId, 'המשפחה עם ' + people.get(partnerId).name, 'בן/בת זוג והילדים המשותפים', next);
    }
    const ownChildren = sort(children(id));
    const listedChildren = new Set(ownFamilies(id).filter(family => family.parents.some(parentId => partnerIds.includes(parentId))).flatMap(family => family.children));
    const otherChildren = ownChildren.filter(childId => !listedChildren.has(childId));
    if (otherChildren.length) addBranch('children', 'הדור הבא', 'ילדים והמשך המשפחה', otherChildren);
    const ownSiblings = siblings(id);
    addBranch('siblings', 'אחים ואחיות', 'המשפחות שצמחו מאותו דור', ownSiblings);
    if (!branchesView.querySelector('.branch-folder')) branchesView.append(element('p', 'no-relations', 'אין עדיין ענפים נוספים לאדם הזה בעץ. אפשר לחפש מישהו אחר למעלה.'));
  }

  function render() {
    document.getElementById('focus-name').textContent = people.get(focusId).name;
    document.getElementById('focus-info').textContent = people.get(focusId).deceased ? 'לזכרו/ה' : '';
    if (activeView === 'card') renderCard();
    if (activeView === 'branches') renderBranches();
    if (activeView === 'tree') renderTree();
  }

  function setView(view) {
    activeView = view;
    for (const button of document.querySelectorAll('.view-tab')) {
      const selected = button.dataset.view === view;
      button.setAttribute('aria-selected', String(selected));
      document.getElementById('panel-' + button.dataset.view).hidden = !selected;
    }
    render();
  }

  function hideResults() {
    results.hidden = true;
    search.setAttribute('aria-expanded', 'false');
  }

  function select(id, updateHash = true, remember = false) {
    if (!people.has(id)) return;
    focusId = id;
    if (remember) {
      const existing = trail.indexOf(id);
      trail = existing >= 0 ? trail.slice(0, existing + 1) : [...trail, id];
    } else trail = [id];
    openBranch = null;
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
  for (const button of document.querySelectorAll('.view-tab')) button.addEventListener('click', () => setView(button.dataset.view));
  document.getElementById('reset').addEventListener('click', () => select(initialId));
  window.addEventListener('resize', () => { if (activeView === 'tree') drawLines(); });
  window.addEventListener('hashchange', () => select(decodeURIComponent(location.hash.slice(1)), false));
  select(people.has(decodeURIComponent(location.hash.slice(1))) ? decodeURIComponent(location.hash.slice(1)) : initialId, false);
})();
