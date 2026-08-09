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

  // ページを開いた瞬間に、裏側でAIイベント情報を取得しておく
  fetchAndRenderEvents();
});

// ============================================================
// 共通ヘルパー
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

// ============================================================
// AIイベント情報：GASから取得して表示
// ============================================================
function renderEventCard(ev, index) {
  var color = BRANCH_COLOR[ev.branch] || BRANCH_COLOR["他"];
  var hasNews = ev.hasNews;

  var badge = '<span style="font-size:0.72rem; font-weight:700; color:#fff; background:' + color
    + '; padding:2px 10px; border-radius:4px; margin-left:8px; vertical-align:middle;">' + escapeHtml(BRANCH_LABEL[ev.branch]) + '</span>';

  var html = '<div class="event-timeline-item" style="animation-delay:' + (index * 0.06) + 's;' + (hasNews ? '' : ' opacity-adjust: 0.6;') + '">'
    + '<div class="event-marker" style="border-color:' + color + ';"></div>'
    + '<div class="event-content-wrapper"' + (hasNews ? '' : ' style="opacity:0.6;"') + '>'
    + '<span class="event-time-badge">' + escapeHtml(hasNews ? ev.date + '　' + ev.time : '情報なし') + '</span>'
    + '<h4><span class="event-base-name">' + escapeHtml(ev.baseName) + '</span>' + badge + '</h4>';

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

// イベントの日付文字列を解析して、過去かどうか判定できるようにする
function parseEventDate(dateStr) {
  if (!dateStr || dateStr === "-") return null;

  // パターン1: "2026年8月5日（水）" のような形式
  var m = dateStr.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }

  // パターン2: 日にちが抜けている "2026年4月（火）" のような形式
  //   → その月の末日として扱う（誤って除外しないよう甘めに判定）
  m = dateStr.match(/(\d{4})年(\d{1,2})月/);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]), 0);
  }

  // パターン3: JavaScriptがそのまま解釈できる形式（AIが英語形式で返した場合など）
  var fallback = new Date(dateStr);
  if (!isNaN(fallback.getTime())) return fallback;

  // 解析できない場合は「わからない」を意味するnullを返す
  return null;
}

function renderNewsFromEvents(events) {
  var container = document.getElementById("news-list");
  if (!container) return;

  var today = new Date();
  today.setHours(0, 0, 0, 0); // 今日の0時0分を基準にする（今日開催のものは表示する）

  var withNews = events.filter(function (ev) {
    if (!ev.hasNews) return false;
    var eventDate = parseEventDate(ev.date);
    // 日付が解析できない場合は、念のため表示する（誤って隠さないため）
    if (!eventDate) return true;
    return eventDate >= today;
  });

  if (withNews.length === 0) return; // 表示できる未来のイベントが無ければ今の表示のままにする

  // 取得日時が新しい順に並べる
  withNews.sort(function (a, b) {
    return b.fetchedAt.localeCompare(a.fetchedAt);
  });

  var topNews = withNews.slice(0, 4);

  container.innerHTML = topNews.map(function (ev) {
    var dateLabel = ev.fetchedAt.split(" ")[0].replace(/\//g, ".");
    return '<article class="news-item">'
      + '<span class="news-date">' + escapeHtml(dateLabel) + '</span>'
      + '<span class="news-category tag-event">AI取得</span>'
      + '<a href="' + escapeHtml(ev.link || "#") + '" target="_blank" rel="noopener" class="news-title">'
      + escapeHtml(ev.baseName) + '：' + escapeHtml(ev.eventName)
      + '</a>'
      + '</article>';
  }).join("");
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
    renderNewsFromEvents(events);

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
  if (btn) btn.addEventListener("click", fetchAndRenderEvents);
});

// ============================================================
// 出欠アンケート（GASスプレッドシート連携版）
// ============================================================
var surveySettings = null;         // GASから取得した日程・設問設定
var currentMeetingType = "soukai"; // "soukai"（総会） or "yakuinkai"（役員会）
var adminPassword = "";            // 管理者タブで入力されたパスワード（一時保持のみ・保存はしない）

