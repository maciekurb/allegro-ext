async function load() {
  const keys = ["enabled","minRating","minOpinions","autoPagination","maxPages"];
  const data = await chrome.storage.sync.get(keys);
  for (const k of keys) {
    const el = document.getElementById(k);
    if (!el) continue;
    if (el.type === "checkbox") el.checked = !!data[k];
    else el.value = data[k] ?? el.value;
  }
  updateStatus();
}
function updateStatus() {
  const status = document.getElementById("status");
  const enabled = document.getElementById("enabled").checked;
  status.textContent = enabled ? "ON" : "OFF";
}
document.getElementById("enabled").addEventListener("change", updateStatus);

document.getElementById("save").addEventListener("click", async () => {
  const enabled = document.getElementById("enabled").checked;
  const minRating = parseFloat(document.getElementById("minRating").value || "4.9");
  const minOpinions = parseInt(document.getElementById("minOpinions").value || "100", 10);
  const autoPagination = document.getElementById("autoPagination").checked;
  const maxPages = parseInt(document.getElementById("maxPages").value || "10", 10);

  await chrome.storage.sync.set({ enabled, minRating, minOpinions, autoPagination, maxPages });

  // Content script applies instantly via storage.onChanged
  updateStatus();
});
load();
