const STORAGE_KEY = 'mcp-chat-conversations';
const ACTIVE_KEY = 'mcp-chat-active';
const state = { id: localStorage.getItem(ACTIVE_KEY) || crypto.randomUUID(), messages: [], tools: [], developer: false, controller: null };
const $ = (selector) => document.querySelector(selector);
const conversation = $('#conversation');
const input = $('#messageInput');

function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char])); }
function json(value) { return escapeHtml(JSON.stringify(value ?? {}, null, 2)); }
function markdown(value) {
  const lines = escapeHtml(value).replace(/\r\n?/g, '\n').split('\n');
  let html = '';
  let inCode = false;
  let code = [];
  let inList = false;
  const inline = (line) => line
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  const closeList = () => { if (inList) { html += '</ul>'; inList = false; } };
  lines.forEach((line) => {
    if (line.trim().startsWith('```')) {
      if (inCode) { html += `<pre><code>${code.join('\n')}</code></pre>`; code = []; inCode = false; }
      else { closeList(); inCode = true; }
      return;
    }
    if (inCode) { code.push(line); return; }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    if (heading) { closeList(); html += `<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`; return; }
    if (bullet) { if (!inList) { html += '<ul>'; inList = true; } html += `<li>${inline(bullet[1])}</li>`; return; }
    closeList();
    if (line.trim()) html += `<p>${inline(line)}</p>`;
  });
  if (inCode) html += `<pre><code>${code.join('\n')}</code></pre>`;
  closeList();
  return html || '<p></p>';
}
function saveConversation() {
  const conversations = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]').filter((item) => item.id !== state.id);
  conversations.unshift({
    id: state.id,
    title: state.messages.find((item) => item.role === 'user')?.text || 'New conversation',
    messages: state.messages,
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations.slice(0, 12)));
  localStorage.setItem(ACTIVE_KEY, state.id);
  renderHistory();
}
function renderHistory() {
  const history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  $('#history').innerHTML = history.map((item) => `<button class="${item.id === state.id ? 'active' : ''}" data-id="${item.id}">${escapeHtml(item.title)}</button>`).join('');
}
function addMessage(role, text, steps = []) {
  $('#welcome').hidden = true;
  state.messages.push({ role, text, steps });
  const item = document.createElement('article');
  item.className = `message ${role}`;
  item.innerHTML = `<div class="message-bubble${role === 'assistant' ? ' markdown' : ''}">${role === 'assistant' ? markdown(text) : escapeHtml(text)}</div>`;
  steps.forEach((step) => {
    const status = step.status === 'completed' ? '✓ Completed' : step.status === 'error' ? 'Failed' : step.status === 'confirmation' ? 'Needs confirmation' : 'Waiting';
    const details = state.developer || step.status === 'completed' || step.status === 'error';
    item.innerHTML += `<details class="tool-card" ${details ? '' : ''}><summary class="tool-summary"><span class="tool-icon">${step.status === 'completed' ? '✓' : '⚙'}</span><strong>${escapeHtml(step.tool)}</strong><span class="tool-status">${status}${step.duration_ms ? ` · ${step.duration_ms}ms` : ''}</span></summary><div class="tool-body"><div class="json-block"><label>Input</label><pre>${json(step.input)}</pre></div>${step.output !== undefined ? `<div class="json-block"><label>Output</label><pre>${json(step.output)}</pre></div>` : step.error ? `<div class="json-block"><label>Error</label><pre>${escapeHtml(step.error)}</pre></div>` : ''}</div></details>`;
  });
  conversation.appendChild(item); conversation.scrollTop = conversation.scrollHeight;
  saveConversation();
}
function renderConversation() {
  conversation.querySelectorAll('.message').forEach((item) => item.remove());
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]').find((item) => item.id === state.id);
  state.messages = saved?.messages || [];
  $('#welcome').hidden = state.messages.length > 0;
  state.messages.forEach((message) => addMessageMarkup(message));
  renderHistory();
}
function addMessageMarkup(message) {
  const item = document.createElement('article');
  item.className = `message ${message.role}`;
  item.innerHTML = `<div class="message-bubble${message.role === 'assistant' ? ' markdown' : ''}">${message.role === 'assistant' ? markdown(message.text) : escapeHtml(message.text)}</div>`;
  (message.steps || []).forEach((step) => {
    const status = step.status === 'completed' ? '✓ Completed' : step.status === 'error' ? 'Failed' : step.status === 'confirmation' ? 'Needs confirmation' : 'Waiting';
    const details = state.developer || step.status === 'completed' || step.status === 'error';
    item.innerHTML += `<details class="tool-card" ${details ? '' : ''}><summary class="tool-summary"><span class="tool-icon">${step.status === 'completed' ? '✓' : '⚙'}</span><strong>${escapeHtml(step.tool)}</strong><span class="tool-status">${status}${step.duration_ms ? ` · ${step.duration_ms}ms` : ''}</span></summary><div class="tool-body"><div class="json-block"><label>Input</label><pre>${json(step.input)}</pre></div>${step.output !== undefined ? `<div class="json-block"><label>Output</label><pre>${json(step.output)}</pre></div>` : step.error ? `<div class="json-block"><label>Error</label><pre>${escapeHtml(step.error)}</pre></div>` : ''}</div></details>`;
  });
  conversation.appendChild(item);
}
function setThinking(active, text = 'Selecting a tool') { $('#thinking').hidden = !active; $('#thinkingText').textContent = text; $('#sendButton').disabled = false; $('#sendButton').textContent = active ? '■' : '↑'; $('#sendButton').setAttribute('aria-label', active ? 'Stop execution' : 'Send message'); }
function resizeInput() { input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight, 160)}px`; }
async function send(text) {
  if (!text.trim() || state.controller) return;
  addMessage('user', text.trim()); input.value = ''; resizeInput(); setThinking(true, 'Discovering tools');
  state.controller = new AbortController();
  try {
    setTimeout(() => { if (state.controller) $('#thinkingText').textContent = 'Running MCP capability'; }, 350);
    const response = await fetch('/api/chat', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ conversation_id: state.id, message: text.trim(), developer_mode: state.developer }), signal: state.controller.signal });
    const data = await response.json(); if (!response.ok) throw new Error(data.detail || 'Request failed');
    addMessage('assistant', data.reply, data.steps || []);
  } catch (error) { if (error.name !== 'AbortError') addMessage('assistant', `I couldn't reach the MCP runner: ${error.message}`); }
  finally { state.controller = null; setThinking(false); }
}
async function loadStatus() {
  try {
    const response = await fetch('/api/status'); const data = await response.json(); state.tools = data.tools || [];
    $('#connectionText').textContent = data.connected ? `MCP Connected · ${data.tool_count} tools` : 'MCP Offline'; $('#sideStatus').textContent = data.connected ? 'MCP Connected' : 'MCP Offline'; $('#statusDot').classList.toggle('on', data.connected); $('#dialogDot').classList.toggle('on', data.connected); $('#dialogStatus').textContent = data.connected ? 'Connected' : 'Unavailable'; $('#toolCount').textContent = `${data.tool_count} discovered tools`; $('#llmStatus').textContent = data.llm_enabled ? data.llm_model : 'Local fallback';
    $('#suggestions').innerHTML = state.tools.slice(0, 4).map((tool) => `<button class="suggestion" data-prompt="${escapeHtml(tool.description || tool.name)}">${escapeHtml(tool.description || tool.name)}</button>`).join('');
  } catch { $('#connectionText').textContent = 'MCP Offline'; $('#sideStatus').textContent = 'MCP Offline'; }
}
$('#composer').addEventListener('submit', (event) => { event.preventDefault(); send(input.value); });
$('#sendButton').addEventListener('click', (event) => { if (state.controller) { event.preventDefault(); state.controller.abort(); state.controller = null; setThinking(false); } });
input.addEventListener('input', resizeInput); input.addEventListener('keydown', (event) => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey || !event.shiftKey)) { event.preventDefault(); send(input.value); } });
document.addEventListener('click', (event) => { const suggestion = event.target.closest('[data-prompt]'); if (suggestion) { input.value = suggestion.dataset.prompt; resizeInput(); input.focus(); } });
$('#newChat').addEventListener('click', () => { state.id = crypto.randomUUID(); state.messages = []; localStorage.setItem(ACTIVE_KEY, state.id); conversation.querySelectorAll('.message').forEach((item) => item.remove()); $('#welcome').hidden = false; renderHistory(); input.focus(); });
$('#clearChat').addEventListener('click', () => { state.messages = []; const conversations = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]').filter((item) => item.id !== state.id); localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations)); localStorage.setItem(ACTIVE_KEY, state.id); conversation.querySelectorAll('.message').forEach((item) => item.remove()); $('#welcome').hidden = false; renderHistory(); });
$('#history').addEventListener('click', (event) => { const button = event.target.closest('[data-id]'); if (!button) return; state.id = button.dataset.id; localStorage.setItem(ACTIVE_KEY, state.id); renderConversation(); });
$('#developerToggle').addEventListener('click', (event) => { state.developer = !state.developer; event.currentTarget.classList.toggle('active', state.developer); });
$('#settingsButton').addEventListener('click', () => $('#settingsDialog').showModal()); $('#closeSettings').addEventListener('click', () => $('#settingsDialog').close());
renderHistory(); renderConversation(); loadStatus();