/**
 * ระบบผ้าป่าเพื่อการศึกษา โรงเรียนร่มเกล้าพิทยาสรรค์ — Backend (Code.gs)
 * สื่อสารกับ index.html ด้วย JSONP · ฐานข้อมูล Google Sheets · เก็บไฟล์ใน Google Drive
 * วิธีใช้: รัน setup() 1 ครั้ง → Deploy เป็น Web app (Execute as: Me, Access: Anyone)
 */
const SHEET_ID = '1LqVMwk81psJ69LM5iAu6oQlejM3XZtOBAZW2kfYEOFg';
const FOLDER_ID = '1cV8Mv8WiplKltEVr10z-DSg6Q9oNWeu-';

// ======================================================================
// ตั้งค่า · โครงสร้างชีต · สิทธิ์
// ======================================================================

/* ระบบผ้าป่าเพื่อการศึกษา – Backend (Google Apps Script + Google Sheets)
   วิธีใช้: ผูกสคริปต์กับ Google Sheet → รัน setup() 1 ครั้ง → Deploy เป็น Web app */
const SALT = 'rk39',
  SHIP = 40;
const SCHEMA = {
  Settings: ['Key', 'Value'],
  Users: ['Username', 'PassHash', 'Role', 'Name'],
  Donations: [
    'DonationID',
    'DonorName',
    'Phone',
    'Email',
    'DonorType',
    'Amount',
    'Purpose',
    'ShowName',
    'Wish',
    'NeedReceipt',
    'SlipURL',
    'Status',
    'Reason',
    'VerifiedBy',
    'VerifiedAt',
    'CreatedAt',
  ],
  Products: ['ProductID', 'ProductName', 'Color', 'Price', 'Emoji', 'ImageURL', 'Active'],
  ProductStock: ['ProductID', 'Size', 'Total', 'Reserved'],
  Orders: [
    'OrderID',
    'Name',
    'Phone',
    'Method',
    'Address',
    'Shipping',
    'Total',
    'SlipURL',
    'Status',
    'Reason',
    'VerifiedBy',
    'VerifiedAt',
    'CreatedAt',
  ],
  OrderItems: ['OrderID', 'ProductID', 'ProductName', 'Color', 'Size', 'Qty', 'Price'],
  Tables: ['TableID', 'Seats', 'Price'],
  TableBookings: [
    'BookingID',
    'TableID',
    'BookerName',
    'Organization',
    'Phone',
    'Pax',
    'Amount',
    'Note',
    'SlipURL',
    'Status',
    'Reason',
    'VerifiedBy',
    'VerifiedAt',
    'CreatedAt',
  ],
  News: ['NewsID', 'Title', 'Detail', 'ImageURL', 'CreatedAt'],
  Schedule: ['ScheduleID', 'DateText', 'Title', 'Detail', 'ImageURL'],
  Logs: ['Time', 'User', 'Action', 'Detail'],
};
// สิทธิ์: Super ทำได้ทุกอย่าง
const ROLES = {
  Super: null,
  Finance: ['verify', 'report'],
  Merchandise: ['product', 'report'],
  Event: ['table', 'content', 'report'],
  Viewer: ['report'],
};
const T = (v) => v === true || v === 'TRUE' || v === 'true',
  now = () => new Date().toISOString();


// ======================================================================
// เริ่มระบบ · สร้างชีตและหัวตาราง
// ======================================================================

const API_NAMES = ['getPublic', 'login', 'logout', 'submitDonation', 'submitOrder', 'submitTable', 'searchTxn', 'receipt', 'chunk',
  'adminList', 'verify', 'report', 'slipImage', 'saveProduct', 'deleteProduct', 'saveTables', 'saveNews', 'saveSchedule',
  'deleteRec', 'adminCfg', 'saveSettings', 'listUsers', 'saveUser', 'deleteUser'];

