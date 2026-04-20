import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));

// Google Sheets Proxy for Apps Script
app.post('/api/sheets/proxy', async (req, res) => {
  const { url, data, method } = req.body;
  
  if (!url) return res.status(400).json({ error: 'ไม่พบ URL ของ Web App' });
  
  // Basic URL Validation
  try {
    const validUrl = new URL(url);
    if (validUrl.hostname !== 'script.google.com') {
      return res.status(400).json({ error: 'URL ไม่ถูกต้อง กรุณาใช้ลิงก์ที่มาจาก Google Apps Script เท่านั้น' });
    }
  } catch (e) {
    return res.status(400).json({ error: 'รูปแบบ URL ไม่ถูกต้อง กรุณาตรวจสอบว่าคัดลอกมาครบถ้วนหรือไม่' });
  }

  try {
    console.log(`[Proxy] ${method || 'POST'} to ${url}`);
    
    const fetchOptions: any = {
      method: method || 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: method === 'GET' ? undefined : JSON.stringify(data),
      redirect: 'manual', // We will handle redirects manually to ensure method preservation if needed
    };

    let response = await fetch(url, fetchOptions);
    
    // Manual redirect handling to be extremely safe with G.A.S.
    let redirectCount = 0;
    while ((response.status === 302 || response.status === 301 || response.status === 307 || response.status === 308) && redirectCount < 5) {
      const location = response.headers.get('location');
      if (!location) break;
      
      console.log(`[Proxy] Redirecting to: ${location}`);
      // After a 301/302 POST, standard behavior is to GET the next URL
      response = await fetch(location, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      redirectCount++;
    }

    const text = await response.text();
    console.log(`[Proxy] Status: ${response.status}, Content Length: ${text.length}`);
    
    try {
      const result = JSON.parse(text);
      res.json(result);
    } catch (parseError) {
      console.error('Failed to parse Apps Script response as JSON. First 500 chars:', text.substring(0, 500));
      
      if (text.includes('<!DOCTYPE') || text.includes('<html')) {
        let specificError = '';
        if (text.includes('Page not found')) {
          specificError = '\n(ข้อผิดพลาด: Google หาหน้านี้ไม่พบ - ตรวจสอบ URL)';
        } else if (text.includes('errorMessage') || text.includes('errorMessage">')) {
          // Try to extract the error message from Google's error page
          const match = text.match(/class="errorMessage">([^<]+)</);
          if (match) specificError = `\n(ข้อผิดพลาดจาก Google: ${match[1]})`;
        }

        return res.status(500).json({ 
          error: `Google ตอบกลับมาเป็นหน้าเว็บ (HTML)${specificError}\n\nคำแนะนำ:\n1. กดที่หน้า Apps Script -> ลำดับการทำงาน (Executions) เพื่อดูว่าโค้ดผิดตรงไหน\n2. ตรวจสอบว่าตั้งค่า Anyone หรือยัง\n3. ลองกดปุ่ม Run ใน Apps Script Editor เพื่อให้มันถามการอนุญาต (Authorization) ก่อนครับ` 
        });
      }
      
      res.status(500).json({ error: 'ข้อมูลไม่ใช่รูปแบบ JSON: ' + text.substring(0, 200) });
    }
  } catch (error: any) {
    console.error('Proxy Fetch error:', error);
    res.status(500).json({ error: 'ไม่สามารถติดต่อ Google ได้: ' + error.message });
  }
});

app.get('/api/sheets/proxy', async (req, res) => {
  const { url } = req.query;
  if (!url || typeof url !== 'string') return res.status(400).json({ error: 'ไม่พบ URL ของ Web App' });

  try {
    const response = await fetch(url, { redirect: 'follow' });
    const text = await response.text();
    try {
      const result = JSON.parse(text);
      res.json(result);
    } catch (e) {
      console.error('Non-JSON GET response:', text.substring(0, 500));
      res.status(500).json({ error: 'ไม่สามารถอ่านข้อมูลได้ (Server ตอบกลับมาไม่ใช่ JSON)' });
    }
  } catch (error: any) {
    console.error('Proxy GET error:', error);
    res.status(500).json({ error: error.message });
  }
});

// n8n Proxy to bypass Mixed Content (HTTPS to HTTP)
app.post('/api/n8n/proxy', async (req, res) => {
  const { url, data } = req.body;
  
  if (!url) return res.status(400).json({ error: 'ไม่พบ n8n Webhook URL' });
  
  try {
    console.log(`[n8n Proxy] Sending data to ${url}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(data),
      timeout: 30000 // 30 seconds timeout
    });

    const contentType = response.headers.get('content-type');
    const text = await response.text();
    
    console.log(`[n8n Proxy] Status: ${response.status}`);

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: `n8n Webhook Error: ${response.status} ${response.statusText}`,
        detail: text.substring(0, 500)
      });
    }

    // Try to parse as JSON if it looks like one, otherwise return as text
    if (contentType && contentType.includes('application/json')) {
      try {
        const result = JSON.parse(text);
        return res.json(result);
      } catch (e) {
        return res.json({ result: text });
      }
    } else {
      return res.json({ result: text });
    }
  } catch (error: any) {
    console.error('n8n Proxy error:', error);
    res.status(500).json({ 
      error: 'ไม่สามารถติดต่อ n8n ได้ผ่าน Proxy Server',
      detail: error.message 
    });
  }
});

// Vite middleware setup
if (process.env.NODE_ENV !== 'production') {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
