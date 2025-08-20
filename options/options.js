const keys = ["enabled","minRating","minOpinions","autoPagination","maxPages"];
async function load() {
  const data = await chrome.storage.sync.get(keys);
  document.getElementById("enabled").checked = !!data.enabled;
  document.getElementById("minRating").value = data.minRating ?? 4.9;
  document.getElementById("minOpinions").value = data.minOpinions ?? 100;
  document.getElementById("autoPagination").checked = !!data.autoPagination;
  document.getElementById("maxPages").value = data.maxPages ?? 10;
}
async function save() {
  const payload = {
    enabled: document.getElementById("enabled").checked,
    minRating: parseFloat(document.getElementById("minRating").value || "4.9"),
    minOpinions: parseInt(document.getElementById("minOpinions").value || "100", 10),
    autoPagination: document.getElementById("autoPagination").checked,
    maxPages: parseInt(document.getElementById("maxPages").value || "10", 10)
  };
  await chrome.storage.sync.set(payload);
}
document.getElementById("save").addEventListener("click", save);
document.getElementById("reset").addEventListener("click", async () => {
  await chrome.storage.sync.set({
    enabled: true, minRating: 4.9, minOpinions: 100, autoPagination: true, maxPages: 10
  });
  load();
});
load();
