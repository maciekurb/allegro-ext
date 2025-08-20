(() => {
  console.log("🔍 Allegro Offer Filter: initializing…");

  let settings = {
    enabled: true,
    minRating: 4.9,
    minOpinions: 100,
    autoPagination: false,
    maxPages: 10,
    showSummary: true,      
    hideSponsored: false    
  };

  let observer;
  let isNavigating = false;
  let pagesChecked = 0;
  let startingPage = 1;
  let filterStats = { filtered: 0, hidden: 0, total: 0 };
  let urlWatchTimer;

  function forceReapply(statusText = "Updating…") {
    document.querySelectorAll('[data-filter-processed="true"]').forEach(offer => {
      offer.style.display = "";
      offer.removeAttribute("data-filter-processed");
      const title = offer.querySelector('h2 a[data-filtered="true"]');
      if (title) {
        title.style.border = "";
        title.style.borderRadius = "";
        title.style.padding = "";
        title.removeAttribute("data-filtered");
        const badge = title.querySelector('span[style*="background: #00a441"]');
        badge?.remove();
      }
    });
    isNavigating = false;
    updateSummary(statusText);
    setTimeout(applyFilters, 50);
  }

  chrome.storage.sync.get(Object.keys(settings), (out) => {
    settings = { ...settings, ...out };
    bootOrStop();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    const hadEnabled = settings.enabled;

    for (const [k, { newValue }] of Object.entries(changes)) settings[k] = newValue;

    if ("enabled" in changes) {
      if (settings.enabled) { startFilter(); forceReapply("Enabled — reapplying…"); }
      else { stopFilter(true); }
      return;
    }

    if ("showSummary" in changes) {
      if (!settings.showSummary) document.getElementById("allegro-filter-summary")?.remove();
      else updateSummary("Showing panel…");
    }

    if ("minRating" in changes || "minOpinions" in changes || "autoPagination" in changes || "maxPages" in changes || "hideSponsored" in changes) {
      if (hadEnabled) forceReapply("Settings changed — reapplying…");
    }
  });

  function bootOrStop() { settings.enabled ? startFilter() : stopFilter(true); }

  function startFilter() {
    stopObserverOnly();
    pagesChecked = 0;
    startingPage = getCurrentPage();
    setTimeout(applyFilters, 750);
    startObserver();
    startUrlWatcher();
    console.log("✅ Allegro Offer Filter is active.");
  }

  function stopFilter(clearUi = false) {
    stopObserverOnly();
    stopUrlWatcher();
    if (clearUi) resetOffersAndUi();
    console.log("🛑 Allegro Offer Filter stopped.");
  }

  function stopObserverOnly() { if (observer) { observer.disconnect(); observer = null; } }
  function startUrlWatcher() {
    let currentUrl = location.href;
    urlWatchTimer && clearInterval(urlWatchTimer);
    urlWatchTimer = setInterval(() => {
      if (location.href !== currentUrl) {
        currentUrl = location.href;
        console.log("🔄 URL changed, reapplying filters…");
        isNavigating = false;
        document.querySelectorAll('[data-filter-processed="true"]').forEach(el => { el.removeAttribute("data-filter-processed"); el.style.display = ""; });
        setTimeout(applyFilters, 1200);
      }
    }, 1000);
  }
  function stopUrlWatcher() { if (urlWatchTimer) { clearInterval(urlWatchTimer); urlWatchTimer = null; } }

  function getCurrentPage() {
    const currentPageLink = document.querySelector('[aria-current="page"]');
    if (currentPageLink) {
      const pageNum = parseInt(currentPageLink.textContent);
      if (!Number.isNaN(pageNum)) return pageNum;
    }
    const urlMatch = location.search.match(/[?&]p=(\d+)/);
    if (urlMatch) return parseInt(urlMatch[1]);
    return 1;
  }

  function getNextPageLink() {
    return document.querySelector('[data-role="next-page"], [rel="next"], a[aria-label*="następna"]');
  }

  function goToNextPage() {
    if (!settings.autoPagination || isNavigating) return false;
    const nextPageBtn = getNextPageLink();
    if (!nextPageBtn) { updateSummary("Reached end of pages"); return false; }
    pagesChecked++;
    if (pagesChecked >= (settings.maxPages || 10)) { updateSummary("Reached page limit"); return false; }
    isNavigating = true;
    updateSummary("Searching next page…");
    nextPageBtn.click();
    return true;
  }

  // --- NEW: sponsor detection ----------------------------------------------
  function isSponsoredOffer(offer) {
    // Try common attribute hints first
    if (offer.querySelector('[aria-label*="Sponsorowane" i], [data-testid*="sponsor" i], [class*="sponsor" i]')) return true;
    // Fallback: plain text match bounded by spaces
    const txt = offer.textContent || "";
    return /(^|\s)Sponsorowane(\s|$)/i.test(txt);
  }
  // -------------------------------------------------------------------------

  function applyFilters() {
    if (!settings.enabled || isNavigating) return;

    const offers = document.querySelectorAll('[class*="_1e32a_ENO3Q"], .mqen_m6.mjyo_6x.mgmw_3z.mpof_ki');
    if (offers.length === 0) { updateSummary("No offers detected"); return; }

    let shown = 0, hidden = 0;

    offers.forEach((offer, index) => {
      try {
        if (offer.dataset.filterProcessed === "true") { if (offer.style.display === "none") hidden++; else shown++; return; }
        offer.dataset.filterProcessed = "true";

        // Hide sponsored if enabled
        if (settings.hideSponsored && isSponsoredOffer(offer)) {
          offer.style.display = "none"; hidden++; return;
        }

        const ratingGroup = offer.querySelector('[role="group"][aria-label*="na 5"]');
        if (!ratingGroup) { offer.style.display = "none"; hidden++; return; }

        const ariaLabel = ratingGroup.getAttribute("aria-label") || "";
        const m = ariaLabel.match(/([\d,]+)\s+na\s+5,\s+(\d+)\s+ocen/);
        if (!m) { offer.style.display = "none"; hidden++; return; }

        const rating = parseFloat(m[1].replace(",", "."));
        const opinions = parseInt(m[2], 10);

        const keep = rating > (settings.minRating ?? 4.9) && opinions > (settings.minOpinions ?? 100);
        if (keep) {
          offer.style.display = "";
          shown++;
          const title = offer.querySelector("h2 a");
          if (title && !title.dataset.filtered) {
            title.style.border = "2px solid #00a441";
            title.style.borderRadius = "4px";
            title.style.padding = "2px";
            title.dataset.filtered = "true";
            const badge = document.createElement("span");
            badge.textContent = `🏆 ${rating}/5 (${opinions})`;
            badge.style.cssText = `background:#00a441;color:#fff;padding:2px 6px;border-radius:12px;font-size:11px;font-weight:700;margin-left:8px;display:inline-block;`;
            title.appendChild(badge);
          }
        } else { offer.style.display = "none"; hidden++; }
      } catch (e) {
        console.error(`Error processing offer ${index}:`, e);
        offer.style.display = "none"; hidden++;
      }
    });

    filterStats = { filtered: shown, hidden, total: offers.length };

    if (shown === 0 && offers.length > 0) {
      setTimeout(() => { if (!goToNextPage()) updateSummary("No qualifying offers found"); }, 800);
    } else {
      updateSummary();
    }
  }

  function updateSummary(customStatus = null) {
    if (!settings.showSummary) { document.getElementById("allegro-filter-summary")?.remove(); return; }

    let summary = document.getElementById("allegro-filter-summary");
    if (!summary) {
      summary = document.createElement("div");
      summary.id = "allegro-filter-summary";
      summary.style.cssText = `
        position:fixed;top:20px;right:20px;background:#00a441;color:#fff;padding:15px;
        border-radius:8px;font-family:system-ui,Arial,sans-serif;font-size:14px;
        box-shadow:0 4px 12px rgba(0,0,0,.3);z-index:999999;max-width:320px;transition:.3s all;
      `;
      document.body.appendChild(summary);
    }

    const currentPage = getCurrentPage();
    const statusText = customStatus || (filterStats.filtered > 0 ? "Active" : "Searching…");

    summary.innerHTML = `
      <div style="font-weight:700;margin-bottom:8px;">🔍 Auto Filter ${statusText}</div>
      <div>✅ Showing: ${filterStats.filtered}</div>
      <div>❌ Hidden: ${filterStats.hidden}</div>
      <div>📦 Total: ${filterStats.total}</div>
      <div style="margin-top:8px;font-size:12px;opacity:.9;">📄 Page: ${currentPage} (started: ${startingPage})</div>
      <div style="margin-top:4px;font-size:12px;opacity:.9;">🔍 Pages checked: ${pagesChecked}/${settings.maxPages}</div>
      <div style="margin-top:8px;font-size:11px;opacity:.85;">Criteria: >${settings.minOpinions} opinions & >${settings.minRating} rating</div>
      <div style="margin-top:4px;font-size:11px;opacity:.8;">🔄 Auto-pagination ${settings.autoPagination ? "enabled" : "disabled"}</div>
      <div style="margin-top:4px;font-size:11px;opacity:.8;">🚫 Sponsored hidden: ${settings.hideSponsored ? "yes" : "no"}</div>
      <button id="allegro-filter-close" style="position:absolute;top:5px;right:8px;background:none;border:none;color:#fff;font-size:16px;cursor:pointer;" title="Hide this panel">×</button>
    `;

    // IMPORTANT CHANGE: '×' now only hides the panel (doesn't disable the filter)
    summary.querySelector("#allegro-filter-close")?.addEventListener(
      "click",
      async () => { await chrome.storage.sync.set({ showSummary: false }); },
      { once: true }
    );
  }

  function startObserver() {
    observer = new MutationObserver((mutations) => {
      let shouldRefilter = false;
      let pageChanged = false;

      for (const mutation of mutations) {
        if (mutation.type === "childList" && mutation.addedNodes.length) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType !== Node.ELEMENT_NODE) continue;
            const el = /** @type {Element} */ (node);
            if (
              el.matches?.('[class*="_1e32a_ENO3Q"], .mqen_m6.mjyo_6x.mgmw_3z.mpof_ki') ||
              el.querySelector?.('[class*="_1e32a_ENO3Q"], .mqen_m6.mjyo_6x.mgmw_3z.mpof_ki')
            ) shouldRefilter = true;
            if (el.matches?.('[aria-current="page"]') || el.querySelector?.('[aria-current="page"]')) pageChanged = true;
          }
        }
      }

      if (pageChanged) {
        isNavigating = false;
        document.querySelectorAll('[data-filter-processed="true"]').forEach(el => el.removeAttribute("data-filter-processed"));
        shouldRefilter = true;
      }
      if (shouldRefilter) setTimeout(applyFilters, 400);
    });

    observer.observe(document.body, { childList: true, subtree: true, attributes: false });
    console.log("👁️ Monitoring page changes…");
  }

  function resetOffersAndUi() {
    document.getElementById("allegro-filter-summary")?.remove();
    document.querySelectorAll('[data-filter-processed="true"]').forEach(offer => {
      offer.style.display = "";
      offer.removeAttribute("data-filter-processed");
      const title = offer.querySelector('h2 a[data-filtered="true"]');
      if (title) {
        title.style.border = "";
        title.style.borderRadius = "";
        title.style.padding = "";
        title.removeAttribute("data-filtered");
        title.querySelector('span[style*="background: #00a441"]')?.remove();
      }
    });
  }
})();