// จุดรับคำสั่ง JSONP: ?action=ชื่อฟังก์ชัน&a=[อาร์กิวเมนต์ JSON]&callback=ชื่อ
function doGet(e) {
  const p = (e && e.parameter) || {};
  const cb = String(p.callback || 'callback').replace(/[^\w.$]/g, '');
  let out;
  try {
    if (!p.action || p.action === 'ping') out = { ok: true, data: { status: 'ready', message: 'ระบบผ้าป่าเพื่อการศึกษาพร้อมใช้งาน (ทดสอบ: เพิ่ม ?action=getPublic ต่อท้าย URL)' } };
    else {
      if (API_NAMES.indexOf(p.action) < 0) throw new Error('ไม่พบคำสั่ง ' + p.action);
      const FN = { getPublic, login, logout, submitDonation, submitOrder, submitTable, searchTxn, receipt, chunk,
        adminList, verify, report, slipImage, saveProduct, deleteProduct, saveTables, saveNews, saveSchedule,
        deleteRec, adminCfg, saveSettings, listUsers, saveUser, deleteUser };
      out = { ok: true, data: FN[p.action].apply(null, JSON.parse(p.a || '[]')) };
    }
  } catch (err) {
    out = { ok: false, error: String(err.message || err) };
  }
  return ContentService.createTextOutput(cb + '(' + JSON.stringify(out) + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
}
function setup() {
  const ss = SS();
  Object.keys(SCHEMA).forEach((n) => {
    const s = ss.getSheetByName(n) || ss.insertSheet(n),
      h = SCHEMA[n];
    s.getRange(1, 1, 1, h.length)
      .setValues([h])
      .setFontWeight('bold')
      .setBackground('#4A2C6D')
      .setFontColor('#ffffff');
    s.setFrozenRows(1);
    const pc = h.indexOf('Phone');
    if (pc >= 0) s.getRange(2, pc + 1, s.getMaxRows() - 1, 1).setNumberFormat('@');
  });
  if (sh('Settings').getLastRow() < 2) {
    const d = {
      SystemName: 'ระบบผ้าป่าเพื่อการศึกษา',
      Subtitle: 'คืนสู่เหย้า 39 ปี ชาวม่วง-แสด',
      Target: 500000,
      PromptPay: '',
      Objective: 'ระดมทุนสมทบกองทุนการศึกษา พัฒนาอาคารเรียนและสิ่งแวดล้อมเพื่อการเรียนรู้',
      Logo: '',
      Banner: '',
      QRImage: '',
      TelegramToken: '',
      TelegramChat: '',
    };
    for (const k in d) add('Settings', { Key: k, Value: d[k] });
  }
  if (sh('Users').getLastRow() < 2)
    add('Users', { Username: 'admin', PassHash: hash('1234'), Role: 'Super', Name: 'ผู้ดูแลระบบ' });
  if (sh('Tables').getLastRow() < 2) genTables(3, 4, 8, 3000);
  if (sh('Products').getLastRow() < 2)
    [
      ['เสื้อผ้าป่า', 'ม่วง', 299, '👕'],
      ['เสื้อผ้าป่า', 'แสด', 299, '👕'],
      ['เสื้อโปโล', 'ม่วง', 399, '👔'],
      ['กระเป๋าผ้า', '-', 159, '👜'],
      ['แก้วที่ระลึก', '-', 129, '🥤'],
    ].forEach((p, i) => {
      const id = 'P' + (i + 1);
      add('Products', {
        ProductID: id,
        ProductName: p[0],
        Color: p[1],
        Price: p[2],
        Emoji: p[3],
        ImageURL: '',
        Active: true,
      });
      (i < 3 ? ['S', 'M', 'L', 'XL', '2XL'] : ['ฟรีไซซ์']).forEach((z) =>
        add('ProductStock', { ProductID: id, Size: z, Total: 100, Reserved: 0 }),
      );
    });
  if (sh('Schedule').getLastRow() < 2)
    add('Schedule', {
      ScheduleID: 'S1',
      DateText: 'วันงาน · 08.00 น.',
      Title: 'ลงทะเบียน & พิธีเปิดงาน',
      Detail: 'พบปะศิษย์เก่า ครู และผู้ปกครอง',
      ImageURL: '',
    });
  const folders = setupFolders();
  Logger.log(JSON.stringify(folders, null, 2));
  return 'setup เสร็จแล้ว: ผู้ดูแล admin / 1234 (กรุณาเปลี่ยนรหัสผ่านทันที) · โฟลเดอร์ Drive: ' + FOLDER_ID;
}
function genTables(r, c, seats, price) {
  const s = sh('Tables');
  if (s.getLastRow() > 1) s.deleteRows(2, s.getLastRow() - 1);
  const v = [];
  for (let i = 1; i <= r * c; i++) v.push(['T' + String(i).padStart(2, '0'), seats, price]);
  s.getRange(2, 1, v.length, 3).setValues(v);
  [
    ['TableRows', r],
    ['TableCols', c],
    ['TableSeats', seats],
    ['TablePrice', price],
  ].forEach((a) => setCfg(a[0], a[1]));
}


// ======================================================================
// ฐานข้อมูล Google Sheets · โฟลเดอร์ Drive · Telegram
// ======================================================================

function SS() {
  return SpreadsheetApp.openById(SHEET_ID);
}
function sh(n) {
  return SS().getSheetByName(n);
}
function all(n) {
  const v = sh(n).getDataRange().getValues(),
    h = v.shift();
  return v.map((r, i) => {
    const o = { _r: i + 2 };
    h.forEach((k, j) => (o[k] = r[j] instanceof Date ? r[j].toISOString() : r[j]));
    return o;
  });
}
function add(n, o) {
  sh(n).appendRow(SCHEMA[n].map((k) => (o[k] === undefined ? '' : o[k])));
}
function upd(n, key, id, p) {
  const r = all(n).find((x) => String(x[key]) == String(id));
  if (!r) return false;
  const s = sh(n),
    h = SCHEMA[n];
  for (const k in p) {
    const c = h.indexOf(k);
    if (c >= 0) s.getRange(r._r, c + 1).setValue(p[k]);
  }
  return true;
}
function del(n, key, id) {
  all(n)
    .filter((x) => String(x[key]) == String(id))
    .reverse()
    .forEach((r) => sh(n).deleteRow(r._r));
}
function nid(p, n, pad) {
  return p + '-' + (new Date().getFullYear() + 543) + '-' + String(sh(n).getLastRow()).padStart(pad, '0');
}
function cfg() {
  const o = {};
  all('Settings').forEach((r) => (o[r.Key] = r.Value));
  return o;
}
function setCfg(k, v) {
  if (!upd('Settings', 'Key', k, { Value: v })) add('Settings', { Key: k, Value: v });
}
function log(u, a, d) {
  add('Logs', { Time: now(), User: u, Action: a, Detail: d });
}
function bump(pid, size, d) {
  const r = all('ProductStock').find((x) => String(x.ProductID) == String(pid) && x.Size == size);
  if (r)
    sh('ProductStock')
      .getRange(r._r, 4)
      .setValue(Number(r.Reserved) + d);
}
const DRIVE_FOLDERS = [
  ['Slips', 'Donations'],
  ['Slips', 'Orders'],
  ['Slips', 'Tables'],
  ['Images', 'Branding'],
  ['Images', 'Products'],
  ['Images', 'News'],
  ['Images', 'Schedule'],
  ['Receipts'],
];
function childFolder_(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}
function getFolder_(path) {
  const props = PropertiesService.getScriptProperties(),
    key = 'folder:' + path.join('/'),
    cached = props.getProperty(key);
  if (cached) {
    try {
      const f = DriveApp.getFolderById(cached);
      if (!f.isTrashed()) return f;
    } catch (e) {}
  }
  let folder = DriveApp.getFolderById(FOLDER_ID);
  path.forEach((n) => (folder = childFolder_(folder, n)));
  props.setProperty(key, folder.getId());
  return folder;
}
function setupFolders() {
  const out = {};
  DRIVE_FOLDERS.forEach((p) => (out[p.join('/')] = getFolder_(p).getUrl()));
  return out;
}
// ===== อัปโหลดไฟล์ผ่าน JSONP: ฝั่ง client แบ่ง base64 เป็นชิ้นเล็ก ๆ ส่งเก็บใน Cache แล้วอ้างอิงด้วย "ref:<id>:<จำนวนชิ้น>"
function chunk(id, k, part) {
  if (!/^u[a-z0-9]{6,30}$/.test(String(id))) throw new Error('รหัสอัปโหลดไม่ถูกต้อง');
  CacheService.getScriptCache().put(id + '_' + k, String(part), 21600);
  return 1;
}
function resolve_(data) {
  const m = String(data).match(/^ref:(u[a-z0-9]+):(\d+)$/);
  if (!m) return data;
  const cache = CacheService.getScriptCache(), n = +m[2], keys = [];
  for (let i = 0; i < n; i++) keys.push(m[1] + '_' + i);
  let got = {};
  for (let i = 0; i < keys.length; i += 50) got = Object.assign(got, cache.getAll(keys.slice(i, i + 50)));
  let b64 = '';
  keys.forEach(k => { if (got[k] === undefined) throw new Error('อัปโหลดไฟล์ไม่สมบูรณ์ กรุณาลองใหม่'); b64 += got[k]; });
  cache.removeAll(keys);
  b64 = b64.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  return 'data:image/jpeg;base64,' + b64;
}
function decode_(data, tag) {
  return decodeData_(resolve_(data), tag);
}
function decodeData_(data, tag) {
  const m = String(data).match(/^data:(image\/[\w+.-]+);base64,(.+)$/);
  if (!m) throw new Error('ไฟล์รูปภาพไม่ถูกต้อง');
  if (m[2].length > 8e6) throw new Error('ไฟล์ใหญ่เกินไป (ไม่เกินประมาณ 6 MB)');
  const ext = m[1].split('/')[1].replace('jpeg', 'jpg'),
    ts = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMdd_HHmmss');
  return Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], tag + '_' + ts + '.' + ext);
}
// สลิป: เก็บแบบส่วนตัว (Slips/<ประเภท>) ดูได้ผ่านระบบ Admin เท่านั้น
function uploadSlip(data, id, group) {
  return data ? getFolder_(['Slips', group]).createFile(decode_(data, id)).getUrl() : '';
}
// รูปภาพสาธารณะ (โลโก้ สินค้า ข่าว กำหนดการ): Images/<หมวด>
function uploadImage(data, group, tag) {
  if (!data) return '';
  const f = getFolder_(['Images', group]).createFile(decode_(data, tag));
  f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://drive.google.com/thumbnail?id=' + f.getId() + '&sz=w1200';
}
// ให้ Admin ดูสลิป (ส่งกลับเป็น data URL เฉพาะไฟล์ที่ถูกอ้างถึงในชีต)
function slipImage(t, url) {
  me(t);
  const id = (String(url).match(/[-\w]{25,}/) || [])[0];
  if (!id || !rows().some((r) => r.slip && String(r.slip).indexOf(id) >= 0)) return '';
  const b = DriveApp.getFileById(id).getBlob();
  return 'data:' + b.getContentType() + ';base64,' + Utilities.base64Encode(b.getBytes());
}
function tg(m) {
  const c = cfg();
  if (!c.TelegramToken || !c.TelegramChat) return;
  try {
    UrlFetchApp.fetch('https://api.telegram.org/bot' + c.TelegramToken + '/sendMessage', {
      method: 'post',
      payload: { chat_id: c.TelegramChat, text: m },
      muteHttpExceptions: true,
    });
  } catch (e) {}
}


