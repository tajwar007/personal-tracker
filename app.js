const STORAGE_KEY = "shikhi-learning-tracker-v1";
const bnDigits = new Intl.NumberFormat("bn-BD");
const dateFormatter = new Intl.DateTimeFormat("bn-BD", { weekday: "long", day: "numeric", month: "long" });
const shortDateFormatter = new Intl.DateTimeFormat("bn-BD", { day: "numeric", month: "short" });
const dayFormatter = new Intl.DateTimeFormat("bn-BD", { weekday: "short" });
const colors = ["", "color-1", "color-2", "color-3"];
const symbols = { "প্রোগ্রামিং": "</>", "ভাষা": "文", "ডিজাইন": "✳", "ব্যবসা": "↗", "ব্যক্তিগত উন্নয়ন": "✦", "অন্যান্য": "◇" };
const state = loadState();
let activeFilter = "all";
let editingGoalId = null;
let toastTimeout;

const elements = {
  todayLabel: document.querySelector("#today-label"),
  goalNavCount: document.querySelector("#goal-nav-count"),
  weeklyHours: document.querySelector("#weekly-hours"),
  activeGoals: document.querySelector("#active-goals"),
  completedGoals: document.querySelector("#completed-goals"),
  todayMinutes: document.querySelector("#today-minutes"),
  allFilterCount: document.querySelector("#all-filter-count"),
  goalsList: document.querySelector("#goals-list"),
  weekChart: document.querySelector("#week-chart"),
  chartTotal: document.querySelector("#chart-total"),
  activityList: document.querySelector("#activity-list"),
  goalDialog: document.querySelector("#goal-dialog"),
  goalForm: document.querySelector("#goal-form"),
  goalTitle: document.querySelector("#goal-title"),
  goalDialogTitle: document.querySelector("#goal-dialog-title"),
  goalSubmit: document.querySelector("#goal-submit"),
  sessionDialog: document.querySelector("#session-dialog"),
  sessionForm: document.querySelector("#session-form"),
  sessionGoal: document.querySelector("#session-goal"),
  toast: document.querySelector("#toast"),
};

function loadState() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    window.addEventListener("DOMContentLoaded", () => showToast(`স্থানীয় স্টোরেজে প্রবেশ করা যায়নি: ${error.message}`, true), { once: true });
    return { goals: [], sessions: [] };
  }
  if (!raw) return { goals: [], sessions: [] };
  try {
    const saved = JSON.parse(raw);
    if (!saved || !Array.isArray(saved.goals) || !Array.isArray(saved.sessions)) {
      throw new Error("সংরক্ষিত তথ্যের গঠন সঠিক নয়।");
    }
    return {
      goals: saved.goals.filter((goal) => goal && typeof goal.id === "string" && typeof goal.title === "string"),
      sessions: saved.sessions.filter((session) => session && typeof session.id === "string" && Number.isFinite(session.minutes)),
    };
  } catch (error) {
    window.addEventListener("DOMContentLoaded", () => showToast(`আগের তথ্য পড়া যায়নি: ${error.message}`, true), { once: true });
    return { goals: [], sessions: [] };
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    showToast(`তথ্য সংরক্ষণ করা যায়নি: ${error.message}`, true);
    return false;
  }
}

function toBn(value) {
  return bnDigits.format(value);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function sessionDate(session) {
  const date = new Date(session.createdAt);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isSameDay(first, second) {
  return dateKey(first) === dateKey(second);
}

function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours && remainder) return `${toBn(hours)} ঘণ্টা ${toBn(remainder)} মি.`;
  if (hours) return `${toBn(hours)} ঘণ্টা`;
  return `${toBn(remainder)} মিনিট`;
}

function showToast(message, isError = false) {
  clearTimeout(toastTimeout);
  elements.toast.textContent = message;
  elements.toast.classList.toggle("is-error", isError);
  elements.toast.classList.add("is-visible");
  toastTimeout = setTimeout(() => elements.toast.classList.remove("is-visible"), 3200);
}

function render() {
  const today = new Date();
  elements.todayLabel.textContent = dateFormatter.format(today);
  renderStats(today);
  renderGoals();
  renderChart(today);
  renderActivity();
  updateSessionOptions();
}

