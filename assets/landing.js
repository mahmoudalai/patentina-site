(() => {
  const userAgent = navigator.userAgent;
  const isAppleMobile = /iPhone|iPad|iPod/i.test(userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isSocialBrowser = /musical_ly|Bytedance|TikTok|trill|Instagram|FBAN|FBAV|FB_IAB|FBIOS|FB4A|Messenger|Snapchat|Line\/|Twitter|LinkedInApp|Pinterest/i.test(userAgent);
  const dialog = document.querySelector(".store-dialog");

  if (!isAppleMobile || !isSocialBrowser || typeof dialog?.showModal !== "function") {
    return;
  }

  const help = document.querySelector("[data-store-help]");
  const downloadUrl = document.querySelector("#download-url");
  const copyStatus = dialog.querySelector(".copy-status");
  let cancelHandoff = () => {};
  let returnFocus;

  function showHelp(trigger) {
    cancelHandoff();
    if (!dialog.open) {
      returnFocus = trigger;
      copyStatus.textContent = "";
      dialog.showModal();
    }
  }

  dialog.addEventListener("close", () => returnFocus?.focus());
  help.hidden = false;
  help.addEventListener("click", () => showHelp(help));

  dialog.querySelector("[data-copy]").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(downloadUrl.value);
      copyStatus.textContent = "اتنسخ اللينك.";
    } catch {
      downloadUrl.focus();
      downloadUrl.select();
      copyStatus.textContent = "اللينك متحدّد. دوس عليه ضغطة طويلة واختار نسخ.";
    }
  });

  document.querySelectorAll("[data-store]").forEach((link) => {
    link.addEventListener("click", (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey ||
        event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      event.preventDefault();
      cancelHandoff();
      const controller = new AbortController();
      const timer = window.setTimeout(() => showHelp(link), 1800);
      cancelHandoff = () => {
        window.clearTimeout(timer);
        controller.abort();
      };

      document.addEventListener("visibilitychange", () => {
        if (document.hidden) cancelHandoff();
      }, { signal: controller.signal });
      window.addEventListener("pagehide", cancelHandoff, { signal: controller.signal });

      try {
        window.location.assign(link.href.replace(/^https:/, "itms-apps:"));
      } catch {
        showHelp(link);
      }
    });
  });
})();
