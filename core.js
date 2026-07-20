(function (global) {
  'use strict';

  const STORAGE_KEY = 'carPriorityPlan.v1';

  const DEFAULT_BUDGET = [
    { priority:'A', name:'Восстановление замка багажника', amount:3000 },
    { priority:'A', name:'Все сайлентблоки задней подвески, включая задний подрамник', amount:18000 },
    { priority:'A', name:'Замена всей резины', amount:25000 },
    { priority:'A', name:'Замена всех передних шаровых, 8 шт', amount:8000 },
    { priority:'A', name:'Замена насоса ГУР', amount:8000 },
    { priority:'A', name:'Замена передних и задних приводов', amount:25000 },
    { priority:'A', name:'Крестовины и балансировка обоих карданов', amount:8000 },
    { priority:'A', name:'Люк течет и задувает на 100 км/ч', amount:3000 },
    { priority:'A', name:'Новый/БУ MAF sensor', amount:5000 },
    { priority:'A', name:'Передние опорные/верхние элементы', amount:10000 },
    { priority:'A', name:'Ремонт генератора, уже сделали, оплатить', amount:6000 },
    { priority:'A', name:'Ремонт и обслуживание всех суппортов', amount:8000 },
    { priority:'A', name:'Ремонт рулевой рейки', amount:7000 },
    { priority:'A', name:'Ступичные подшипники вкруг', amount:15000 },
    { priority:'B', name:'Адаптация проводки под двухсекционные фары', amount:3000 },
    { priority:'B', name:'Антигравий/антикор', amount:20000 },
    { priority:'B', name:'Вернуть кондиционер, кроме компрессора ничего нет', amount:35000 },
    { priority:'B', name:'Восстановление геометрии кузова на морде', amount:30000 },
    { priority:'B', name:'Восстановление/покупка подкапотной косы', amount:25000 },
    { priority:'B', name:'Задние стойки KYB New SR', amount:20000 },
    { priority:'B', name:'Замена 3 дверей', amount:20000 },
    { priority:'B', name:'Замена всей топливной трассы', amount:15000 },
    { priority:'B', name:'Замена гидравлической трассы ГУР', amount:8000 },
    { priority:'B', name:'Замена лобового стекла', amount:20000 },
    { priority:'B', name:'Нормальные лампы спереди и сзади', amount:3000 },
    { priority:'B', name:'Переварка задних стаканов', amount:20000 },
    { priority:'B', name:'Переварка передних арок', amount:10000 },
    { priority:'B', name:'Переварка порогов и задних арок', amount:15000 },
    { priority:'B', name:'Подварка/переварка передних стаканов', amount:20000 },
    { priority:'B', name:'Ремонт/замена проводки салона', amount:12000 },
    { priority:'B', name:'Фары седан ICHIKOH 1535, две секции', amount:40000 },
    { priority:'C', name:'Детейлинг салона/перешив сидений/потолок', amount:15000 },
    { priority:'C', name:'Диски БУ R17/R18', amount:35000 },
    { priority:'C', name:'Задние и передние газлифты', amount:4000 },
    { priority:'C', name:'Задние фонари от рестайлинга', amount:12000 },
    { priority:'C', name:'Замена приборной панели/щитка', amount:5000 },
    { priority:'C', name:'Переход 4 шпильки на 5 шпилек, 4WD', amount:50000 },
    { priority:'D', name:'Опционально: RB25DET/VQ30DET + подружить с автоматом', amount:400000 }
  ];

  const DEFAULT_STATE = {
    version: 1,
    settings: {
      startDate: '2026-08-01',
      deadlineA: '2026-12-31',
      deadlineB: '2027-05-31',
      deadlineC: '2028-06-30',
      defaultIncome: 150000,
      defaultExpenses: 74469,
      maxRoom: 50000,
      defaultRoom: 35000,
      startCash: 0,
      startRoom: 0,
      reserve: 60000,
      bufferAB: 0.15,
      bufferC: 0.10,
      bufferD: 0,
      months: 48
    },
    budget: DEFAULT_BUDGET,
    months: {}
  };

  function clone(obj) { return JSON.parse(JSON.stringify(obj)); }
  function toNumber(v, fallback = 0) {
    if (v === undefined || v === null || String(v).trim() === '') return fallback;
    const n = Number(String(v).replace(',', '.').replace(/\s+/g, ''));
    return Number.isFinite(n) ? n : fallback;
  }
  function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }
  function dateFromISO(iso) {
    const parts = String(iso).split('-').map(Number);
    return new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
  }
  function isoFromDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  function addMonths(iso, index) {
    const d = dateFromISO(iso);
    d.setMonth(d.getMonth() + index);
    return isoFromDate(d);
  }
  function monthLabel(iso) {
    return dateFromISO(iso).toLocaleDateString('ru-RU', { month:'short', year:'numeric' }).replace('.', '');
  }
  function formatMoney(n) {
    return Math.round(toNumber(n)).toLocaleString('ru-RU') + ' ₽';
  }
  function formatDate(iso) {
    if (!iso) return 'Не закрыто';
    return dateFromISO(iso).toLocaleDateString('ru-RU', { month:'long', year:'numeric' });
  }
  function ensureState(raw) {
    const state = clone(DEFAULT_STATE);
    if (!raw || typeof raw !== 'object') return state;
    state.version = 1;
    state.settings = Object.assign(state.settings, raw.settings || {});
    state.budget = Array.isArray(raw.budget) && raw.budget.length ? raw.budget : state.budget;
    state.months = raw.months && typeof raw.months === 'object' ? raw.months : {};
    state.settings.months = clamp(Math.round(toNumber(state.settings.months, 48)), 12, 96);
    return state;
  }
  function budgetTotals(state) {
    const raw = { A:0, B:0, C:0, D:0 };
    for (const item of state.budget) {
      if (!raw[item.priority]) raw[item.priority] = 0;
      raw[item.priority] += Math.max(0, toNumber(item.amount));
    }
    const s = state.settings;
    return {
      raw,
      target: {
        A: raw.A * (1 + toNumber(s.bufferAB)),
        B: raw.B * (1 + toNumber(s.bufferAB)),
        C: raw.C * (1 + toNumber(s.bufferC)),
        D: raw.D * (1 + toNumber(s.bufferD))
      }
    };
  }
  function computePlan(stateInput) {
    const state = ensureState(stateInput);
    const totals = budgetTotals(state);
    const rem = clone(totals.target);
    const saved = { A:0, B:0, C:0, D:0 };
    const closedAt = { A:null, B:null, C:null, D:null };
    let roomTotal = toNumber(state.settings.startRoom);
    let cash = toNumber(state.settings.startCash);
    const rows = [];
    const count = clamp(Math.round(toNumber(state.settings.months, 48)), 12, 96);

    for (let i = 0; i < count; i++) {
      const iso = addMonths(state.settings.startDate, i);
      const override = state.months[iso] || {};
      const income = Math.max(0, toNumber(override.income, state.settings.defaultIncome));
      const expenses = Math.max(0, toNumber(override.expenses, state.settings.defaultExpenses));
      const roomInput = Math.max(0, toNumber(override.room, state.settings.defaultRoom));
      const roomFact = Math.min(roomInput, toNumber(state.settings.maxRoom), Math.max(0, income - expenses));
      roomTotal += roomFact;
      let available = Math.max(0, income - expenses - roomFact);
      if (i === 0 && cash > 0) available += cash;
      const pay = { A:0, B:0, C:0, D:0 };
      let left = available;
      for (const p of ['A','B','C','D']) {
        pay[p] = Math.min(left, rem[p]);
        rem[p] = Math.max(0, rem[p] - pay[p]);
        saved[p] += pay[p];
        left = Math.max(0, left - pay[p]);
        if (!closedAt[p] && rem[p] <= 0.00001) closedAt[p] = iso;
      }
      cash = left;
      const goesTo = pay.A > 0 ? 'A' : pay.B > 0 ? 'B' : pay.C > 0 ? 'C' : pay.D > 0 ? 'D' : '-';
      const status = roomInput > toNumber(state.settings.maxRoom) ? 'Комната выше лимита' :
        available <= 0 ? 'Нет свободных денег' :
        rem.A <= 0 && rem.B <= 0 ? 'A+B закрыты' :
        rem.A <= 0 ? 'A закрыт' : 'OK';
      rows.push({
        index: i + 1, iso, label: monthLabel(iso), income, expenses,
        roomInput, roomFact, toPriority: available, goesTo, pay,
        rem: clone(rem), saved: clone(saved), roomTotal, cash, status,
        note: override.note || ''
      });
    }
    return { state, totals, rows, saved, rem, closedAt, roomTotal, cash };
  }
  function loadState() {
    try {
      const txt = localStorage.getItem(STORAGE_KEY);
      return ensureState(txt ? JSON.parse(txt) : null);
    } catch (e) {
      return ensureState(null);
    }
  }
  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ensureState(state)));
  }
  global.CarPlanCore = {
    STORAGE_KEY, DEFAULT_STATE, DEFAULT_BUDGET, ensureState, clone, toNumber, addMonths,
    monthLabel, formatMoney, formatDate, budgetTotals, computePlan, loadState, saveState
  };
})(typeof window !== 'undefined' ? window : globalThis);
