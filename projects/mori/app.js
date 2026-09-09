(function () {
  'use strict';

  const STORAGE_KEY = 'mori.daily.v1';
  const SCHEMA_VERSION = 1;
  let todayKey = dateToKey(new Date());
  let currentDate = todayKey;
  let store;
  let editingTaskId = null;
  let selectedMood = 'soft';
  let lastFocusElement = null;
  let plantAssignedDuringRead = false;
  let gustTimer = null;
  let animalTimer = null;
  let animalResetTimer = null;
  let animalSequence = 0;

  // 每种植物都拥有一套自己的 0~5 级图鉴形态。
  // 0 级是埋在土里的种子，1~5 级对应完成 1~5 件日程；5 级为完全体。
  const plantMap = {
    fern: {
      name: '蕨类', glyph: '🌿', color: '#5d815d', shape: 'fern',
      glyphs: ['🌰', '🌱', '🌿', '🌿', '🌾', '🌿']
    },
    monstera: {
      name: '龟背竹', glyph: '🍃', color: '#4e7c58', shape: 'monstera',
      glyphs: ['🌰', '🌱', '🍃', '🍃', '🍃', '🍃']
    },
    lavender: {
      name: '薰衣草', glyph: '🪻', color: '#75649a', shape: 'lavender',
      glyphs: ['🌰', '🌱', '🌱', '🪻', '🪻', '💐']
    },
    cactus: {
      name: '仙人掌', glyph: '🌵', color: '#4f8065', shape: 'cactus',
      glyphs: ['🌰', '🌱', '🌵', '🌵', '🌵', '🌵']
    },
    clover: {
      name: '四叶草', glyph: '☘️', color: '#6b8f4f', shape: 'clover',
      glyphs: ['🌰', '🌱', '☘️', '☘️', '🍀', '🍀']
    },
    sunflower: {
      name: '向日葵', glyph: '🌻', color: '#bb8744', shape: 'sunflower',
      glyphs: ['🌰', '🌱', '🌿', '🌻', '🌻', '🌻']
    }
  };

  const plantStages = {
    seed: { level: 0, label: '种子 · 0 / 5', short: '种子', detail: '还在土里打盹' },
    sprout: { level: 1, label: '发芽 · 1 / 5', short: '发芽', detail: '第一片小叶探出头' },
    leaf: { level: 2, label: '幼苗 · 2 / 5', short: '幼苗', detail: '茎干开始站稳' },
    leafy: { level: 3, label: '长叶 · 3 / 5', short: '长叶', detail: '叶片正在展开' },
    bud: { level: 4, label: '花苞 · 4 / 5', short: '花苞', detail: '再照料一件就会盛放' },
    full: { level: 5, label: '完全体 · 5 / 5', short: '完全体', detail: '五件日程都开花了' }
  };

  const stageByCompletion = ['seed', 'sprout', 'leaf', 'leafy', 'bud', 'full'];

  const weatherMap = {
    sunny: { label: '晴朗', icon: '☀' },
    cloudy: { label: '多云', icon: '☁' },
    rainy: { label: '小雨', icon: '⌁' },
    windy: { label: '有风', icon: '〰' }
  };

  const animalMap = {
    squirrel: { name: '松鼠', glyph: '🐿️', className: 'animal-squirrel' },
    bee: { name: '小蜜蜂', glyph: '🐝', className: 'animal-bee' },
    butterfly: { name: '蝴蝶', glyph: '🦋', className: 'animal-butterfly' },
    ladybug: { name: '瓢虫', glyph: '🐞', className: 'animal-ladybug' }
  };

  const seedPrompts = [
    '今天什么值得被记住？',
    '如果只做一件事，会是哪一件？',
    '给未来的自己留一句什么话？',
    '今天想把时间交给什么？',
    '哪一个小动作会让你更靠近想要的生活？',
    '现在的身体正在提醒你什么？'
  ];

  const moodMap = {
    bright: { label: '晴朗', symbol: '☀' },
    soft: { label: '柔和', symbol: '◒' },
    cloudy: { label: '多云', symbol: '☁' },
    rainy: { label: '下雨', symbol: '⌁' },
    starry: { label: '星夜', symbol: '✦' }
  };

  const energyMap = {
    1: { label: '低潮', symbol: '·' },
    2: { label: '偏低', symbol: '⌁' },
    3: { label: '平稳', symbol: '◒' },
    4: { label: '有光', symbol: '✦' },
    5: { label: '饱满', symbol: '✿' }
  };

  // 数据读取要放在植物/心情字典初始化之后，避免旧浏览器在解析本地数据时遇到暂时性死区。
  store = loadStore();

  const refs = {
    prevDay: document.getElementById('prevDay'),
    nextDay: document.getElementById('nextDay'),
    todayButton: document.getElementById('todayButton'),
    prevMonth: document.getElementById('prevMonth'),
    nextMonth: document.getElementById('nextMonth'),
    currentMonthButton: document.getElementById('currentMonthButton'),
    monthLabel: document.getElementById('monthLabel'),
    dayLabel: document.getElementById('dayLabel'),
    fullDate: document.getElementById('fullDate'),
    dayOfYear: document.getElementById('dayOfYear'),
    greeting: document.getElementById('greeting'),
    progressRing: document.getElementById('progressRing'),
    progressPercent: document.getElementById('progressPercent'),
    progressCount: document.getElementById('progressCount'),
    progressCopy: document.getElementById('progressCopy'),
    energyPlant: document.getElementById('energyPlant'),
    energyLabel: document.getElementById('energyLabel'),
    seedPrompt: document.getElementById('seedPrompt'),
    seedText: document.getElementById('seedText'),
    useSeedButton: document.getElementById('useSeedButton'),
    taskForm: document.getElementById('taskForm'),
    taskInput: document.getElementById('taskInput'),
    taskTime: document.getElementById('taskTime'),
    taskReminder: document.getElementById('taskReminder'),
    plantSpecies: document.getElementById('plantSpecies'),
    timeline: document.getElementById('timeline'),
    timelineEmpty: document.getElementById('timelineEmpty'),
    taskCount: document.getElementById('taskCount'),
    reminderButton: document.getElementById('reminderButton'),
    reminderButtonText: document.getElementById('reminderButtonText'),
    greenhouseScene: document.getElementById('greenhouseScene'),
    greenhouseCount: document.getElementById('greenhouseCount'),
    weatherStatus: document.getElementById('weatherStatus'),
    weatherButton: document.getElementById('weatherButton'),
    weatherParticles: document.getElementById('weatherParticles'),
    monthlyPlants: document.getElementById('monthlyPlants'),
    animalLayer: document.getElementById('animalLayer'),
    animalButton: document.getElementById('animalButton'),
    interactionStatus: document.getElementById('interactionStatus'),
    currentPlant: document.getElementById('currentPlant'),
    currentPlantName: document.getElementById('currentPlantName'),
    currentPlantStage: document.getElementById('currentPlantStage'),
    growthMeter: document.getElementById('growthMeter'),
    growthMeterLabel: document.getElementById('growthMeterLabel'),
    plantCollection: document.getElementById('plantCollection'),
    changePlantButton: document.getElementById('changePlantButton'),
    openReflectionTop: document.getElementById('openReflectionTop'),
    openReflectionButton: document.getElementById('openReflectionButton'),
    reflectionEmpty: document.getElementById('reflectionEmpty'),
    reflectionSummary: document.getElementById('reflectionSummary'),
    summaryMood: document.getElementById('summaryMood'),
    summaryHighlight: document.getElementById('summaryHighlight'),
    summaryEnergy: document.getElementById('summaryEnergy'),
    moveOverdueButton: document.getElementById('moveOverdueButton'),
    overdueNote: document.getElementById('overdueNote'),
    editDialog: document.getElementById('editDialog'),
    editForm: document.getElementById('editForm'),
    editId: document.getElementById('editId'),
    editText: document.getElementById('editText'),
    editTime: document.getElementById('editTime'),
    editReminder: document.getElementById('editReminder'),
    deleteTaskButton: document.getElementById('deleteTaskButton'),
    cancelEditButton: document.getElementById('cancelEditButton'),
    closeEditButton: document.getElementById('closeEditButton'),
    reflectionDialog: document.getElementById('reflectionDialog'),
    reflectionForm: document.getElementById('reflectionForm'),
    energyRange: document.getElementById('energyRange'),
    energyOutput: document.getElementById('energyOutput'),
    highlightInput: document.getElementById('highlightInput'),
    moodOptions: document.getElementById('moodOptions'),
    cancelReflectionButton: document.getElementById('cancelReflectionButton'),
    closeReflectionButton: document.getElementById('closeReflectionButton'),
    exportButton: document.getElementById('exportButton'),
    importButton: document.getElementById('importButton'),
    importInput: document.getElementById('importInput'),
    clearDayButton: document.getElementById('clearDayButton'),
    toastRegion: document.getElementById('toastRegion')
  };

  const periods = {
    morning: { list: document.getElementById('morningTasks'), empty: document.getElementById('morningEmpty') },
    day: { list: document.getElementById('dayTasks'), empty: document.getElementById('dayEmpty') },
    night: { list: document.getElementById('nightTasks'), empty: document.getElementById('nightEmpty') },
    loose: { list: document.getElementById('looseTasks'), empty: document.getElementById('looseEmpty') }
  };

  function dateToKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function refreshTodayKey() {
    const nextTodayKey = dateToKey(new Date());
    if (nextTodayKey === todayKey) return;
    const wasOnToday = currentDate === todayKey;
    todayKey = nextTodayKey;
    if (wasOnToday) currentDate = nextTodayKey;
    render();
  }

  function monthKeyForDate(key) { return String(key).slice(0, 7); }

  function monthKeyToDate(monthKey) {
    const parts = String(monthKey).split('-').map(Number);
    return new Date(parts[0] || new Date().getFullYear(), (parts[1] || 1) - 1, 1, 12, 0, 0, 0);
  }

  function shiftMonth(monthKey, amount) {
    const date = monthKeyToDate(monthKey);
    date.setMonth(date.getMonth() + amount);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
  }

  function daysInMonth(monthKey) {
    const date = monthKeyToDate(monthKey);
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }

  function keyForMonthDay(monthKey, dayNumberValue) {
    return `${monthKey}-${pad(dayNumberValue)}`;
  }

  function formatMonth(monthKey) {
    const date = monthKeyToDate(monthKey);
    return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月温室`;
  }

  function ensureMonthPlants(monthKey) {
    const currentMonthKey = monthKeyForDate(todayKey);
    if (monthKey > currentMonthKey) return;
    const maxDay = monthKey === currentMonthKey ? Number(todayKey.slice(8)) : daysInMonth(monthKey);
    for (let dayNumberValue = 1; dayNumberValue <= maxDay; dayNumberValue += 1) {
      const key = keyForMonthDay(monthKey, dayNumberValue);
      if (!store.days[key]) store.days[key] = defaultDay();
      const day = store.days[key];
      if (!day.plant) {
        day.plant = { species: speciesForDate(key), plantedAt: keyToDate(key).getTime() };
        plantAssignedDuringRead = true;
      }
    }
  }

  function keyToDate(key) {
    const parts = String(key).split('-').map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return new Date();
    return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0, 0);
  }

  function shiftDate(key, amount) {
    const date = keyToDate(key);
    date.setDate(date.getDate() + amount);
    return dateToKey(date);
  }

  function dateDifference(fromKey, toKey) {
    const from = keyToDate(fromKey);
    const to = keyToDate(toKey);
    return Math.round((to.getTime() - from.getTime()) / 86400000);
  }

  function pad(value) { return String(value).padStart(2, '0'); }

  function formatDate(key) {
    const date = keyToDate(key);
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} · 周${weekdays[date.getDay()]}`;
  }

  function dayNumber(key) {
    const date = keyToDate(key);
    const start = new Date(date.getFullYear(), 0, 1);
    return Math.floor((date - start) / 86400000) + 1;
  }

  function defaultStore() {
    return {
      version: SCHEMA_VERSION,
      settings: { remindersEnabled: false, weatherMode: 'auto' },
      days: {},
      meta: { lastExportAt: null }
    };
  }

  function defaultDay() {
    return {
      tasks: [],
      mood: '',
      energy: 3,
      highlight: '',
      plant: null,
      seedUsed: false,
      updatedAt: Date.now()
    };
  }

  function makeId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return `mori-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function normalizeTask(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const text = String(raw.text ?? raw.title ?? '').trim().slice(0, 120);
    if (!text) return null;
    const rawTime = typeof raw.time === 'string' && /^\d{2}:\d{2}$/.test(raw.time) ? raw.time : null;
    const rawReminder = String(raw.reminder ?? (raw.remind ? 'ontime' : 'none'));
    const reminder = ['none', 'ontime', '15'].includes(rawReminder) ? rawReminder : 'none';
    return {
      id: String(raw.id || makeId()),
      text,
      time: rawTime,
      reminder,
      done: Boolean(raw.done),
      remindedAt: raw.remindedAt ? String(raw.remindedAt) : null,
      snoozedUntil: Number.isFinite(Number(raw.snoozedUntil)) ? Number(raw.snoozedUntil) : null,
      createdAt: Number.isFinite(Number(raw.createdAt)) ? Number(raw.createdAt) : Date.now(),
      completedAt: raw.completedAt ? String(raw.completedAt) : null
    };
  }

  function normalizeDay(raw) {
    const day = defaultDay();
    if (!raw || typeof raw !== 'object') return day;
    day.tasks = Array.isArray(raw.tasks) ? raw.tasks.map(normalizeTask).filter(Boolean) : [];
    day.mood = Object.prototype.hasOwnProperty.call(moodMap, raw.mood) ? raw.mood : '';
    const energy = Number(raw.energy);
    day.energy = Number.isFinite(energy) ? Math.min(5, Math.max(1, Math.round(energy))) : 3;
    day.highlight = typeof raw.highlight === 'string' ? raw.highlight.slice(0, 240) : '';
    if (raw.plant && typeof raw.plant === 'object' && plantMap[String(raw.plant.species)]) {
      day.plant = {
        species: String(raw.plant.species),
        plantedAt: Number.isFinite(Number(raw.plant.plantedAt)) ? Number(raw.plant.plantedAt) : Date.now()
      };
    }
    day.seedUsed = Boolean(raw.seedUsed);
    day.updatedAt = Number.isFinite(Number(raw.updatedAt)) ? Number(raw.updatedAt) : Date.now();
    return day;
  }

  function normalizeStore(raw) {
    const clean = defaultStore();
    if (!raw || typeof raw !== 'object') return clean;
    clean.version = SCHEMA_VERSION;
    clean.settings.remindersEnabled = Boolean(raw.settings && raw.settings.remindersEnabled);
    clean.settings.weatherMode = raw.settings && ['auto', 'sunny', 'cloudy', 'rainy', 'windy'].includes(raw.settings.weatherMode)
      ? raw.settings.weatherMode
      : 'auto';
    if (raw.meta && raw.meta.lastExportAt) clean.meta.lastExportAt = String(raw.meta.lastExportAt);
    if (raw.days && typeof raw.days === 'object') {
      Object.keys(raw.days).forEach((key) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return;
        const day = normalizeDay(raw.days[key]);
        if (!day.plant && key <= dateToKey(new Date()) && (day.tasks.length || day.highlight || day.mood)) {
          day.plant = { species: speciesForDate(key), plantedAt: day.updatedAt || Date.now() };
        }
        clean.days[key] = day;
      });
    }
    return clean;
  }

  function loadStore() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? normalizeStore(JSON.parse(raw)) : defaultStore();
    } catch (error) {
      return defaultStore();
    }
  }

  function saveStore() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (error) {
      showToast('浏览器暂时无法保存，当前记录仍可继续编辑。', { alert: true });
    }
  }

  function getDay(key = currentDate) {
    if (!store.days[key]) store.days[key] = defaultDay();
    const day = store.days[key];
    // 只为今天及已经发生的日期建立植物；浏览未来日期不会提前长出植物。
    if (!day.plant && key <= todayKey) {
      day.plant = { species: speciesForDate(key), plantedAt: Date.now() };
      plantAssignedDuringRead = true;
    }
    return day;
  }

  function speciesForDate(key) {
    const species = Object.keys(plantMap);
    let hash = 0;
    for (let index = 0; index < key.length; index += 1) hash = ((hash << 5) - hash + key.charCodeAt(index)) | 0;
    return species[Math.abs(hash) % species.length];
  }

  function getPlantStage(day) {
    const completed = day.tasks.filter((task) => task.done).length;
    return stageByCompletion[Math.min(5, completed)];
  }

  function growthLevel(day) {
    return plantStages[getPlantStage(day)].level;
  }

  function touchDay(key = currentDate) {
    getDay(key).updatedAt = Date.now();
  }

  function getTimeValue(task) {
    if (!task.time) return Number.POSITIVE_INFINITY;
    const [hours, minutes] = task.time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  function periodForTask(task) {
    if (!task.time) return 'loose';
    const hour = Number(task.time.slice(0, 2));
    if (hour < 12) return 'morning';
    if (hour < 18) return 'day';
    return 'night';
  }

  function taskDateTime(key, time) {
    if (!time) return null;
    const date = keyToDate(key);
    const [hours, minutes] = time.split(':').map(Number);
    date.setHours(hours, minutes, 0, 0);
    return date;
  }

  function isOverdue(task, key = currentDate) {
    if (task.done || !task.time) return false;
    if (key < todayKey) return true;
    if (key > todayKey) return false;
    const due = taskDateTime(key, task.time);
    return due ? due.getTime() < Date.now() : false;
  }

  function reminderOffset(reminder) { return reminder === '15' ? 15 : 0; }

  function sortTasks(tasks) {
    return [...tasks].sort((a, b) => {
      const timeDiff = getTimeValue(a) - getTimeValue(b);
      if (timeDiff !== 0) return timeDiff;
      return a.createdAt - b.createdAt;
    });
  }

  function greetingForDate() {
    if (currentDate !== todayKey) return '给这一天留一小块可以呼吸的地方。';
    const hour = new Date().getHours();
    if (hour < 11) return '早安，先照料一件最小的事。';
    if (hour < 18) return '午安，给正在进行的事留一点光。';
    return '晚安，今天已经做得够多了。';
  }

  function labelForDate() {
    const diff = dateDifference(todayKey, currentDate);
    if (diff === 0) return '今天';
    if (diff === -1) return '昨天';
    if (diff === 1) return '明天';
    const date = keyToDate(currentDate);
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  }

  function seedForDate(key) {
    let hash = 0;
    for (let index = 0; index < key.length; index += 1) hash = ((hash << 5) - hash + key.charCodeAt(index)) | 0;
    return seedPrompts[Math.abs(hash) % seedPrompts.length];
  }

  function renderHeader() {
    refs.dayLabel.textContent = labelForDate();
    refs.fullDate.textContent = formatDate(currentDate);
    refs.dayOfYear.textContent = `DAY ${String(dayNumber(currentDate)).padStart(3, '0')}`;
    refs.greeting.textContent = greetingForDate();
    refs.todayButton.disabled = currentDate === todayKey;
    refs.todayButton.setAttribute('aria-disabled', String(currentDate === todayKey));
    refs.reminderButton.classList.toggle('is-enabled', store.settings.remindersEnabled);
    refs.reminderButton.setAttribute('aria-pressed', String(store.settings.remindersEnabled));
    refs.reminderButtonText.textContent = store.settings.remindersEnabled ? '提醒已开启' : '开启提醒';
  }

  function renderSummary(day) {
    const total = day.tasks.length;
    const completed = day.tasks.filter((task) => task.done).length;
    const percent = total ? Math.round((completed / total) * 100) : 0;
    refs.progressRing.style.setProperty('--progress', `${percent * 3.6}deg`);
    refs.progressRing.setAttribute('aria-label', `今日完成进度 ${percent}%`);
    refs.progressPercent.textContent = `${percent}%`;
    refs.progressCount.textContent = `${completed} / ${total}`;
    refs.progressCopy.textContent = total === 0 ? '先种下一件小事。' : completed === total ? '今天的温室已经收好。' : `${total - completed} 件事还在生长。`;
    const energy = energyMap[day.energy] || energyMap[3];
    refs.energyPlant.textContent = energy.symbol;
    refs.energyLabel.textContent = day.mood && moodMap[day.mood] ? moodMap[day.mood].label : energy.label;

    const showSeed = !day.seedUsed && total === 0;
    refs.seedPrompt.hidden = !showSeed;
    if (showSeed) refs.seedText.textContent = seedForDate(currentDate);
  }

  function createMeta(text, className) {
    const element = document.createElement('span');
    element.textContent = text;
    if (className) element.className = className;
    return element;
  }

  function renderTask(task) {
    const item = document.createElement('li');
    item.className = 'task-item';
    item.dataset.taskId = task.id;
    if (task.done) item.classList.add('is-done');
    if (isOverdue(task)) item.classList.add('is-overdue');

    const check = document.createElement('button');
    check.className = 'task-check';
    check.type = 'button';
    check.dataset.action = 'toggle';
    check.dataset.id = task.id;
    check.setAttribute('role', 'checkbox');
    check.setAttribute('aria-checked', String(task.done));
    check.setAttribute('aria-label', task.done ? `撤销完成：${task.text}` : `标记完成：${task.text}`);
    check.textContent = task.done ? '✓' : '';

    const main = document.createElement('div');
    main.className = 'task-main';
    const title = document.createElement('span');
    title.className = 'task-title';
    title.textContent = task.text;
    main.appendChild(title);

    const meta = document.createElement('div');
    meta.className = 'task-meta';
    if (task.time) meta.appendChild(createMeta(task.time));
    if (task.reminder !== 'none') meta.appendChild(createMeta(task.reminder === '15' ? '铃声提前 15 分钟' : '准时提醒', 'reminder-meta'));
    if (task.snoozedUntil && task.snoozedUntil > Date.now()) meta.appendChild(createMeta('已延后 10 分钟', 'reminder-meta'));
    if (isOverdue(task)) meta.appendChild(createMeta('需要照料', 'overdue-meta'));
    if (!task.time) meta.appendChild(createMeta('无固定时间'));
    main.appendChild(meta);

    const action = document.createElement('button');
    action.className = 'task-action';
    action.type = 'button';
    action.dataset.action = 'edit';
    action.dataset.id = task.id;
    action.textContent = '编辑';
    action.setAttribute('aria-label', `编辑：${task.text}`);

    item.append(check, main, action);
    return item;
  }

  function renderTimeline(day) {
    Object.values(periods).forEach((period) => period.list.replaceChildren());
    const grouped = { morning: [], day: [], night: [], loose: [] };
    sortTasks(day.tasks).forEach((task) => grouped[periodForTask(task)].push(task));
    Object.keys(grouped).forEach((periodName) => {
      const entries = grouped[periodName];
      const period = periods[periodName];
      entries.forEach((task) => period.list.appendChild(renderTask(task)));
      period.empty.hidden = entries.length > 0;
    });
    refs.timelineEmpty.hidden = day.tasks.length > 0;
    refs.taskCount.textContent = `${day.tasks.length} 件事`;
  }

  function renderReflection(day) {
    const hasReflection = Boolean(day.highlight || day.mood);
    refs.reflectionEmpty.hidden = hasReflection;
    refs.reflectionSummary.hidden = !hasReflection;
    if (!hasReflection) return;
    const mood = moodMap[day.mood] || moodMap.soft;
    refs.summaryMood.textContent = mood.symbol;
    refs.summaryMood.setAttribute('aria-label', mood.label);
    refs.summaryHighlight.textContent = day.highlight || '今天留了一点安静。';
    refs.summaryEnergy.textContent = `能量 ${day.energy} / 5 · ${mood.label}`;
  }

  function renderOverdue(day) {
    const overdue = day.tasks.filter((task) => isOverdue(task));
    refs.moveOverdueButton.disabled = overdue.length === 0;
    refs.moveOverdueButton.textContent = overdue.length ? `移到明天（${overdue.length}）` : '没有需要移植的事';
    refs.overdueNote.hidden = overdue.length === 0;
    if (overdue.length) refs.overdueNote.textContent = `${overdue.length} 件事已经过了计划时间，可以轻轻放到明天。`;
  }

  function glyphForPlant(species, stage) {
    const plant = plantMap[species] || plantMap.fern;
    const level = plantStages[stage] ? plantStages[stage].level : 0;
    return (plant.glyphs && plant.glyphs[level]) || plant.glyph;
  }

  function createPlantArt(speciesKey, stage) {
    const species = plantMap[speciesKey] || plantMap.fern;
    const art = document.createElement('span');
    art.className = `plant-art shape-${species.shape || 'fern'}`;
    art.setAttribute('aria-hidden', 'true');
    art.style.setProperty('--plant-color', species.color);
    art.style.setProperty('--growth-level', String(plantStages[stage]?.level || 0));
    // 这些小部件由 CSS 组合成六种不同的植物轮廓；同一物种会随等级逐步显现。
    ['stem', 'leaf leaf-a', 'leaf leaf-b', 'leaf leaf-c', 'leaf leaf-d', 'arm arm-left', 'arm arm-right', 'bud', 'flower', 'fruit', 'spike spike-a', 'spike spike-b', 'spike spike-c'].forEach((part) => {
      const piece = document.createElement('i');
      piece.className = part.split(' ').map((token) => `art-${token}`).join(' ');
      piece.setAttribute('aria-hidden', 'true');
      art.appendChild(piece);
    });
    const fallback = document.createElement('span');
    fallback.className = 'plant-glyph-fallback';
    fallback.textContent = glyphForPlant(speciesKey, stage);
    fallback.setAttribute('aria-hidden', 'true');
    art.appendChild(fallback);
    return art;
  }

  function renderPlantDisplay(day) {
    const plant = day.plant || { species: speciesForDate(currentDate) };
    const species = plantMap[plant.species] || plantMap.fern;
    const stage = getPlantStage(day);
    const level = growthLevel(day);
    refs.currentPlant.className = `plant-display stage-${stage} species-${plant.species}`;
    refs.currentPlant.dataset.growth = String(level);
    refs.currentPlant.replaceChildren();
    refs.currentPlant.appendChild(createPlantArt(plant.species, stage));
    refs.currentPlant.setAttribute('aria-label', `${labelForDate()}的${species.name}，${plantStages[stage].label}，${plantStages[stage].detail}`);
    refs.currentPlantName.textContent = `${species.name} · ${labelForDate()}`;
    refs.currentPlantStage.textContent = `${plantStages[stage].label} · ${plantStages[stage].detail}`;
    if (refs.growthMeter) {
      refs.growthMeter.setAttribute('aria-label', `成长进度 ${level} / 5，完成五件日程即可完全体`);
      refs.growthMeter.dataset.level = String(level);
      refs.growthMeter.querySelectorAll('.growth-dot').forEach((dot, index) => {
        dot.classList.toggle('is-filled', index < level);
      });
    }
    if (refs.growthMeterLabel) refs.growthMeterLabel.textContent = `${level} / 5`;
    refs.plantSpecies.value = plant.species;
  }

  function monthPlantEntries() {
    const monthKey = monthKeyForDate(currentDate);
    ensureMonthPlants(monthKey);
    return Object.keys(store.days)
      .filter((key) => key.startsWith(`${monthKey}-`) && key <= todayKey && store.days[key] && store.days[key].plant)
      .sort();
  }

  function renderMonthNav() {
    const monthKey = monthKeyForDate(currentDate);
    refs.monthLabel.textContent = formatMonth(monthKey);
    const isCurrentMonth = monthKey === monthKeyForDate(todayKey);
    refs.currentMonthButton.disabled = isCurrentMonth;
    refs.currentMonthButton.setAttribute('aria-disabled', String(isCurrentMonth));
  }

  function renderMonthlyPlants(entries) {
    refs.monthlyPlants.replaceChildren();
    if (!entries.length) {
      const empty = document.createElement('span');
      empty.className = 'monthly-plants-empty';
      empty.textContent = '这座温室还在等这个月的第一天。';
      refs.monthlyPlants.appendChild(empty);
      return;
    }
    entries.forEach((key) => {
      const day = store.days[key];
      const species = plantMap[day.plant.species] || plantMap.fern;
      const stage = getPlantStage(day);
      const plant = document.createElement('button');
      plant.type = 'button';
      plant.className = `monthly-plant species-${day.plant.species} stage-${stage}${key === currentDate ? ' is-current' : ''}`;
      plant.dataset.date = key;
      plant.style.setProperty('--plant-color', species.color);
      plant.setAttribute('aria-label', `${formatDate(key)}的${species.name}，完成 ${growthLevel(day)} / 5，${plantStages[stage].short}阶段`);
      const glyph = document.createElement('span');
      glyph.className = 'month-plant-glyph';
      glyph.textContent = glyphForPlant(day.plant.species, stage);
      const date = document.createElement('span');
      date.className = 'month-plant-date';
      date.textContent = key.slice(8);
      const level = document.createElement('span');
      level.className = 'month-plant-level';
      level.textContent = `${growthLevel(day)}/5`;
      plant.append(glyph, date, level);
      refs.monthlyPlants.appendChild(plant);
    });
  }

  function renderPlantCollection() {
    const entries = monthPlantEntries();
    refs.plantCollection.replaceChildren();
    const monthKey = monthKeyForDate(currentDate);
    refs.greenhouseCount.textContent = `${formatMonth(monthKey)} · ${entries.length} 株正在生长`;
    renderMonthlyPlants(entries);
    if (!entries.length) {
      const empty = document.createElement('span');
      empty.className = 'plant-collection-empty';
      empty.textContent = '从这个月的第一天开始，温室会多一株植物。';
      refs.plantCollection.appendChild(empty);
      return;
    }
    entries.forEach((key) => {
      const day = store.days[key];
      const species = plantMap[day.plant.species] || plantMap.fern;
      const stage = getPlantStage(day);
      const memory = document.createElement('button');
      memory.type = 'button';
      memory.className = `plant-memory species-${day.plant.species} stage-${stage}${key === currentDate ? ' is-current' : ''}`;
      memory.dataset.date = key;
      memory.style.setProperty('--plant-color', species.color);
      memory.setAttribute('aria-label', `查看 ${formatDate(key)} 的${species.name}，完成 ${growthLevel(day)} / 5，${plantStages[stage].short}阶段`);
      const glyph = document.createElement('span');
      glyph.className = 'memory-glyph';
      glyph.textContent = glyphForPlant(day.plant.species, stage);
      glyph.style.setProperty('--plant-color', species.color);
      const date = document.createElement('span');
      date.className = 'memory-date';
      date.textContent = key.slice(5).replace('-', '.');
      const name = document.createElement('span');
      name.className = 'memory-name';
      name.textContent = `${species.name} · ${growthLevel(day)}/5`;
      memory.append(glyph, date, name);
      refs.plantCollection.appendChild(memory);
    });
  }

  function animalForWeather(weather) {
    if (weather === 'rainy') return ['squirrel', 'ladybug'][Math.floor(Math.random() * 2)];
    if (weather === 'sunny') return ['bee', 'butterfly'][Math.floor(Math.random() * 2)];
    const options = Object.keys(animalMap);
    return options[Math.floor(Math.random() * options.length)];
  }

  function animalTargetEntries(animalKey, entries) {
    const matches = entries.filter((key) => {
      const day = store.days[key];
      if (!day || !day.plant) return false;
      const species = day.plant.species;
      const stage = getPlantStage(day);
      const level = growthLevel(day);
      if (animalKey === 'squirrel') return species === 'sunflower' || species === 'clover' || level === 0;
      if (animalKey === 'bee') return (species === 'lavender' || species === 'sunflower') && level >= 3;
      if (animalKey === 'butterfly') return (species === 'lavender' || species === 'monstera' || species === 'fern') && level >= 2;
      if (animalKey === 'ladybug') return level >= 2 && stage !== 'seed';
      return true;
    });
    return matches.length ? matches : entries;
  }

  function interactionCopy(animalKey, species, key, stage) {
    const dateLabel = key === todayKey ? '今天' : `${Number(key.slice(8))} 号`;
    if (animalKey === 'squirrel') {
      if (stage === 'seed') return `松鼠把一颗瓜子埋在${dateLabel}的花盆里。`;
      if (species.name === '向日葵' || species.name === '四叶草') return `松鼠在${dateLabel}的${species.name}旁啃了一颗瓜子。`;
      return `松鼠在${dateLabel}的${species.name}旁捡到一粒小种子。`;
    }
    if (animalKey === 'bee') return ['leafy', 'bud', 'full'].includes(stage) ? `小蜜蜂飞来${dateLabel}的${species.name}旁采蜜。` : `小蜜蜂在${dateLabel}的花盆边打转，等一朵花开。`;
    if (animalKey === 'butterfly') return ['leaf', 'leafy', 'bud', 'full'].includes(stage) ? `蝴蝶在${dateLabel}的${species.name}旁绕了一圈。` : `蝴蝶在${dateLabel}的花盆边轻轻停了一下。`;
    return stage === 'seed' ? `瓢虫在${dateLabel}的花盆边晒太阳。` : `瓢虫在${dateLabel}的${species.name}叶子上休息。`;
  }

  function triggerAnimalInteraction(requestedAnimal) {
    const entries = monthPlantEntries();
    if (!entries.length || !refs.animalLayer) {
      refs.interactionStatus.textContent = '温室还在等第一株植物。';
      return;
    }
    const weather = activeWeather();
    const animalKey = requestedAnimal && animalMap[requestedAnimal] ? requestedAnimal : animalForWeather(weather);
    const animal = animalMap[animalKey];
    const eligibleEntries = animalTargetEntries(animalKey, entries);
    const targetKey = eligibleEntries[Math.floor(Math.random() * eligibleEntries.length)];
    const targetDay = store.days[targetKey];
    const targetSpecies = plantMap[targetDay.plant.species] || plantMap.fern;
    const targetStage = getPlantStage(targetDay);
    const visitor = document.createElement('span');
    visitor.className = `animal-visitor ${animal.className}`;
    visitor.dataset.sequence = String(++animalSequence);
    let targetPercent = 50;
    const targetCard = Array.from(refs.monthlyPlants.querySelectorAll('[data-date]')).find((card) => card.dataset.date === targetKey);
    if (targetCard) {
      const cardRect = targetCard.getBoundingClientRect();
      const sceneRect = refs.greenhouseScene.getBoundingClientRect();
      const center = ((cardRect.left + cardRect.width / 2 - sceneRect.left) / Math.max(1, sceneRect.width)) * 100;
      if (Number.isFinite(center) && center >= 8 && center <= 92) targetPercent = center;
    }
    visitor.style.setProperty('--animal-target', `${targetPercent}%`);
    visitor.style.setProperty('--animal-top', animalKey === 'squirrel' ? '66%' : `${18 + Math.random() * 20}%`);
    visitor.textContent = animal.glyph;
    const bubble = document.createElement('span');
    bubble.className = 'animal-bubble';
    bubble.textContent = interactionCopy(animalKey, targetSpecies, targetKey, targetStage);
    const spark = document.createElement('span');
    spark.className = 'animal-spark';
    spark.setAttribute('aria-hidden', 'true');
    spark.textContent = '✦';
    visitor.append(bubble, spark);
    if (animalResetTimer) window.clearTimeout(animalResetTimer);
    refs.animalLayer.replaceChildren(visitor);
    refs.interactionStatus.textContent = interactionCopy(animalKey, targetSpecies, targetKey, targetStage);
    const sequence = animalSequence;
    animalResetTimer = window.setTimeout(() => {
      if (visitor.isConnected) visitor.remove();
      if (sequence === animalSequence && refs.interactionStatus) refs.interactionStatus.textContent = '温室里还没有小动物来访。';
    }, 7600);
  }

  function scheduleAnimalVisit() {
    if (animalTimer) window.clearTimeout(animalTimer);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    animalTimer = window.setTimeout(() => {
      if (!document.hidden) triggerAnimalInteraction();
      scheduleAnimalVisit();
    }, 18000 + Math.random() * 22000);
  }

  function autoWeatherForDate(key) {
    const monthKey = monthKeyForDate(key);
    const hourBlock = monthKey === monthKeyForDate(todayKey) ? Math.floor(new Date().getHours() / 8) : 1;
    const sequence = ['sunny', 'cloudy', 'rainy', 'sunny', 'windy'];
    const monthNumber = Number(monthKey.slice(5)) || 1;
    return sequence[(monthNumber + hourBlock) % sequence.length];
  }

  function activeWeather() {
    const mode = store.settings.weatherMode || 'auto';
    return mode === 'auto' ? autoWeatherForDate(currentDate) : mode;
  }

  function renderWeather() {
    const mode = store.settings.weatherMode || 'auto';
    const weather = activeWeather();
    refs.greenhouseScene.classList.remove('weather-sunny', 'weather-cloudy', 'weather-rainy', 'weather-windy');
    refs.greenhouseScene.classList.add(`weather-${weather}`);
    const weatherInfo = weatherMap[weather] || weatherMap.sunny;
    refs.weatherStatus.textContent = `${mode === 'auto' ? '自动天气' : '手动天气'} · ${weatherInfo.icon} ${weatherInfo.label}`;
    refs.weatherButton.textContent = '换一种天气';
    refs.weatherParticles.replaceChildren();
    if (weather === 'rainy') {
      for (let index = 0; index < 12; index += 1) {
        const drop = document.createElement('span');
        drop.className = 'weather-particle';
        drop.style.setProperty('--drop-x', `${8 + Math.random() * 84}%`);
        drop.style.setProperty('--drop-delay', `${Math.random() * 1.4}s`);
        refs.weatherParticles.appendChild(drop);
      }
    }
  }

  function triggerGust() {
    if (!refs.greenhouseScene || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    refs.greenhouseScene.classList.remove('is-gust');
    // 强制重新计算动画，保证连续两次风也能重新播放。
    void refs.greenhouseScene.offsetWidth;
    refs.greenhouseScene.classList.add('is-gust');
    window.setTimeout(() => refs.greenhouseScene.classList.remove('is-gust'), 1800);
  }

  function scheduleGust() {
    if (gustTimer) window.clearTimeout(gustTimer);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gustTimer = window.setTimeout(() => {
      triggerGust();
      scheduleGust();
    }, 9000 + Math.random() * 11000);
  }

  function setPlantSpecies(value) {
    const species = value === 'auto' ? speciesForDate(currentDate) : value;
    if (!plantMap[species]) return;
    const day = getDay();
    if (!day.plant) day.plant = { species, plantedAt: Date.now() };
    if (day.plant.species === species) {
      refs.plantSpecies.value = species;
      return;
    }
    day.plant.species = species;
    touchDay();
    saveStore();
    render();
    showToast(`今天的植物换成了${plantMap[species].name}。`);
  }

  function cyclePlantSpecies() {
    const day = getDay();
    const currentSpecies = day.plant && plantMap[day.plant.species] ? day.plant.species : speciesForDate(currentDate);
    const species = Object.keys(plantMap);
    const next = species[(species.indexOf(currentSpecies) + 1) % species.length];
    setPlantSpecies(next);
  }

  function cycleWeather() {
    const options = ['auto', 'sunny', 'cloudy', 'rainy', 'windy'];
    const current = store.settings.weatherMode || 'auto';
    const next = options[(options.indexOf(current) + 1) % options.length];
    store.settings.weatherMode = next;
    saveStore();
    renderWeather();
    if (next === 'windy') triggerGust();
    const weather = activeWeather();
    showToast(next === 'auto' ? '温室交给自动天气照料。' : `天气切换为${weatherMap[weather].label}。`);
  }

  function changeMonth(amount) {
    const targetMonth = shiftMonth(monthKeyForDate(currentDate), amount);
    const currentDayNumber = Number(currentDate.slice(8)) || 1;
    currentDate = keyForMonthDay(targetMonth, Math.min(currentDayNumber, daysInMonth(targetMonth)));
    setDefaultTime();
    render();
    triggerAnimalInteraction();
  }

  function render() {
    const day = getDay();
    renderHeader();
    renderSummary(day);
    renderTimeline(day);
    renderReflection(day);
    renderOverdue(day);
    renderMonthNav();
    renderPlantDisplay(day);
    renderPlantCollection();
    renderWeather();
    updateMoodButtons();
    if (plantAssignedDuringRead) {
      saveStore();
      plantAssignedDuringRead = false;
    }
    document.title = currentDate === todayKey ? 'MORI / 一日温室' : `MORI / ${labelForDate()}`;
  }

  function openDialog(dialog, focusElement) {
    if (!dialog) return;
    lastFocusElement = document.activeElement;
    try {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    } catch (error) {
      dialog.setAttribute('open', '');
    }
    window.setTimeout(() => focusElement?.focus(), 30);
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    try {
      if (dialog.open && typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    } catch (error) {
      dialog.removeAttribute('open');
    }
    if (lastFocusElement && typeof lastFocusElement.focus === 'function') lastFocusElement.focus();
    lastFocusElement = null;
  }

  function openEdit(taskId) {
    const task = getDay().tasks.find((entry) => entry.id === taskId);
    if (!task) return;
    editingTaskId = taskId;
    refs.editId.value = task.id;
    refs.editText.value = task.text;
    refs.editTime.value = task.time || '';
    refs.editReminder.value = task.reminder || 'none';
    openDialog(refs.editDialog, refs.editText);
  }

  function openReflection() {
    const day = getDay();
    selectedMood = day.mood || 'soft';
    refs.energyRange.value = String(day.energy || 3);
    refs.energyOutput.value = `${refs.energyRange.value} / 5`;
    refs.highlightInput.value = day.highlight || '';
    updateMoodButtons();
    openDialog(refs.reflectionDialog, refs.highlightInput);
  }

  function updateMoodButtons() {
    refs.moodOptions.querySelectorAll('.mood-option').forEach((button) => {
      const selected = button.dataset.mood === selectedMood;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  function showToast(message, options = {}) {
    if (!refs.toastRegion) return;
    const toast = document.createElement('div');
    toast.className = `toast${options.alert ? ' is-alert' : ''}`;
    const mark = document.createElement('span');
    mark.className = 'toast-mark';
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = options.alert ? '!' : '✦';
    const text = document.createElement('span');
    text.className = 'toast-message';
    text.textContent = message;
    toast.append(mark, text);
    if (options.actionLabel && typeof options.action === 'function') {
      const action = document.createElement('button');
      action.className = 'toast-action';
      action.type = 'button';
      action.textContent = options.actionLabel;
      action.addEventListener('click', () => {
        options.action();
        toast.remove();
      });
      toast.appendChild(action);
    }
    refs.toastRegion.appendChild(toast);
    window.setTimeout(() => toast.remove(), options.duration || 5600);
  }

  function addTask(event) {
    event.preventDefault();
    const text = refs.taskInput.value.trim();
    if (!text) return;
    const time = refs.taskTime.value || null;
    let reminder = refs.taskReminder.value;
    if (!time && reminder !== 'none') {
      reminder = 'none';
      showToast('没有固定时间的记录不会触发提醒。', { alert: true });
    }
    const day = getDay();
    const chosenSpecies = refs.plantSpecies.value === 'auto' ? speciesForDate(currentDate) : refs.plantSpecies.value;
    if (!day.plant) day.plant = { species: plantMap[chosenSpecies] ? chosenSpecies : speciesForDate(currentDate), plantedAt: Date.now() };
    day.tasks.push({
      id: makeId(),
      text: text.slice(0, 120),
      time,
      reminder,
      done: false,
      remindedAt: null,
      snoozedUntil: null,
      createdAt: Date.now(),
      completedAt: null
    });
    day.seedUsed = true;
    touchDay();
    saveStore();
    refs.taskForm.reset();
    setDefaultTime();
    render();
    refs.taskInput.focus();
    showToast('已种下，慢慢来。');
    checkDueReminders();
  }

  function toggleTask(taskId) {
    const day = getDay();
    const task = day.tasks.find((entry) => entry.id === taskId);
    if (!task) return;
    task.done = !task.done;
    task.completedAt = task.done ? new Date().toISOString() : null;
    if (task.done) {
      task.remindedAt = task.remindedAt || null;
      task.snoozedUntil = null;
    }
    touchDay();
    saveStore();
    render();
    const item = Array.from(refs.timeline.querySelectorAll('[data-task-id]')).find((entry) => entry.dataset.taskId === taskId);
    if (item && task.done) {
      item.classList.add('just-done');
      window.setTimeout(() => item.classList.remove('just-done'), 420);
    }
    if (task.done) {
      const level = growthLevel(day);
      showToast(level >= 5 ? '完全体！今天的植物盛放了。' : `植物长到 ${level} / 5。`);
    } else {
      showToast('已放回今天。');
    }
  }

  function saveEdit(event) {
    event.preventDefault();
    const day = getDay();
    const task = day.tasks.find((entry) => entry.id === editingTaskId);
    if (!task) return;
    const text = refs.editText.value.trim();
    if (!text) return;
    const time = refs.editTime.value || null;
    task.text = text.slice(0, 120);
    task.time = time;
    task.reminder = time ? refs.editReminder.value : 'none';
    task.remindedAt = null;
    task.snoozedUntil = null;
    touchDay();
    saveStore();
    closeDialog(refs.editDialog);
    render();
    showToast('已调整这件事。');
    editingTaskId = null;
  }

  function deleteTask() {
    if (!editingTaskId) return;
    const day = getDay();
    const task = day.tasks.find((entry) => entry.id === editingTaskId);
    if (!task) return;
    if (!window.confirm(`确定删除“${task.text}”吗？`)) return;
    day.tasks = day.tasks.filter((entry) => entry.id !== editingTaskId);
    touchDay();
    saveStore();
    closeDialog(refs.editDialog);
    render();
    showToast('已删除这件事。');
    editingTaskId = null;
  }

  function saveReflection(event) {
    event.preventDefault();
    const day = getDay();
    if (!day.plant) day.plant = { species: speciesForDate(currentDate), plantedAt: Date.now() };
    day.mood = selectedMood;
    day.energy = Number(refs.energyRange.value) || 3;
    day.highlight = refs.highlightInput.value.trim().slice(0, 240);
    touchDay();
    saveStore();
    closeDialog(refs.reflectionDialog);
    render();
    showToast('今天已被好好收下。');
  }

  function moveOverdue() {
    const day = getDay();
    const overdue = day.tasks.filter((task) => isOverdue(task));
    if (!overdue.length) return;
    const tomorrow = getDay(shiftDate(currentDate, 1));
    overdue.forEach((task) => {
      task.remindedAt = null;
      task.snoozedUntil = null;
      task.done = false;
      tomorrow.tasks.push(task);
    });
    day.tasks = day.tasks.filter((task) => !overdue.includes(task));
    touchDay(currentDate);
    touchDay(shiftDate(currentDate, 1));
    saveStore();
    render();
    showToast(`已把 ${overdue.length} 件事放到明天。`);
  }

  function snoozeTask(taskId) {
    const day = getDay(todayKey);
    const task = day.tasks.find((entry) => entry.id === taskId);
    if (!task) return;
    task.snoozedUntil = Date.now() + 10 * 60000;
    task.remindedAt = null;
    touchDay(todayKey);
    saveStore();
    render();
    showToast('已延后 10 分钟。');
  }

  function sendNotification(task, message) {
    if (!('Notification' in window) || !window.isSecureContext || Notification.permission !== 'granted') return;
    try {
      const notification = new Notification('MORI｜一日温室', { body: message, tag: `mori-${task.id}` });
      notification.onclick = () => { window.focus(); notification.close(); };
    } catch (error) {
      // 浏览器阻止系统通知时，站内 toast 仍然会显示。
    }
  }

  function checkDueReminders() {
    if (!store.settings.remindersEnabled) return;
    const day = getDay(todayKey);
    const now = Date.now();
    let changed = false;
    day.tasks.forEach((task) => {
      if (task.done || !task.time || task.reminder === 'none') return;
      if (task.snoozedUntil && task.snoozedUntil > now) return;
      if (task.remindedAt) return;
      const due = taskDateTime(todayKey, task.time);
      if (!due) return;
      const triggerAt = due.getTime() - reminderOffset(task.reminder) * 60000;
      if (now < triggerAt) return;
      const minutesLate = Math.max(0, Math.floor((now - due.getTime()) / 60000));
      const message = minutesLate > 0 ? `已到 ${task.time}：${task.text}` : (task.reminder === '15' ? `15 分钟后：${task.text}` : `现在：${task.text}`);
      task.remindedAt = new Date(now).toISOString();
      task.snoozedUntil = null;
      changed = true;
      showToast(message, { alert: true, actionLabel: '延后 10 分', action: () => snoozeTask(task.id), duration: 9000 });
      sendNotification(task, message);
    });
    if (changed) {
      touchDay(todayKey);
      saveStore();
      if (currentDate === todayKey) render();
    }
  }

  function requestReminders() {
    if (store.settings.remindersEnabled) {
      store.settings.remindersEnabled = false;
      saveStore();
      render();
      showToast('页面提醒已暂停。');
      return;
    }
    const finish = (systemReady) => {
      store.settings.remindersEnabled = true;
      saveStore();
      render();
      if (systemReady) showToast('系统通知已开启，页面内也会提醒。');
      else showToast('页面提醒已开启；浏览器未提供系统通知。', { alert: true });
      checkDueReminders();
    };
    if (!('Notification' in window) || !window.isSecureContext) {
      finish(false);
      return;
    }
    if (Notification.permission === 'granted') {
      finish(true);
      return;
    }
    if (Notification.permission === 'denied') {
      finish(false);
      showToast('系统通知已被浏览器拒绝，仍会保留页面内提醒。', { alert: true });
      return;
    }
    try {
      const permissionRequest = Notification.requestPermission();
      Promise.resolve(permissionRequest).then((permission) => finish(permission === 'granted')).catch(() => finish(false));
    } catch (error) {
      finish(false);
    }
  }

  function setDefaultTime() {
    if (currentDate !== todayKey) {
      refs.taskTime.value = '09:00';
      return;
    }
    const now = new Date();
    const rounded = new Date(now.getTime());
    rounded.setSeconds(0, 0);
    rounded.setMinutes(Math.ceil((rounded.getMinutes() + 1) / 30) * 30);
    if (rounded.getHours() >= 24) refs.taskTime.value = '23:59';
    else refs.taskTime.value = `${pad(rounded.getHours())}:${pad(rounded.getMinutes())}`;
  }

  function exportData() {
    store.meta.lastExportAt = new Date().toISOString();
    saveStore();
    const blob = new Blob([JSON.stringify(store, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mori-${todayKey}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast('本地记录已导出。');
  }

  function importData() {
    const file = refs.importInput.files && refs.importInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const imported = normalizeStore(parsed);
        const dayCount = Object.keys(imported.days).length;
        if (!window.confirm(`导入会覆盖当前本地记录（${dayCount} 天）。继续吗？`)) return;
        store = imported;
        saveStore();
        render();
        showToast('记录已导入。');
      } catch (error) {
        showToast('这个文件不是有效的 MORI 记录。', { alert: true });
      } finally {
        refs.importInput.value = '';
      }
    };
    reader.readAsText(file);
  }

  function clearDay() {
    const day = getDay();
    if (!day.tasks.length && !day.highlight && !day.mood) {
      showToast('今天还没有需要清空的记录。');
      return;
    }
    if (!window.confirm(`确定清空${labelForDate()}的全部记录吗？`)) return;
    store.days[currentDate] = defaultDay();
    saveStore();
    render();
    showToast('今天已经清空。');
  }

  function onTimelineClick(event) {
    const action = event.target.closest('[data-action]');
    if (!action) return;
    const taskId = action.dataset.id;
    if (action.dataset.action === 'toggle') toggleTask(taskId);
    if (action.dataset.action === 'edit') openEdit(taskId);
  }

  function wireDialogs() {
    [refs.editDialog, refs.reflectionDialog].forEach((dialog) => {
      dialog.addEventListener('cancel', (event) => {
        event.preventDefault();
        closeDialog(dialog);
      });
      dialog.addEventListener('click', (event) => {
        if (event.target === dialog) closeDialog(dialog);
      });
    });
    refs.closeEditButton.addEventListener('click', () => closeDialog(refs.editDialog));
    refs.cancelEditButton.addEventListener('click', () => closeDialog(refs.editDialog));
    refs.closeReflectionButton.addEventListener('click', () => closeDialog(refs.reflectionDialog));
    refs.cancelReflectionButton.addEventListener('click', () => closeDialog(refs.reflectionDialog));
  }

  function init() {
    refs.prevDay.addEventListener('click', () => { currentDate = shiftDate(currentDate, -1); setDefaultTime(); render(); });
    refs.nextDay.addEventListener('click', () => { currentDate = shiftDate(currentDate, 1); setDefaultTime(); render(); });
    refs.todayButton.addEventListener('click', () => { currentDate = todayKey; setDefaultTime(); render(); });
    refs.prevMonth.addEventListener('click', () => changeMonth(-1));
    refs.nextMonth.addEventListener('click', () => changeMonth(1));
    refs.currentMonthButton.addEventListener('click', () => {
      currentDate = todayKey;
      setDefaultTime();
      render();
    });
    refs.reminderButton.addEventListener('click', requestReminders);
    refs.taskForm.addEventListener('submit', addTask);
    refs.timeline.addEventListener('click', onTimelineClick);
    refs.plantSpecies.addEventListener('change', (event) => setPlantSpecies(event.target.value));
    refs.changePlantButton.addEventListener('click', cyclePlantSpecies);
    refs.weatherButton.addEventListener('click', cycleWeather);
    refs.animalButton.addEventListener('click', () => triggerAnimalInteraction());
    refs.plantCollection.addEventListener('click', (event) => {
      const memory = event.target.closest('[data-date]');
      if (!memory) return;
      currentDate = memory.dataset.date;
      setDefaultTime();
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    refs.monthlyPlants.addEventListener('click', (event) => {
      const memory = event.target.closest('[data-date]');
      if (!memory) return;
      currentDate = memory.dataset.date;
      setDefaultTime();
      render();
    });
    refs.openReflectionTop.addEventListener('click', openReflection);
    refs.openReflectionButton.addEventListener('click', openReflection);
    refs.moveOverdueButton.addEventListener('click', moveOverdue);
    refs.editForm.addEventListener('submit', saveEdit);
    refs.deleteTaskButton.addEventListener('click', deleteTask);
    refs.reflectionForm.addEventListener('submit', saveReflection);
    refs.energyRange.addEventListener('input', () => { refs.energyOutput.value = `${refs.energyRange.value} / 5`; });
    refs.moodOptions.addEventListener('click', (event) => {
      const moodButton = event.target.closest('[data-mood]');
      if (!moodButton) return;
      selectedMood = moodButton.dataset.mood;
      updateMoodButtons();
    });
    refs.useSeedButton.addEventListener('click', () => {
      refs.taskInput.value = seedForDate(currentDate);
      getDay().seedUsed = true;
      saveStore();
      refs.seedPrompt.hidden = true;
      refs.taskInput.focus();
    });
    refs.exportButton.addEventListener('click', exportData);
    refs.importButton.addEventListener('click', () => refs.importInput.click());
    refs.importInput.addEventListener('change', importData);
    refs.clearDayButton.addEventListener('click', clearDay);
    wireDialogs();
    window.addEventListener('focus', () => { refreshTodayKey(); checkDueReminders(); });
    window.addEventListener('pageshow', () => { refreshTodayKey(); checkDueReminders(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { refreshTodayKey(); checkDueReminders(); } });
    window.addEventListener('storage', (event) => {
      if (event.key !== STORAGE_KEY) return;
      try { store = event.newValue ? normalizeStore(JSON.parse(event.newValue)) : defaultStore(); render(); } catch (error) { /* ignore malformed cross-tab data */ }
    });
    setDefaultTime();
    render();
    scheduleGust();
    scheduleAnimalVisit();
    window.setInterval(() => { refreshTodayKey(); checkDueReminders(); }, 20000);
  }

  init();
}());