// JSONP方式でGASと通信する共通ヘルパー（Promiseで結果を返す）
function jsonpFetchSurvey(actionUrl) {
  return new Promise(function (resolve, reject) {
    var callbackName = "surveyCb_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
    window[callbackName] = function (data) {
      resolve(data);
      cleanup();
    };
    var script = document.createElement("script");
    script.src = actionUrl + (actionUrl.indexOf("?") > -1 ? "&" : "?") + "callback=" + callbackName;
    script.onerror = function () {
      reject(new Error("通信に失敗しました"));
      cleanup();
    };
    document.body.appendChild(script);
    function cleanup() {
      delete window[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
    }
  });
}

function buildQuery(params) {
  return Object.keys(params).map(function (k) {
    var v = params[k];
    return encodeURIComponent(k) + "=" + encodeURIComponent(v === undefined || v === null ? "" : v);
  }).join("&");
}

function switchSurveyTab(which) {
  document.getElementById("survey-tab-form-btn").classList.toggle("active", which === "form");
  document.getElementById("survey-tab-results-btn").classList.toggle("active", which === "results");
  document.getElementById("survey-form-panel").classList.toggle("active", which === "form");
  document.getElementById("survey-results-panel").classList.toggle("active", which === "results");
}

// ------------------------------------------------------------
// 設定（日程・設問）の取得と表示
// ------------------------------------------------------------
function loadSurveySettings() {
  var display = document.getElementById("meeting-date-display");
  jsonpFetchSurvey(GAS_WEBAPP_URL + "?action=get-survey-settings")
    .then(function (settings) {
      surveySettings = settings;
      renderSoukaiQuestions();
      updateMeetingDateDisplay();
    })
    .catch(function () {
      if (display) display.textContent = "日程情報の取得に失敗しました。時間をおいて再度お試しください。";
    });

  var link = document.getElementById("admin-editor-link");
  if (link) link.href = GAS_WEBAPP_URL + "?action=survey-editor";
}

function updateMeetingDateDisplay() {
  var display = document.getElementById("meeting-date-display");
  if (!display || !surveySettings) return;
  var info = currentMeetingType === "soukai" ? surveySettings.soukai : surveySettings.yakuinkai;
  display.textContent = info.meetingLabel;
}

function renderSoukaiQuestions() {
  var container = document.getElementById("soukai-questions");
  if (!container || !surveySettings) return;
  var questions = surveySettings.questions || [];
  var html = "";
  questions.forEach(function (q, i) {
    if (!q) return;
    html += '<div class="form-group">'
      + '<label for="soukai-q' + (i + 1) + '">' + escapeHtml(q) + '</label>'
      + '<input type="text" id="soukai-q' + (i + 1) + '" class="text-input">'
      + '</div>';
  });
  container.innerHTML = html;
  container.style.display = currentMeetingType === "soukai" ? "block" : "none";
}

function updateFormForMeetingType() {
  var proxySection = document.getElementById("proxy-section");
  var questionsBlock = document.getElementById("soukai-questions");
  var isSoukai = currentMeetingType === "soukai";

  if (questionsBlock) questionsBlock.style.display = isSoukai ? "block" : "none";

  if (proxySection) {
    var statusInput = document.querySelector('input[name="attendance-status"]:checked');
    var isAbsent = statusInput && statusInput.value === "欠席";
    proxySection.style.display = (isSoukai && isAbsent) ? "block" : "none";
  }

  updateMeetingDateDisplay();
}

// ------------------------------------------------------------
// フォームの初期化
// ------------------------------------------------------------
function setupSurveyForm() {
  var form = document.getElementById("attendance-form");
  if (!form) return;

  // 会議区分（総会／役員会）の切り替えボタン
  document.querySelectorAll(".meeting-type-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".meeting-type-btn").forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      currentMeetingType = btn.getAttribute("data-meeting-type");
      updateFormForMeetingType();
    });
  });

  // 出欠選択時に委任状セクションを表示（総会のみ）
  form.querySelectorAll('input[name="attendance-status"]').forEach(function (radio) {
    radio.addEventListener("change", updateFormForMeetingType);
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
    var submitBtn = form.querySelector(".btn-submit");
    var status = form.querySelector('input[name="attendance-status"]:checked').value;
    var isSoukai = currentMeetingType === "soukai";

    var payload = {
      meetingType: isSoukai ? "総会" : "役員会",
      name: document.getElementById("member-name").value,
      district: document.getElementById("member-district").value,
      role: document.getElementById("member-role").value,
      status: status,
      proxyChoice: (isSoukai && status === "欠席" && document.getElementById("proxy-choice")) ? document.getElementById("proxy-choice").value : "",
      proxyName: (isSoukai && status === "欠席" && document.getElementById("proxy-name")) ? document.getElementById("proxy-name").value : "",
      comment: document.getElementById("member-comment").value
    };

    if (isSoukai) {
      for (var i = 1; i <= 5; i++) {
        var input = document.getElementById("soukai-q" + i);
        payload["q" + i + "a"] = input ? input.value : "";
      }
    }

    if (!payload.name || !payload.district) {
      alert("ご氏名と地区協議会は必須です。");
      return;
    }

    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "送信中..."; }

    jsonpFetchSurvey(GAS_WEBAPP_URL + "?action=submit-survey&" + buildQuery(payload))
      .then(function (result) {
        if (result && result.ok) {
          alert("回答を受け付けました。ご協力ありがとうございます。");
          form.reset();
          document.getElementById("proxy-section").style.display = "none";
          renderSoukaiQuestions();
        } else {
          alert("送信に失敗しました。お手数ですが、再度お試しください。");
        }
      })
      .catch(function () {
        alert("通信エラーが発生しました。しばらくしてから再度お試しください。");
      })
      .then(function () {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "回答を送信する"; }
      });
  });

  var unlockBtn = document.getElementById("admin-unlock-btn");
  if (unlockBtn) unlockBtn.addEventListener("click", unlockAdminResults);

  var resetBtn = document.getElementById("reset-survey-btn");
  if (resetBtn) resetBtn.addEventListener("click", function () {
    if (!confirm("すべての回答データをリセットします。よろしいですか？")) return;
    jsonpFetchSurvey(GAS_WEBAPP_URL + "?action=reset-survey-responses&" + buildQuery({ password: adminPassword }))
      .then(function (result) {
        if (result && result.ok) { loadAdminResults(); }
        else { alert((result && result.error) || "リセットに失敗しました。"); }
      })
      .catch(function () { alert("通信エラーが発生しました。"); });
  });

  var refreshBtn = document.getElementById("refresh-survey-btn");
  if (refreshBtn) refreshBtn.addEventListener("click", loadAdminResults);

  updateFormForMeetingType();
  loadSurveySettings();
}

