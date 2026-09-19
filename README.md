# ห้อง RP กับ AI ผู้บรรยาย (self-hosted)

เว็บแอปเล็กๆ สำหรับเล่น RP กับเพื่อน 2 คน โดยมี AI (จาก API ภายนอกที่คุณเลือกเอง) คอยเล่าเรื่อง/บรรยายฉากให้

## สิ่งที่ต้องมี
- [Node.js](https://nodejs.org) เวอร์ชัน 18 ขึ้นไป (มี `fetch` ในตัว)
- API key ของผู้ให้บริการ AI ที่จะใช้ (เช่น OpenAI หรือ Anthropic)

## วิธีติดตั้งและรัน

```bash
npm install
cp .env.example .env
```

แก้ไฟล์ `.env` ใส่ค่าให้ตรงกับผู้ให้บริการที่จะใช้ เช่นถ้าใช้ Gemini (ขอ API key ฟรีได้ที่ https://aistudio.google.com/apikey):

```
AI_PROVIDER=gemini
AI_API_KEY=xxxxxxxxxx
AI_MODEL=gemini-2.5-flash
```

หรือถ้าใช้ OpenAI / Anthropic:

```
AI_PROVIDER=openai        # หรือ anthropic
AI_API_KEY=sk-xxxxxxxx    # API key ของคุณ
AI_MODEL=gpt-4o-mini      # หรือโมเดลอื่นที่ต้องการ
```

จากนั้นรันเซิร์ฟเวอร์:

```bash
npm start
```

เปิดเบราว์เซอร์ไปที่ `http://localhost:3000` — ใส่ชื่อตัวละครแล้วเข้าห้องได้เลย (ห้องเดียว จำกัด 2 คน ไม่ต้องมีรหัสห้อง)

## ให้เพื่อนเข้ามาเล่นด้วย
รันบนเครื่องคุณอย่างเดียวเพื่อนจะเข้าไม่ได้ (เพราะ `localhost` เห็นแค่ในเครื่องตัวเอง) เลือกวิธีใดวิธีหนึ่ง:

1. **เดโม/ทดสอบเร็วๆ**: ใช้ [ngrok](https://ngrok.com) หรือ [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) เปิดทันเนลจากเครื่องคุณ แล้วส่งลิงก์ที่ได้ให้เพื่อน
   ```bash
   ngrok http 3000
   ```
2. **ใช้งานถาวรกว่า**: deploy ขึ้นโฮสต์ฟรี/ราคาถูก เช่น [Render](https://render.com), [Railway](https://railway.app), หรือ [Fly.io](https://fly.io) — อัปโหลดโค้ดนี้ขึ้นไป ตั้งค่า Environment Variables (`AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`) ในหน้าตั้งค่าของโฮสต์นั้นแทนไฟล์ `.env`

## รองรับผู้ให้บริการ AI ไหนบ้าง
- `AI_PROVIDER=gemini` — ใช้ Google Gemini API (Generative Language API) ขอ API key ฟรีได้ที่ https://aistudio.google.com/apikey
- `AI_PROVIDER=openai` — ใช้ OpenAI Chat Completions API และผู้ให้บริการอื่นที่ทำ API ให้เข้ากันได้กับ OpenAI (Groq, DeepSeek, Together.ai, Ollama ที่รัน local ก็ได้ ผ่านการตั้ง `AI_BASE_URL`)
- `AI_PROVIDER=anthropic` — ใช้ Anthropic Messages API

ถ้าอยากใช้ผู้ให้บริการอื่นที่ไม่ตรงกับสองแบบนี้ แก้ฟังก์ชัน `callAI()` ใน `server.js` ได้ตามรูปแบบ API ของผู้ให้บริการนั้น

## โครงสร้างไฟล์
```
server.js           เซิร์ฟเวอร์ Express + Socket.io และการเรียก AI API
package.json
.env.example
public/
  index.html        หน้าเว็บ
  style.css
  app.js            โค้ดฝั่งไคลเอนต์ (เชื่อมต่อ socket.io)
rooms.json           (จะถูกสร้างอัตโนมัติ) เก็บประวัติแชทของห้อง
```

## ข้อจำกัดของเวอร์ชันนี้
- เก็บข้อมูลในไฟล์ JSON บนเครื่อง/เซิร์ฟเวอร์เดียว เหมาะกับเล่นกันแค่ไม่กี่คน ไม่เหมาะกับสเกลใหญ่
- ไม่มีระบบล็อกอิน/รหัสผ่าน เป็นห้องเดียว ใครก็ตามที่เข้าลิงก์นี้ได้ก็เข้าห้องได้ (จำกัดจำนวนคนในห้องไว้ที่ 2 คน)
- ปุ่ม "ให้ AI เล่าเรื่องต่อ" ต้องกดเอง (ไม่ auto) เพื่อคุมค่าใช้จ่าย API — ถ้าอยากให้ AI ตอบอัตโนมัติทุกครั้งที่มีคนพิมพ์ แก้ใน `server.js` ที่ event `message` ให้เรียก `callAI` ต่อได้เลย