// ======================================================================
// เข้าสู่ระบบ / ตรวจสอบสิทธิ์
// ======================================================================

const hash = (p) =>
  Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, p + SALT)
    .map((b) => ('0' + (b & 255).toString(16)).slice(-2))
    .join('');
function login(u, p) {
  const r = all('Users').find((x) => x.Username == u && x.PassHash == hash(String(p)));
  if (!r) return { ok: false };
  const t = Utilities.getUuid();
  CacheService.getScriptCache().put(t, JSON.stringify({ u: r.Username, role: r.Role, name: r.Name }), 21600);
  log(r.Username, 'login', '');
  return { ok: true, token: t, role: r.Role, name: r.Name };
}
function logout(t) {
  CacheService.getScriptCache().remove(t);
}
function me(t, perm) {
  const j = CacheService.getScriptCache().get(t);
  if (!j) throw new Error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
  const m = JSON.parse(j);
  if (perm && m.role != 'Super' && !(ROLES[m.role] || []).includes(perm))
    throw new Error('ไม่มีสิทธิ์ดำเนินการ');
  return m;
}


// ======================================================================
// ข้อมูลหน้าสาธารณะ
// ======================================================================

function getPublic() {
  const c = cfg();
  delete c.TelegramToken;
  delete c.TelegramChat;
  const dn = all('Donations').filter((d) => d.Status == 'ok'),
    st = all('ProductStock'),
    bk = all('TableBookings').filter((b) => b.Status != 'no'),
    okO = all('Orders')
      .filter((o) => o.Status == 'ok')
      .map((o) => o.OrderID);
  return {
    cfg: c,
    sum: dn.reduce((a, d) => a + Number(d.Amount), 0),
    donors: dn.length,
    recent: dn
      .sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt))
      .slice(0, 6)
      .map((d) => ({
        name: T(d.ShowName) ? d.DonorName : 'ผู้ไม่ประสงค์ออกนาม',
        amt: d.Amount,
        type: d.DonorType,
        at: d.CreatedAt,
      })),
    products: all('Products')
      .filter((p) => (p.Active === '' || T(p.Active)))
      .map((p) => ({
        id: p.ProductID,
        name: p.ProductName,
        color: p.Color,
        price: +p.Price,
        emoji: p.Emoji,
        img: p.ImageURL,
        sizes: st
          .filter((s) => s.ProductID == p.ProductID)
          .map((s) => ({ size: s.Size, total: +s.Total, res: +s.Reserved })),
      })),
    tables: all('Tables').map((t) => {
      const b = bk.find((x) => x.TableID == t.TableID);
      return {
        id: t.TableID,
        seats: +t.Seats,
        price: +t.Price,
        state: b ? (b.Status == 'ok' ? 'ok' : 'wait') : 'free',
      };
    }),
    tableBooked: bk.length,
    sold: all('OrderItems')
      .filter((i) => okO.includes(i.OrderID))
      .reduce((a, i) => a + Number(i.Qty), 0),
    news: all('News').reverse(),
    schedule: all('Schedule'),
  };
}


