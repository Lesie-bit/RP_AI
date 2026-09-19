const socket = io();
let myId = null;
let players = {};
let messages = [];
let scenario = '';

const $ = (id) => document.getElementById(id);
const joinScreen = $('joinScreen');
const app = $('app');
const roomCodeInput = $('roomCodeInput');
const nameInput = $('nameInput');
const joinBtn = $('joinBtn');
const joinError = $('joinError');
const roomLabel = $('roomLabel');
const scenarioBanner = $('scenarioBanner');
const chat = $('chat');
const input = $('input');
const sendBtn = $('sendBtn');
const aiBtn = $('aiBtn');
const settingsBtn = $('settingsBtn');
const settingsModal = $('settingsModal');
const scenarioInput = $('scenarioInput');
const charNameInput = $('charNameInput');
const saveSettingsBtn = $('saveSettingsBtn');
const closeSettingsBtn = $('closeSettingsBtn');

let roomCode = '';

joinBtn.addEventListener('click', () => {
  roomCode = (roomCodeInput.value || 'room1').trim();
  const name = (nameInput.value || 'ผู้เล่น').trim();
  joinBtn.disabled = true;
  socket.emit('join', { roomCode, name }, (res) => {
    joinBtn.disabled = false;
    if (!res.ok) {
      joinError.textContent = res.error;
      return;
    }
    myId = res.myId;
    scenario = res.setting;
    messages = res.messages;
    players = res.players;
    roomLabel.textContent = 'ห้อง: ' + roomCode;
    joinScreen.hidden = true;
    app.hidden = false;
    renderScenario();
    renderMessages();
  });
});

socket.on('players', (p) => { players = p; renderMessages(); });
socket.on('scenario', (s) => { scenario = s; renderScenario(); });
socket.on('message', (m) => { messages.push(m); renderMessages(); });
socket.on('aiThinking', (thinking) => {
  aiBtn.disabled = thinking;
  aiBtn.textContent = thinking ? 'AI กำลังคิด...' : '🤖 ให้ AI เล่าเรื่องต่อ';
});
socket.on('aiError', (msg) => { alert(msg); });

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function nameFor(id) {
  if (!id) return 'AI ผู้บรรยาย';
  return (players[id] && players[id].name) || 'ผู้เล่น';
}
function colorFor(id) {
  if (!id) return null;
  return players[id] && players[id].color;
}

function renderScenario() {
  scenarioBanner.textContent = scenario || 'ยังไม่ได้ตั้งฉาก/บริบทของเรื่อง — กด ⚙️ เพื่อเริ่มตั้งเรื่องราว';
}

function renderMessages() {
  if (messages.length === 0) {
    chat.innerHTML = '<div class="notice">ยังไม่มีข้อความ — เริ่มเล่นได้เลย หรือกด "ให้ AI เล่าเรื่องต่อ" เพื่อเปิดฉาก</div>';
    return;
  }
  chat.innerHTML = messages.map((m) => {
    const isAI = m.type === 'ai';
    const isMe = !isAI && m.senderId === myId;
    const cls = isAI ? 'msg ai' : (isMe ? 'msg me' : 'msg other');
    const name = isAI ? '🤖 ผู้บรรยาย (AI)' : escapeHtml(nameFor(m.senderId));
    const color = isAI ? 'var(--ai-color)' : (colorFor(m.senderId) || 'var(--text-dim)');
    const text = escapeHtml(m.text).replace(/\n/g, '<br>');
    return `<div class="${cls}"><div class="msg-name" style="color:${color}">${name}</div><div class="msg-text">${text}</div></div>`;
  }).join('');
  chat.scrollTop = chat.scrollHeight;
}

sendBtn.addEventListener('click', () => {
  const text = input.value;
  if (!text.trim()) return;
  socket.emit('message', text);
  input.value = '';
});
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendBtn.click();
  }
});
aiBtn.addEventListener('click', () => { socket.emit('askAI'); });

settingsBtn.addEventListener('click', () => {
  scenarioInput.value = scenario;
  charNameInput.value = (players[myId] && players[myId].name) || '';
  settingsModal.hidden = false;
});
closeSettingsBtn.addEventListener('click', () => { settingsModal.hidden = true; });
saveSettingsBtn.addEventListener('click', () => {
  socket.emit('setScenario', scenarioInput.value.trim());
  socket.emit('setName', charNameInput.value.trim());
  settingsModal.hidden = true;
});
