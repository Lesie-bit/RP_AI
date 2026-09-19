require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 3000;
const AI_PROVIDER = (process.env.AI_PROVIDER || 'openai').toLowerCase();
const AI_API_KEY = process.env.AI_API_KEY || '';
const AI_MODEL = process.env.AI_MODEL || (
  AI_PROVIDER === 'anthropic' ? 'claude-sonnet-4-5' :
  AI_PROVIDER === 'gemini' ? 'gemini-2.5-flash' :
  'gpt-4o-mini'
);
const AI_BASE_URL = process.env.AI_BASE_URL || (
  AI_PROVIDER === 'anthropic' ? 'https://api.anthropic.com/v1/messages' :
  AI_PROVIDER === 'gemini' ? 'https://generativelanguage.googleapis.com/v1beta' :
  'https://api.openai.com/v1/chat/completions'
);
const MAX_PLAYERS = 2;
const FIXED_ROOM = 'main';
const DATA_FILE = path.join(__dirname, 'room.json');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
const server = http.createServer(app);
const io = new Server(server);

// ---------- very simple JSON-file persistence ----------
let room = { setting: '', messages: [], players: {} };
function loadRoom() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      room = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('load room failed', e);
  }
}
let saveTimer = null;
function saveRoomDebounced() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.writeFile(DATA_FILE, JSON.stringify(room, null, 2), (err) => {
      if (err) console.error('save room failed', err);
    });
  }, 500);
}
loadRoom();

function publicPlayers() {
  const out = {};
  for (const id in room.players) {
    out[id] = { name: room.players[id].name, color: room.players[id].color };
  }
  return out;
}

function pickColor(id) {
  const palette = ['#ef4444', '#f97316', '#d97706', '#16a34a', '#0891b2', '#2563eb', '#7c3aed', '#db2777'];
  let hash = 0;
  for (const c of String(id)) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
}

function trimMessages(room) {
  const MAX = 300;
  if (room.messages.length > MAX) {
    room.messages = room.messages.slice(room.messages.length - MAX);
  }
}

function nameFor(room, senderId) {
  const p = room.players[senderId];
  return (p && p.name) || 'ผู้เล่น';
}

async function callAI(room) {
  if (!AI_API_KEY) {
    throw new Error('ยังไม่ได้ตั้งค่า AI_API_KEY ใน .env');
  }
  const history = room.messages.slice(-30).map((m) => {
    const who = m.type === 'ai' ? 'ผู้บรรยาย' : nameFor(room, m.senderId);
    return `${who}: ${m.text}`;
  }).join('\n');

  const systemPrompt = `คุณคือผู้บรรยาย (Game Master) ของเกมสวมบทบาท (RP) แบบข้อความ ระหว่างผู้เล่นสองคน
บริบท/ฉากของเรื่อง: ${room.setting || '(ยังไม่ได้ระบุ ให้ประเมินจากบทสนทนาและสร้างบรรยากาศที่เข้ากัน)'}
เขียนคำบรรยายฉาก เหตุการณ์ หรือคำพูดของ NPC สั้นกระชับ (3-6 ประโยค) เพื่อขับเคลื่อนเรื่องราวต่อ
ห้ามพูดแทนหรือตัดสินใจแทนตัวละครของผู้เล่นทั้งสองคน ให้เว้นจังหวะให้พวกเขาเลือกทำเอง ตอบเป็นภาษาไทยเท่านั้น`;

  const userTurn = `บทสนทนาที่ผ่านมา:\n${history || '(ยังไม่มีบทสนทนา เริ่มเปิดฉากเรื่องได้เลย)'}`;

  if (AI_PROVIDER === 'anthropic') {
    const res = await fetch(AI_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': AI_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: AI_MODEL,
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: 'user', content: userTurn }],
      }),
    });
    if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const textBlock = (data.content || []).find((b) => b.type === 'text');
    return textBlock ? textBlock.text.trim() : '(AI ไม่ได้ตอบข้อความ)';
  }

  if (AI_PROVIDER === 'gemini') {
    const url = `${AI_BASE_URL}/models/${AI_MODEL}:generateContent?key=${AI_API_KEY}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userTurn }] }],
        generationConfig: { maxOutputTokens: 500 },
      }),
    });
    if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const parts = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
    const text = parts ? parts.map((p) => p.text || '').join('') : '';
    return (text || '(AI ไม่ได้ตอบข้อความ)').trim();
  }

  // OpenAI-compatible chat completions — works with OpenAI, and most
  // OpenAI-compatible providers (Groq, DeepSeek, Together, local Ollama shim, ...)
  const res = await fetch(AI_BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: AI_MODEL,
      max_tokens: 500,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userTurn },
      ],
    }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  return (text || '(AI ไม่ได้ตอบข้อความ)').trim();
}

io.on('connection', (socket) => {
  let myId = null;

  socket.on('join', ({ name }, cb) => {
    const activeCount = Object.keys(room.players).filter((id) => room.players[id].connected).length;
    if (activeCount >= MAX_PLAYERS && !room.players[socket.id]) {
      cb && cb({ ok: false, error: 'ห้องเต็มแล้ว (จำกัด 2 คน)' });
      return;
    }
    myId = socket.id;
    socket.join(FIXED_ROOM);
    room.players[myId] = {
      name: (name || 'ผู้เล่น').slice(0, 40),
      color: pickColor(myId),
      connected: true,
    };
    saveRoomDebounced();
    cb && cb({
      ok: true,
      myId,
      setting: room.setting,
      messages: room.messages,
      players: publicPlayers(),
    });
    io.to(FIXED_ROOM).emit('players', publicPlayers());
  });

  socket.on('setScenario', (setting) => {
    room.setting = String(setting || '').slice(0, 4000);
    saveRoomDebounced();
    io.to(FIXED_ROOM).emit('scenario', room.setting);
  });

  socket.on('setName', (name) => {
    if (room.players[myId]) {
      room.players[myId].name = String(name || 'ผู้เล่น').slice(0, 40);
      saveRoomDebounced();
      io.to(FIXED_ROOM).emit('players', publicPlayers());
    }
  });

  socket.on('message', (text) => {
    text = String(text || '').trim().slice(0, 2000);
    if (!text) return;
    const msg = { type: 'player', senderId: myId, text, ts: Date.now() };
    room.messages.push(msg);
    trimMessages(room);
    saveRoomDebounced();
    io.to(FIXED_ROOM).emit('message', msg);
  });

  socket.on('askAI', async () => {
    io.to(FIXED_ROOM).emit('aiThinking', true);
    try {
      const text = await callAI(room);
      const msg = { type: 'ai', text, ts: Date.now() };
      room.messages.push(msg);
      trimMessages(room);
      saveRoomDebounced();
      io.to(FIXED_ROOM).emit('message', msg);
    } catch (e) {
      console.error('AI call failed', e.message);
      io.to(FIXED_ROOM).emit('aiError', 'เรียก AI ไม่สำเร็จ: ' + e.message);
    } finally {
      io.to(FIXED_ROOM).emit('aiThinking', false);
    }
  });

  socket.on('disconnect', () => {
    if (room.players[myId]) {
      room.players[myId].connected = false;
      saveRoomDebounced();
      io.to(FIXED_ROOM).emit('players', publicPlayers());
    }
  });
});

server.listen(PORT, () => {
  console.log(`AI RP server running at http://localhost:${PORT}`);
});
