(function () {
  'use strict';
  const C = window.CarPlanCore;
  let state = C.loadState();
  let activeTab = 'dashboard';
  const view = document.getElementById('view');
  const saveIndicator = document.getElementById('saveIndicator');

  function save() {
    C.saveState(state);
    saveIndicator.textContent = 'Сохранено';
    saveIndicator.classList.remove('warning');
    setTimeout(() => saveIndicator.textContent = 'Сохранено', 600);
  }
  function markChanged() { saveIndicator.textContent = 'Изменено'; saveIndicator.classList.add('warning'); }
  function setState(updater) { updater(state); state = C.ensureState(state); save(); render(); }
  function html(strings, ...values) { return strings.map((s, i) => s + (values[i] ?? '')).join(''); }
  function esc(v) { return String(v ?? '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s])); }
  function money(n) { return C.formatMoney(n); }

  function priorityCard(priority, summary) {
    const target = summary.totals.target[priority] || 0;
    const saved = summary.saved[priority] || 0;
    const left = Math.max(0, target - saved);
    const pct = target > 0 ? Math.min(100, saved / target * 100) : 100;
    const date = summary.closedAt[priority] ? C.formatDate(summary.closedAt[priority]) : 'Не закрыто';
    return html`<section class="card priority-card">
      <div class="card-head">
        <div><span class="badge ${priority}">${priority}</span><h2>Приоритет ${priority}</h2></div>
        <span class="date-chip">${date}</span>
      </div>
      <div class="progress"><div class="progress-fill" style="width:${pct}%"></div></div>
      <div class="money-grid">
        <div><small>Цель</small><b>${money(target)}</b></div>
        <div><small>Накоплено</small><b>${money(saved)}</b></div>
        <div><small>Осталось</small><b>${money(left)}</b></div>
      </div>
    </section>`;
  }

  function renderDashboard() {
    const summary = C.computePlan(state);
    const next = ['A','B','C','D'].find(p => summary.rem[p] > 0) || 'все закрыто';
    const currentMonth = summary.rows.find(r => r.toPriority > 0) || summary.rows[0];
    view.innerHTML = html`
      <div class="kpi-grid">
        <div class="kpi"><small>Следующий приоритет</small><strong>${next}</strong></div>
        <div class="kpi"><small>Комната накоплено</small><strong>${money(summary.roomTotal)}</strong></div>
        <div class="kpi"><small>В приоритет в первом месяце</small><strong>${money(currentMonth.toPriority)}</strong></div>
        <div class="kpi"><small>Расходы по умолчанию</small><strong>${money(state.settings.defaultExpenses)}</strong></div>
      </div>
      <p class="section-title">Прогресс</p>
      ${['A','B','C','D'].map(p => priorityCard(p, summary)).join('')}
      <section class="card">
        <h3>Правило месяца</h3>
        <p><b>Доход - расходы - комната = в приоритет.</b> Свободные деньги идут сначала в A, потом B, потом C, потом D.</p>
        <p>Пример: 250 000 - 140 000 - 0 = <b>110 000 ₽</b> в приоритет.</p>
      </section>`;
  }

  function renderPlan() {
    const summary = C.computePlan(state);
    view.innerHTML = html`
      <div class="toolbar">
        <button class="btn primary" data-action="add-months">+ 12 месяцев</button>
        <button class="btn" data-action="scroll-current">К текущему месяцу</button>
      </div>
      ${summary.rows.map(row => monthCard(row)).join('')}`;
  }

  function monthCard(row) {
    const statusClass = row.status === 'OK' || row.status.includes('закрыт') ? 'ok' : 'warning';
    return html`<section class="card month-card" id="month-${row.iso}">
      <div class="month-summary">
        <div>
          <div class="month-title">${row.index}. ${row.label}</div>
          <div class="month-status">Куда ушло: <b>${row.goesTo}</b> · ${esc(row.status)}</div>
        </div>
        <span class="pill ${statusClass}">${money(row.toPriority)}</span>
      </div>
      <div class="form-grid">
        ${numberField('Доход', row.iso, 'income', row.income)}
        ${numberField('Расходы', row.iso, 'expenses', row.expenses)}
        ${numberField('Комната', row.iso, 'room', row.roomInput)}
      </div>
      <div class="month-money">
        <div><small>В приоритет</small><b>${money(row.toPriority)}</b></div>
        <div><small>Комната факт</small><b>${money(row.roomFact)}</b></div>
        <div><small>Остаток A</small><b>${money(row.rem.A)}</b></div>
        <div><small>Остаток B</small><b>${money(row.rem.B)}</b></div>
      </div>
      <div class="priority-line">
        <span>A: ${money(row.pay.A)}</span><span>B: ${money(row.pay.B)}</span><span>C: ${money(row.pay.C)}</span><span>D: ${money(row.pay.D)}</span>
      </div>
      <div class="field" style="margin-top:10px"><label>Комментарий</label><textarea data-month="${row.iso}" data-key="note" placeholder="Например: премия, ремонт, незапланированная трата">${esc(row.note)}</textarea></div>
    </section>`;
  }

  function numberField(label, iso, key, value) {
    return html`<div class="field"><label>${label}</label><input inputmode="numeric" type="number" min="0" step="100" value="${Math.round(value)}" data-month="${iso}" data-key="${key}" /></div>`;
  }

  function renderBudget() {
    const summary = C.computePlan(state);
    view.innerHTML = html`
      <section class="card"><h3>Бюджет работ</h3><p>Можно уточнять суммы. План пересчитается сразу.</p></section>
      ${state.budget.map((item, idx) => html`<section class="card budget-item">
        <span class="badge ${item.priority}">${item.priority}</span>
        <div class="budget-name">${esc(item.name)}</div>
        <input type="number" min="0" step="100" value="${Math.round(C.toNumber(item.amount))}" data-budget-index="${idx}" />
      </section>`).join('')}
      <section class="card"><h3>Итого с буфером</h3>
        <div class="money-grid"><div><small>A</small><b>${money(summary.totals.target.A)}</b></div><div><small>B</small><b>${money(summary.totals.target.B)}</b></div><div><small>C</small><b>${money(summary.totals.target.C)}</b></div></div>
      </section>`;
  }

  function renderSettings() {
    const s = state.settings;
    const fields = [
      ['startDate','Дата старта','date'], ['deadlineA','Дедлайн A','date'], ['deadlineB','Дедлайн B','date'], ['deadlineC','Дедлайн C','date'],
      ['defaultIncome','Доход по умолчанию','number'], ['defaultExpenses','Расходы без комнаты','number'], ['maxRoom','Комната максимум','number'], ['defaultRoom','Комната по умолчанию','number'],
      ['startCash','Стартовый остаток','number'], ['startRoom','Комната уже накоплено','number'], ['reserve','Резерв безопасности','number'],
      ['bufferAB','Буфер A/B','number'], ['bufferC','Буфер C','number'], ['bufferD','Буфер D','number'], ['months','Месяцев в плане','number']
    ];
    view.innerHTML = html`<section class="card"><h3>Вводные</h3><p>Меняй аккуратно. Все сохраняется на телефоне автоматически.</p></section>
      <section class="card settings-grid">${fields.map(([key,label,type]) => html`<div class="field"><label>${label}</label><input type="${type}" step="${key.startsWith('buffer') ? '0.01' : '1'}" value="${esc(s[key])}" data-setting="${key}" /></div>`).join('')}</section>`;
  }

  function renderData() {
    const json = JSON.stringify(C.ensureState(state), null, 2);
    view.innerHTML = html`<section class="card">
        <h3>Экспорт и импорт</h3>
        <p>Делай экспорт перед крупными правками. Данные хранятся локально в браузере.</p>
        <div class="toolbar">
          <button class="btn primary" data-action="export-json">Скачать JSON</button>
          <label class="btn">Импорт JSON<input type="file" accept="application/json" data-action="import-json" hidden></label>
          <button class="btn" data-action="export-csv">Скачать CSV</button>
          <button class="btn danger" data-action="reset">Сбросить</button>
        </div>
      </section>
      <section class="card"><h3>Текущие данные</h3><div class="data-box">${esc(json)}</div></section>`;
  }

  function render() {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === activeTab));
    if (activeTab === 'dashboard') renderDashboard();
    if (activeTab === 'plan') renderPlan();
    if (activeTab === 'budget') renderBudget();
    if (activeTab === 'settings') renderSettings();
    if (activeTab === 'data') renderData();
  }

  document.querySelector('.bottom-nav').addEventListener('click', e => {
    const btn = e.target.closest('[data-tab]');
    if (!btn) return;
    activeTab = btn.dataset.tab;
    render();
  });

  view.addEventListener('input', e => {
    const el = e.target;
    if (el.dataset.month) {
      const iso = el.dataset.month;
      const key = el.dataset.key;
      state.months[iso] = state.months[iso] || {};
      state.months[iso][key] = key === 'note' ? el.value : C.toNumber(el.value);
      markChanged(); save(); render();
    }
    if (el.dataset.setting) {
      const key = el.dataset.setting;
      state.settings[key] = el.type === 'date' ? el.value : C.toNumber(el.value);
      markChanged(); save(); render();
    }
    if (el.dataset.budgetIndex) {
      state.budget[Number(el.dataset.budgetIndex)].amount = C.toNumber(el.value);
      markChanged(); save(); render();
    }
  });

  view.addEventListener('click', async e => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    if (action === 'add-months') {
      setState(s => { s.settings.months = C.toNumber(s.settings.months, 48) + 12; });
    }
    if (action === 'scroll-current') {
      document.querySelector('.month-card')?.scrollIntoView({behavior:'smooth', block:'start'});
    }
    if (action === 'export-json') download('car-plan-data.json', JSON.stringify(C.ensureState(state), null, 2), 'application/json');
    if (action === 'export-csv') download('car-plan-months.csv', buildCsv(), 'text/csv;charset=utf-8');
    if (action === 'reset' && confirm('Сбросить все данные приложения?')) {
      state = C.clone(C.DEFAULT_STATE); save(); render();
    }
  });

  view.addEventListener('change', e => {
    if (e.target.dataset.action === 'import-json') {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          state = C.ensureState(JSON.parse(reader.result));
          save(); render(); alert('Импорт готов');
        } catch (err) { alert('Не удалось импортировать JSON'); }
      };
      reader.readAsText(file);
    }
  });

  function download(name, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function buildCsv() {
    const s = C.computePlan(state);
    const header = ['month','income','expenses','room','to_priority','goes_to','A','B','C','D','left_A','left_B','left_C','left_D','room_total','status'];
    const rows = s.rows.map(r => [r.label, r.income, r.expenses, r.roomFact, r.toPriority, r.goesTo, r.pay.A, r.pay.B, r.pay.C, r.pay.D, r.rem.A, r.rem.B, r.rem.C, r.rem.D, r.roomTotal, r.status]);
    return [header, ...rows].map(row => row.map(v => '"' + String(v).replace(/"/g,'""') + '"').join(';')).join('\n');
  }

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  render();
})();
