(function () {
  'use strict';

  const C = window.PriorityCashCore;
  let state = C.loadState();
  let activeTab = 'dashboard';
  let saveTimer = null;

  const view = document.getElementById('view');
  const saveIndicator = document.getElementById('saveIndicator');
  const topSubtitle = document.getElementById('topSubtitle');

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
  }

  function money(value) { return C.formatMoney(value); }
  function priorityInfo(priority) { return state.settings.priorities[priority] || C.DEFAULT_PRIORITIES[priority]; }

  function applyTheme() {
    document.documentElement.dataset.theme = state.settings.theme || 'auto';
    topSubtitle.textContent = `${state.settings.userName ? state.settings.userName + ' · ' : ''}свободные деньги идут в приоритеты`;
  }

  function saveSoon() {
    clearTimeout(saveTimer);
    saveIndicator.textContent = 'Сохраняю...';
    saveIndicator.classList.add('dirty');
    saveTimer = setTimeout(() => {
      state = C.ensureState(state);
      C.saveState(state);
      saveIndicator.textContent = 'Сохранено';
      saveIndicator.classList.remove('dirty');
      applyTheme();
    }, 250);
  }

  function saveNow() {
    clearTimeout(saveTimer);
    state = C.ensureState(state);
    C.saveState(state);
    saveIndicator.textContent = 'Сохранено';
    saveIndicator.classList.remove('dirty');
    applyTheme();
  }

  function render() {
    applyTheme();
    document.querySelectorAll('.nav-btn').forEach(button => {
      button.classList.toggle('active', button.dataset.tab === activeTab);
    });
    if (activeTab === 'dashboard') renderDashboard();
    if (activeTab === 'plan') renderPlan();
    if (activeTab === 'budget') renderBudget();
    if (activeTab === 'settings') renderSettings();
    if (activeTab === 'data') renderData();
  }

  function priorityCard(priority, summary) {
    const info = priorityInfo(priority);
    const target = summary.totals.target[priority] || 0;
    const saved = summary.saved[priority] || 0;
    const left = Math.max(0, target - saved);
    const percent = target > 0 ? Math.min(100, saved / target * 100) : 100;
    const closeDate = summary.closedAt[priority] ? C.formatDate(summary.closedAt[priority]) : 'Не закрыто';
    return `
      <section class="card priority-card">
        <div class="priority-head">
          <div class="priority-title">
            <span class="badge ${priority}">${priority}</span>
            <div>
              <h3>${esc(info.title)}</h3>
              <p style="margin:3px 0 0">${esc(info.description)}</p>
            </div>
          </div>
          <span class="date-chip">${closeDate}</span>
        </div>
        <div class="progress"><div class="progress-fill" style="width:${percent}%"></div></div>
        <div class="money-grid">
          <div><small>Цель</small><b>${money(target)}</b></div>
          <div><small>Накоплено</small><b>${money(saved)}</b></div>
          <div><small>Осталось</small><b>${money(left)}</b></div>
        </div>
      </section>`;
  }

  function renderDashboard() {
    const summary = C.computePlan(state);
    const nextPriority = ['A', 'B', 'C', 'D'].find(priority => summary.rem[priority] > 0) || 'все закрыто';
    const goalName = esc(state.settings.goalName);
    view.innerHTML = `
      <section class="card hero">
        <h2>${state.settings.userName ? esc(state.settings.userName) + ', ' : ''}твой финансовый водопад</h2>
        <p>Остаток после расходов и “${goalName}” идет в первый незакрытый приоритет.</p>
        <div class="kpi-grid">
          <div class="kpi"><small>Следующий приоритет</small><strong>${esc(nextPriority)}</strong></div>
          <div class="kpi"><small>${goalName} накоплено</small><strong>${money(summary.goalTotal)}</strong></div>
        </div>
      </section>
      <section class="help-box"><b>Формула:</b> доход - расходы - ${goalName} = в приоритет.</section>
      <p class="section-title">Приоритеты</p>
      ${['A', 'B', 'C', 'D'].map(priority => priorityCard(priority, summary)).join('')}`;
  }

  function renderMonthCard(row) {
    const goalName = esc(state.settings.goalName);
    const statusClass = row.status === 'OK' || row.status.includes('закрыт') ? 'ok' : 'warning';
    return `
      <section class="card month-card" id="m-${row.iso}" data-month-card="${row.iso}">
        <div class="month-top">
          <div>
            <div class="month-title">${row.index}. ${row.label}</div>
            <div class="month-sub">Куда ушло: <b data-out="goesTo">${row.goesTo}</b> · <span data-out="status">${esc(row.status)}</span></div>
          </div>
          <span class="pill ${statusClass}" data-out="toPriority">${money(row.toPriority)}</span>
        </div>
        <div class="form-grid">
          ${numberField('Доход', row.iso, 'income', row.income)}
          ${numberField('Расходы план', row.iso, 'expenses', row.expenses)}
          ${numberField('Расходы факт', row.iso, 'actualExpenses', row.actualExpenses)}
          ${numberField(goalName, row.iso, 'goal', row.goalInput)}
        </div>
        <div class="month-money">
          <div><small>В приоритет</small><b data-out="toPriority2">${money(row.toPriority)}</b></div>
          <div><small>${goalName} факт</small><b data-out="goalFact">${money(row.goalFact)}</b></div>
          <div><small>Остаток A</small><b data-out="remA">${money(row.rem.A)}</b></div>
          <div><small>Остаток B</small><b data-out="remB">${money(row.rem.B)}</b></div>
        </div>
        <div class="priority-line">
          <span data-out="payA">A ${money(row.pay.A)}</span>
          <span data-out="payB">B ${money(row.pay.B)}</span>
          <span data-out="payC">C ${money(row.pay.C)}</span>
          <span data-out="payD">D ${money(row.pay.D)}</span>
        </div>
        <details>
          <summary class="section-title">Календарь остатка</summary>
          <div class="calendar" data-calendar="${row.iso}">${renderCalendar(row)}</div>
        </details>
        <div class="field" style="margin-top:10px">
          <label>Комментарий</label>
          <textarea data-month="${row.iso}" data-key="note" placeholder="Например: премия, незапланированные траты">${esc(row.note)}</textarea>
        </div>
      </section>`;
  }

  function numberField(label, iso, key, value) {
    return `
      <div class="field">
        <label>${label}</label>
        <input inputmode="numeric" type="number" min="0" step="100" value="${Math.round(value)}" data-month="${iso}" data-key="${key}">
      </div>`;
  }

  function renderCalendar(row) {
    const date = C.dateFromISO(row.iso);
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay() || 7;
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
    const todayDay = isCurrentMonth ? today.getDate() : days;
    const base = Math.max(0, row.income - row.goalFact);
    const headers = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    let output = headers.map(day => `<div class="cal-head">${day}</div>`).join('');
    for (let i = 1; i < firstDay; i++) output += '<div class="cal-empty"></div>';
    for (let day = 1; day <= days; day++) {
      const planLeft = Math.max(0, base - row.expenses * day / days);
      const factLeft = Math.max(0, base - row.actualExpenses * Math.min(day, todayDay) / Math.max(1, todayDay));
      output += `
        <div class="cal-day ${isCurrentMonth && day === todayDay ? 'today' : ''}">
          <div class="num">${day}</div>
          <div class="plan">П ${Math.round(planLeft / 1000)}к</div>
          <div class="fact">Ф ${Math.round(factLeft / 1000)}к</div>
        </div>`;
    }
    return output;
  }

  function updateVisiblePlan() {
    const summary = C.computePlan(state);
    for (const row of summary.rows) {
      const card = view.querySelector(`[data-month-card="${row.iso}"]`);
      if (!card) continue;
      const setText = (key, value) => {
        const element = card.querySelector(`[data-out="${key}"]`);
        if (element) element.textContent = value;
      };
      setText('goesTo', row.goesTo);
      setText('status', row.status);
      setText('toPriority', money(row.toPriority));
      setText('toPriority2', money(row.toPriority));
      setText('goalFact', money(row.goalFact));
      setText('remA', money(row.rem.A));
      setText('remB', money(row.rem.B));
      setText('payA', `A ${money(row.pay.A)}`);
      setText('payB', `B ${money(row.pay.B)}`);
      setText('payC', `C ${money(row.pay.C)}`);
      setText('payD', `D ${money(row.pay.D)}`);
      const calendar = card.querySelector(`[data-calendar="${row.iso}"]`);
      if (calendar) calendar.innerHTML = renderCalendar(row);
    }
  }

  function renderPlan() {
    const summary = C.computePlan(state);
    view.innerHTML = `
      <div class="toolbar">
        <button class="btn primary" data-action="recalc">Полный пересчет</button>
        <button class="btn" data-action="add-months">+ 12 месяцев</button>
      </div>
      <section class="help-box">После изменения дохода, расходов или цели остатки пересчитываются сразу. Клавиатура не закрывается.</section>
      ${summary.rows.map(renderMonthCard).join('')}`;
  }

  function renderBudget() {
    const summary = C.computePlan(state);
    view.innerHTML = `
      <section class="card"><h3>Бюджет</h3><p>Добавляй любые цели и статьи. Каждый пользователь видит и меняет только свои данные.</p></section>
      <section class="card">
        <h3>Добавить строку</h3>
        <div class="add-budget">
          <div class="field"><label>Приоритет</label><select id="newPriority"><option>A</option><option>B</option><option>C</option><option>D</option></select></div>
          <div class="field"><label>Название</label><input id="newName" placeholder="Например: новый ноутбук"></div>
          <div class="field"><label>Сумма</label><input id="newAmount" type="number" min="0" step="100" placeholder="0"></div>
        </div>
        <div class="toolbar"><button class="btn primary" data-action="add-budget">Добавить</button></div>
      </section>
      ${state.budget.map((item, index) => `
        <section class="card budget-row">
          <span class="badge ${item.priority}">${item.priority}</span>
          <input value="${esc(item.name)}" data-budget-name="${index}">
          <input class="amount-input" type="number" min="0" step="100" value="${Math.round(C.toNumber(item.amount))}" data-budget-amount="${index}">
          <button class="btn danger delete-btn" data-delete-budget="${index}">×</button>
        </section>`).join('')}
      <section class="card">
        <h3>Итого с буфером</h3>
        <div class="money-grid">
          <div><small>A</small><b>${money(summary.totals.target.A)}</b></div>
          <div><small>B</small><b>${money(summary.totals.target.B)}</b></div>
          <div><small>C</small><b>${money(summary.totals.target.C)}</b></div>
        </div>
      </section>`;
  }

  function renderSettings() {
    const settings = state.settings;
    view.innerHTML = `
      <section class="card"><h3>Настройки пользователя</h3><p>У каждого пользователя свои данные. Здесь можно менять ник, тему, названия приоритетов и название регулярной цели.</p></section>
      <section class="card setting-two">
        <div class="field"><label>Ник пользователя</label><input value="${esc(settings.userName)}" data-setting-text="userName" placeholder="Например: Артем"></div>
        <div class="field"><label>Тема</label><select data-setting-text="theme">
          <option value="auto" ${settings.theme === 'auto' ? 'selected' : ''}>Как в телефоне</option>
          <option value="light" ${settings.theme === 'light' ? 'selected' : ''}>Светлая</option>
          <option value="dark" ${settings.theme === 'dark' ? 'selected' : ''}>Тёмная</option>
        </select></div>
      </section>
      <section class="card">
        <h3>Регулярная цель / отдельная статья</h3>
        <div class="field"><label>Название поля</label><input value="${esc(settings.goalName)}" data-setting-text="goalName" placeholder="Например: ремонт, отпуск, подушка"></div>
      </section>
      <section class="card">
        <h3>Названия приоритетов</h3>
        ${['A', 'B', 'C', 'D'].map(priority => `
          <div class="field"><label>${priority}: название</label><input value="${esc(settings.priorities[priority].title)}" data-priority-title="${priority}"></div>
          <div class="field"><label>${priority}: пояснение</label><textarea data-priority-desc="${priority}">${esc(settings.priorities[priority].description)}</textarea></div>
        `).join('')}
      </section>
      <section class="card settings-grid">
        ${settingFields().map(([key, label, type, step]) => `
          <div class="field"><label>${label}</label><input type="${type}" step="${step || 1}" value="${esc(settings[key])}" data-setting="${key}"></div>
        `).join('')}
      </section>`;
  }

  function settingFields() {
    return [
      ['startDate', 'Дата старта', 'date'],
      ['deadlineA', 'Дедлайн A', 'date'],
      ['deadlineB', 'Дедлайн B', 'date'],
      ['deadlineC', 'Дедлайн C', 'date'],
      ['defaultIncome', 'Доход по умолчанию', 'number'],
      ['defaultExpenses', 'Расходы план по умолчанию', 'number'],
      ['maxGoal', 'Лимит регулярной цели', 'number'],
      ['defaultGoal', 'Регулярная цель по умолчанию', 'number'],
      ['startCash', 'Стартовый остаток', 'number'],
      ['startGoal', 'Уже накоплено по регулярной цели', 'number'],
      ['reserve', 'Резерв', 'number'],
      ['bufferAB', 'Буфер A/B', 'number', '0.01'],
      ['bufferC', 'Буфер C', 'number', '0.01'],
      ['bufferD', 'Буфер D', 'number', '0.01'],
      ['months', 'Месяцев в плане', 'number']
    ];
  }

  function renderData() {
    view.innerHTML = `
      <section class="card"><h3>Экспорт и импорт</h3><p>Данные хранятся на устройстве пользователя. Чтобы перенести или сохранить данные, скачай JSON.</p>
        <div class="toolbar">
          <button class="btn primary" data-action="export-json">Скачать JSON</button>
          <label class="btn">Импорт JSON<input type="file" hidden accept="application/json" data-action="import-json"></label>
          <button class="btn" data-action="export-csv">Скачать CSV</button>
          <button class="btn danger" data-action="reset">Сбросить</button>
        </div>
      </section>
      <section class="card"><div class="data-box">${esc(JSON.stringify(C.ensureState(state), null, 2))}</div></section>`;
  }

  function download(name, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function buildCsv() {
    const summary = C.computePlan(state);
    const header = ['month', 'income', 'expenses_plan', 'expenses_fact', 'goal', 'to_priority', 'goes_to', 'A', 'B', 'C', 'D', 'left_A', 'left_B', 'left_C', 'left_D', 'goal_total', 'status'];
    const rows = summary.rows.map(row => [row.label, row.income, row.expenses, row.actualExpenses, row.goalFact, row.toPriority, row.goesTo, row.pay.A, row.pay.B, row.pay.C, row.pay.D, row.rem.A, row.rem.B, row.rem.C, row.rem.D, row.goalTotal, row.status]);
    return [header, ...rows].map(row => row.map(value => '"' + String(value).replace(/"/g, '""') + '"').join(';')).join('\n');
  }

  document.querySelector('.bottom-nav').addEventListener('click', event => {
    const button = event.target.closest('[data-tab]');
    if (!button) return;
    activeTab = button.dataset.tab;
    render();
  });

  view.addEventListener('input', event => {
    const element = event.target;
    if (element.dataset.month) {
      const iso = element.dataset.month;
      const key = element.dataset.key;
      state.months[iso] = state.months[iso] || {};
      state.months[iso][key] = key === 'note' ? element.value : C.toNumber(element.value);
      saveSoon();
      updateVisiblePlan();
      return;
    }
    if (element.dataset.setting) {
      state.settings[element.dataset.setting] = element.type === 'date' ? element.value : C.toNumber(element.value);
      saveSoon();
      return;
    }
    if (element.dataset.settingText) {
      state.settings[element.dataset.settingText] = element.value;
      saveSoon();
      applyTheme();
      return;
    }
    if (element.dataset.priorityTitle) {
      state.settings.priorities[element.dataset.priorityTitle].title = element.value;
      saveSoon();
      return;
    }
    if (element.dataset.priorityDesc) {
      state.settings.priorities[element.dataset.priorityDesc].description = element.value;
      saveSoon();
      return;
    }
    if (element.dataset.budgetAmount) {
      state.budget[Number(element.dataset.budgetAmount)].amount = C.toNumber(element.value);
      saveSoon();
      return;
    }
    if (element.dataset.budgetName) {
      state.budget[Number(element.dataset.budgetName)].name = element.value;
      saveSoon();
    }
  });

  view.addEventListener('change', event => {
    if (event.target.dataset.action === 'import-json') {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          state = C.ensureState(JSON.parse(reader.result));
          saveNow();
          render();
          alert('Импорт готов');
        } catch (_) {
          alert('Файл не похож на JSON приложения');
        }
      };
      reader.readAsText(file);
      return;
    }
    if (event.target.matches('input, textarea, select')) saveNow();
  });

  view.addEventListener('click', event => {
    const deleteButton = event.target.closest('[data-delete-budget]');
    if (deleteButton) {
      if (confirm('Удалить строку бюджета?')) {
        state.budget.splice(Number(deleteButton.dataset.deleteBudget), 1);
        saveNow();
        render();
      }
      return;
    }

    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;

    if (action === 'recalc') { saveNow(); render(); }
    if (action === 'add-months') {
      state.settings.months = C.toNumber(state.settings.months, 48) + 12;
      saveNow();
      render();
    }
    if (action === 'add-budget') {
      const priority = document.getElementById('newPriority').value;
      const name = document.getElementById('newName').value.trim();
      const amount = C.toNumber(document.getElementById('newAmount').value);
      if (!name) { alert('Введи название'); return; }
      state.budget.push({ priority, name, amount });
      saveNow();
      render();
    }
    if (action === 'export-json') download('prioritycash-data.json', JSON.stringify(C.ensureState(state), null, 2), 'application/json');
    if (action === 'export-csv') download('prioritycash-months.csv', buildCsv(), 'text/csv;charset=utf-8');
    if (action === 'reset' && confirm('Сбросить данные только на этом устройстве?')) {
      state = C.clone(C.DEFAULT_STATE);
      saveNow();
      render();
    }
  });

  function setupAutoUpdate() {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').then(registration => {
        if (registration.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              worker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
        setInterval(() => registration.update().catch(() => {}), 30 * 60 * 1000);
      }).catch(() => {});
    });
  }

  setupAutoUpdate();
  render();
})();
