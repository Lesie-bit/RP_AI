const socket = io();
let myId = null;
let players = {};
let messages = [];
let scenario = '';

const $ = (id) => document.getElementById(id);
const app = $('app');
const scenarioBanner = $('scenarioBanner');
const chat = $('chat');
const playersList = $('playersList');
const input = $('input');
const sendBtn = $('sendBtn');
const aiBtn = $('aiBtn');
const settingsBtn = $('settingsBtn');
const settingsModal = $('settingsModal');
const profileNameInput = $('profileNameInput');
const profileCharacterNameInput = $('profileCharacterNameInput');
const profileCharacterTraitInput = $('profileCharacterTraitInput');
const scenarioInput = $('scenarioInput');
const worldPdfInput = $('worldPdfInput');
const saveSettingsBtn = $('saveSettingsBtn');
const closeSettingsBtn = $('closeSettingsBtn');

const storedName = localStorage.getItem('rp_name') || 'ผู้เล่น';

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function getJoinPayload() {
  const baseName = localStorage.getItem('rp_name') || 'ผู้เล่น';
  return {
    name: (baseName || 'ผู้เล่น').trim() || 'ผู้เล่น',
    characterName: 'ตัวละคร',
    characterTrait: '',
  };
}

function nameFor(id) {
  if (!id) return 'AI ผู้บรรยาย';
  const p = players[id];
  if (!p) return 'ผู้เล่น';
  return p.characterName || p.name || 'ผู้เล่น';
}

function aliasFor(id) {
  if (!id) return 'AI ผู้บรรยาย';
  const p = players[id];
  return (p && p.name) || 'ผู้เล่น';
}

function colorFor(id) {
  if (!id) return 'var(--ai-color)';
  return players[id] && players[id].color ? players[id].color : 'var(--text-dim)';
}

function renderScenario() {
  scenarioBanner.textContent = scenario || 'ยังไม่ได้ตั้งฉาก/บริบทของเรื่อง — กด ⚙️ เพื่อเริ่มตั้งเรื่องราว';
}

function renderPlayers() {
  const entries = Object.entries(players);
  if (entries.length === 0) {
    playersList.innerHTML = '<div class="empty-state">รอผู้เล่นเข้าร่วม...</div>';
    return;
  }

  playersList.innerHTML = entries.map(([id, p]) => {
    const name = escapeHtml(p.characterName || p.name || 'ตัวละคร');
    const isMe = id === myId;
    return `
      <div class="player-card ${isMe ? 'me' : ''}">
        <div class="player-badge" style="background:${p.color || '#888'}"></div>
        <div class="player-info">
          <div class="player-head player-head-simple">
            <span>${name}</span>
            <span class="player-status ${p.connected === false ? 'offline' : 'online'}">${p.connected === false ? 'ออฟไลน์' : 'ออนไลน์'}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderMessages() {
  if (messages.length === 0) {
    chat.innerHTML = '<div class="notice">เริ่มบทสนทนาได้เลย หรือกด "ให้ AI เล่าเรื่องต่อ" เพื่อเปิดฉาก</div>';
    return;
  }

  chat.innerHTML = messages.map((m) => {
    const isAI = m.type === 'ai';
    const isMe = !isAI && m.senderId === myId;
    const cls = isAI ? 'msg ai' : (isMe ? 'msg me' : 'msg other');
    const displayName = isAI ? '🤖 ผู้บรรยาย (AI)' : escapeHtml(nameFor(m.senderId));
    const subText = isAI ? 'ผู้คุมเรื่อง' : escapeHtml(aliasFor(m.senderId));
    const color = colorFor(m.senderId);
    const text = escapeHtml(m.text).replace(/\n/g, '<br>');
    return `
      <div class="${cls}">
        <div class="msg-header">
          <span class="msg-name" style="color:${color}">${displayName}</span>
          ${isAI ? '' : `<span class="msg-role">${subText}</span>`}
        </div>
        <div class="msg-text">${text}</div>
      </div>
    `;
  }).join('');
  chat.scrollTop = chat.scrollHeight;
}

function joinRoom() {
  const payload = getJoinPayload();
  socket.emit('join', payload, (res) => {
    if (!res.ok) {
      alert(res.error || 'ไม่สามารถเข้าห้องได้');
      return;
    }

    myId = res.myId;
    scenario = res.setting;
    messages = res.messages;
    players = res.players;

    const me = players[myId] || {};
    profileNameInput.value = me.name || payload.name;
    profileCharacterNameInput.value = me.characterName || payload.characterName;
    profileCharacterTraitInput.value = me.characterTrait || payload.characterTrait || '';
    renderScenario();
    renderPlayers();
    renderMessages();
  });
}

socket.on('connect', () => {
  joinRoom();
});

socket.on('players', (p) => {
  players = p;
  renderPlayers();
  renderMessages();
});

socket.on('scenario', (s) => {
  scenario = s;
  renderScenario();
});

socket.on('message', (m) => {
  messages.push(m);
  renderMessages();
});

socket.on('aiThinking', (thinking) => {
  aiBtn.disabled = thinking;
  aiBtn.textContent = thinking ? 'AI กำลังคิด...' : '🤖 ให้ AI เล่าเรื่องต่อ';
});

socket.on('aiError', (msg) => {
  alert(msg);
});

async function loadPdfWorld(file) {
  if (!file || file.type !== 'application/pdf') {
    alert('กรุณาเลือกไฟล์ PDF เท่านั้น');
    return;
  }

  try {
    if (!window.pdfjsLib) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.9.359/pdf.min.js';
      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    const pdfjsLib = window.pdfjsLib;
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((item) => (item && item.str) || '').join(' ');
      text += pageText + '\n';
    }

    const cleanText = text.replace(/\s+/g, ' ').trim();
    if (!cleanText) {
      alert('ไม่สามารถอ่านข้อความจาก PDF นี้ได้');
      return;
    }

    scenarioInput.value = cleanText.slice(0, 4000);
    alert('อ่านข้อมูลจาก PDF แล้ว');
  } catch (error) {
    console.error('PDF parse failed', error);
    alert('อ่าน PDF ไม่สำเร็จ กรุณาเลือกไฟล์ PDF อื่น');
  }
}

worldPdfInput.addEventListener('change', async (event) => {
  const file = event.target.files && event.target.files[0];
  if (file) {
    await loadPdfWorld(file);
  }
});

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

aiBtn.addEventListener('click', () => {
  socket.emit('askAI');
});

settingsBtn.addEventListener('click', () => {
  const me = players[myId] || {};
  profileNameInput.value = me.name || storedName || 'ผู้เล่น';
  profileCharacterNameInput.value = me.characterName || 'ตัวละคร';
  const currentTrait = me.characterTrait || profileCharacterTraitInput.value || '';
  profileCharacterTraitInput.value = currentTrait;
  scenarioInput.value = scenario || '';
  settingsModal.hidden = false;
});

closeSettingsBtn.addEventListener('click', () => {
  settingsModal.hidden = true;
});

saveSettingsBtn.addEventListener('click', () => {
  const payload = {
    name: (profileNameInput.value || 'ผู้เล่น').trim() || 'ผู้เล่น',
    characterName: (profileCharacterNameInput.value || 'ตัวละคร').trim() || 'ตัวละคร',
    characterTrait: (profileCharacterTraitInput.value || '').trim(),
  };

  socket.emit('setScenario', scenarioInput.value.trim());
  socket.emit('setName', payload);
  localStorage.setItem('rp_name', payload.name);
  settingsModal.hidden = true;
});
