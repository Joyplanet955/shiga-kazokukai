// ============================================================
// 滋賀県自衛隊家族会 ホームページ app.js
// ============================================================

// ↓↓↓ ここを、GASをデプロイして発行された /exec URLに書き換えてください ↓↓↓
const GAS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbw0P5AkJKkWbIjIyKVOM7UXcudTsf58of_TZdVrSg_W6375_68rpllPH3h_D-nRWoespA/exec";
// ↑↑↑ ここを、GASをデプロイして発行された /exec URLに書き換えてください ↑↑↑

const BRANCH_COLOR = { "陸": "#3f7d4f", "海": "#2a5c8a", "空": "#3f8ac9", "他": "#8a8a8a" };
const BRANCH_LABEL = { "陸": "陸上自衛隊", "海": "海上自衛隊", "空": "航空自衛隊", "他": "" };

// ============================================================
// タブ切り替え
// ============================================================
function switchTab(tabName) {
  // ナビゲーションのハイライト切り替え
  document.querySelectorAll(".nav-link").forEach(function (link) {
    link.classList.toggle("active", link.getAttribute("onclick") && link.getAttribute("onclick").indexOf("'" + tabName + "'") !== -1);
  });

  // コンテンツの切り替え
  document.querySelectorAll(".tab-content").forEach(function (section) {
    section.classList.remove("active-tab");
  });
  var target = document.getElementById(tabName + "-section");
  if (target) target.classList.add("active-tab");

  // モバイルメニューを開いていたら閉じる
  var navMenu = document.getElementById("nav-menu");
  if (navMenu) navMenu.classList.remove("open");

  window.scrollTo({ top: document.querySelector(".main-content").offsetTop - 80, behavior: "smooth" });

  // AIイベントタブを開いたら、まだ一度も読み込んでいなければ自動取得
  if (tabName === "ai-events" && !window.__aiEventsLoaded) {
    fetchAndRenderEvents();
  }
}

// ============================================================
// モバイルメニュー開閉
// ============================================================
document.addEventListener("DOMContentLoaded", function () {
  var toggleBtn = document.getElementById("mobile-toggle");
  var navMenu = document.getElementById("nav-menu");
  if (toggleBtn && navMenu) {
    toggleBtn.addEventListener("click", function () {
      navMenu.classList.toggle("open");
    });
  }

  // 初期表示はホーム
  switchTab("home");

  setupSurveyForm();
});

// ============================================================
// AIイベント情報：GASから取得して表示
// ============================================================
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function appendLog(message, type) {
  var log = document.getElementById("terminal-log");
  if (!log) return;
  var line = document.createElement("div");
  line.className = "log-line" + (type ? " log-line-" + type : "");
  line.textContent = message;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
}

function renderEventCard(ev, index) {
  var color = BRANCH_COLOR[ev.branch] || BRANCH_COLOR["他"];
  var hasNews = ev.hasNews;

  var badge = '<span style="font-size:0.72rem; font-weight:700; color:#fff; background:' + color
    + '; padding:2px 10px; border-radius:4px; margin-left:8px; vertical-align:middle;">' + escapeHtml(BRANCH_LABEL[ev.branch]) + '</span>';

  var html = '<div class="event-timeline-item" style="animation-delay:' + (index * 0.06) + 's;' + (hasNews ? '' : ' opacity-adjust: 0.6;') + '">'
    + '<div class="event-marker" style="border-color:' + color + ';"></div>'
    + '<div class="event-content-wrapper"' + (hasNews ? '' : ' style="opacity:0.6;"') + '>'
    + '<span class="event-time-badge">' + escapeHtml(hasNews ? ev.date + '　' + ev.time : '情報なし') + '</span>'
    + '<h4>' + escapeHtml(ev.baseName) + badge + '</h4>';

  if (hasNews) {
    html += '<div style="font-size:0.95rem; font-weight:700; color:var(--primary-color); margin-bottom:6px;">' + escapeHtml(ev.eventName) + '</div>'
      + '<div class="event-meta"><span>👥 ' + escapeHtml(ev.audience) + '</span><span>更新: ' + escapeHtml(ev.fetchedAt) + '</span></div>'
      + '<div class="event-details">' + escapeHtml(ev.details) + '</div>';
  }

  if (ev.link && hasNews) {
    html += '<div style="margin-top:10px;"><a href="' + escapeHtml(ev.link) + '" target="_blank" rel="noopener" class="btn btn-outline btn-small">詳細を見る</a></div>';
  }

  html += '</div></div>';
  return html;
}

function fetchAndRenderEvents() {
  var btn = document.getElementById("trigger-scrape-btn");
  var btnText = document.getElementById("scrape-btn-text");
  var icon = document.getElementById("scrape-icon");
  var timeline = document.getElementById("events-timeline");

  if (btn) btn.disabled = true;
  if (btnText) btnText.textContent = "取得中...";
  if (icon) { icon.classList.remove("spin-icon-disabled"); icon.classList.add("spin-icon"); }

  appendLog("PROCESS: GASサーバーへ問い合わせ中...", "process");

  var callbackName = "gasCallback_" + Date.now();

  window[callbackName] = function (events) {
    window.__aiEventsLoaded = true;

    if (timeline) {
      timeline.innerHTML = events.map(renderEventCard).join("");
    }
    appendLog("SUCCESS: " + events.length + "件のイベント情報を反映しました。", "success");

    var now = new Date();
    var timeStr = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0")
      + " " + String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
    var lastCheck = document.getElementById("last-check-time");
    if (lastCheck) lastCheck.textContent = timeStr;

    cleanup();
  };

  var script = document.createElement("script");
  script.src = GAS_WEBAPP_URL + "?format=json&callback=" + callbackName;
  script.onerror = function () {
    appendLog("ERROR: 情報の取得に失敗しました。", "process");
    console.error("AIイベント取得エラー: スクリプトの読み込みに失敗しました");
    cleanup();
  };
  document.body.appendChild(script);

  function cleanup() {
    delete window[callbackName];
    if (script.parentNode) script.parentNode.removeChild(script);
    if (btn) btn.disabled = false;
    if (btnText) btnText.textContent = "AIで最新のイベント情報を収集する";
    if (icon) { icon.classList.remove("spin-icon"); icon.classList.add("spin-icon-disabled"); }
  }
}

