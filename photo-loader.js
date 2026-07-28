/**
 * 活動報告カードの写真・記事タイトル・本文を、GAS（活動報告 編集係）から読み込んで反映します。
 * 下の GAS_WEB_APP_URL は、以前設定した値のままで大丈夫です（変更不要）。
 * 例: https://script.google.com/macros/s/AKfycb.../exec?action=photos
 */
(function () {
  var GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzOtTzGjV_3qerlV6BG8GPy9h4lCRxUzayX01tklstV6CBNFSD38DaIjciENIEqM0YJzA/exec'; // 既に実際のURLに書き換え済みならそのままでOK

  if (!GAS_WEB_APP_URL || GAS_WEB_APP_URL.indexOf('http') !== 0) {
    console.warn('photo-loader.js: GAS_WEB_APP_URL が設定されていません。');
    return;
  }

  fetch(GAS_WEB_APP_URL + '?action=photos')
    .then(function (res) { return res.json(); })
    .then(function (map) {
      Object.keys(map || {}).forEach(function (eventId) {
        var card = document.querySelector('[data-event-id="' + eventId + '"]');
        if (!card) return;
        var data = map[eventId] || {};

        // --- 写真 ---
        if (data.url) {
          var container = card.querySelector('.article-photo');
          if (container) {
            var img = document.createElement('img');
            img.src = data.url;
            img.alt = '';
            img.loading = 'lazy';
            container.innerHTML = '';
            container.appendChild(img);
          }
        }

        // --- タイトル ---
        if (data.title) {
          var h3 = card.querySelector('.article-content h3');
          if (h3) h3.textContent = data.title;
        }

        // --- 日付 ---
        if (data.date) {
          var dateSpan = card.querySelector('.article-date');
          if (dateSpan) dateSpan.textContent = data.date;
        }

        // --- 本文 ---
        if (data.body) {
          var p = card.querySelector('.article-content p');
          if (p) p.textContent = data.body;
        }
      });
    })
    .catch(function (err) {
      console.warn('活動報告の内容読み込みに失敗しました', err);
    });
})();
