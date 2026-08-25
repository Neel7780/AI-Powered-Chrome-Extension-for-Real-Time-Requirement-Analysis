const API = "http://127.0.0.1:8000";
const $ = id => document.getElementById(id);

function setStatus(message) {
  $("status").textContent = message;
}

async function request(path, payload) {
  const response = await fetch(`${API}${path}`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(payload)
  });
  let data;
  try { data = await response.json(); }
  catch { throw new Error("Backend returned an invalid response."); }
  if (!response.ok) throw new Error(data.detail || "Backend request failed.");
  return data;
}

async function state() {
  return chrome.storage.local.get([
    "transcript", "baseline", "questions", "responses", "refined", "evaluation"
  ]);
}
async function save(values) {
  await chrome.storage.local.set(values);
}

$("capture").addEventListener("click", async () => {
  try {
    setStatus("Reading the active Zoom tab...");
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
    if (!tabs[0]?.id) throw new Error("No active tab found.");

    const result = await chrome.scripting.executeScript({
      target: {tabId: tabs[0].id},
      func: () => window.__REQUIREMENT_LENS_TRANSCRIPT__ || ""
    });

    const transcript = result?.[0]?.result || "";
    if (!transcript) throw new Error("No transcript/caption text found. Paste it manually.");
    $("transcript").value = transcript;
    await save({transcript});
    setStatus("Transcript captured.");
  } catch (error) { setStatus(error.message); }
});

$("baseline").addEventListener("click", async () => {
  try {
    const transcript = $("transcript").value.trim();
    if (!transcript) throw new Error("Enter a transcript first.");
    setStatus("Generating the baseline...");
    const data = await request("/analyze", {transcript});
    $("baselineOutput").textContent =
      `${data.baseline}\n\nMetrics\n${JSON.stringify(data.metrics, null, 2)}`;
    await save({transcript, baseline: data.baseline});
    setStatus("Baseline ready.");
  } catch (error) { setStatus(error.message); }
});

$("clarify").addEventListener("click", async () => {
  try {
    const transcript = $("transcript").value.trim();
    if (!transcript) throw new Error("Enter a transcript first.");
    setStatus("Finding ambiguity and drafting questions...");
    const data = await request("/clarify", {transcript});
    const questions = data.questions || [];
    $("questionList").innerHTML = "";
    if (!questions.length) {
      $("questionList").textContent = "No clarification questions were extracted.";
    } else {
      questions.forEach((q, index) => {
        const div = document.createElement("div");
        div.className = "question";
        div.textContent = `Q${index + 1}: ${q}`;
        $("questionList").appendChild(div);
      });
    }
    await save({questions});
    setStatus(`${questions.length} clarification question(s) ready.`);
  } catch (error) { setStatus(error.message); }
});

$("refine").addEventListener("click", async () => {
  try {
    const current = await state();
    const transcript = $("transcript").value.trim();
    if (!transcript) throw new Error("Enter a transcript first.");
    if (!current.questions?.length) throw new Error("Generate clarification questions first.");

    const responses = $("responses").value.split("\n").map(x => x.trim()).filter(Boolean);
    setStatus("Applying stakeholder clarification...");
    const data = await request("/refine", {
      transcript, questions: current.questions, responses
    });

    $("refinedOutput").textContent =
      `${data.refined}\n\nMetrics\n${JSON.stringify(data.metrics, null, 2)}`;
    await save({responses, refined: data.refined});
    setStatus("Refined requirements ready.");
  } catch (error) { setStatus(error.message); }
});

$("compare").addEventListener("click", async () => {
  try {
    const current = await state();
    if (!current.baseline || !current.refined) {
      throw new Error("Generate both baseline and refined requirements first.");
    }

    setStatus("Evaluating before vs after...");
    const data = await request("/compare", {
      baseline: current.baseline, refined: current.refined
    });

    $("comparisonOutput").textContent =
      `BASELINE METRICS\n${JSON.stringify(data.baseline_metrics, null, 2)}\n\n` +
      `REFINED METRICS\n${JSON.stringify(data.refined_metrics, null, 2)}\n\n` +
      `QUALITATIVE REVIEW\n${data.qualitative}`;

    await save({evaluation: data.qualitative});
    setStatus("Comparison complete.");
  } catch (error) { setStatus(error.message); }
});

document.querySelectorAll("[data-export]").forEach(button => {
  button.addEventListener("click", async () => {
    try {
      const format = button.dataset.export;
      const current = await state();
      if (!current.baseline && !current.refined) {
        throw new Error("Generate requirements before exporting.");
      }

      setStatus(`Preparing ${format.toUpperCase()} report...`);
      const response = await fetch(`${API}/export/${format}`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          baseline: current.baseline || "",
          questions: current.questions || [],
          responses: current.responses || [],
          refined: current.refined || "",
          evaluation: current.evaluation || ""
        })
      });

      if (!response.ok) {
        let message = "Export failed.";
        try { message = (await response.json()).detail || message; } catch {}
        throw new Error(message);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `requirements_report.${format}`;
      link.click();
      URL.revokeObjectURL(url);
      setStatus(`${format.toUpperCase()} report exported.`);
    } catch (error) { setStatus(error.message); }
  });
});

(async function restore() {
  const current = await state();
  if (current.transcript) $("transcript").value = current.transcript;
  if (current.baseline) $("baselineOutput").textContent = current.baseline;
  if (current.refined) $("refinedOutput").textContent = current.refined;
})();
