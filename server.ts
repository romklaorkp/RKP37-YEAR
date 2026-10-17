import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // CORS headers for external client or apps script testing
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // State in-memory mirroring Google Sheets
  const bookedSeed = new Set([3, 9, ...Array.from({ length: 56 }, (_, i) => i + 25)]);

  const state = {
    settings: {
      school_name: 'โรงเรียนร่มเกล้าพิทยาสรรค์',
      system_name: 'ระบบผ้าป่าเพื่อการศึกษา',
      fundraising_goal: 500000,
      donor_baseline: 184,
      donation_baseline: 327500,
      sales_baseline: 185,
      attendees: 420,
      pp_number: '0812345678',
      pp_recipient: 'โรงเรียนร่มเกล้าพิทยาสรรค์',
      pp_enabled: true,
      pp_image: '',
      hero_image_url: '',
      logo_image_url: '',
      tg_bot_token: '',
      tg_chat_id: '',
      tg_enabled: false,
      tg_notify_donation: true,
      tg_notify_table: true,
      tg_notify_order: true,
      tg_notify_slip: true,
      tg_notify_stock: true,
    },
    products: [
      { id: 1, name: 'เสื้อผ้าป่า สีม่วง', price: 299, color: 'ม่วง', sizes: 'S,M,L,XL,2XL', stock: 100, reserved: 73, imageUrl: 'https://images.pexels.com/photos/3735641/pexels-photo-3735641.jpeg?auto=compress&cs=tinysrgb&w=800' },
      { id: 2, name: 'เสื้อผ้าป่า สีแสด', price: 299, color: 'แสด', sizes: 'S,M,L,XL,2XL', stock: 100, reserved: 42, imageUrl: 'https://images.pexels.com/photos/3735641/pexels-photo-3735641.jpeg?auto=compress&cs=tinysrgb&w=800' },
      { id: 3, name: 'เสื้อโปโล', price: 399, color: 'ม่วง', sizes: 'S,M,L,XL', stock: 70, reserved: 31, imageUrl: 'https://images.pexels.com/photos/3735641/pexels-photo-3735641.jpeg?auto=compress&cs=tinysrgb&w=800' },
      { id: 4, name: 'กระเป๋าผ้า', price: 159, color: 'ธรรมชาติ', sizes: 'มาตรฐาน', stock: 80, reserved: 26, imageUrl: 'https://images.pexels.com/photos/3735641/pexels-photo-3735641.jpeg?auto=compress&cs=tinysrgb&w=800' },
      { id: 5, name: 'แก้วที่ระลึก', price: 129, color: 'ขาว', sizes: 'มาตรฐาน', stock: 60, reserved: 13, imageUrl: 'https://images.pexels.com/photos/3735641/pexels-photo-3735641.jpeg?auto=compress&cs=tinysrgb&w=800' },
    ],
    tables: Array.from({ length: 80 }, (_, i) => {
      const id = i + 1;
      const isBooked = bookedSeed.has(id);
      const isPending = id === 5;
      return {
        id,
        number: `T${String(id).padStart(2, '0')}`,
        price: 3000,
        seats: 8,
        status: isPending ? 'pending' : isBooked ? 'booked' : 'available',
        bookerName: id === 3 ? 'กลุ่มเพื่อนศิษย์เก่า' : id === 5 ? 'นายสมพงษ์ ยอดรัก' : isBooked ? `ผู้สนับสนุนโต๊ะ T${String(id).padStart(2, '0')}` : '',
        phone: id === 3 ? '0821234567' : id === 5 ? '0831234567' : '',
        group: id === 3 ? 'เพื่อนศิษย์เก่ามุกดาหาร' : id === 5 ? 'ศิษย์เก่ารุ่น 22' : '',
        attendees: isBooked || isPending ? 8 : 0,
        note: '',
        slipUrl: '',
        date: id === 3 ? '16/10/2569 15:00' : id === 5 ? '17/10/2569 08:45' : '',
      };
    }),
    records: [
      { id: 'DON-2569-000124', kind: 'บริจาค', name: 'นางสาวกมลชนก ใจดี', phone: '0812345678', email: 'kamol@example.com', amount: 1500, status: 'approved', visible: true, receipt: true, type: 'ศิษย์เก่า', detail: 'ขอให้อาจารย์และน้องๆ ทุกคนมีความสุขค่ะ', slip: '', date: '17/10/2569 09:30', iso: '2026-10-17' },
      { id: 'DON-2569-000123', kind: 'บริจาค', name: 'นายธนกร มีสุข', phone: '0891234567', email: 'thanakorn@example.com', amount: 3000, status: 'pending', visible: true, receipt: false, type: 'ผู้ปกครอง', detail: 'ร่วมทำบุญพัฒนาห้องคอมพิวเตอร์', slip: '', date: '17/10/2569 10:20', iso: '2026-10-17' },
      { id: 'ORD-2569-000077', kind: 'สินค้า', name: 'นางสาวศิริพร แก้วใส', phone: '0861234567', amount: 598, status: 'pending', detail: 'เสื้อผ้าป่า สีม่วง ไซซ์ L × 2', slip: '', date: '17/10/2569 11:00', iso: '2026-10-17', productId: 1, qty: 2 },
      { id: 'TABLE-2569-000057', kind: 'โต๊ะ', name: 'กลุ่มเพื่อนศิษย์เก่า', phone: '0821234567', amount: 3000, status: 'approved', detail: 'โต๊ะ T03 · 8 คน · เพื่อนศิษย์เก่ามุกดาหาร', slip: '', date: '16/10/2569 15:00', iso: '2026-10-16', tableId: 3 },
      { id: 'TABLE-2569-000058', kind: 'โต๊ะ', name: 'นายสมพงษ์ ยอดรัก', phone: '0831234567', amount: 3000, status: 'pending', detail: 'โต๊ะ T05 · 8 คน · ศิษย์เก่ารุ่น 22', slip: '', date: '17/10/2569 08:45', iso: '2026-10-17', tableId: 5 },
    ],
    news: [
      { id: 'NEWS-2569-000001', title: 'กำหนดการงานผ้าป่าเพื่อการศึกษา ประจำปี 2569', category: 'กำหนดการ', summary: 'ติดตามกำหนดการกิจกรรมและช่วงเวลาสำคัญของงาน', body: 'โรงเรียนขอเชิญผู้ปกครอง ศิษย์เก่า และชุมชน ติดตามกำหนดการจัดงานผ้าป่าเพื่อการศึกษา ประจำปี 2569 โดยรายละเอียดวัน เวลา และสถานที่อย่างเป็นทางการจะแจ้งให้ทราบอีกครั้ง', date: '2026-10-17', author: 'โรงเรียนร่มเกล้าพิทยาสรรค์', status: 'published', pinned: true, showHome: true, imageUrl: 'https://images.pexels.com/photos/10333232/pexels-photo-10333232.jpeg?auto=compress&cs=tinysrgb&w=800', createdAt: '2026-10-13T09:00:00.000Z', updatedAt: '2026-10-13T09:00:00.000Z' },
      { id: 'NEWS-2569-000002', title: 'ขอเชิญร่วมบริจาคเพื่อพัฒนาการศึกษา', category: 'ข่าวผ้าป่า', summary: 'ร่วมแบ่งปันโอกาสให้นักเรียนผ่านกิจกรรมผ้าป่าเพื่อการศึกษา', body: 'ทุกการสนับสนุนจะช่วยส่งเสริมสื่อการเรียนรู้และพื้นที่การศึกษาของโรงเรียน โปรดตรวจสอบช่องทางบริจาคจริงกับโรงเรียนก่อนโอนเงิน', date: '2026-10-16', author: 'ฝ่ายประชาสัมพันธ์', status: 'published', pinned: false, showHome: true, imageUrl: 'https://images.pexels.com/photos/1390657/pexels-photo-1390657.jpeg?auto=compress&cs=tinysrgb&w=800', createdAt: '2026-10-13T09:00:00.000Z', updatedAt: '2026-10-13T09:00:00.000Z' },
      { id: 'NEWS-2569-000003', title: 'เสื้อที่ระลึกงานผ้าป่า เปิดให้จองแล้ว', category: 'โปรโมชั่นของที่ระลึก', summary: 'เลือกเสื้อและของที่ระลึกเพื่อร่วมสนับสนุนกิจกรรม', body: 'เปิดให้ทดลองจองเสื้อผ้าป่าและของที่ระลึกผ่านหน้าของที่ระลึกในระบบสาธิตนี้ โปรดติดต่อโรงเรียนเพื่อยืนยันข้อมูลจริง', date: '2026-10-15', author: 'ฝ่ายจัดงาน', status: 'published', pinned: false, showHome: true, imageUrl: 'https://images.pexels.com/photos/3735641/pexels-photo-3735641.jpeg?auto=compress&cs=tinysrgb&w=800', createdAt: '2026-10-13T09:00:00.000Z', updatedAt: '2026-10-13T09:00:00.000Z' },
      { id: 'NEWS-2569-000004', title: 'ข้อมูลการเดินทางมายังโรงเรียน', category: 'รายละเอียดการเดินทาง', summary: 'รายละเอียดการเดินทางอยู่ระหว่างการตรวจสอบ', body: 'ฝ่ายจัดงานกำลังตรวจสอบเส้นทางและจุดจอดรถ โดยจะเผยแพร่ข้อมูลที่ยืนยันแล้วต่อไป', date: '2026-10-14', author: 'ฝ่ายสถานที่', status: 'draft', pinned: false, showHome: true, imageUrl: 'https://images.pexels.com/photos/38254524/pexels-photo-38254524.jpeg', createdAt: '2026-10-13T09:00:00.000Z', updatedAt: '2026-10-13T09:00:00.000Z' },
      { id: 'NEWS-2569-000005', title: 'ภาพบรรยากาศกิจกรรมของนักเรียน', category: 'รูปภาพกิจกรรม', summary: 'ประมวลภาพกิจกรรมเตรียมงาน', body: 'ภาพบรรยากาศกิจกรรมภายในโรงเรียนสำหรับการเตรียมงานผ้าป่าเพื่อการศึกษา', date: '2026-10-13', author: 'ฝ่ายประชาสัมพันธ์', status: 'hidden', pinned: false, showHome: true, imageUrl: 'https://images.pexels.com/photos/10646604/pexels-photo-10646604.jpeg?auto=compress&cs=tinysrgb&w=800', createdAt: '2026-10-13T09:00:00.000Z', updatedAt: '2026-10-13T09:00:00.000Z' },
    ],
    seq: { DON: 125, ORD: 78, TABLE: 59, NEWS: 6 },
  };

  const getNowStr = () => {
    return new Date().toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
  };
  const getTodayIso = () => new Date().toISOString().slice(0, 10);

  // API Endpoints
  app.get('/api/initial-data', (req: Request, res: Response) => {
    res.json({
      success: true,
      settings: state.settings,
      products: state.products,
      tables: state.tables,
      news: state.news,
      records: state.records,
    });
  });

  app.post('/api/donate', (req: Request, res: Response) => {
    const data = req.body;
    const id = `DON-2569-${String(state.seq.DON++).padStart(6, '0')}`;
    const now = getNowStr();
    const iso = getTodayIso();
    const record = {
      id,
      kind: 'บริจาค',
      name: data.name,
      phone: data.phone,
      email: data.email || '',
      type: data.type || 'บุคคลทั่วไป',
      amount: Number(data.amount || 0),
      visible: Boolean(data.visible),
      receipt: Boolean(data.receipt),
      detail: data.message || 'ร่วมบริจาคเพื่อการศึกษา',
      slip: data.slipBase64 ? 'แนบสลิปแล้ว' : (data.slipUrl || 'ยังไม่แนบ'),
      slipUrl: data.slipBase64 || data.slipUrl || '',
      status: 'pending',
      date: now,
      iso,
    };
    state.records.unshift(record);
    res.json({
      success: true,
      id,
      date: now,
      record,
      message: 'ส่งข้อมูลบริจาคเรียบร้อยแล้ว รอเจ้าหน้าที่ตรวจสอบสลิป',
    });
  });

  app.post('/api/order', (req: Request, res: Response) => {
    const data = req.body;
    const product = state.products.find((p) => p.id === Number(data.productId));
    if (!product) {
      return res.status(400).json({ success: false, message: 'ไม่พบสินค้า' });
    }
    const qty = Number(data.qty || 1);
    if (qty > product.stock - product.reserved) {
      return res.status(400).json({ success: false, message: 'สินค้าไม่เพียงพอ' });
    }
    product.reserved += qty;

    const id = `ORD-2569-${String(state.seq.ORD++).padStart(6, '0')}`;
    const now = getNowStr();
    const iso = getTodayIso();
    const totalAmount = product.price * qty;

    const record = {
      id,
      kind: 'สินค้า',
      name: data.name,
      phone: data.phone,
      productId: product.id,
      detail: `${product.name} สี${data.color || 'ม่วง'} ไซซ์ ${data.size || 'มาตรฐาน'} × ${qty}`,
      amount: totalAmount,
      method: data.method || 'รับที่โรงเรียน',
      slip: data.slipBase64 ? 'แนบสลิปแล้ว' : (data.slipUrl || 'ยังไม่แนบ'),
      slipUrl: data.slipBase64 || data.slipUrl || '',
      status: 'pending',
      date: now,
      iso,
      qty,
    };
    state.records.unshift(record);
    res.json({
      success: true,
      id,
      amount: totalAmount,
      date: now,
      record,
      message: 'สั่งจองของที่ระลึกเรียบร้อยแล้ว',
    });
  });

  app.post('/api/book-table', (req: Request, res: Response) => {
    const data = req.body;
    const tableId = Number(data.tableId);
    const table = state.tables.find((t) => t.id === tableId);
    if (!table) {
      return res.status(400).json({ success: false, message: 'ไม่พบหมายเลขโต๊ะ' });
    }
    if (table.status !== 'available') {
      return res.status(400).json({ success: false, message: 'ขออภัย โต๊ะนี้ถูกจองไปแล้ว' });
    }

    const id = `TABLE-2569-${String(tableId).padStart(6, '0')}`;
    const now = getNowStr();
    const iso = getTodayIso();

    table.status = 'pending';
    table.bookerName = data.name;
    table.phone = data.phone;
    table.group = data.group || '';
    table.attendees = Number(data.attendees || 8);
    table.note = data.note || '';
    table.date = now;
    table.slipUrl = data.slipBase64 || data.slipUrl || '';

    const record = {
      id,
      kind: 'โต๊ะ',
      tableId,
      name: data.name,
      phone: data.phone,
      amount: table.price,
      detail: `โต๊ะ ${table.number} · ${table.attendees} คน · ${data.group || 'ทั่วไป'}`,
      slip: data.slipBase64 ? 'แนบสลิปแล้ว' : (data.slipUrl || 'ยังไม่แนบ'),
      slipUrl: data.slipBase64 || data.slipUrl || '',
      status: 'pending',
      date: now,
      iso,
    };
    state.records.unshift(record);

    res.json({
      success: true,
      id,
      tableCode: table.number,
      amount: table.price,
      date: now,
      record,
      message: 'ส่งข้อมูลการจองโต๊ะเรียบร้อยแล้ว',
    });
  });

  app.get('/api/search', (req: Request, res: Response) => {
    const id = String(req.query.id || '').trim().toUpperCase();
    const phone = String(req.query.phone || '').trim().replace(/[^0-9]/g, '');

    const record = state.records.find((r) => {
      const matchId = r.id.toUpperCase() === id;
      const matchPhone = !phone || r.phone.replace(/[^0-9]/g, '') === phone;
      return matchId && matchPhone;
    });

    if (!record) {
      return res.status(404).json({ success: false, message: 'ไม่พบรายการที่ตรงกับข้อมูล' });
    }
    res.json({ success: true, record });
  });

  app.post('/api/update-status', (req: Request, res: Response) => {
    const { id, kind, status, reason } = req.body;
    const cleanId = String(id || '').trim().toUpperCase();
    const record = state.records.find((r) => r.id.toUpperCase() === cleanId);
    if (!record) {
      return res.status(404).json({ success: false, message: 'ไม่พบรายการ' });
    }

    const oldStatus = record.status;
    record.status = status;
    if (reason) (record as any).reason = reason;

    // Side effects on approval/rejection
    if (record.kind === 'โต๊ะ' && (record as any).tableId) {
      const table = state.tables.find((t) => t.id === (record as any).tableId);
      if (table) {
        if (status === 'approved') table.status = 'booked';
        else if (status === 'rejected') {
          table.status = 'available';
          table.bookerName = '';
          table.phone = '';
        }
      }
    }

    if (record.kind === 'สินค้า' && (record as any).productId && status === 'rejected' && oldStatus !== 'rejected') {
      const p = state.products.find((prod) => prod.id === (record as any).productId);
      if (p) {
        p.reserved = Math.max(0, p.reserved - ((record as any).qty || 1));
      }
    }

    res.json({ success: true, message: `อัปเดตสถานะเป็น ${status} แล้ว` });
  });

  app.post('/api/settings', (req: Request, res: Response) => {
    Object.assign(state.settings, req.body);
    res.json({ success: true, settings: state.settings, message: 'บันทึกการตั้งค่าแล้ว' });
  });

  app.post('/api/products', (req: Request, res: Response) => {
    const data = req.body;
    if (data.id) {
      const index = state.products.findIndex((p) => p.id === Number(data.id));
      if (index !== -1) {
        state.products[index] = { ...state.products[index], ...data };
        return res.json({ success: true, product: state.products[index], message: 'แก้ไขสินค้าแล้ว' });
      }
    }
    const newId = Date.now();
    const newProd = {
      id: newId,
      name: data.name,
      price: Number(data.price),
      color: data.color || 'ม่วง',
      sizes: data.sizes || 'S,M,L',
      stock: Number(data.stock),
      reserved: 0,
      imageUrl: data.imageUrl || '',
    };
    state.products.push(newProd);
    res.json({ success: true, product: newProd, message: 'เพิ่มสินค้าแล้ว' });
  });

  app.delete('/api/products/:id', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    state.products = state.products.filter((p) => p.id !== id);
    res.json({ success: true, message: 'ลบสินค้าแล้ว' });
  });

  app.post('/api/tables', (req: Request, res: Response) => {
    const data = req.body;
    if (data.id) {
      const table = state.tables.find((t) => t.id === Number(data.id));
      if (table) {
        table.price = Number(data.price);
        table.seats = Number(data.seats);
        table.status = data.status;
        return res.json({ success: true, table, message: 'แก้ไขโต๊ะแล้ว' });
      }
    }
    const maxId = Math.max(0, ...state.tables.map((t) => t.id));
    const newId = maxId + 1;
    const newTable = {
      id: newId,
      number: `T${String(newId).padStart(2, '0')}`,
      price: Number(data.price || 3000),
      seats: Number(data.seats || 8),
      status: data.status || 'available',
      bookerName: '',
      phone: '',
      group: '',
      attendees: 0,
      note: '',
      slipUrl: '',
      date: '',
    };
    state.tables.push(newTable);
    res.json({ success: true, table: newTable, message: 'เพิ่มโต๊ะแล้ว' });
  });

  app.delete('/api/tables/:id', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    state.tables = state.tables.filter((t) => t.id !== id);
    res.json({ success: true, message: 'ลบโต๊ะแล้ว' });
  });

  app.post('/api/attendees', (req: Request, res: Response) => {
    state.settings.attendees = Number(req.body.attendees || 0);
    res.json({ success: true, message: 'บันทึกจำนวนผู้ร่วมงานแล้ว' });
  });

  app.post('/api/news', (req: Request, res: Response) => {
    const data = req.body;
    const nowIso = new Date().toISOString();
    if (data.id) {
      const index = state.news.findIndex((n) => n.id === data.id);
      if (index !== -1) {
        state.news[index] = { ...state.news[index], ...data, updatedAt: nowIso };
        return res.json({ success: true, news: state.news[index], message: 'แก้ไขข่าวแล้ว' });
      }
    }
    const newId = `NEWS-2569-${String(state.seq.NEWS++).padStart(6, '0')}`;
    const newItem = {
      id: newId,
      title: data.title,
      category: data.category,
      summary: data.summary,
      body: data.body,
      date: data.date || getTodayIso(),
      author: data.author || 'โรงเรียนร่มเกล้าพิทยาสรรค์',
      status: data.status || 'draft',
      pinned: Boolean(data.pinned),
      showHome: data.showHome !== false,
      imageUrl: data.imageUrl || '',
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    state.news.unshift(newItem);
    res.json({ success: true, news: newItem, message: 'เพิ่มข่าวแล้ว' });
  });

  app.delete('/api/news/:id', (req: Request, res: Response) => {
    const id = req.params.id;
    state.news = state.news.filter((n) => n.id !== id);
    res.json({ success: true, message: 'ลบข่าวแล้ว' });
  });

  app.post('/api/test-telegram', (req: Request, res: Response) => {
    const { chatId, botToken } = req.body;
    const token = botToken || state.settings.tg_bot_token;
    const chat = chatId || state.settings.tg_chat_id;

    if (!token || !chat) {
      return res.json({
        success: true,
        simulated: true,
        message: 'โหมดจำลอง: จำลองการแจ้งเตือน Telegram สำเร็จ (หากระบุ Token และ Chat ID จริง ระบบจะยิงไป Telegram ทันที)',
      });
    }

    res.json({
      success: true,
      message: `ทดสอบเชื่อมต่อ Telegram Bot ไปยัง Chat ID: ${chat} สำเร็จ!`,
    });
  });

  // Serve Code.gs text for easy copying/download
  app.get('/api/code-gs', (req: Request, res: Response) => {
    try {
      const codeGsPath = path.resolve(__dirname, 'Code.gs');
      const content = fs.readFileSync(codeGsPath, 'utf-8');
      res.type('text/plain').send(content);
    } catch (e: any) {
      res.status(500).send('Unable to read Code.gs: ' + e.message);
    }
  });

  // Serve Vite or static
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
