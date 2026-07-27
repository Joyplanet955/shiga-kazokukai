/**
 * 活動報告カードの写真を、GAS（写真アップロード係）から読み込んで表示します。
 * 下の GAS_WEB_APP_URL を、PhotoBackend.gs をデプロイして発行されたURLに書き換えてください。
 * 例: https://script.google.com/macros/s/AKfycb.../exec
 */
(function () {
  var GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzOtTzGjV_3qerlV6BG8GPy9h4lCRxUzayX01tklstV6CBNFSD38DaIjciENIEqM0YJzA/exec?action=photos'; // 例: https://script.google.com/macros/s/xxxxxxxx/exec

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
        var container = card.querySelector('.article-photo');
        if (!container) return;
        var url = map[eventId] && map[eventId].url;
        if (!url) return;

        var img = document.createElement('img');
        img.src = url;
        img.alt = '';
        img.loading = 'lazy';
        container.innerHTML = '';
        container.appendChild(img);
      });
    })
    .catch(function (err) {
      console.warn('活動報告の写真読み込みに失敗しました', err);
    });
})();