// ======================================================================
// รายการจากผู้ใช้ (บริจาค · สั่งซื้อ · จองโต๊ะ · ค้นหา · ใบรับเงิน)
// ======================================================================

function withLock(f) {
  const L = LockService.getScriptLock();
  L.waitLock(20000);
  try {
    return f();
  } finally {
    L.releaseLock();
  }
}
function submitDonation(f) {
  if (!f.name || !f.phone || !(+f.amount > 0) || !f.slip) throw new Error('กรุณากรอกข้อมูลและแนบสลิปให้ครบ');
  return withLock(() => {
    const id = nid('DON', 'Donations', 6);
    add('Donations', {
      DonationID: id,
      DonorName: f.name,
      Phone: f.phone,
      Email: f.email || '',
      DonorType: f.type,
      Amount: +f.amount,
      Purpose: 'สมทบทุนเพื่อการศึกษา',
      ShowName: !!f.show,
      Wish: f.wish || '',
      NeedReceipt: !!f.rc,
      SlipURL: uploadSlip(f.slip, id, 'Donations'),
      Status: 'wait',
      CreatedAt: now(),
    });
    tg('💰 บริจาคใหม่ ' + id + '\n' + f.name + ' ' + f.amount + ' บาท');
    return { id };
  });
}
function submitOrder(f) {
  if (!f.name || !f.phone || !f.slip || !(f.items || []).length)
    throw new Error('กรุณากรอกข้อมูลและแนบสลิปให้ครบ');
  if (f.method == 'จัดส่ง' && !String(f.addr || '').trim()) throw new Error('กรุณากรอกที่อยู่จัดส่ง');
  return withLock(() => {
    const st = all('ProductStock'),
      pr = all('Products'),
      lines = f.items.map((i) => {
        const p = pr.find((x) => x.ProductID == i.id),
          s = st.find((x) => x.ProductID == i.id && x.Size == i.size),
          q = +i.qty;
        if (!p || !s || q < 1) throw new Error('ข้อมูลสินค้าไม่ถูกต้อง');
        if (q > Number(s.Total) - Number(s.Reserved))
          throw new Error(p.ProductName + ' ไซซ์ ' + i.size + ' คงเหลือไม่พอ');
        return { p, q, size: i.size };
      }),
      ship = f.method == 'จัดส่ง' ? SHIP : 0,
      id = nid('ORD', 'Orders', 6),
      total = lines.reduce((a, l) => a + l.q * Number(l.p.Price), 0) + ship;
    add('Orders', {
      OrderID: id,
      Name: f.name,
      Phone: f.phone,
      Method: f.method,
      Address: ship ? f.addr : '',
      Shipping: ship,
      Total: total,
      SlipURL: uploadSlip(f.slip, id, 'Orders'),
      Status: 'wait',
      CreatedAt: now(),
    });
    lines.forEach((l) => {
      add('OrderItems', {
        OrderID: id,
        ProductID: l.p.ProductID,
        ProductName: l.p.ProductName,
        Color: l.p.Color,
        Size: l.size,
        Qty: l.q,
        Price: l.p.Price,
      });
      bump(l.p.ProductID, l.size, l.q);
    });
    tg('👕 สั่งซื้อใหม่ ' + id + '\n' + f.name + ' ' + total + ' บาท');
    return { id, total };
  });
}
function submitTable(f) {
  if (!f.name || !f.phone || !f.slip || !f.table) throw new Error('กรุณากรอกข้อมูลและแนบสลิปให้ครบ');
  return withLock(() => {
    if (all('TableBookings').some((b) => b.TableID == f.table && b.Status != 'no'))
      throw new Error('โต๊ะนี้ถูกจองแล้ว');
    const t = all('Tables').find((x) => x.TableID == f.table);
    if (!t) throw new Error('ไม่พบโต๊ะ');
    const id = nid('TABLE', 'TableBookings', 5);
    add('TableBookings', {
      BookingID: id,
      TableID: f.table,
      BookerName: f.name,
      Organization: f.org || '',
      Phone: f.phone,
      Pax: +f.pax || t.Seats,
      Amount: t.Price,
      Note: f.note || '',
      SlipURL: uploadSlip(f.slip, id, 'Tables'),
      Status: 'wait',
      CreatedAt: now(),
    });
    tg('🪑 จองโต๊ะ ' + id + ' ' + f.table + '\n' + f.name);
    return { id };
  });
}
function searchTxn(id, phone) {
  id = String(id).trim().toUpperCase();
  phone = String(phone).trim();
  for (const d of [
    ['Donations', 'DonationID', 'บริจาค', 'Amount', 'DonorName'],
    ['Orders', 'OrderID', 'สั่งซื้อ', 'Total', 'Name'],
    ['TableBookings', 'BookingID', 'จองโต๊ะ', 'Amount', 'BookerName'],
  ]) {
    const r = all(d[0]).find((x) => x[d[1]] == id && String(x.Phone) == phone);
    if (r)
      return {
        type: d[2],
        id,
        who: r[d[4]],
        amt: r[d[3]],
        status: r.Status,
        reason: r.Reason,
        addr: r.Address || '',
        table: r.TableID || '',
        items: d[0] == 'Orders' ? all('OrderItems').filter((i) => i.OrderID == id) : [],
      };
  }
  return null;
}
function receipt(id, phone) {
  const r = all('Donations').find((x) => x.DonationID == id && String(x.Phone) == String(phone));
  if (!r || r.Status != 'ok') throw new Error('ยังไม่สามารถออกใบรับเงินได้');
  const d = DocumentApp.create('rc_' + id),
    b = d.getBody();
  b.setAttributes({ [DocumentApp.Attribute.FONT_FAMILY]: 'Sarabun' });
  b.appendParagraph('ใบรับเงินบริจาคเพื่อการศึกษา')
    .setHeading(DocumentApp.ParagraphHeading.HEADING1)
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  [
    'โรงเรียนร่มเกล้าพิทยาสรรค์ สำนักงานเขตพื้นที่การศึกษามัธยมศึกษามุกดาหาร',
    'เลขที่ ' + id,
    'ผู้บริจาค: ' + r.DonorName,
    'จำนวนเงิน: ' + Number(r.Amount).toLocaleString('th-TH') + ' บาท',
    'วัตถุประสงค์: ' + r.Purpose,
    'วันที่: ' + Utilities.formatDate(new Date(r.VerifiedAt || r.CreatedAt), 'Asia/Bangkok', 'dd/MM/yyyy'),
  ].forEach((t) => b.appendParagraph(t));
  d.saveAndClose();
  const f = DriveApp.getFileById(d.getId()),
    pdf = getFolder_(['Receipts']).createFile(f.getAs('application/pdf').setName(id + '.pdf'));
  pdf.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  f.setTrashed(true);
  return pdf.getUrl();
}


