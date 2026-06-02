let allTurmas = [];
let selectedTurma = null;

async function loadData(){
  const saved = window.localStorage.getItem('turmas');
  if(saved){
    try{return JSON.parse(saved);}catch(e){console.warn('localStorage corrompido, carregando de data.json', e);}
  }
  const res = await fetch('data.json');
  const db = await res.json();
  return db.turmas;
}

function persistData(){
  window.localStorage.setItem('turmas', JSON.stringify(allTurmas));
}

function parseScheduleText(text){
  return text.split('\n')
    .map(line=>line.trim())
    .filter(line=>line)
    .map(line=>{
      const parts = line.split('|').map(p=>p.trim());
      return {day: parts[0]||'', time: parts[1]||'', subject: parts[2]||''};
    });
}

function scheduleToText(schedule){
  return (schedule||[]).map(item=>`${item.day} | ${item.time} | ${item.subject}`).join('\n');
}

function el(tag, cls, txt){
  const e = document.createElement(tag);
  if(cls) e.className = cls;
  if(txt != null) e.textContent = txt;
  return e;
}

function renderList(turmas){
  const ul = document.getElementById('turmaList'); ul.innerHTML = '';
  const courseFilter = document.getElementById('courseFilter').value;
  const filteredTurmas = courseFilter ? turmas.filter(t => t.course === courseFilter) : turmas;
  const grouped = {};
  filteredTurmas.forEach(t => {
    if(!grouped[t.course]) grouped[t.course] = [];
    grouped[t.course].push(t);
  });
  const courses = Object.keys(grouped).sort();
  courses.forEach(course => {
    if(!courseFilter){
      const header = el('li','course-header', course);
      ul.appendChild(header);
    }
    grouped[course].sort((a,b)=> a.name.localeCompare(b.name, 'pt-BR', {numeric:true}));
    grouped[course].forEach(t => {
      const classes = ['turma-item'];
      if(selectedTurma && t.id === selectedTurma.id) classes.push('selected');
      const li = el('li', classes.join(' '), `${t.name} — ${t.year}`);
      li.addEventListener('click', ()=> selectTurma(t));
      ul.appendChild(li);
    });
  });
}

function toggleMenu(open){
  const sideMenu = document.getElementById('sideMenu');
  const overlay = document.getElementById('menuOverlay');
  const button = document.getElementById('menuToggle');
  const isOpen = open ?? !sideMenu.classList.contains('open');
  sideMenu.classList.toggle('open', isOpen);
  overlay.classList.toggle('open', isOpen);
  button.classList.toggle('open', isOpen);
  button.setAttribute('aria-expanded', String(isOpen));
  sideMenu.setAttribute('aria-hidden', String(!isOpen));
  document.body.classList.toggle('menu-open', isOpen);
}

function parseTime(t){
  const [a,b] = t.split('-').map(s=>s.trim());
  const toMin = s=>{const [hh,mm]=s.split(':').map(Number); return hh*60+mm};
  return {start: toMin(a), end: toMin(b)};
}

const SLOT_DEFINITIONS = [
  {label:'07:00-07:50', start:parseTime('07:00-07:50').start, end:parseTime('07:00-07:50').end},
  {label:'07:50-08:40', start:parseTime('07:50-08:40').start, end:parseTime('07:50-08:40').end},
  {label:'08:40-09:30', start:parseTime('08:40-09:30').start, end:parseTime('08:40-09:30').end},
  {label:'09:50-10:40', start:parseTime('09:50-10:40').start, end:parseTime('09:50-10:40').end},
  {label:'10:40-11:30', start:parseTime('10:40-11:30').start, end:parseTime('10:40-11:30').end},
  {label:'11:30-12:20', start:parseTime('11:30-12:20').start, end:parseTime('11:30-12:20').end}
];

const WEEK_DAYS = ['Segunda','Terça','Quarta','Quinta','Sexta'];

function selectTurma(t){
  selectedTurma = t;
  renderList(allTurmas);
  showDetails(t);
}

function clearDetails(){
  const c = document.getElementById('detailsContent');
  c.innerHTML = 'Selecione uma turma à esquerda ou pesquise.';
}

