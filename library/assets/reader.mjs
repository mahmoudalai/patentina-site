const reader = document.getElementById('reader');
const tools = reader.querySelector('.reader-tools');
const scroll = reader.querySelector('.reader-scroll');
const sheet = reader.querySelector('.reader-sheet');
const status = reader.querySelector('.reader-status');
const error = reader.querySelector('.reader-error');
const input = tools.querySelector('input');
const buttons = Object.fromEntries(Array.from(reader.querySelectorAll('button[data-reader]'), button => [button.dataset.reader,button]));
let book;
let loading;
let pageNumber = 1;
let zoom = 1;
let request = 0;
let renderTask;
const format = new Intl.NumberFormat('ar-EG');

function failed() {
  status.textContent = '';
  error.hidden = false;
  window.dispatchEvent(new Event('library:reader-error'));
}

async function annotate(page, viewport, links, token) {
  for (const annotation of await page.getAnnotations({ intent:'display' })) {
    if (token !== request) return;
    if (annotation.subtype !== 'Link' || !annotation.rect) continue;
    const [a,b,c,d] = viewport.convertToViewportRectangle(annotation.rect);
    const link = document.createElement('a');
    if (annotation.url) {
      let url;
      try { url = new URL(annotation.url); } catch { continue; }
      if (url.protocol !== 'https:') continue;
      link.href = url.href;
      link.rel = 'noopener noreferrer';
      link.target = '_blank';
      link.setAttribute('aria-label', 'افتح ' + url.hostname + url.pathname);
    } else if (annotation.dest) {
      link.href = '#reader';
      link.setAttribute('aria-label', 'روح للصفحة المشار إليها');
      link.onclick = async event => {
        event.preventDefault();
        try {
          const destination = typeof annotation.dest === 'string'
            ? await book.getDestination(annotation.dest) : annotation.dest;
          if (!destination) return;
          const index = typeof destination[0] === 'number' ? destination[0] : await book.getPageIndex(destination[0]);
          render(index + 1);
        } catch { failed(); }
      };
    } else continue;
    Object.assign(link.style, {
      left: Math.min(a,c) + 'px', top: Math.min(b,d) + 'px',
      width: Math.abs(c-a) + 'px', height: Math.abs(d-b) + 'px',
    });
    links.append(link);
  }
}

async function render(number) {
  if (!book) return;
  const token = ++request;
  renderTask?.cancel();
  pageNumber = Math.max(1, Math.min(book.numPages, number));
  input.value = pageNumber;
  buttons.prev.disabled = pageNumber === 1;
  buttons.next.disabled = pageNumber === book.numPages;
  error.hidden = true;
  status.textContent = 'بنفتح الصفحة…';
  try {
    const page = await book.getPage(pageNumber);
    if (token !== request) return;
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: zoom * Math.min(910, scroll.clientWidth || reader.clientWidth) / base.width });
    const density = Math.min(devicePixelRatio || 1, 2, Math.sqrt(7e6 / (viewport.width * viewport.height)));
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width * density);
    canvas.height = Math.floor(viewport.height * density);
    canvas.style.width = viewport.width + 'px';
    canvas.style.height = viewport.height + 'px';
    canvas.setAttribute('role','img');
    canvas.setAttribute('aria-label','صفحة ' + format.format(pageNumber) + ' من الكتاب');
    const links = Object.assign(document.createElement('div'), { className:'reader-links' });
    renderTask = page.render({ canvas, viewport, transform:[density,0,0,density,0,0] });
    await Promise.all([renderTask.promise, annotate(page,viewport,links,token)]);
    if (token !== request) return;
    sheet.style.width = viewport.width + 'px';
    sheet.replaceChildren(canvas,links);
    scroll.scrollTo(0,0);
    status.textContent = 'صفحة ' + format.format(pageNumber) + ' من ' + format.format(book.numPages);
  } catch (problem) {
    if (token === request && problem.name !== 'RenderingCancelledException') failed();
  }
}

async function openBook() {
  if (loading) return;
  error.hidden = true;
  status.textContent = 'بنحمّل الكتاب…';
  try {
    const pdf = await import('./pdfjs-5.7.284/pdf.min.mjs');
    const root = new URL('./pdfjs-5.7.284/', import.meta.url);
    pdf.GlobalWorkerOptions.workerSrc = new URL('pdf.worker.min.mjs',root).href;
    loading = pdf.getDocument({
      url: reader.dataset.file, isEvalSupported:false, enableXfa:false,
      wasmUrl: new URL('wasm/',root).href,
    });
    loading.onProgress = ({loaded,total}) => {
      if (total > 0) status.textContent = 'بنحمّل الكتاب… ' + format.format(Math.round(100 * loaded / total)) + '٪';
    };
    let timer;
    try {
      book = await Promise.race([loading.promise, new Promise((_,reject) => {
        timer = setTimeout(() => reject(new Error('PDF load timed out')), 45000);
      })]);
    } finally { clearTimeout(timer); }
    tools.hidden = false;
    buttons.fullscreen.hidden = !document.fullscreenEnabled;
    await render(pageNumber);
  } catch {
    await loading?.destroy().catch(() => {});
    failed();
  } finally { loading = undefined; }
}

buttons.prev.onclick = () => render(pageNumber - 1);
buttons.next.onclick = () => render(pageNumber + 1);
input.onchange = () => render(input.valueAsNumber || pageNumber);
buttons.plus.onclick = () => { zoom = Math.min(3, zoom * 1.25); render(pageNumber); };
buttons.minus.onclick = () => { zoom = Math.max(.5, zoom / 1.25); render(pageNumber); };
buttons.fit.onclick = () => { zoom = 1; render(pageNumber); };
buttons.fullscreen.onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await reader.requestFullscreen();
  } catch { status.textContent = 'ملء الشاشة مش متاح في المتصفح ده.'; }
};
buttons.retry.onclick = () => book ? render(pageNumber) : openBook();
let delayedResize;
function resized() {
  if (!book) return;
  clearTimeout(delayedResize);
  delayedResize = setTimeout(() => render(pageNumber), 150);
}
window.addEventListener('resize',resized);
document.addEventListener('fullscreenchange',resized);
openBook();