// ======================================================================
// Admin: ตรวจสลิป · รายงาน
// ======================================================================

function rows() {
  const it = all('OrderItems'),
    o = [];
  all('Donations').forEach((r) =>
    o.push({
      id: r.DonationID,
      k: 'บริจาค',
      who: r.DonorName,
      phone: r.Phone,
      amt: Number(r.Amount),
      st: r.Status,
      slip: r.SlipURL,
      at: r.CreatedAt,
      reason: r.Reason,
      det: r.DonorType,
    }),
  );
  all('Orders').forEach((r) => {
    const i = it.filter((x) => x.OrderID == r.OrderID);
    o.push({
      id: r.OrderID,
      k: 'สินค้า',
      who: r.Name,
      phone: r.Phone,
      amt: Number(r.Total),
      st: r.Status,
      slip: r.SlipURL,
      at: r.CreatedAt,
      reason: r.Reason,
      addr: r.Address,
      items: i,
      det:
        i.map((x) => x.ProductName + ' ' + x.Size + '×' + x.Qty).join(', ') +
        (r.Shipping ? ' (+จัดส่ง)' : ''),
    });
  });
  all('TableBookings').forEach((r) =>
    o.push({
      id: r.BookingID,
      k: 'โต๊ะ',
      who: r.BookerName,
      phone: r.Phone,
      amt: Number(r.Amount),
      st: r.Status,
      slip: r.SlipURL,
      at: r.CreatedAt,
      reason: r.Reason,
      det: 'โต๊ะ ' + r.TableID + ' · ' + r.Pax + ' คน',
    }),
  );
  return o.sort((a, b) => new Date(b.at) - new Date(a.at));
}
function adminList(t) {
  me(t);
  return rows();
}
function verify(t, id, ok, why) {
  const m = me(t, 'verify'),
    M = {
      DON: ['Donations', 'DonationID'],
      ORD: ['Orders', 'OrderID'],
      TABLE: ['TableBookings', 'BookingID'],
    }[String(id).split('-')[0]];
  if (!M) throw new Error('ไม่พบรายการ');
  const r = all(M[0]).find((x) => x[M[1]] == id);
  if (!r) throw new Error('ไม่พบรายการ');
  if (M[0] == 'Orders') {
    const sg = ok ? (r.Status == 'no' ? 1 : 0) : r.Status != 'no' ? -1 : 0;
    if (sg)
      all('OrderItems')
        .filter((i) => i.OrderID == id)
        .forEach((i) => bump(i.ProductID, i.Size, sg * Number(i.Qty)));
  }
  upd(M[0], M[1], id, {
    Status: ok ? 'ok' : 'no',
    Reason: ok ? '' : why,
    VerifiedBy: m.u,
    VerifiedAt: now(),
  });
  log(m.u, ok ? 'approve' : 'reject', id);
  return 1;
}
function report(t, p, d, ty) {
  me(t, 'report');
  const D = new Date(d + 'T00:00:00+07:00');
  let a = 0,
    b = 9e15;
  if (p == 'day') {
    a = +D;
    b = a + 864e5;
  } else if (p == 'week') {
    const w = new Date(D);
    w.setDate(w.getDate() - ((w.getDay() + 6) % 7));
    a = +w;
    b = a + 7 * 864e5;
  } else if (p == 'month') {
    a = +new Date(D.getFullYear(), D.getMonth(), 1);
    b = +new Date(D.getFullYear(), D.getMonth() + 1, 1);
  }
  return rows()
    .filter((r) => {
      const x = +new Date(r.at);
      return x >= a && x < b && (!ty || ty == 'all' || r.k == ty);
    })
    .map((r) => ({ id: r.id, k: r.k, who: r.who, det: r.det, amt: r.amt, st: r.st, at: r.at }));
}


