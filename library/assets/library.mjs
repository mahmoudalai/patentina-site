const config = JSON.parse(document.getElementById('library-config').textContent);
const localTab = new URL(location.href);
// The download page handles App Store handoff inside social apps and Android availability.
if (/Android|TikTok|Bytedance|musical_ly|Instagram|FBAN|FBAV|FB_IAB|Messenger/i.test(navigator.userAgent)) {
  for (const link of document.querySelectorAll('[data-store-fallback]')) {
    link.href = link.dataset.storeFallback;
  }
}
const book = document.body.dataset.book || '';
const choices = ['tiktok','instagram','facebook','whatsapp','messenger','youtube','direct'];
const source = (localTab.searchParams.get('utm_source') || localTab.searchParams.get('source') || 'direct').toLowerCase();
const attrs = { source: choices.includes(source) ? source : 'other' };
const campaignFields = ['utm_medium','utm_campaign','utm_content','utm_term','utm_id'];
for (const field of campaignFields) {
  const label = localTab.searchParams.get(field)?.toLowerCase();
  if (label && /^[a-z][a-z0-9_-]{0,39}$/.test(label) && !/\d{7}/.test(label)) attrs[field] = label;
}
const consentKey = 'patentina_library_statistics';
const hasDownloadError = localTab.searchParams.get('download_error') === '1';
const analyticsDialog = document.getElementById('analytics-dialog');
let consent = false;
let viewed = false;
try { consent = localStorage.getItem(consentKey) === 'yes'; } catch {}
const honorPrivacy = navigator.globalPrivacyControl === true || navigator.doNotTrack === '1';
function updateDownloads() {
  for (const link of document.querySelectorAll('[data-attachment]')) {
    if (!config.endpoint || hasDownloadError) continue;
    const target = new URL(config.endpoint);
    target.searchParams.set('asset', link.dataset.attachment);
    if (consent && !honorPrivacy) target.searchParams.set('stats', '1');
    link.href = target.href;
  }
}
updateDownloads();
if (attrs.source !== 'direct' || campaignFields.some(field => attrs[field])) {
  for (const link of document.querySelectorAll('a[href^="/library/"]:not([data-attachment]):not([target])')) {
    const next = new URL(link.href);
    for (const [name, value] of Object.entries(attrs)) next.searchParams.set(name, value);
    link.href = next.href;
  }
}
function track(event, title = book) {
  if (!consent || honorPrivacy || !config.endpoint) return;
  try {
    fetch(config.endpoint, {
      method: 'POST', keepalive: true, credentials: 'omit', referrerPolicy: 'no-referrer',
      body: JSON.stringify({ event, book: title, ...attrs, id: crypto.randomUUID() }),
    }).catch(() => {});
  } catch {}
}
function view() {
  if (viewed || !consent || honorPrivacy) return;
  viewed = true;
  track(book ? 'book_view' : 'library_view');
}
view();
window.addEventListener('library:reader-error', () => track('reader_error'));

if (config.endpoint && !honorPrivacy && typeof analyticsDialog.showModal === 'function') {
  const settings = document.querySelector('[data-analytics]');
  settings.hidden = false;
  settings.onclick = () => analyticsDialog.showModal();
  for (const control of analyticsDialog.querySelectorAll('[data-consent]')) {
    control.onclick = () => {
      consent = control.dataset.consent === 'yes';
      try { localStorage.setItem(consentKey, control.dataset.consent); } catch {}
      updateDownloads();
      view();
      analyticsDialog.close();
    };
  }
}

document.addEventListener('click', event => {
  const link = event.target.closest('[data-event]');
  if (!link) return;
  track(link.dataset.event, link.closest('[data-book]')?.dataset.book || book);
});
if (hasDownloadError) {
  const fallback = document.getElementById('download-help');
  fallback.open = true;
  fallback.insertAdjacentHTML('beforeend', '<p class="notice" role="alert">التحميل ما اشتغلش. زرار التحميل دلوقتي هيفتح الملف من الموقع نفسه. لو لسه مش شغال، افتح الصفحة في متصفح تاني.</p>');
}

const arabic = '٠١٢٣٤٥٦٧٨٩';
const persian = '۰۱۲۳۴۵۶۷۸۹';
const normalize = input => input.toLowerCase().normalize('NFD').replace(/\p{M}/gu,'')
  .replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/ـ/g,'')
  .replace(/[٠-٩۰-۹]/g, digit => String(Math.max(arabic.indexOf(digit), persian.indexOf(digit))))
  .replace(/[^\p{L}\p{N}]+/gu,' ').trim();

const search = document.getElementById('search');
if (search) {
  const cards = Array.from(document.querySelectorAll('[data-search]'), element =>
    [element, normalize(element.dataset.search)]);
  search.closest('label').hidden = false;
  search.addEventListener('input', () => {
    const words = normalize(search.value).split(' ');
    let displayed = 0;
    for (const [element, text] of cards) {
      element.hidden = !words.every(word => text.includes(word));
      if (!element.hidden) displayed += 1;
    }
    document.getElementById('search-empty').hidden = displayed > 0;
    document.getElementById('search-status').textContent = displayed ? `عدد النتائج ${displayed}` : 'مفيش كتب مطابقة';
  });
}

const shareDialog = document.getElementById('share-dialog');
const shareUrl = document.getElementById('share-url');
const shareStatus = document.getElementById('share-status');
let sharingBook = '';
function showShareDialog(url, title) {
  shareUrl.value = url;
  shareStatus.textContent = '';
  const whatsappUrl = new URL(url);
  whatsappUrl.searchParams.set('source','whatsapp');
  shareDialog.querySelector('[data-whatsapp]').href = 'https://wa.me/?text=' + encodeURIComponent(title + '\n' + whatsappUrl);
  if (typeof shareDialog.showModal === 'function') shareDialog.showModal();
  else shareDialog.setAttribute('open', '');
}
for (const form of document.querySelectorAll('dialog form')) {
  form.addEventListener('submit', event => {
    event.preventDefault();
    const dialog = form.closest('dialog');
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  });
}
for (const button of document.querySelectorAll('[data-share]')) {
  button.hidden = false;
  button.addEventListener('click', async () => {
    const url = new URL(button.dataset.share, 'https://patentina.it').href;
    const title = button.dataset.title;
    sharingBook = button.closest('[data-book]')?.dataset.book || book;
    if (navigator.share && !button.closest('#download-help')) {
      try {
        await navigator.share({ url, title });
        track('share_action', sharingBook);
        return;
      } catch (error) {
        if (error.name === 'AbortError') return;
      }
    }
    showShareDialog(url, title);
  });
}
shareDialog.querySelector('[data-copy]').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(shareUrl.value);
    shareStatus.textContent = 'اتنسخ اللينك.';
    track('share_action', sharingBook);
  } catch {
    shareUrl.focus();
    shareUrl.select();
    shareStatus.textContent = 'اختار «نسخ» من قايمة المتصفح.';
  }
});
shareDialog.querySelector('[data-whatsapp]').addEventListener('click', () => track('share_action', sharingBook));