// ------------------------------------------------------------
// 管理者用：回答一覧の表示
// ------------------------------------------------------------
function unlockAdminResults() {
  var pwInput = document.getElementById("admin-password-input");
  var msg = document.getElementById("admin-lock-msg");
  adminPassword = pwInput.value;
  msg.textContent = "確認中...";

  jsonpFetchSurvey(GAS_WEBAPP_URL + "?action=get-survey-responses&" + buildQuery({ password: adminPassword }))
    .then(function (result) {
      if (result && result.ok) {
        msg.textContent = "";
        document.getElementById("admin-lock-card").style.display = "none";
        document.getElementById("admin-results-content").style.display = "";
        renderSurveyResults(result.responses || []);
      } else {
        msg.textContent = (result && result.error) || "パスワードが違います。";
      }
    })
    .catch(function () { msg.textContent = "通信エラーが発生しました。"; });
}

function loadAdminResults() {
  jsonpFetchSurvey(GAS_WEBAPP_URL + "?action=get-survey-responses&" + buildQuery({ password: adminPassword }))
    .then(function (result) {
      if (result && result.ok) { renderSurveyResults(result.responses || []); }
      else { alert((result && result.error) || "取得に失敗しました。"); }
    })
    .catch(function () { alert("通信エラーが発生しました。"); });
}

function renderSurveyResults(responses) {
  var total = responses.length;
  var attend = responses.filter(function (r) { return r.status === "出席"; }).length;
  var absent = responses.filter(function (r) { return r.status === "欠席"; }).length;
  var pending = responses.filter(function (r) { return r.status === "保留"; }).length;

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
    tbody.innerHTML = responses.map(function (r) {
      var noteParts = [];
      if (r.proxyChoice) noteParts.push("委任: " + r.proxyChoice + (r.proxyName ? "（" + r.proxyName + "）" : ""));
      if (r.comment) noteParts.push(r.comment);
      var note = noteParts.join(" / ");
      return "<tr><td>" + escapeHtml(r.name) + "</td><td>" + escapeHtml(r.district) + "</td><td>" + escapeHtml(r.meetingType)
        + '</td><td><span class="badge ' + (badgeClass[r.status] || "") + '">' + escapeHtml(r.status) + "</span></td><td>" + escapeHtml(note) + "</td></tr>";
    }).join("");
  }
}