// ======================================================================
// Admin: สินค้า · โต๊ะ · เนื้อหา · ตั้งค่า · ผู้ใช้
// ======================================================================

function saveProduct(t, p) {
  const m = me(t, 'product');
  if (!p.name || !(+p.price > 0)) throw new Error('กรุณากรอกชื่อและราคา');
  const sizes = p.sizes || [];
  if (!sizes.length) throw new Error('กรุณาเพิ่มไซซ์อย่างน้อย 1 รายการ');
  const ex = p.id && all('Products').some((x) => x.ProductID == p.id),
    id = p.id || 'P' + Date.now(),
    img = uploadImage(p.img, 'Products', 'prod'),
    row = {
      ProductID: id,
      ProductName: p.name,
      Color: p.color || '-',
      Price: +p.price,
      Emoji: p.emoji || '🛍️',
      Active: true,
    };
  const old = all('ProductStock').filter((s) => s.ProductID == id);
  old.forEach((o) => {
    const z = sizes.find((x) => x.k == o.Size);
    if (!z && Number(o.Reserved) > 0) throw new Error('ลบไซซ์ ' + o.Size + ' ไม่ได้ เพราะมีการจองแล้ว');
    if (z && z.n < Number(o.Reserved))
      throw new Error('ไซซ์ ' + o.Size + ': จำนวนต้องไม่น้อยกว่าที่จอง (' + o.Reserved + ')');
  });
  if (ex) {
    if (img) row.ImageURL = img;
    upd('Products', 'ProductID', id, row);
  } else {
    row.ImageURL = img;
    add('Products', row);
  }
  sizes.forEach((z) => {
    const o = old.find((s) => s.Size == z.k);
    if (o) sh('ProductStock').getRange(o._r, 3).setValue(z.n);
    else add('ProductStock', { ProductID: id, Size: z.k, Total: z.n, Reserved: 0 });
  });
  old
    .filter((o) => !sizes.some((z) => z.k == o.Size))
    .reverse()
    .forEach((o) => sh('ProductStock').deleteRow(o._r));
  log(m.u, 'saveProduct', id);
  return id;
}
function deleteProduct(t, id) {
  me(t, 'product');
  del('Products', 'ProductID', id);
  del('ProductStock', 'ProductID', id);
  return 1;
}
function saveTables(t, o) {
  me(t, 'table');
  const r = +o.rows,
    c = +o.cols;
  if (r < 1 || c < 1) throw new Error('จำนวนแถว/คอลัมน์ไม่ถูกต้อง');
  if (all('TableBookings').some((b) => b.Status != 'no' && +String(b.TableID).slice(1) > r * c))
    throw new Error('มีโต๊ะที่ถูกจองอยู่นอกผังใหม่');
  genTables(r, c, +o.seats, +o.price);
  return 1;
}
function saveNews(t, o) {
  me(t, 'content');
  const img = uploadImage(o.img, 'News', 'news');
  if (o.id) {
    const p = { Title: o.title, Detail: o.detail };
    if (img) p.ImageURL = img;
    upd('News', 'NewsID', o.id, p);
  } else
    add('News', {
      NewsID: 'N' + Date.now(),
      Title: o.title,
      Detail: o.detail,
      ImageURL: img,
      CreatedAt: now(),
    });
  return 1;
}
function saveSchedule(t, o) {
  me(t, 'content');
  const img = uploadImage(o.img, 'Schedule', 'sch');
  if (o.id) {
    const p = { DateText: o.date, Title: o.title, Detail: o.detail };
    if (img) p.ImageURL = img;
    upd('Schedule', 'ScheduleID', o.id, p);
  } else
    add('Schedule', {
      ScheduleID: 'S' + Date.now(),
      DateText: o.date,
      Title: o.title,
      Detail: o.detail,
      ImageURL: img,
    });
  return 1;
}
function deleteRec(t, sheet, id) {
  me(t, 'content');
  const k = { News: 'NewsID', Schedule: 'ScheduleID' }[sheet];
  if (!k) throw new Error('ไม่รองรับ');
  del(sheet, k, id);
  return 1;
}
function adminCfg(t) {
  me(t, 'settings');
  return cfg();
}
function saveSettings(t, o) {
  const m = me(t, 'settings');
  [
    ['SystemName', o.name],
    ['Subtitle', o.sub],
    ['Target', +o.target || 500000],
    ['PromptPay', o.pp],
    ['Objective', o.obj],
    ['TelegramToken', o.tgToken],
    ['TelegramChat', o.tgChat],
  ].forEach((a) => setCfg(a[0], a[1]));
  [
    ['Logo', o.logo],
    ['Banner', o.banner],
    ['QRImage', o.qr],
  ].forEach((a) => {
    const u = uploadImage(a[1], 'Branding', a[0]);
    if (u) setCfg(a[0], u);
  });
  if (o.newPass) upd('Users', 'Username', m.u, { PassHash: hash(String(o.newPass)) });
  log(m.u, 'saveSettings', '');
  return 1;
}
function listUsers(t) {
  me(t, 'users');
  return all('Users').map((u) => ({ user: u.Username, role: u.Role, name: u.Name }));
}
function saveUser(t, o) {
  me(t, 'users');
  if (!o.user || !ROLES.hasOwnProperty(o.role)) throw new Error('ข้อมูลไม่ถูกต้อง');
  const p = { Role: o.role, Name: o.name };
  if (o.pass) p.PassHash = hash(String(o.pass));
  if (!upd('Users', 'Username', o.user, p)) {
    if (!o.pass) throw new Error('กรุณาตั้งรหัสผ่าน');
    add('Users', { Username: o.user, PassHash: p.PassHash, Role: o.role, Name: o.name });
  }
  return 1;
}
function deleteUser(t, u) {
  const m = me(t, 'users');
  if (u == m.u) throw new Error('ลบบัญชีตัวเองไม่ได้');
  del('Users', 'Username', u);
  return 1;
}


