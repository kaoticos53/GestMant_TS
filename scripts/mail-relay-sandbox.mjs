/**
 * Almacén en memoria y tabla web para el modo de pruebas (sandbox) del relevo.
 *
 * Registra los sobres recibidos sin abrir ninguna conexión SMTP real y sirve
 * una tabla HTML ligera para inspeccionar asunto, remitente, destinatarios,
 * copia oculta y cuerpo (HTML y texto plano) desde el navegador.
 */

import { randomUUID } from "node:crypto";

export const DEFAULT_MAX_LOG_ENTRIES = 200;

/**
 * Crea un registro circular en memoria para los correos interceptados.
 */
export function createSandboxMailLog({
  maxEntries = DEFAULT_MAX_LOG_ENTRIES,
  now = () => Date.now(),
} = {}) {
  const entries = [];

  return {
    record(envelope, smtp = null) {
      const entry = {
        id: randomUUID(),
        at: now(),
        from: envelope.from,
        to: [...envelope.to],
        bcc: [...envelope.bcc],
        subject: envelope.subject,
        text: envelope.text,
        html: envelope.html,
        smtpTarget: smtp ? `${smtp.host}:${smtp.port}` : "sandbox",
      };
      entries.unshift(entry);
      if (entries.length > maxEntries) {
        entries.length = maxEntries;
      }
      return entry;
    },
    list() {
      return [...entries];
    },
    clear() {
      const cleared = entries.length;
      entries.length = 0;
      return { cleared };
    },
  };
}