document.addEventListener("DOMContentLoaded", function () {
  var btn = document.getElementById("trigger-scrape-btn");
// ============================================================
// 出欠アンケート（簡易・ブラウザ内メモリ保持のみ / デモ用）
// ============================================================
var surveyResponses = [];

function switchSurveyTab(which) {
  document.getElementById("survey-tab-form-btn").classList.toggle("active", which === "form");
  document.getElementById("survey-tab-results-btn").classList.toggle("active", which === "results");
  document.getElementById("survey-form-panel").classList.toggle("active", which === "form");
  document.getElementById("survey-results-panel").classList.toggle("active", which === "results");
}

function setupSurveyForm() {
  var form = document.getElementById("attendance-form");
  if (!form) return;

  // 欠席選択時に委任状セクションを表示
  form.querySelectorAll('input[name="attendance-status"]').forEach(function (radio) {
    radio.addEventListener("change", function () {
      var proxySection = document.getElementById("proxy-section");
      proxySection.style.display = (radio.value === "欠席" && radio.checked) ? "block" : (form.querySelector('input[name="attendance-status"]:checked').value === "欠席" ? "block" : "none");
    });
  });

  var proxyChoice = document.getElementById("proxy-choice");
  if (proxyChoice) {
    proxyChoice.addEventListener("change", function () {
      var proxyNameInput = document.getElementById("proxy-name");
      proxyNameInput.style.display = (proxyChoice.value === "他の出席会員に委任します") ? "block" : "none";
    });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var status = form.querySelector('input[name="attendance-status"]:checked').value;
    surveyResponses.push({
      name: document.getElementById("member-name").value,
      district: document.getElementById("member-district").value,
      meeting: document.getElementById("target-meeting").value,
      status: status,
      comment: document.getElementById("member-comment").value || (status === "欠席" ? (document.getElementById("proxy-choice") ? document.getElementById("proxy-choice").value : "") : "")
    });
    alert("回答を受け付けました。ご協力ありがとうございます。");
    form.reset();
    document.getElementById("proxy-section").style.display = "none";
    renderSurveyResults();
  });

  var resetBtn = document.getElementById("reset-survey-btn");
  if (resetBtn) resetBtn.addEventListener("click", function () {
    if (confirm("集計データをリセットします。よろしいですか？")) {
      surveyResponses = [];
      renderSurveyResults();
    }
  });

  var mockBtn = document.getElementById("add-mock-btn");
  if (mockBtn) mockBtn.addEventListener("click", function () {
    surveyResponses.push({
      name: "サンプル 太郎", district: "大津地区会",
      meeting: document.getElementById("target-meeting").value,
      status: ["出席", "欠席", "保留"][Math.floor(Math.random() * 3)],
      comment: "(デモデータ)"
    });
    renderSurveyResults();
  });

  renderSurveyResults();
}

function renderSurveyResults() {
  var total = surveyResponses.length;
  var attend = surveyResponses.filter(function (r) { return r.status === "出席"; }).length;
  var absent = surveyResponses.filter(function (r) { return r.status === "欠席"; }).length;
  var pending = surveyResponses.filter(function (r) { return r.status === "保留"; }).length;

  var totalEl = document.getElementById("total-responses");
  if (totalEl) totalEl.textContent = total;

  function pct(n) { return total === 0 ? 0 : Math.round((n / total) * 100); }

  var attendPct = pct(attend), absentPct = pct(absent), pendingPct = pct(pending);

  var setText = function (id, val) { var el = document.getElementById(id); if (el) el.textContent = val; };
  setText("legend-attend-pct", attendPct + "%");
  setText("legend-attend-count", attend);
  setText("legend-absent-pct", absentPct + "%");
  setText("legend-absent-count", absent);
  setText("legend-pending-pct", pendingPct + "%");
  setText("legend-pending-count", pending);

  var pie = document.getElementById("pie-chart");
  if (pie) {
    pie.style.background = "conic-gradient(#3f7d4f 0% " + attendPct + "%, #c0392b " + attendPct + "% " + (attendPct + absentPct) + "%, #cccccc " + (attendPct + absentPct) + "% 100%)";
    pie.style.borderRadius = "50%";
  }

  var tbody = document.getElementById("results-table-body");
  if (tbody) {
    var badgeClass = { "出席": "badge-attend", "欠席": "badge-absent", "保留": "badge-pending" };
    tbody.innerHTML = surveyResponses.map(function (r) {
      return "<tr><td>" + escapeHtml(r.name) + "</td><td>" + escapeHtml(r.district) + "</td><td>" + escapeHtml(r.meeting)
        + '</td><td><span class="badge ' + (badgeClass[r.status] || "") + '">' + escapeHtml(r.status) + "</span></td><td>" + escapeHtml(r.comment) + "</td></tr>";
    }).join("");
  }
}