// ======================================================================
// เครื่องมือช่วยตรวจ/เติมข้อมูลสินค้า (รันจากเมนู Run ใน Apps Script)
// ======================================================================
function seedProducts() {
  const have = all('Products').filter(p => p.ProductID && p.ProductName);
  if (have.length) return 'มีสินค้าอยู่แล้ว ' + have.length + ' รายการ (ตรวจว่าคอลัมน์ Active = TRUE และมีแถวสต็อกใน ProductStock)';
  [['เสื้อผ้าป่า', 'ม่วง', 299, '👕'], ['เสื้อผ้าป่า', 'แสด', 299, '👕'], ['เสื้อโปโล', 'ม่วง', 399, '👔'], ['กระเป๋าผ้า', '-', 159, '👜'], ['แก้วที่ระลึก', '-', 129, '🥤']].forEach((p, i) => {
    const id = 'P' + (i + 1);
    add('Products', { ProductID: id, ProductName: p[0], Color: p[1], Price: p[2], Emoji: p[3], ImageURL: '', Active: true });
    (i < 3 ? ['S', 'M', 'L', 'XL', '2XL'] : ['ฟรีไซซ์']).forEach(z => add('ProductStock', { ProductID: id, Size: z, Total: 100, Reserved: 0 }));
  });
  return 'เพิ่มสินค้าตัวอย่าง 5 รายการแล้ว';
}