function escapeHtmlAttr(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/**
 * Página HTML autocontenida con tabla interactiva para inspeccionar los logs
 * de correos enviados en modo pruebas.
 */
export function renderSandboxPage({ relayUrl = "/enviar" } = {}) {
  const safeRelayUrl = escapeHtmlAttr(relayUrl);
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Relevo de correo · Modo pruebas</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #f8fafc;
      --card: #ffffff;
      --border: #e2e8f0;
      --text: #0f172a;
      --muted: #64748b;
      --accent: #2563eb;
      --accent-soft: #eff6ff;
      --danger: #dc2626;
      --ok: #15803d;
      --ok-bg: #dcfce7;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0b1120;
        --card: #111827;
        --border: #1f2937;
        --text: #f1f5f9;
        --muted: #94a3b8;
        --accent: #60a5fa;
        --accent-soft: #1e293b;
        --danger: #f87171;
        --ok: #4ade80;
        --ok-bg: #052e16;
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.45;
    }
    .wrap {
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px 16px 48px;
    }
    header {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 16px;
    }
    h1 { font-size: 1.35rem; margin: 0 0 4px; }
    .sub { color: var(--muted); font-size: 0.9rem; margin: 0; }
    code {
      background: var(--accent-soft);
      padding: 2px 6px;
      border-radius: 6px;
      font-size: 0.85em;
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      margin-bottom: 14px;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 10px 12px;
    }
    input[type="search"] {
      flex: 1 1 220px;
      padding: 7px 10px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--bg);
      color: var(--text);
      font-size: 0.9rem;
    }
    button {
      cursor: pointer;
      padding: 7px 12px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--card);
      color: var(--text);
      font-size: 0.85rem;
      font-weight: 500;
    }
    button:hover { border-color: var(--accent); }
    button.danger { color: var(--danger); }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.8rem;
      padding: 3px 9px;
      border-radius: 999px;
      background: var(--ok-bg);
      color: var(--ok);
      font-weight: 600;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 10px;
      overflow: hidden;
    }
    .table-wrap { overflow-x: auto; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.88rem;
    }
    th, td {
      text-align: left;
      padding: 10px 12px;
      border-bottom: 1px solid var(--border);
      vertical-align: top;
    }
    th {
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: var(--muted);
      background: var(--accent-soft);
    }
    tr:last-child td { border-bottom: none; }
    tr.selected { background: var(--accent-soft); }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.82rem; }
    .empty {
      padding: 32px 16px;
      text-align: center;
      color: var(--muted);
      font-size: 0.92rem;
    }
    .detail {
      margin-top: 16px;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 16px;
    }
    .detail-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
    }
    .meta {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 8px 16px;
      font-size: 0.86rem;
      margin-bottom: 12px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border);
    }
    .tabs { display: flex; gap: 8px; margin-bottom: 10px; }
    .tabs button.active {
      background: var(--accent);
      color: #fff;
      border-color: var(--accent);
    }
    iframe {
      width: 100%;
      min-height: 320px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: #fff;
    }
    pre {
      margin: 0;
      padding: 12px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--bg);
      overflow-x: auto;
      white-space: pre-wrap;
      font-size: 0.84rem;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <div>
        <h1>Relevo de correo · Modo pruebas (solo logs)</h1>
        <p class="sub">
          Endpoint de envío: <code>${safeRelayUrl}</code> · Ningún correo sale a Internet.
        </p>
      </div>
      <span class="pill" id="count-pill">0 correos</span>
    </header>

    <div class="toolbar">
      <input id="search" type="search" placeholder="Filtrar por destinatario, remitente o asunto..." />
      <label style="font-size:0.85rem;display:flex;align-items:center;gap:6px;">
        <input id="auto-refresh" type="checkbox" checked />
        Auto-actualizar (3 s)
      </label>
      <button id="refresh-btn" type="button">Actualizar</button>
      <button id="clear-btn" type="button" class="danger">Vaciar tabla</button>
    </div>

    <div class="card">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>De</th>
              <th>Para / CCO</th>
              <th>Asunto</th>
              <th>Destino</th>
              <th>Detalle</th>
            </tr>
          </thead>
          <tbody id="rows"></tbody>
        </table>
      </div>
      <div id="empty" class="empty" hidden>
        Todavía no se ha registrado ningún envío. Configura «Relevo propio» en Ajustes del taller apuntando a <code>${safeRelayUrl}</code> y manda un correo de prueba.
      </div>
    </div>

    <section id="detail" class="detail" hidden>
      <div class="detail-head">
        <strong id="detail-subject"></strong>
        <button id="close-detail" type="button">Cerrar</button>
      </div>
      <div class="meta" id="detail-meta"></div>
      <div class="tabs">
        <button type="button" data-tab="html" class="active">Vista HTML</button>
        <button type="button" data-tab="text">Texto plano</button>
        <button type="button" data-tab="json">JSON</button>
      </div>
      <div id="tab-body"></div>
    </section>
  </div>

  <script>
    const rowsEl = document.getElementById("rows");
    const emptyEl = document.getElementById("empty");
    const countEl = document.getElementById("count-pill");
    const searchEl = document.getElementById("search");
    const autoEl = document.getElementById("auto-refresh");
    const detailEl = document.getElementById("detail");
    const detailSubjectEl = document.getElementById("detail-subject");
    const detailMetaEl = document.getElementById("detail-meta");
    const tabBodyEl = document.getElementById("tab-body");

    let allEntries = [];
    let selectedId = null;
    let activeTab = "html";

    function fmtDate(ts) {
      return new Date(ts).toLocaleString("es-ES");
    }

    function renderDetail() {
      const entry = allEntries.find((e) => e.id === selectedId);
      if (!entry) {
        detailEl.hidden = true;
        return;
      }
      detailEl.hidden = false;
      detailSubjectEl.textContent = entry.subject;
      detailMetaEl.innerHTML = "";
      const pairs = [
        ["De", entry.from],
        ["Para", entry.to.join(", ") || "—"],
        ["CCO", entry.bcc.join(", ") || "—"],
        ["Fecha", fmtDate(entry.at)],
      ];
      for (const [k, v] of pairs) {
        const div = document.createElement("div");
        const strong = document.createElement("strong");
        strong.textContent = k + ": ";
        const span = document.createElement("span");
        span.textContent = v;
        div.append(strong, span);
        detailMetaEl.appendChild(div);
      }

      tabBodyEl.innerHTML = "";
      if (activeTab === "html") {
        if (entry.html) {
          const frame = document.createElement("iframe");
          frame.setAttribute("sandbox", "");
          frame.srcdoc = entry.html;
          tabBodyEl.appendChild(frame);
        } else {
          const pre = document.createElement("pre");
          pre.textContent = entry.text || "(Sin contenido HTML)";
          tabBodyEl.appendChild(pre);
        }
      } else if (activeTab === "text") {
        const pre = document.createElement("pre");
        pre.textContent = entry.text || "(Sin texto plano)";
        tabBodyEl.appendChild(pre);
      } else {
        const pre = document.createElement("pre");
        pre.textContent = JSON.stringify(entry, null, 2);
        tabBodyEl.appendChild(pre);
      }
    }

    function renderTable() {
      const q = searchEl.value.trim().toLowerCase();
      const filtered = q
        ? allEntries.filter((e) =>
            [e.from, ...e.to, ...e.bcc, e.subject]
              .join(" ")
              .toLowerCase()
              .includes(q),
          )
        : allEntries;

      countEl.textContent =
        allEntries.length === 1 ? "1 correo" : allEntries.length + " correos";
      rowsEl.innerHTML = "";
      emptyEl.hidden = filtered.length > 0;

      for (const entry of filtered) {
        const tr = document.createElement("tr");
        if (entry.id === selectedId) tr.className = "selected";

        const tdDate = document.createElement("td");
        tdDate.className = "mono";
        tdDate.textContent = fmtDate(entry.at);

        const tdFrom = document.createElement("td");
        tdFrom.textContent = entry.from;

        const tdTo = document.createElement("td");
        tdTo.textContent = entry.to.join(", ");
        if (entry.bcc.length > 0) {
          const bcc = document.createElement("div");
          bcc.className = "sub";
          bcc.textContent = "CCO: " + entry.bcc.join(", ");
          tdTo.appendChild(bcc);
        }

        const tdSubj = document.createElement("td");
        tdSubj.textContent = entry.subject;

        const tdTarget = document.createElement("td");
        tdTarget.className = "mono";
        tdTarget.textContent = entry.smtpTarget || "sandbox";

        const tdAct = document.createElement("td");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = "Ver";
        btn.addEventListener("click", () => {
          selectedId = entry.id;
          renderTable();
          renderDetail();
        });
        tdAct.appendChild(btn);

        tr.append(tdDate, tdFrom, tdTo, tdSubj, tdTarget, tdAct);
        rowsEl.appendChild(tr);
      }
    }

    async function loadLogs() {
      try {
        const res = await fetch("/api/logs");
        if (!res.ok) return;
        const data = await res.json();
        allEntries = Array.isArray(data.entries) ? data.entries : [];
        renderTable();
        renderDetail();
      } catch {}
    }

    document.getElementById("refresh-btn").addEventListener("click", loadLogs);
    document.getElementById("clear-btn").addEventListener("click", async () => {
      await fetch("/api/logs", { method: "DELETE" });
      selectedId = null;
      await loadLogs();
    });
    document.getElementById("close-detail").addEventListener("click", () => {
      selectedId = null;
      renderTable();
      renderDetail();
    });
    searchEl.addEventListener("input", renderTable);
    document.querySelectorAll(".tabs button").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeTab = btn.dataset.tab;
        document.querySelectorAll(".tabs button").forEach((b) => {
          b.classList.toggle("active", b === btn);
        });
        renderDetail();
      });
    });

    loadLogs();
    setInterval(() => {
      if (autoEl.checked) loadLogs();
    }, 3000);
  </script>
</body>
</html>
`;
}
