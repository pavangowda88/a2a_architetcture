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
function friendlyToolName(name) {
  if (!name) return 'the requested action';
  const labels = {
    authenticate: 'check access',
    assign_task: 'assign the task',
    register: 'register the service',
    get_ue_inbox: 'check the inbox',
    end_task_session: 'finish the task',
    end_all_task_sessions: 'finish all active tasks',
    find_robot_by_skill: 'find the right robot',
    list_agents_by_skill: 'find available agents',
    find_agent: 'look up the agent',
    list_active_sessions: 'review active sessions',
    default: String(name).replace(/_/g, ' '),
  };
  return labels[String(name)] || labels.default;
}
function friendlyStatusLabel(status) {
  const map = {
    waiting: 'Waiting for input',
    confirmation: 'Needs approval',
    completed: 'Finished',
    error: 'Could not finish',
    active: 'In progress',
    queued: 'Queued',
    rejected: 'Needs attention',
    failed: 'Could not finish',
    pending: 'Pending',
  };
  return map[String(status)] || 'Update';
}
function processExplanation(steps) {
  if (!steps.length) return '';
  const lines = ['### What I did'];
  steps.forEach((step, index) => {
    if (step.status === 'waiting') {
      lines.push(`- I checked what you need, and I need one small detail before I can continue.`);
    } else if (step.status === 'confirmation') {
      lines.push(`- I prepared the action and I’m waiting for your approval before it moves forward.`);
    } else if (step.status === 'error') {
      lines.push(`- I tried to complete the action, but something did not work as expected.`);
    } else if (step.status === 'completed') {
      lines.push(`- I completed the request and used the result to answer you clearly.`);
    } else {
      lines.push(`- I’m working through the request and checking the next step.`);
    }
    if (step.tool) {
      const label = friendlyToolName(step.tool);
      lines.push(`  - Action: ${label}.`);
    }
  });
  return markdown(lines.join('\n'));
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
  item.innerHTML = `<div class="message-bubble${role === 'assistant' ? ' markdown' : ''}">${role === 'assistant' ? markdown(text) + processExplanation(steps) : escapeHtml(text)}</div>`;
  steps.forEach((step) => {
    const status = friendlyStatusLabel(step.status);
    const details = state.developer;
    item.innerHTML += `<details class="tool-card" ${details ? 'open' : ''}><summary class="tool-summary"><span class="tool-icon">${step.status === 'completed' ? '✓' : step.status === 'error' ? '!' : '⚙'}</span><strong>${escapeHtml(friendlyToolName(step.tool))}</strong><span class="tool-status">${status}${step.duration_ms ? ` · ${step.duration_ms}ms` : ''}</span></summary><div class="tool-body"><div class="json-block"><label>Input</label><pre>${json(step.input)}</pre></div>${step.output !== undefined ? `<details class="json-block raw-output"><summary>Output JSON</summary><pre>${json(step.output)}</pre></details>` : step.error ? `<div class="json-block"><label>Error</label><pre>${escapeHtml(step.error)}</pre></div>` : ''}</div></details>`;
    enrichToolCard(step, item);
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
  item.innerHTML = `<div class="message-bubble${message.role === 'assistant' ? ' markdown' : ''}">${message.role === 'assistant' ? markdown(message.text) + processExplanation(message.steps || []) : escapeHtml(message.text)}</div>`;
  (message.steps || []).forEach((step) => {
    const status = friendlyStatusLabel(step.status);
    const details = state.developer;
    item.innerHTML += `<details class="tool-card" ${details ? 'open' : ''}><summary class="tool-summary"><span class="tool-icon">${step.status === 'completed' ? '✓' : step.status === 'error' ? '!' : '⚙'}</span><strong>${escapeHtml(friendlyToolName(step.tool))}</strong><span class="tool-status">${status}${step.duration_ms ? ` · ${step.duration_ms}ms` : ''}</span></summary><div class="tool-body"><div class="json-block"><label>Input</label><pre>${json(step.input)}</pre></div>${step.output !== undefined ? `<details class="json-block raw-output"><summary>Output JSON</summary><pre>${json(step.output)}</pre></details>` : step.error ? `<div class="json-block"><label>Error</label><pre>${escapeHtml(step.error)}</pre></div>` : ''}</div></details>`;
    enrichToolCard(step, item);
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
    setTimeout(() => { if (state.controller) $('#thinkingText').textContent = 'Checking the best next step'; }, 350);
    const response = await fetch('/api/chat', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ conversation_id: state.id, message: text.trim(), developer_mode: state.developer }), signal: state.controller.signal });
    const data = await response.json(); if (!response.ok) throw new Error(data.detail || 'Request failed');
    addMessage('assistant', data.reply, data.steps || []);
  } catch (error) { if (error.name !== 'AbortError') addMessage('assistant', 'I had trouble getting the answer right now. Please try again in a moment.'); }
  finally { state.controller = null; setThinking(false); }
}
async function loadStatus() {
  try {
    const response = await fetch(`/api/status?ts=${Date.now()}`, { cache: 'no-store' }); const data = await response.json(); state.tools = data.tools || [];
    $('#connectionText').textContent = data.connected ? `MCP Connected · ${data.tool_count} tools` : 'MCP Offline'; $('#sideStatus').textContent = data.connected ? 'MCP Connected' : 'MCP Offline'; $('#statusDot').classList.toggle('on', data.connected); $('#dialogDot').classList.toggle('on', data.connected); $('#dialogStatus').textContent = data.connected ? 'Connected' : 'Unavailable'; $('#toolCount').textContent = data.connected ? `${data.tool_count} discovered tools` : (data.error || 'MCP unavailable'); $('#llmStatus').textContent = data.llm_enabled ? data.llm_model : 'Local fallback';
    const suggestions = $('#suggestions');
    if (suggestions) suggestions.innerHTML = state.tools.slice(0, 4).map((tool) => `<button class="suggestion" data-prompt="${escapeHtml(tool.description || tool.name)}">${escapeHtml(tool.description || tool.name)}</button>`).join('');
  } catch (error) { $('#connectionText').textContent = 'MCP Offline'; $('#sideStatus').textContent = 'MCP Offline'; $('#statusDot').classList.remove('on'); $('#dialogDot').classList.remove('on'); $('#dialogStatus').textContent = 'Unavailable'; $('#toolCount').textContent = error.message || 'Status check failed'; }
}
$('#composer').addEventListener('submit', (event) => { event.preventDefault(); send(input.value); });
$('#sendButton').addEventListener('click', (event) => { if (state.controller) { event.preventDefault(); state.controller.abort(); state.controller = null; setThinking(false); } });
input.addEventListener('input', resizeInput); input.addEventListener('keydown', (event) => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey || !event.shiftKey)) { event.preventDefault(); send(input.value); } });
document.addEventListener('click', (event) => { const suggestion = event.target.closest('[data-prompt]'); if (suggestion) { input.value = suggestion.dataset.prompt; resizeInput(); input.focus(); } });
$('#newChat').addEventListener('click', () => { state.id = crypto.randomUUID(); state.messages = []; localStorage.setItem(ACTIVE_KEY, state.id); conversation.querySelectorAll('.message').forEach((item) => item.remove()); $('#welcome').hidden = false; renderHistory(); input.focus(); });
$('#clearChat').addEventListener('click', () => { state.messages = []; const conversations = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]').filter((item) => item.id !== state.id); localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations)); localStorage.setItem(ACTIVE_KEY, state.id); conversation.querySelectorAll('.message').forEach((item) => item.remove()); $('#welcome').hidden = false; renderHistory(); });
$('#history').addEventListener('click', (event) => { const button = event.target.closest('[data-id]'); if (!button) return; state.id = button.dataset.id; localStorage.setItem(ACTIVE_KEY, state.id); renderConversation(); });
$('#developerToggle').addEventListener('click', (event) => { state.developer = !state.developer; event.currentTarget.classList.toggle('active', state.developer); });
$('#inboxToggle').addEventListener('click', () => { input.value = 'Get inbox for ue_agent_001'; resizeInput(); input.focus(); });
$('#settingsButton').addEventListener('click', () => $('#settingsDialog').showModal()); $('#closeSettings').addEventListener('click', () => $('#settingsDialog').close());
renderHistory(); renderConversation(); loadStatus();
setInterval(loadStatus, 10000);

function skillColor(skillId) {
  const map = { pick_and_place: '#9df1c0', inspection: '#7ab8f5', welding: '#f3b37a', packaging: '#c8a5f0', crush: '#f47a7a', attach: '#52c98e', 'peer-message': '#f0c85a', qos: '#84919c', session: '#84919c' };
  return map[skillId] ?? '#52616b';
}

function statusColor(status) {
  const map = { active: '#9df1c0', queued: '#f3b37a', completed: '#52616b', rejected: '#f47a7a', failed: '#f47a7a', cancelled: '#52616b', pending: '#84919c' };
  return map[status] ?? '#84919c';
}

function skillIdOf(skill) { return typeof skill === 'string' ? skill : skill?.id; }
function skillLabel(skill) { return typeof skill === 'string' ? skill : skill?.name || skill?.id; }
function skillBadge(skill) {
  const id = skillIdOf(skill);
  if (!id) return '';
  const color = skillColor(id);
  return `<span class="skill-badge" style="background:${color}22;color:${color};border-color:${color}66">${escapeHtml(skillLabel(skill))}</span>`;
}
function statusPill(statusStr) {
  if (statusStr === undefined || statusStr === null) return '';
  const status = String(statusStr);
  const color = statusColor(status);
  const label = status === 'active' ? 'Active' : status === 'queued' ? 'Queued' : status === 'rejected' ? 'Rejected' : status;
  const activeAttr = status === 'active' ? ' data-active="true"' : '';
  return `<span class="status-pill"${activeAttr} style="background:${color}22;color:${color};border-color:${color}66"><i${activeAttr}></i>${escapeHtml(label)}</span>`;
}
function payloadBar(kg) {
  if (typeof kg !== 'number' || kg <= 0) return '';
  const width = Math.min(100, Math.max(8, kg * 10));
  return `<div class="payload-bar-wrap"><div class="payload-bar-label"><span>Payload</span><strong>${escapeHtml(kg)} kg</strong></div><div class="payload-bar"><span class="payload-bar-fill" style="width:${width}%"></span></div></div>`;
}
function textRow(label, value) { return value === undefined || value === null ? '' : `<div class="demo-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`; }
function shortId(value) { const text = String(value); return text.length > 18 ? `${text.slice(0, 8)}…${text.slice(-6)}` : text; }
function valueText(value) { return typeof value === 'object' ? JSON.stringify(value) : String(value); }
function outputHeading(label, value) { return value === undefined || value === null ? '' : `<div class="output-heading"><span>${escapeHtml(label)}</span><strong>${escapeHtml(valueText(value))}</strong></div>`; }

function getAuthFailedIndex(output) {
  if (output.authenticated) return -1;
  if (output.trust_score === undefined) return 3;
  if (output.qos_class === undefined) return 4;
  return 1;
}
function buildAuthStepper(output) {
  if (!Object.prototype.hasOwnProperty.call(output, 'authenticated')) return '';
  const names = [['Supervisor', '8000', 'received'], ['AUSF', '8001', 'validated'], ['UDM', '8003', 'fetched'], ['Security', '8105', 'scored'], ['Subscriber', '8002', 'confirmed']];
  const failedAt = getAuthFailedIndex(output);
  const status = output.authenticated ? 'Access approved' : 'Access needs attention';
  const tone = output.authenticated ? 'success' : 'warning';
  return `
    <div class="status-panel ${tone}">
      <div class="status-panel-header">
        <span class="status-panel-icon">${output.authenticated ? '✓' : '!'}</span>
        <div>
          <strong>${escapeHtml(status)}</strong>
          <small>${escapeHtml(output.agent_id || 'System')}</small>
        </div>
      </div>
      <div class="auth-stepper">${names.map((step, index) => { const failed = index === failedAt; const muted = failedAt >= 0 && index > failedAt; return `<div class="stepper-step ${failed ? 'fail' : muted ? 'muted' : 'done'}"><strong>${escapeHtml(step[0])} <small>:${step[1]}</small></strong><span>${failed ? '✗' : muted ? '·' : '✓'} ${step[2]}</span></div>${index < names.length - 1 ? '<span class="stepper-arrow">→</span>' : ''}`; }).join('')}</div>
    </div>
  `;
}
function buildTaskFlow(output) {
  if (output.success !== true) return '';
  const result = output.result || {};
  const isFail = result.status === 'rejected' || result.status === 'failed';
  const nodes = [
    { title: 'User', fail: false },
    { title: 'Supervisor', fail: false },
    { title: `Registry: ${result.skill || 'search'}`, fail: false },
    { title: `${output.agent_id || 'Agent'}: ${result.status || 'done'}`, fail: isFail },
  ];
  return `
    <div class="status-panel ${isFail ? 'warning' : 'success'}">
      <div class="status-panel-header">
        <span class="status-panel-icon">${isFail ? '!' : '✓'}</span>
        <div>
          <strong>${isFail ? 'Task needs attention' : 'Task assigned successfully'}</strong>
          <small>${escapeHtml(output.agent_id || 'Robot')}</small>
        </div>
      </div>
      <div class="task-flow">${nodes.map((node, index) => `<span class="flow-node ${node.fail ? 'fail' : ''}">${escapeHtml(node.title)}</span>${index < nodes.length - 1 ? '<span class="flow-arrow">→</span>' : ''}`).join('')}</div>
    </div>
  `;
}
function buildAgentCard(output) {
  const agent = output.agent || ((output.id || output.name) ? output : null);
  if (!agent) return '';
  const skills = Array.isArray(agent.skills) ? agent.skills.map(skillBadge).join('') : '';
  const endpoint = agent.url || agent.endpoint;
  const extraFields = Object.entries(agent)
    .filter(([key]) => !['id', 'name', 'url', 'endpoint', 'skills'].includes(key))
    .slice(0, 3)
    .map(([key, value]) => `<div class="mini-metric"><span>${escapeHtml(key)}</span><strong>${escapeHtml(valueText(value))}</strong></div>`)
    .join('');
  const endpointStatus = output.endpoint ? `<div class="mini-metric"><span>Endpoint status</span><strong>${escapeHtml(`${output.endpoint.status ?? ''}${output.endpoint.pid !== undefined ? ` · PID: ${output.endpoint.pid}` : ''}`)}</strong></div>` : '';
  const alreadyRegistered = output.already_registered === true ? '<div class="status-note warning">Already registered</div>' : '';
  return `
    <div class="agent-mini-card">
      <div class="mini-card-header">
        <div>
          <span class="mini-label">Agent</span>
          <strong>${escapeHtml(agent.name || agent.id || 'Robot')}</strong>
        </div>
        ${agent.id ? `<span class="mini-id">${escapeHtml(shortId(agent.id))}</span>` : ''}
      </div>
      ${endpoint ? `<div class="mini-metric"><span>Endpoint</span><strong>${escapeHtml(endpoint)}</strong></div>` : ''}
      ${skills ? `<div class="badge-row">${skills}</div>` : ''}
      <div class="mini-grid">${extraFields}${endpointStatus}</div>
      ${alreadyRegistered}
    </div>
  `;
}
function buildInboxRender(output) {
  const messages = Array.isArray(output.messages) ? output.messages : [];
  if (output.count === 0 || !messages.length) return `<div class="status-panel"><div class="status-panel-header"><span class="status-panel-icon">•</span><div><strong>No new messages</strong><small>${escapeHtml(output.agent_id || 'Inbox')}</small></div></div></div>`;
  return `
    <div class="inbox-render">
      <div class="status-panel">
        <div class="status-panel-header">
          <span class="status-panel-icon">✉</span>
          <div>
            <strong>Inbox update</strong>
            <small>${escapeHtml(output.agent_id || 'System')}</small>
          </div>
        </div>
      </div>
      ${messages.map((message) => message.type === 'task' ? `<div class="inbox-task-card"><div>${skillBadge(message.skill)}${statusPill(message.status)}</div>${message.task ? `<strong>${escapeHtml(message.task)}</strong>` : ''}<small>${message.payload_kg !== undefined ? `${escapeHtml(message.payload_kg)} kg` : ''}${message.created_at ? `${message.payload_kg !== undefined ? ' · ' : ''}${escapeHtml(message.created_at)}` : ''}</small></div>` : `<div class="inbox-msg-card"><div>✉ ${message.sender ? `[${escapeHtml(message.sender)}]` : ''}${message.topic ? ` → ${skillBadge(message.topic)}` : ''}</div>${message.content ? `<strong>${escapeHtml(message.content)}</strong>` : ''}${message.timestamp ? `<small>${escapeHtml(message.timestamp)}</small>` : ''}</div>`).join('')}
    </div>
  `;
}
function buildCompletionStamp(output) {
  if (output.success === false) return output.error ? `<div class="completion-stamp fail">✗ ${escapeHtml(output.error)}</div>` : '';
  if (output.success !== true) return '';
  const session = output.ended_session_id === undefined ? '' : ` · Session: ${escapeHtml(shortId(output.ended_session_id))}`;
  const next = output.next_task_id !== null && output.next_task_id !== undefined ? `<div class="next-task">▶ Next task activated: ${escapeHtml(shortId(output.next_task_id))}</div>` : '';
  return `<div class="status-panel success"><div class="status-panel-header"><span class="status-panel-icon">✓</span><div><strong>Session ended</strong><small>${escapeHtml(output.agent_id || 'System')}${session}</small></div></div>${next}</div>`;
}
function buildBulkBanner(output) {
  if (output.success !== true) return '';
  const count = output.ended_count;
  const message = count === 0 ? 'No active sessions were found.' : `Ended ${count} session(s)${output.agent_id ? ` for ${output.agent_id}.` : ' across all agents.'}`;
  return `<div class="bulk-banner">${escapeHtml(message)}</div>`;
}
function buildAgentGrid(output) {
  const agents = Array.isArray(output.agents) ? output.agents : (output.agent ? [output.agent] : []);
  if (!agents.length) return (output.count === 0 || output.success === false) && output.error ? `<div class="demo-note error-text">${escapeHtml(output.error)}</div>` : '';
  return `<div class="agent-card-grid">${agents.map((agent) => buildAgentCard(agent)).join('')}</div>`;
}
function buildSessionTable(output) {
  const sessions = Array.isArray(output) ? output : (Array.isArray(output.result) ? output.result : (Array.isArray(output.sessions) ? output.sessions : []));
  if (!sessions.length || !sessions[0] || typeof sessions[0] !== 'object') return '';
  const keys = Object.keys(sessions[0]);
  return `<div class="status-panel"><div class="status-panel-header"><span class="status-panel-icon">▦</span><div><strong>Active sessions</strong><small>${escapeHtml(String(sessions.length))} records</small></div></div><div class="session-table-wrap"><table class="session-table"><thead><tr>${keys.map((key) => `<th>${escapeHtml(key)}</th>`).join('')}</tr></thead><tbody>${sessions.map((session) => `<tr>${keys.map((key) => `<td>${escapeHtml(session[key])}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
}
function enrichToolCard(step, cardElement) {
  if (step.status !== 'completed' || step.output === undefined) return;
  const output = step.output;
  const toolBody = cardElement.querySelectorAll('.tool-body');
  const target = toolBody[toolBody.length - 1];
  if (!target) return;
  let visual = '';
  if (step.tool === 'authenticate' && output && typeof output === 'object') {
    visual = buildAuthStepper(output) + outputHeading('Authentication', output.authentication_method) + outputHeading('Agent', output.agent_id);
    if (typeof output.trust_score === 'number') { const color = output.trust_score >= 80 ? '#9df1c0' : output.trust_score >= 50 ? '#f3b37a' : '#f47a7a'; visual += `<div class="trust-bar-wrap"><div class="payload-bar-label"><span>Trust Score</span><strong>${output.trust_score}/100</strong></div><div class="payload-bar"><span class="trust-bar-fill" style="width:${Math.max(0, Math.min(100, output.trust_score))}%;background:${color}"></span></div></div>`; }
    if (typeof output.risk_level === 'string') { const color = output.risk_level === 'LOW' ? '#9df1c0' : output.risk_level === 'MEDIUM' ? '#f3b37a' : '#f47a7a'; visual += `<span class="risk-badge" style="background:${color}22;color:${color};border-color:${color}66">${escapeHtml(output.risk_level)}</span>`; }
    if (output.qos_class !== undefined && output.service_plan !== undefined) visual += textRow('QoS Class · Plan', `${output.qos_class} · ${output.service_plan}`);
    if (Object.prototype.hasOwnProperty.call(output, 'automated_recovery')) visual += `<details class="recovery-card"><summary>Automated recovery</summary><pre>${json(output.automated_recovery)}</pre></details>`;
  } else if (step.tool === 'assign_task' && output && typeof output === 'object') {
    const result = output.result || {};
    visual = buildTaskFlow(output) + payloadBar(result.payload_kg);
    if (result.locations && typeof result.locations === 'object' && Object.keys(result.locations).length) visual += textRow('From · To', `${result.locations.from ?? result.locations.source ?? ''} → ${result.locations.to ?? result.locations.destination ?? ''}`);
    if (result.status !== undefined) visual += statusPill(result.status);
    if (result.accepted === true) visual += `<div class="inbox-task-card"><strong>📥 Task received by ${escapeHtml(output.agent_id || '')}</strong>${skillBadge(result.skill)}${output.task ? `<span>${escapeHtml(output.task)}</span>` : ''}${statusPill(result.status)}${payloadBar(result.payload_kg)}${result.session_id ? `<small>Session: ${escapeHtml(shortId(result.session_id))}</small>` : ''}</div>`;
  } else if (step.tool === 'register') visual = buildAgentCard(output);
  else if (step.tool === 'get_ue_inbox') visual = buildInboxRender(output);
  else if (step.tool === 'end_task_session') visual = buildCompletionStamp(output);
  else if (step.tool === 'end_all_task_sessions') visual = buildBulkBanner(output);
  else if (step.tool === 'find_robot_by_skill' || step.tool === 'list_agents_by_skill') visual = buildAgentGrid(output);
  else if (step.tool === 'list_active_sessions') visual = buildSessionTable(output);
  else if (step.tool === 'find_agent') visual = buildAgentCard(output);
  if (visual) {
    const outputBlock = target.querySelectorAll('.json-block')[1];
    const markup = `<div class="demo-block">${visual}</div>`;
    if (outputBlock) outputBlock.insertAdjacentHTML('beforebegin', markup);
    else target.insertAdjacentHTML('beforeend', markup);
  }
}