function renderWeeklySchedule(t){
  const c = document.getElementById('detailsContent');
  c.appendChild(el('h3',null,`${t.name} — ${t.room}`));
  c.appendChild(el('div','meta',`${t.year} • ${t.course} • ${t.location}`));
  const teachers = el('div','teachers');
  teachers.appendChild(el('strong',null,'Professores: '));
  teachers.appendChild(el('span',null,t.teachers.join(', ')));
  c.appendChild(teachers);
  c.appendChild(el('div','small','Quadro de horários (Semana: Segunda–Sexta)'));

  const table = document.createElement('table'); table.className = 'timetable';
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  headRow.appendChild(document.createElement('th'));
  WEEK_DAYS.forEach(d=>{ const th = document.createElement('th'); th.textContent = d; headRow.appendChild(th); });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  const grid = Array.from({length:SLOT_DEFINITIONS.length}, ()=>Array.from({length:WEEK_DAYS.length}, ()=>[]));
  (t.schedule||[]).forEach(s=>{
    const dayIdx = WEEK_DAYS.indexOf(s.day);
    if(dayIdx === -1) return;
    if(s.time){
      try{
        const parsed = parseTime(s.time);
        SLOT_DEFINITIONS.forEach((slot,si)=>{
          if(parsed.start < slot.end && parsed.end > slot.start){
            grid[si][dayIdx].push(s.subject || '');
          }
        });
      }catch(e){
        for(let si=0;si<SLOT_DEFINITIONS.length;si++){
          if(!grid[si][dayIdx].length){ grid[si][dayIdx].push(s.subject||''); break; }
        }
      }
    }
  });

  for(let si=0; si<SLOT_DEFINITIONS.length; si++){
    if(si===3){
      const ir = document.createElement('tr'); ir.className = 'interval-row';
      const timeCell = document.createElement('td'); timeCell.className='timecell'; timeCell.textContent = '09:30-09:50'; ir.appendChild(timeCell);
      const spanCell = document.createElement('td'); spanCell.colSpan = WEEK_DAYS.length; spanCell.className='intervalcell';
      spanCell.textContent = 'Intervalo — 09:30-09:50';
      ir.appendChild(spanCell);
      tbody.appendChild(ir);
    }

    const slot = SLOT_DEFINITIONS[si];
    const tr = document.createElement('tr');
    const timeCell = document.createElement('td'); timeCell.className='timecell'; timeCell.textContent = slot.label; tr.appendChild(timeCell);
    for(let di=0; di<WEEK_DAYS.length; di++){
      const td = document.createElement('td');
      const subjects = grid[si][di];
      if(subjects.length) td.innerHTML = subjects.join('<br>'); else { td.className='emptycell'; td.textContent='—'; }
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  c.appendChild(table);
}

function showDetails(t){
  const c = document.getElementById('detailsContent'); c.innerHTML = '';
  const top = el('div','detail-actions');
  const editBtn = el('button','btn', 'Editar turma');
  editBtn.type = 'button';
  editBtn.addEventListener('click', ()=> showEditForm(t));
  const deleteBtn = el('button','btn btn-secondary', 'Excluir turma');
  deleteBtn.type = 'button';
  deleteBtn.addEventListener('click', ()=> deleteTurma(t));
  top.appendChild(editBtn);
  top.appendChild(deleteBtn);
  c.appendChild(top);
  renderWeeklySchedule(t);
}

function showEditForm(t){
  const isNew = !t;
  const c = document.getElementById('detailsContent');
  c.innerHTML = '';
  const title = el('h3',null, isNew ? 'Criar nova turma' : `Editar ${t.name}`);
  c.appendChild(title);

  const form = document.createElement('form'); form.className = 'admin-form'; form.id = 'adminForm';
  const nameLabel = el('label',null,'Nome da turma');
  const nameInput = document.createElement('input'); nameInput.name = 'name'; nameInput.value = t ? t.name : '';
  const courseLabel = el('label',null,'Curso');
  const courseInput = document.createElement('input'); courseInput.name = 'course'; courseInput.value = t ? t.course : '';
  const yearLabel = el('label',null,'Ano');
  const yearInput = document.createElement('input'); yearInput.name = 'year'; yearInput.value = t ? t.year : '';
  const roomLabel = el('label',null,'Sala');
  const roomInput = document.createElement('input'); roomInput.name = 'room'; roomInput.value = t ? t.room : '';
  const locationLabel = el('label',null,'Localização / Bloco');
  const locationInput = document.createElement('input'); locationInput.name = 'location'; locationInput.value = t ? t.location : '';
  const teachersLabel = el('label',null,'Professores (separados por vírgula)');
  const teachersInput = document.createElement('input'); teachersInput.name = 'teachers'; teachersInput.value = t ? t.teachers.join(', ') : '';
  const scheduleLabel = el('label',null,'Horários (Linha: Dia | Hora | Disciplina)');
  const scheduleTextarea = document.createElement('textarea'); scheduleTextarea.name = 'schedule'; scheduleTextarea.value = t ? scheduleToText(t.schedule) : 'Segunda | 07:00-07:50 | Matematica\n...';

  form.appendChild(nameLabel); form.appendChild(nameInput);
  form.appendChild(courseLabel); form.appendChild(courseInput);
  form.appendChild(yearLabel); form.appendChild(yearInput);
  form.appendChild(roomLabel); form.appendChild(roomInput);
  form.appendChild(locationLabel); form.appendChild(locationInput);
  form.appendChild(teachersLabel); form.appendChild(teachersInput);
  form.appendChild(scheduleLabel); form.appendChild(scheduleTextarea);

  const buttonRow = el('div','detail-actions');
  const saveBtn = el('button','btn', isNew ? 'Salvar nova turma' : 'Salvar alterações');
  saveBtn.type = 'submit';
  const cancelBtn = el('button','btn btn-secondary','Cancelar');
  cancelBtn.type = 'button';
  cancelBtn.addEventListener('click', ()=> {
    if(isNew){ clearDetails(); selectedTurma = null; renderList(allTurmas);} else { showDetails(t);}  
  });
  buttonRow.appendChild(saveBtn);
  buttonRow.appendChild(cancelBtn);
  form.appendChild(buttonRow);

  form.addEventListener('submit', event => {
    event.preventDefault();
    const updated = {
      id: t ? t.id : (allTurmas.reduce((max, item)=> Math.max(max, item.id), 0) + 1),
      name: nameInput.value.trim() || 'Nova turma',
      course: courseInput.value.trim() || 'Sem curso',
      year: yearInput.value.trim() || 'Sem ano',
      room: roomInput.value.trim() || 'Sem sala',
      location: locationInput.value.trim() || 'Sem bloco',
      teachers: teachersInput.value.split(',').map(item=>item.trim()).filter(Boolean),
      schedule: parseScheduleText(scheduleTextarea.value)
    };
    if(t){
      allTurmas = allTurmas.map(item=> item.id === t.id ? updated : item);
    } else {
      allTurmas.push(updated);
    }
    persistData();
    selectedTurma = updated;
    populateCourseFilter();
    renderList(allTurmas);
    showDetails(updated);
  });

  c.appendChild(form);
}

function deleteTurma(t){
  if(!confirm(`Deseja excluir a turma ${t.name}?`)) return;
  allTurmas = allTurmas.filter(item => item.id !== t.id);
  persistData();
  selectedTurma = null;
  renderList(allTurmas);
  clearDetails();
  populateCourseFilter();
}

function populateCourseFilter(){
  const select = document.getElementById('courseFilter');
  const current = select.value;
  select.innerHTML = '<option value="">Todos os cursos</option>';
  const courses = Array.from(new Set(allTurmas.map(t => t.course))).sort();
  courses.forEach(c=>{
    const opt = el('option',null,c);
    opt.value = c;
    if(c === current) opt.selected = true;
    select.appendChild(opt);
  });
}

function setupSearch(turmas){
  const input = document.getElementById('search');
  const select = document.getElementById('courseFilter');

  function applyFilter(){
    const q = input.value.trim().toLowerCase();
    const course = select.value;
    const filtered = turmas.filter(t => {
      if(course && t.course !== course) return false;
      if(!q) return true;
      return t.name.toLowerCase().includes(q) || t.room.toLowerCase().includes(q) || t.location.toLowerCase().includes(q) || t.course.toLowerCase().includes(q) || t.year.toLowerCase().includes(q) || t.teachers.join(' ').toLowerCase().includes(q) || (t.schedule||[]).some(s=>s.subject.toLowerCase().includes(q));
    });
    renderList(filtered);
    if(filtered.length === 1) selectTurma(filtered[0]);
    else if(!filtered.some(item=> selectedTurma && item.id === selectedTurma.id)) selectedTurma = null;
    if(!selectedTurma){ clearDetails(); }
  }

  input.addEventListener('input', applyFilter);
  select.addEventListener('change', applyFilter);
}

document.addEventListener('DOMContentLoaded', async ()=>{
  const menuToggle = document.getElementById('menuToggle');
  const menuOverlay = document.getElementById('menuOverlay');
  if(menuToggle) menuToggle.addEventListener('click', ()=> toggleMenu());
  if(menuOverlay) menuOverlay.addEventListener('click', ()=> toggleMenu(false));

  const courseFilterEl = document.getElementById('courseFilter');
  const turmaListEl = document.getElementById('turmaList');
  if(courseFilterEl && turmaListEl){
    allTurmas = await loadData();
    populateCourseFilter();
    renderList(allTurmas);
    setupSearch(allTurmas);
    document.getElementById('newTurmaBtn').addEventListener('click', ()=> showEditForm(null));
  }
});