function renderStats(today) {
  const weekStart = startOfDay(today);
  weekStart.setDate(weekStart.getDate() - 6);
  const weekMinutes = state.sessions.reduce((total, session) => {
    const date = sessionDate(session);
    return date && date >= weekStart && date <= today ? total + session.minutes : total;
  }, 0);
  const todayMinutes = state.sessions.reduce((total, session) => {
    const date = sessionDate(session);
    return date && isSameDay(date, today) ? total + session.minutes : total;
  }, 0);
  const active = state.goals.filter((goal) => goal.status === "active").length;
  const completed = state.goals.filter((goal) => goal.status === "completed").length;

  elements.weeklyHours.textContent = toBn(Math.floor(weekMinutes / 60));
  elements.activeGoals.textContent = toBn(active);
  elements.completedGoals.textContent = toBn(completed);
  elements.todayMinutes.textContent = toBn(todayMinutes);
  elements.goalNavCount.textContent = toBn(active);
  elements.allFilterCount.textContent = toBn(state.goals.length);
}

function renderGoals() {
  const goals = state.goals.filter((goal) => activeFilter === "all" || goal.status === activeFilter);
  if (!goals.length) {
    const isFiltered = state.goals.length > 0;
    elements.goalsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-illustration" aria-hidden="true">${isFiltered ? "◎" : "✦"}</div>
        <h3>${isFiltered ? "এখানে এখন কিছু নেই" : "তোমার শেখার গল্প শুরু হোক"}</h3>
        <p>${isFiltered ? "এই ফিল্টারে কোনো লক্ষ্য পাওয়া যায়নি। অন্য ফিল্টারটি বেছে নাও।" : "যে বিষয়টি শিখতে চাও, সেটি যোগ করো। অগ্রগতি আর পড়ার সময় এক জায়গাতেই থাকবে।"}</p>
        ${isFiltered ? "" : '<button class="button button-primary" type="button" data-add-goal>＋ প্রথম লক্ষ্য যোগ করো</button>'}
      </div>`;
    elements.goalsList.querySelector("[data-add-goal]")?.addEventListener("click", openGoalDialog);
    return;
  }

  elements.goalsList.innerHTML = goals.map((goal) => {
    const color = colors[Math.abs(Number(goal.colorIndex) || 0) % colors.length];
    const progress = Math.max(0, Math.min(100, Number(goal.progress) || 0));
    const icon = symbols[goal.category] || symbols["অন্যান্য"];
    const hoursText = Number(goal.targetHours) ? `${toBn(goal.targetHours)} ঘণ্টার লক্ষ্য` : "লক্ষ্য নির্ধারিত নয়";
    return `
      <article class="goal-card">
        <div class="goal-avatar ${color}" aria-hidden="true">${escapeHtml(icon)}</div>
        <div class="goal-main">
          <div class="goal-title-row"><span class="goal-title" title="${escapeHtml(goal.title)}">${escapeHtml(goal.title)}</span></div>
          <div class="goal-category">${escapeHtml(goal.category || "অন্যান্য")}</div>
          <div class="goal-progress-row">
            <div class="progress-track" role="progressbar" aria-label="${escapeHtml(goal.title)}-এর অগ্রগতি" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100">
              <div class="progress-fill ${color}" style="width: ${progress}%"></div>
            </div>
            <span class="progress-label">${toBn(progress)}%</span>
          </div>
        </div>
        <div class="goal-side">
          <span class="goal-hours">${hoursText}</span>
          <div class="goal-actions">
            <button class="goal-action" type="button" data-action="session" data-id="${escapeHtml(goal.id)}" aria-label="${escapeHtml(goal.title)}-এ পড়ার সময় যোগ করো" title="সময় যোগ করো">＋</button>
            <button class="goal-action" type="button" data-action="edit" data-id="${escapeHtml(goal.id)}" aria-label="${escapeHtml(goal.title)} সম্পাদনা করো" title="সম্পাদনা">✎</button>
            <button class="goal-action delete" type="button" data-action="delete" data-id="${escapeHtml(goal.id)}" aria-label="${escapeHtml(goal.title)} মুছে ফেলো" title="মুছে ফেলো">×</button>
          </div>
        </div>
      </article>`;
  }).join("");
}

function renderChart(today) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = startOfDay(today);
    date.setDate(date.getDate() - (6 - index));
    const minutes = state.sessions.reduce((total, session) => {
      const sessionDay = sessionDate(session);
      return sessionDay && isSameDay(sessionDay, date) ? total + session.minutes : total;
    }, 0);
    return { date, minutes };
  });
  const maxMinutes = Math.max(...days.map((day) => day.minutes), 30);
  const total = days.reduce((sum, day) => sum + day.minutes, 0);
  elements.weekChart.innerHTML = days.map(({ date, minutes }) => {
    const height = minutes ? Math.max(8, (minutes / maxMinutes) * 100) : 3;
    const isToday = isSameDay(date, today);
    return `<div class="chart-day ${isToday ? "is-today" : ""}" aria-label="${dayFormatter.format(date)}: ${formatDuration(minutes)}">
      <div class="chart-bar-track"><div class="chart-bar" style="height: ${height}%"></div></div>
      <span class="chart-label">${dayFormatter.format(date)}</span>
    </div>`;
  }).join("");
  elements.chartTotal.textContent = `${toBn(total)} মিনিট`;
}

function renderActivity() {
  const recent = [...state.sessions]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 4);
  if (!recent.length) {
    elements.activityList.innerHTML = '<div class="activity-empty">এখনও কোনো পড়ার সেশন যোগ করা হয়নি।<br />পড়া শেষে সময় যোগ করলে এখানে দেখা যাবে।</div>';
    return;
  }
  elements.activityList.innerHTML = recent.map((session) => {
    const goal = state.goals.find((item) => item.id === session.goalId);
    const date = sessionDate(session);
    const when = date ? (isSameDay(date, new Date()) ? "আজ" : shortDateFormatter.format(date)) : "তারিখ অজানা";
    const note = session.note ? ` · ${escapeHtml(session.note)}` : "";
    return `<div class="activity-item">
      <div class="activity-item-icon" aria-hidden="true">◷</div>
      <div class="activity-details">
        <div class="activity-title">${escapeHtml(goal ? goal.title : "মুছে ফেলা লক্ষ্য")}</div>
        <div class="activity-meta">${when}${note}</div>
      </div>
      <span class="activity-duration">${formatDuration(session.minutes)}</span>
    </div>`;
  }).join("");
}

function updateSessionOptions(selectedId) {
  const available = state.goals.filter((goal) => goal.status !== "completed");
  if (!available.length) {
    elements.sessionGoal.innerHTML = '<option value="">আগে একটি চলমান লক্ষ্য যোগ করো</option>';
    return;
  }
  elements.sessionGoal.innerHTML = available.map((goal) =>
    `<option value="${escapeHtml(goal.id)}">${escapeHtml(goal.title)}</option>`
  ).join("");
  if (selectedId && available.some((goal) => goal.id === selectedId)) elements.sessionGoal.value = selectedId;
}

function openGoalDialog(goal = null) {
  editingGoalId = goal ? goal.id : null;
  elements.goalForm.reset();
  if (goal) {
    elements.goalDialogTitle.textContent = "লক্ষ্য সম্পাদনা";
    elements.goalSubmit.textContent = "পরিবর্তন সংরক্ষণ";
    elements.goalForm.elements.title.value = goal.title;
    elements.goalForm.elements.category.value = goal.category || "অন্যান্য";
    elements.goalForm.elements.targetHours.value = goal.targetHours || 20;
    elements.goalForm.elements.progress.value = goal.progress || 0;
  } else {
    elements.goalDialogTitle.textContent = "নতুন শেখার লক্ষ্য";
    elements.goalSubmit.textContent = "লক্ষ্য যোগ করো";
    elements.goalForm.elements.targetHours.value = 20;
    elements.goalForm.elements.progress.value = 0;
  }
  elements.goalDialog.showModal();
  requestAnimationFrame(() => elements.goalTitle.focus());
}

function openSessionDialog(goalId) {
  updateSessionOptions(goalId);
  if (!state.goals.some((goal) => goal.status !== "completed")) {
    showToast("সময় যোগ করার আগে একটি চলমান শেখার লক্ষ্য তৈরি করো।", true);
    return;
  }
  elements.sessionForm.reset();
  updateSessionOptions(goalId);
  elements.sessionDialog.showModal();
  requestAnimationFrame(() => document.querySelector("#session-minutes").focus());
}

function handleGoalSubmit(event) {
  event.preventDefault();
  const data = new FormData(elements.goalForm);
  const title = String(data.get("title")).trim();
  const targetHours = Number(data.get("targetHours"));
  const progress = Number(data.get("progress"));
  if (!title || !Number.isInteger(targetHours) || targetHours < 1 || targetHours > 10000 || !Number.isInteger(progress) || progress < 0 || progress > 100) {
    showToast("তথ্যগুলো ঠিকভাবে পূরণ করো।", true);
    return;
  }

  const existing = editingGoalId ? state.goals.find((goal) => goal.id === editingGoalId) : null;
  const goal = {
    id: existing ? existing.id : crypto.randomUUID(),
    title,
    category: String(data.get("category")),
    targetHours,
    progress,
    status: progress === 100 ? "completed" : "active",
    colorIndex: existing ? existing.colorIndex : state.goals.length % colors.length,
    createdAt: existing ? existing.createdAt : new Date().toISOString(),
  };
  if (existing) {
    state.goals.splice(state.goals.indexOf(existing), 1, goal);
  } else {
    state.goals.unshift(goal);
  }
  if (!saveState()) return;
  elements.goalDialog.close();
  render();
  showToast(existing ? "লক্ষ্যটি হালনাগাদ হয়েছে।" : "নতুন লক্ষ্য যোগ হয়েছে।");
}

function handleSessionSubmit(event) {
  event.preventDefault();
  const data = new FormData(elements.sessionForm);
  const goalId = String(data.get("goalId"));
  const minutes = Number(data.get("minutes"));
  const goal = state.goals.find((item) => item.id === goalId && item.status !== "completed");
  if (!goal || !Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
    showToast("একটি চলমান লক্ষ্য বেছে নিয়ে সঠিক সময় দাও।", true);
    return;
  }
  state.sessions.unshift({
    id: crypto.randomUUID(),
    goalId,
    minutes,
    note: String(data.get("note")).trim(),
    createdAt: new Date().toISOString(),
  });
  if (!saveState()) {
    state.sessions.shift();
    return;
  }
  elements.sessionDialog.close();
  render();
  showToast(`${formatDuration(minutes)} যোগ হয়েছে—চমৎকার!`);
}

function handleGoalAction(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const goal = state.goals.find((item) => item.id === button.dataset.id);
  if (!goal) return;
  if (button.dataset.action === "session") openSessionDialog(goal.id);
  if (button.dataset.action === "edit") openGoalDialog(goal);
  if (button.dataset.action === "delete") {
    if (!window.confirm(`“${goal.title}” লক্ষ্যটি মুছে ফেলবে? আগের পড়ার সেশনগুলো ইতিহাসে থাকবে।`)) return;
    const index = state.goals.indexOf(goal);
    state.goals.splice(index, 1);
    if (!saveState()) {
      state.goals.splice(index, 0, goal);
      return;
    }
    render();
    showToast("লক্ষ্যটি মুছে ফেলা হয়েছে।");
  }
}

document.querySelector("#add-goal-button").addEventListener("click", () => openGoalDialog());
document.querySelector("#quick-session-button").addEventListener("click", () => openSessionDialog());
document.querySelector("#show-all-button").addEventListener("click", () => {
  activeFilter = "all";
  document.querySelectorAll(".filter-chip").forEach((chip) => chip.classList.toggle("is-selected", chip.dataset.filter === "all"));
  renderGoals();
  document.querySelector("#goals").scrollIntoView({ behavior: "smooth", block: "start" });
});
document.querySelectorAll(".filter-chip").forEach((chip) => chip.addEventListener("click", () => {
  activeFilter = chip.dataset.filter;
  document.querySelectorAll(".filter-chip").forEach((item) => item.classList.toggle("is-selected", item === chip));
  renderGoals();
}));
document.querySelector("#goals-list").addEventListener("click", handleGoalAction);
elements.goalForm.addEventListener("submit", handleGoalSubmit);
elements.sessionForm.addEventListener("submit", handleSessionSubmit);
document.querySelectorAll("[data-close-dialog]").forEach((button) => button.addEventListener("click", () => button.closest("dialog").close()));
document.querySelectorAll(".nav-link").forEach((link) => link.addEventListener("click", () => {
  document.querySelectorAll(".nav-link").forEach((item) => item.classList.toggle("is-active", item === link));
}));

render();
