/**
 * ระบบผ้าป่าเพื่อการศึกษา โรงเรียนร่มเกล้าพิทยาสรรค์
 * Backend: Google Apps Script (Code.gs)
 *
 * ฟังก์ชันที่ฝั่งเว็บเรียกผ่าน google.script.run:
 *   getPublic, adminLogin, adminLogout, adminGetAll,
 *   submitDonation, submitOrder, submitTable, searchItem,
 *   adminReview, adminGetSlip, adminSaveConfig, adminSaveProducts,
 *   adminSaveNews, adminSaveSchedule, adminSaveTables, adminResetAll
 *
 * ฐานข้อมูล: Google Sheets (สร้างอัตโนมัติ)  |  ไฟล์รูป/สลิป: Google Drive
 * ตั้งค่าครั้งแรก: รันฟังก์ชัน setup() จาก Apps Script Editor หนึ่งครั้ง
 */
const SHEET_ID = '1q-VeKXJV8grnblE3l6Tub9sj4wX4ngrcbHApmPLRqxU';
const FOLDER_ID = '1gGrMYTNLYRQP0fBrdrRVDtcNSkLhwxSa';
/* =========================================================
 * 1) ค่าคงที่
 * ======================================================= */
const APP = {
  TITLE: 'ระบบผ้าป่าเพื่อการศึกษา โรงเรียนร่มเกล้าพิทยาสรรค์',
  TZ: 'Asia/Bangkok',
  SHIP_FEE: 40,
  ADMIN_USER: 'admin',
  DEFAULT_PASS: 'admin1234',
  TOKEN_TTL: 21600,                 // 6 ชั่วโมง (สูงสุดของ CacheService)
  MAX_IMG_BYTES: 5 * 1024 * 1024,
  SLIP_FOLDER: 'RK_Fundraiser_Slips',
  IMG_FOLDER: 'RK_Fundraiser_Images',
  SHEET_NAME: 'RK_Fundraiser_DB',
  HASH_ROUNDS: 300
};

const DEFAULT_CFG = {
  name: 'ระบบผ้าป่าเพื่อการศึกษา',
  sub: 'ผ้าป่าสามัคคีเพื่อการศึกษา เพื่อพัฒนาคุณภาพการเรียนรู้',
  logo: '',
  banner: '',
  target: 500000,
  pp: '0812345678',
  ppImg: '',
  tgToken: '',
  tgChat: '',
  seat: 8,
  price: 3000,
  obj: 'เพื่อสมทบทุนจัดซื้ออุปกรณ์ห้องปฏิบัติการคอมพิวเตอร์และปรับปรุงภูมิทัศน์โรงเรียนร่มเกล้าพิทยาสรรค์',
  rows: 3,
  cols: 4
};
const NUM_KEYS = ['target', 'seat', 'price', 'rows', 'cols'];
const IMG_KEYS = ['logo', 'banner', 'ppImg'];
const DONOR_TYPES = ['ศิษย์เก่า', 'ผู้ปกครอง', 'ครู/บุคลากร', 'นักเรียน', 'บุคคลทั่วไป', 'หน่วยงาน/องค์กร'];
const METHODS = ['รับที่โรงเรียน', 'รับวันงาน', 'จัดส่ง'];

// num = คอลัมน์ตัวเลข, bool = คอลัมน์จริง/เท็จ, ที่เหลือเป็นข้อความ (ตั้งรูปแบบ '@' กันเบอร์โทรเสียเลข 0 และกัน formula injection)
const SCHEMA = {
  Config:    { h: ['key', 'value'], num: [], bool: [] },
  Donations: { h: ['id', 'at', 'name', 'phone', 'email', 'type', 'amount', 'show', 'wish', 'rc', 'slip', 'status', 'reason'], num: ['at', 'amount'], bool: ['show', 'rc'] },
  Orders:    { h: ['id', 'at', 'name', 'phone', 'method', 'addr', 'items', 'ship', 'total', 'slip', 'status', 'reason'], num: ['at', 'ship', 'total'], bool: [] },
  Bookings:  { h: ['id', 'at', 't', 'name', 'org', 'phone', 'pax', 'note', 'total', 'slip', 'status', 'reason'], num: ['at', 'pax', 'total'], bool: [] },
  Products:  { h: ['id', 'name', 'color', 'price', 'emoji', 'img', 'sz'], num: ['id', 'price'], bool: [] },
  News:      { h: ['id', 'at', 't', 'd', 'img'], num: ['id', 'at'], bool: [] },
  Schedule:  { h: ['id', 'd', 't', 'det', 'img'], num: ['id'], bool: [] }
};

/* =========================================================
 * 2) Entry points (Web App)
 * ======================================================= */
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

/**
 * JSON API สำหรับเรียกจากภายนอก (เช่น เว็บบน GitHub Pages)
 * POST (Content-Type: text/plain) body: {"fn":"getPublic","args":[]}
 */
function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const fn = String(body.fn || '');
    const table = rpcTable_();
    if (!Object.prototype.hasOwnProperty.call(table, fn)) return json_({ ok: false, msg: 'ไม่พบฟังก์ชันที่เรียก' });
    const args = Array.isArray(body.args) ? body.args : [];
    return json_(table[fn].apply(null, args));
  } catch (err) {
    return json_({ ok: false, msg: 'คำขอไม่ถูกต้อง' });
  }
}

function rpcTable_() {
  return {
    getPublic: getPublic, adminLogin: adminLogin, adminLogout: adminLogout, adminGetAll: adminGetAll,
    submitDonation: submitDonation, submitOrder: submitOrder, submitTable: submitTable, searchItem: searchItem,
    adminReview: adminReview, adminGetSlip: adminGetSlip, adminSaveConfig: adminSaveConfig,
    adminSaveProducts: adminSaveProducts, adminSaveNews: adminSaveNews, adminSaveSchedule: adminSaveSchedule,
    adminSaveTables: adminSaveTables, adminResetAll: adminResetAll
  };
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/* =========================================================
 * 3) ฟังก์ชันสำหรับเจ้าของระบบ (รันจาก Editor)
 * ======================================================= */
function ownerOnly_() {
  const a = Session.getActiveUser().getEmail();
  const e = Session.getEffectiveUser().getEmail();
  if (!a || a !== e) throw new Error('owner only');
}

/** รันครั้งแรกครั้งเดียว: สร้างชีต โฟลเดอร์ ค่าตั้งต้น และรหัสผ่านเริ่มต้น */
function setup() {
  ownerOnly_();
  const ss = ss_();
  Object.keys(SCHEMA).forEach(function (n) { sh_(n); });
  ss.getSheets().forEach(function (s) {
    if (!SCHEMA[s.getName()] && s.getLastRow() <= 1 && ss.getSheets().length > 1) ss.deleteSheet(s);
  });
  initAuth_();
  folder_('slip');
  folder_('img');
  if (rows_('Config').length === 0) setCfg_(DEFAULT_CFG);
  console.log('Spreadsheet: ' + ss.getUrl());
  console.log('Admin เริ่มต้น -> user: ' + APP.ADMIN_USER + ' / pass: ' + APP.DEFAULT_PASS + ' (กรุณาเปลี่ยนในเมนูตั้งค่า)');
  return ss.getUrl();
}

/** ลืมรหัสผ่าน Admin: รันจาก Editor เพื่อรีเซ็ตเป็น admin1234 */
function resetAdminPassword() {
  ownerOnly_();
  setPass_(APP.DEFAULT_PASS);
  bumpTokens_();
  console.log('รีเซ็ตรหัสผ่านเป็น ' + APP.DEFAULT_PASS + ' แล้ว');
}

/** ทดสอบการแจ้งเตือน Telegram */
function testTelegram() {
  ownerOnly_();
  tg_('✅ ทดสอบการแจ้งเตือนจากระบบผ้าป่าเพื่อการศึกษา', null);
}

/* =========================================================
 * 4) ตัวช่วยทั่วไป
 * ======================================================= */
function fail_(msg, code) {
  const e = new Error(msg);
  e.isFail = true;
  e.code = code || '';
  throw e;
}

function run_(fn) {
  try {
    return fn();
  } catch (e) {
    if (e && e.isFail) return { ok: false, msg: e.message, code: e.code || '' };
    console.error((e && e.stack) || e);
    return { ok: false, msg: 'ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง' };
  }
}

function locked_(fn) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(25000);
  } catch (e) {
    fail_('ระบบกำลังมีผู้ใช้งานหนาแน่น กรุณาลองใหม่อีกครั้ง');
  }
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function need_(v, msg) { if (!v) fail_(msg); return v; }
function b_(v) { return v === true || v === 1 || v === 'true' || v === 'TRUE'; }
function num_(v, d) { const n = Number(v); return isFinite(n) ? n : d; }
function pad_(n, w) { let s = String(n); while (s.length < w) s = '0' + s; return s; }
function money_(n) { return String(Math.round(Number(n) * 100) / 100).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function now_() { return Date.now(); }

/** ข้อความดิบ: ตัดอักขระควบคุม + จำกัดความยาว */
function txt_(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max || 200);
}
/** escape สำหรับข้อมูลที่ฝั่งเว็บนำไปแสดงผ่าน innerHTML (กัน XSS) */
function esc_(s) {
  return String(s).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function h_(v, max) { return esc_(txt_(v, max)); }
function tgEsc_(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function phone_(v) {
  const p = txt_(v, 30).replace(/[^\d+\- ]/g, '').trim();
  const d = p.replace(/\D/g, '');
  if (d.length < 8 || d.length > 15) fail_('เบอร์โทรศัพท์ไม่ถูกต้อง');
  return p;
}
function digits_(v) { return String(v == null ? '' : v).replace(/\D/g, ''); }

function email_(v) {
  const e = txt_(v, 120);
  if (!e) return '';
  if (!/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(e)) fail_('รูปแบบอีเมลไม่ถูกต้อง');
  return esc_(e);
}

function sizeKey_(v) {
  return String(v == null ? '' : v).replace(/[^\u0E00-\u0E7Fa-zA-Z0-9 ._\-+\/()]/g, '').trim().slice(0, 20);
}

/* =========================================================
 * 5) Spreadsheet helpers
 * ======================================================= */
let _ss = null;
function ss_() {
  if (_ss) return _ss;
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SHEET_ID');
  if (id) {
    try { _ss = SpreadsheetApp.openById(id); return _ss; } catch (e) {}
  }
  let s = null;
  try { s = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) {}
  if (!s) s = SpreadsheetApp.create(APP.SHEET_NAME);
  props.setProperty('SHEET_ID', s.getId());
  _ss = s;
  return s;
}

function initSheet_(ss, name) {
  const def = SCHEMA[name];
  const sh = ss.insertSheet(name);
  def.h.forEach(function (k, i) {
    if (def.num.indexOf(k) < 0 && def.bool.indexOf(k) < 0) {
      sh.getRange(1, i + 1, sh.getMaxRows(), 1).setNumberFormat('@');
    }
  });
  sh.getRange(1, 1, 1, def.h.length).setValues([def.h]).setFontWeight('bold').setBackground('#efe6f6');
  sh.setFrozenRows(1);
  return sh;
}

function sh_(name) {
  const ss = ss_();
  return ss.getSheetByName(name) || initSheet_(ss, name);
}

function ensureRows_(sh, n) {
  const max = sh.getMaxRows();
  if (max < n) sh.insertRowsAfter(max, n - max);
}

function fromRow_(name, arr) {
  const def = SCHEMA[name], o = {};
  def.h.forEach(function (k, i) {
    const v = arr[i];
    if (def.num.indexOf(k) >= 0) o[k] = Number(v) || 0;
    else if (def.bool.indexOf(k) >= 0) o[k] = b_(v);
    else o[k] = String(v == null ? '' : v);
  });
  return o;
}

function toRow_(name, o) {
  const def = SCHEMA[name];
  return def.h.map(function (k) {
    const v = o[k];
    if (def.num.indexOf(k) >= 0) return Number(v) || 0;
    if (def.bool.indexOf(k) >= 0) return !!v;
    return String(v == null ? '' : v);
  });
}

function rows_(name) {
  const sh = sh_(name), last = sh.getLastRow();
  if (last < 2) return [];
  const w = SCHEMA[name].h.length;
  return sh.getRange(2, 1, last - 1, w).getValues().map(function (r) { return fromRow_(name, r); });
}

function appendRow_(name, o) {
  const sh = sh_(name), row = sh.getLastRow() + 1;
  ensureRows_(sh, row);
  sh.getRange(row, 1, 1, SCHEMA[name].h.length).setValues([toRow_(name, o)]);
}

function replaceAll_(name, arr) {
  const sh = sh_(name), w = SCHEMA[name].h.length, last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, w).clearContent();
  if (arr.length) {
    ensureRows_(sh, arr.length + 1);
    sh.getRange(2, 1, arr.length, w).setValues(arr.map(function (o) { return toRow_(name, o); }));
  }
}

function findRow_(name, id) {
  const sh = sh_(name), last = sh.getLastRow();
  if (last < 2) return 0;
  const col = sh.getRange(2, 1, last - 1, 1).getValues();
  const key = String(id);
  for (let i = 0; i < col.length; i++) if (String(col[i][0]) === key) return i + 2;
  return 0;
}

function readRow_(name, row) {
  return fromRow_(name, sh_(name).getRange(row, 1, 1, SCHEMA[name].h.length).getValues()[0]);
}

function setCell_(name, row, key, value) {
  const idx = SCHEMA[name].h.indexOf(key);
  sh_(name).getRange(row, idx + 1).setValue(value);
}

function bust_() {
  try { CacheService.getScriptCache().remove('pub'); } catch (e) {}
}

/* =========================================================
 * 6) Config
 * ======================================================= */
function getCfg_() {
  const cfg = Object.assign({}, DEFAULT_CFG);
  rows_('Config').forEach(function (r) {
    if (!Object.prototype.hasOwnProperty.call(DEFAULT_CFG, r.key)) return;
    if (NUM_KEYS.indexOf(r.key) >= 0) {
      cfg[r.key] = (r.value === '' || isNaN(Number(r.value))) ? DEFAULT_CFG[r.key] : Number(r.value);
    } else {
      cfg[r.key] = r.value;
    }
  });
  return cfg;
}

function setCfg_(obj) {
  const sh = sh_('Config'), last = sh.getLastRow();
  const keys = last > 1 ? sh.getRange(2, 1, last - 1, 1).getValues().map(function (r) { return String(r[0]); }) : [];
  Object.keys(obj).forEach(function (k) {
    if (!Object.prototype.hasOwnProperty.call(DEFAULT_CFG, k)) return;
    const i = keys.indexOf(k);
    if (i >= 0) {
      sh.getRange(i + 2, 2).setValue(String(obj[k]));
    } else {
      const row = sh.getLastRow() + 1;
      ensureRows_(sh, row);
      sh.getRange(row, 1, 1, 2).setValues([[k, String(obj[k])]]);
      keys.push(k);
    }
  });
}

function tableList_(cfg) {
  const n = Math.max(1, cfg.rows * cfg.cols), out = [];
  for (let i = 1; i <= n; i++) out.push('T' + pad_(i, 2));
  return out;
}

/* =========================================================
 * 7) Drive: รูปภาพ / สลิป
 * ======================================================= */
function folder_(kind) {
  const props = PropertiesService.getScriptProperties();
  const key = 'FOLDER_' + kind.toUpperCase();
  const id = props.getProperty(key);
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) {}
  }
  const f = DriveApp.createFolder(kind === 'slip' ? APP.SLIP_FOLDER : APP.IMG_FOLDER);
  props.setProperty(key, f.getId());
  return f;
}

function parseDataUrl_(s) {
  if (typeof s !== 'string' || s.indexOf('data:') !== 0) return null;
  const i = s.indexOf(',');
  if (i < 0 || i > 60) return null;
  const m = /^data:image\/(png|jpe?g|gif|webp);base64$/i.exec(s.slice(0, i));
  if (!m) return null;
  let bytes;
  try { bytes = Utilities.base64Decode(s.slice(i + 1)); } catch (e) { return null; }
  if (!bytes.length) return null;
  if (bytes.length > APP.MAX_IMG_BYTES) fail_('ไฟล์รูปภาพมีขนาดใหญ่เกินไป (สูงสุด 5 MB)');
  let ext = m[1].toLowerCase();
  if (ext === 'jpeg') ext = 'jpg';
  return { bytes: bytes, ext: ext, mime: 'image/' + (ext === 'jpg' ? 'jpeg' : ext) };
}

function slipIn_(dataUrl) {
  const p = parseDataUrl_(dataUrl);
  if (!p) fail_('กรุณาแนบสลิปเป็นไฟล์รูปภาพ (PNG / JPG / WebP)');
  return p;
}

function saveSlip_(p, id) {
  return folder_('slip').createFile(Utilities.newBlob(p.bytes, p.mime, id + '.' + p.ext));
}

function thumbUrl_(file) {
  return 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w1200';
}

function fileIdFromUrl_(u) {
  const m = /^https:\/\/drive\.google\.com\/thumbnail\?id=([\w-]+)/.exec(String(u || ''));
  return m ? m[1] : '';
}

function trashImg_(url) {
  const id = fileIdFromUrl_(url);
  if (!id) return;
  try { DriveApp.getFileById(id).setTrashed(true); } catch (e) {}
}

/** รับ data URL (อัปโหลดใหม่) หรือ URL https เดิม แล้วคืน URL ที่ปลอดภัย */
function resolveImg_(v, label) {
  if (!v || typeof v !== 'string') return '';
  if (v.indexOf('data:') === 0) {
    const p = parseDataUrl_(v);
    if (!p) fail_('ไฟล์รูปภาพไม่ถูกต้อง (รองรับ PNG / JPG / WebP / GIF)');
    const f = folder_('img').createFile(Utilities.newBlob(p.bytes, p.mime, (label || 'img') + '_' + now_() + '.' + p.ext));
    try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
    return thumbUrl_(f);
  }
  if (/^https:\/\/[^\s"'<>()]+$/.test(v) && v.length <= 500) return v;
  return '';
}

function trashOrphans_(oldUrls, newUrls) {
  oldUrls.forEach(function (u) {
    if (u && newUrls.indexOf(u) < 0) trashImg_(u);
  });
}

/* =========================================================
 * 8) Auth
 * ======================================================= */
function hash_(salt, pass) {
  let h = salt + ':' + pass;
  for (let i = 0; i < APP.HASH_ROUNDS; i++) {
    const d = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h + salt, Utilities.Charset.UTF_8);
    h = d.map(function (x) { return ('0' + (x & 0xff).toString(16)).slice(-2); }).join('');
  }
  return h;
}

function safeEq_(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function setPass_(pass) {
  const props = PropertiesService.getScriptProperties();
  const salt = Utilities.getUuid();
  props.setProperty('ADMIN_SALT', salt);
  props.setProperty('ADMIN_HASH', hash_(salt, pass));
}

function initAuth_() {
  if (!PropertiesService.getScriptProperties().getProperty('ADMIN_HASH')) setPass_(APP.DEFAULT_PASS);
}

function tokVer_() { return PropertiesService.getScriptProperties().getProperty('TOK_VER') || '1'; }
function bumpTokens_() {
  PropertiesService.getScriptProperties().setProperty('TOK_VER', String(Number(tokVer_()) + 1));
}

function newToken_() {
  const t = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  CacheService.getScriptCache().put('tok_' + t, tokVer_(), APP.TOKEN_TTL);
  return t;
}

function auth_(tk) {
  const bad = function () { fail_('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่', 'AUTH'); };
  if (!tk || typeof tk !== 'string' || tk.length < 32) bad();
  const c = CacheService.getScriptCache();
  const v = c.get('tok_' + tk);
  if (v === null || v !== tokVer_()) bad();
  c.put('tok_' + tk, v, APP.TOKEN_TTL);
}

function adminLogin(user, pass) {
  return run_(function () {
    const c = CacheService.getScriptCache();
    const fails = Number(c.get('lf') || 0);
    if (fails >= 5) fail_('พยายามเข้าสู่ระบบผิดหลายครั้ง กรุณารอ 10 นาทีแล้วลองใหม่');
    initAuth_();
    const props = PropertiesService.getScriptProperties();
    const okUser = String(user || '').trim().toLowerCase() === APP.ADMIN_USER;
    const calc = hash_(props.getProperty('ADMIN_SALT'), String(pass == null ? '' : pass));
    const okPass = safeEq_(calc, props.getProperty('ADMIN_HASH'));
    if (!okUser || !okPass) {
      c.put('lf', String(fails + 1), 600);
      fail_('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    }
    c.remove('lf');
    return { ok: true, token: newToken_() };
  });
}

function adminLogout(tk) {
  return run_(function () {
    if (tk) CacheService.getScriptCache().remove('tok_' + tk);
    return { ok: true };
  });
}

/* =========================================================
 * 9) Products helpers
 * ======================================================= */
function prodFrom_(r) {
  let sz = {};
  try { sz = JSON.parse(r.sz || '{}') || {}; } catch (e) {}
  Object.keys(sz).forEach(function (k) {
    sz[k] = { n: Number(sz[k].n) || 0, s: Number(sz[k].s) || 0 };
  });
  return { id: r.id, name: r.name, color: r.color || '-', price: r.price, emoji: r.emoji || '🛍️', img: r.img || '', sz: sz };
}
function prodTo_(p) {
  return { id: p.id, name: p.name, color: p.color, price: p.price, emoji: p.emoji, img: p.img, sz: JSON.stringify(p.sz) };
}
function getProducts_() { return rows_('Products').map(prodFrom_); }

/** อ่านสินค้าพร้อมเลขแถว เพื่อใช้ปรับสต็อก */
function prodRows_() {
  const sh = sh_('Products'), last = sh.getLastRow();
  if (last < 2) return [];
  const w = SCHEMA.Products.h.length;
  return sh.getRange(2, 1, last - 1, w).getValues().map(function (r, i) {
    return { row: i + 2, p: prodFrom_(fromRow_('Products', r)) };
  });
}
function writeProdSz_(entry) {
  const idx = SCHEMA.Products.h.indexOf('sz');
  sh_('Products').getRange(entry.row, idx + 1).setValue(JSON.stringify(entry.p.sz));
}

/** ปรับสต็อกตามรายการสินค้าของออเดอร์: dir=+1 จอง, -1 คืน */
function adjustStock_(items, dir, check) {
  const pr = prodRows_(), touched = {};
  items.forEach(function (it) {
    const f = pr.filter(function (x) { return x.p.id === Number(it.id); })[0];
    if (!f || !f.p.sz[it.s]) return;
    const z = f.p.sz[it.s], q = Number(it.q) || 0;
    if (dir > 0) {
      if (check && z.n - z.s < q) fail_('สต็อก ' + f.p.name + ' ไซซ์ ' + it.s + ' ไม่เพียงพอ ไม่สามารถกลับมายืนยันรายการนี้ได้');
      z.s += q;
    } else {
      z.s = Math.max(0, z.s - q);
    }
    touched[f.row] = f;
  });
  Object.keys(touched).forEach(function (k) { writeProdSz_(touched[k]); });
}

/* =========================================================
 * 10) ID / Telegram
 * ======================================================= */
function nextId_(prefix, width) {
  const props = PropertiesService.getScriptProperties();
  const be = Number(Utilities.formatDate(new Date(), APP.TZ, 'yyyy')) + 543;
  const key = 'CNT_' + prefix + '_' + be;
  const n = Number(props.getProperty(key) || 0) + 1;
  props.setProperty(key, String(n));
  return prefix + '-' + be + '-' + pad_(n, width);
}

function stamp_() { return Utilities.formatDate(new Date(), APP.TZ, 'd/M/yyyy HH:mm'); }

function tg_(text, file) {
  try {
    const c = getCfg_();
    if (!c.tgToken || !c.tgChat) return;
    const base = 'https://api.telegram.org/bot' + c.tgToken + '/';
    let res = null;
    if (file) {
      res = UrlFetchApp.fetch(base + 'sendPhoto', {
        method: 'post', muteHttpExceptions: true,
        payload: { chat_id: c.tgChat, caption: text.slice(0, 1000), parse_mode: 'HTML', photo: file.getBlob() }
      });
      if (res.getResponseCode() === 200) return;
    }
    res = UrlFetchApp.fetch(base + 'sendMessage', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      payload: JSON.stringify({ chat_id: c.tgChat, text: text, parse_mode: 'HTML' })
    });
    if (res.getResponseCode() !== 200) {
      UrlFetchApp.fetch(base + 'sendMessage', {
        method: 'post', contentType: 'application/json', muteHttpExceptions: true,
        payload: JSON.stringify({ chat_id: c.tgChat, text: text.replace(/<[^>]+>/g, '') })
      });
    }
  } catch (e) {
    console.warn('Telegram error: ' + e);
  }
}

/* =========================================================
 * 11) Public data
 * ======================================================= */
function aggFrom_(dons, ords) {
  let sum = 0, n = 0, items = 0;
  dons.forEach(function (d) { if (d.status === 'ok') { sum += d.amount; n++; } });
  ords.forEach(function (o) {
    if (o.status !== 'ok') return;
    parseItems_(o.items).forEach(function (i) { items += Number(i.q) || 0; });
  });
  return { sum: sum, n: n, items: items };
}

function parseItems_(s) {
  try { const a = JSON.parse(s || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; }
}

function baseData_(cfg) {
  return {
    cfg: cfg,
    prods: getProducts_(),
    news: rows_('News').map(function (r) { return { id: r.id, at: r.at, t: r.t, d: r.d, img: r.img }; }),
    sch: rows_('Schedule').map(function (r) { return { id: r.id, d: r.d, t: r.t, det: r.det, img: r.img }; }),
    tables: tableList_(cfg)
  };
}

function buildPublic_() {
  const cfg = getCfg_();
  cfg.tgToken = '';
  cfg.tgChat = '';
  const dons = rows_('Donations'), ords = rows_('Orders'), tbls = rows_('Bookings');
  const d = baseData_(cfg);
  d.agg = aggFrom_(dons, ords);
  d.don = dons.filter(function (x) { return x.status === 'ok'; })
    .sort(function (a, b) { return b.at - a.at; }).slice(0, 50)
    .map(function (x) {
      return { id: x.id, at: x.at, name: x.show ? x.name : '', type: x.type, amount: x.amount, show: x.show, status: x.status };
    });
  d.tbl = tbls.filter(function (x) { return x.status !== 'no'; })
    .map(function (x) { return { t: x.t, status: x.status }; });
  return d;
}

function getPublic() {
  return run_(function () {
    const c = CacheService.getScriptCache();
    const hit = c.get('pub');
    if (hit) return { ok: true, data: JSON.parse(hit) };
    const d = buildPublic_();
    try { c.put('pub', JSON.stringify(d), 60); } catch (e) {}
    return { ok: true, data: d };
  });
}

function adminGetAll(tk) {
  return run_(function () {
    auth_(tk);
    const cfg = getCfg_();
    const dons = rows_('Donations'), ords = rows_('Orders'), tbls = rows_('Bookings');
    const d = baseData_(cfg);
    d.agg = aggFrom_(dons, ords);
    d.don = dons.sort(function (a, b) { return b.at - a.at; });
    d.ord = ords.sort(function (a, b) { return b.at - a.at; }).map(function (o) {
      o.items = parseItems_(o.items);
      return o;
    });
    d.tbl = tbls.sort(function (a, b) { return b.at - a.at; });
    return { ok: true, data: d };
  });
}

/* =========================================================
 * 12) ส่งรายการ: บริจาค / สั่งสินค้า / จองโต๊ะ
 * ======================================================= */
function submitDonation(p) {
  return run_(function () {
    p = p || {};
    const rawName = need_(txt_(p.name, 120), 'กรุณากรอกชื่อ-นามสกุล');
    if (rawName.length < 2) fail_('กรุณากรอกชื่อ-นามสกุลให้ถูกต้อง');
    const phone = phone_(p.phone);
    const email = email_(p.email);
    const type = DONOR_TYPES.indexOf(p.type) >= 0 ? p.type : 'บุคคลทั่วไป';
    let amount = num_(p.amount, 0);
    if (!(amount >= 1) || amount > 10000000) fail_('จำนวนเงินไม่ถูกต้อง');
    amount = Math.round(amount * 100) / 100;
    const wish = h_(p.wish, 300);
    const slip = slipIn_(p.slip);

    let id = '', file = null;
    locked_(function () {
      id = nextId_('DON', 6);
      file = saveSlip_(slip, id);
      try {
        appendRow_('Donations', {
          id: id, at: now_(), name: esc_(rawName), phone: phone, email: email, type: type, amount: amount,
          show: b_(p.show), wish: wish, rc: b_(p.rc), slip: file.getId(), status: 'wait', reason: ''
        });
      } catch (e) {
        try { file.setTrashed(true); } catch (x) {}
        throw e;
      }
    });
    bust_();
    tg_('💰 <b>รายการบริจาคใหม่</b>\nเลขที่: ' + id + '\nชื่อ: ' + tgEsc_(rawName) + '\nประเภท: ' + type +
        '\nเบอร์: ' + tgEsc_(phone) + '\nจำนวน: <b>' + money_(amount) + ' บาท</b>\nเวลา: ' + stamp_() + '\nสถานะ: รอตรวจสอบ', file);
    return { ok: true, id: id };
  });
}

function mergeItems_(arr) {
  if (!Array.isArray(arr) || !arr.length) fail_('กรุณาเลือกสินค้าอย่างน้อย 1 รายการ');
  if (arr.length > 60) fail_('จำนวนรายการสินค้ามากเกินไป');
  const map = {}, out = [];
  arr.forEach(function (it) {
    it = it || {};
    const id = Number(it.id), s = String(it.s == null ? '' : it.s), q = Math.floor(Number(it.q));
    if (!isFinite(id) || !s || !(q >= 1) || q > 100) fail_('ข้อมูลสินค้าไม่ถูกต้อง');
    const k = id + '|' + s;
    if (map[k]) { map[k].q += q; } else { map[k] = { id: id, s: s, q: q }; out.push(map[k]); }
  });
  return out;
}

function submitOrder(p) {
  return run_(function () {
    p = p || {};
    const rawName = need_(txt_(p.name, 120), 'กรุณากรอกชื่อผู้จอง');
    const phone = phone_(p.phone);
    if (METHODS.indexOf(p.method) < 0) fail_('วิธีรับสินค้าไม่ถูกต้อง');
    const method = p.method;
    const addr = method === 'จัดส่ง' ? need_(h_(p.addr, 400), 'กรุณากรอกที่อยู่สำหรับจัดส่ง') : '';
    const items = mergeItems_(p.items);
    const slip = slipIn_(p.slip);

    let id = '', total = 0, file = null, lines = [];
    locked_(function () {
      const pr = prodRows_(), touched = {}, enriched = [];
      let sub = 0;
      items.forEach(function (it) {
        const f = pr.filter(function (x) { return x.p.id === it.id; })[0];
        if (!f) fail_('ไม่พบสินค้าที่เลือก กรุณารีเฟรชหน้าเว็บ');
        const z = f.p.sz[it.s];
        if (!z) fail_('ไม่พบไซซ์ ' + it.s + ' ของ ' + f.p.name);
        if (z.n - z.s < it.q) fail_(f.p.name + ' ไซซ์ ' + it.s + ' เหลือ ' + Math.max(0, z.n - z.s) + ' ชิ้น ไม่เพียงพอ');
        z.s += it.q;
        sub += f.p.price * it.q;
        touched[f.row] = f;
        enriched.push({ id: it.id, p: f.p.name, c: f.p.color, s: it.s, q: it.q, price: f.p.price });
      });
      const ship = method === 'จัดส่ง' ? APP.SHIP_FEE : 0;
      total = sub + ship;
      id = nextId_('ORD', 6);
      file = saveSlip_(slip, id);
      try {
        appendRow_('Orders', {
          id: id, at: now_(), name: esc_(rawName), phone: phone, method: method, addr: addr,
          items: JSON.stringify(enriched), ship: ship, total: total, slip: file.getId(), status: 'wait', reason: ''
        });
        Object.keys(touched).forEach(function (k) { writeProdSz_(touched[k]); });
      } catch (e) {
        try { file.setTrashed(true); } catch (x) {}
        throw e;
      }
      lines = enriched.map(function (i) { return '• ' + i.p + ' ไซซ์ ' + i.s + ' × ' + i.q; });
    });
    bust_();
    tg_('👕 <b>สั่งจองของที่ระลึกใหม่</b>\nเลขที่: ' + id + '\nชื่อ: ' + tgEsc_(rawName) + '\nเบอร์: ' + tgEsc_(phone) +
        '\nรับสินค้า: ' + method + '\n' + lines.join('\n') + '\nยอดรวม: <b>' + money_(total) + ' บาท</b>\nเวลา: ' + stamp_(), file);
    return { ok: true, id: id, total: total };
  });
}

function submitTable(p) {
  return run_(function () {
    p = p || {};
    const cfg = getCfg_();
    const t = String(p.t || '').trim().toUpperCase();
    if (tableList_(cfg).indexOf(t) < 0) fail_('ไม่พบโต๊ะที่เลือก');
    const rawName = need_(txt_(p.name, 120), 'กรุณากรอกชื่อผู้จอง');
    const phone = phone_(p.phone);
    const pax = Math.floor(num_(p.pax, 0));
    if (!(pax >= 1) || pax > cfg.seat) fail_('จำนวนผู้เข้าร่วมต้องอยู่ระหว่าง 1 ถึง ' + cfg.seat + ' คน');
    const rawOrg = txt_(p.org, 160);
    const slip = slipIn_(p.slip);
    const note = h_(p.note, 300);

    let id = '', file = null;
    locked_(function () {
      if (rows_('Bookings').some(function (b) { return b.t === t && b.status !== 'no'; })) {
        fail_('โต๊ะ ' + t + ' ถูกจองไปแล้ว กรุณาเลือกโต๊ะอื่น');
      }
      id = nextId_('TBL', 5);
      file = saveSlip_(slip, id);
      try {
        appendRow_('Bookings', {
          id: id, at: now_(), t: t, name: esc_(rawName), org: esc_(rawOrg), phone: phone, pax: pax, note: note,
          total: cfg.price, slip: file.getId(), status: 'wait', reason: ''
        });
      } catch (e) {
        try { file.setTrashed(true); } catch (x) {}
        throw e;
      }
    });
    bust_();
    tg_('🪑 <b>จองโต๊ะใหม่</b>\nเลขที่: ' + id + '\nโต๊ะ: ' + t + ' (' + pax + ' คน)\nชื่อ: ' + tgEsc_(rawName) +
        (rawOrg ? '\nหน่วยงาน: ' + tgEsc_(rawOrg) : '') + '\nเบอร์: ' + tgEsc_(phone) +
        '\nยอด: <b>' + money_(cfg.price) + ' บาท</b>\nเวลา: ' + stamp_(), file);
    return { ok: true, id: id };
  });
}

/* =========================================================
 * 13) ค้นหารายการ
 * ======================================================= */
function sheetOf_(id) {
  if (/^DON-/.test(id)) return 'Donations';
  if (/^ORD-/.test(id)) return 'Orders';
  if (/^TBL-/.test(id)) return 'Bookings';
  return '';
}

function searchItem(id, phone) {
  return run_(function () {
    const c = CacheService.getScriptCache();
    const fails = Number(c.get('sf') || 0);
    if (fails >= 30) fail_('ค้นหาบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่');
    id = String(id || '').trim().toUpperCase();
    const ph = digits_(phone);
    const name = sheetOf_(id);
    let rec = null;
    if (name && ph) {
      const row = findRow_(name, id);
      if (row) {
        const r = readRow_(name, row);
        if (digits_(r.phone) === ph) rec = r;
      }
    }
    if (!rec) {
      c.put('sf', String(fails + 1), 300);
      fail_('ไม่พบรายการที่ตรงกับเลขที่และเบอร์โทรนี้');
    }
    if (name === 'Donations') {
      return { ok: true, rec: { kd: 'don', id: rec.id, at: rec.at, name: rec.name, phone: rec.phone, email: rec.email, type: rec.type,
        amt: rec.amount, show: rec.show, wish: rec.wish, rc: rec.rc, status: rec.status, reason: rec.reason } };
    }
    if (name === 'Orders') {
      return { ok: true, rec: { kd: 'ord', id: rec.id, at: rec.at, name: rec.name, phone: rec.phone, method: rec.method, addr: rec.addr,
        items: parseItems_(rec.items), amt: rec.total, ship: rec.ship, status: rec.status, reason: rec.reason } };
    }
    return { ok: true, rec: { kd: 'tbl', id: rec.id, at: rec.at, t: rec.t, name: rec.name, org: rec.org, phone: rec.phone, pax: rec.pax,
      note: rec.note, amt: rec.total, status: rec.status, reason: rec.reason } };
  });
}

/* =========================================================
 * 14) Admin: ตรวจสอบรายการ / สลิป
 * ======================================================= */
function adminReview(tk, id, act, reason) {
  return run_(function () {
    auth_(tk);
    id = String(id || '').trim().toUpperCase();
    if (['ok', 'no', 'wait'].indexOf(act) < 0) fail_('สถานะไม่ถูกต้อง');
    const name = sheetOf_(id);
    if (!name) fail_('ไม่พบรายการ');
    const why = act === 'no' ? h_(reason, 300) : '';
    let rec = null;
    locked_(function () {
      const row = findRow_(name, id);
      if (!row) fail_('ไม่พบรายการ');
      rec = readRow_(name, row);
      const old = rec.status;
      if (old !== act) {
        const wasHold = old !== 'no', willHold = act !== 'no';
        if (name === 'Orders') {
          if (wasHold && !willHold) adjustStock_(parseItems_(rec.items), -1, false);
          else if (!wasHold && willHold) adjustStock_(parseItems_(rec.items), +1, true);
        }
        if (name === 'Bookings' && !wasHold && willHold) {
          const clash = rows_('Bookings').some(function (b) { return b.id !== rec.id && b.t === rec.t && b.status !== 'no'; });
          if (clash) fail_('โต๊ะ ' + rec.t + ' ถูกจองโดยรายการอื่นแล้ว ไม่สามารถยืนยันได้');
        }
      }
      setCell_(name, row, 'status', act);
      setCell_(name, row, 'reason', why);
    });
    bust_();
    return { ok: true };
  });
}

function adminGetSlip(tk, slipId) {
  return run_(function () {
    auth_(tk);
    slipId = String(slipId || '');
    if (!slipId) return { ok: true, data: '' };
    if (!/^[\w-]{10,}$/.test(slipId)) fail_('ไม่พบไฟล์สลิป');
    let file;
    try { file = DriveApp.getFileById(slipId); } catch (e) { fail_('ไม่พบไฟล์สลิป'); }
    const fid = folder_('slip').getId();
    let inFolder = false;
    const it = file.getParents();
    while (it.hasNext()) { if (it.next().getId() === fid) { inFolder = true; break; } }
    if (!inFolder) fail_('ไม่พบไฟล์สลิป');
    const blob = file.getBlob();
    return { ok: true, data: 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes()) };
  });
}

/* =========================================================
 * 15) Admin: ตั้งค่า / สินค้า / ข่าว / กำหนดการ / โต๊ะ
 * ======================================================= */
function has_(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

function validTableCfg_(c, cur) {
  const out = {};
  if (has_(c, 'rows')) { const v = Math.floor(num_(c.rows, 0)); if (v < 1 || v > 10) fail_('จำนวนแถวต้องอยู่ระหว่าง 1–10'); out.rows = v; }
  if (has_(c, 'cols')) { const v = Math.floor(num_(c.cols, 0)); if (v < 1 || v > 10) fail_('จำนวนคอลัมน์ต้องอยู่ระหว่าง 1–10'); out.cols = v; }
  if (has_(c, 'seat')) { const v = Math.floor(num_(c.seat, 0)); if (v < 1 || v > 20) fail_('ที่นั่งต่อโต๊ะต้องอยู่ระหว่าง 1–20'); out.seat = v; }
  if (has_(c, 'price')) { const v = num_(c.price, -1); if (v < 0 || v > 10000000) fail_('ราคาโต๊ะไม่ถูกต้อง'); out.price = v; }
  if (out.rows || out.cols) {
    const next = { rows: out.rows || cur.rows, cols: out.cols || cur.cols };
    const keep = tableList_(next);
    const bad = rows_('Bookings').filter(function (b) { return b.status !== 'no' && keep.indexOf(b.t) < 0; });
    if (bad.length) fail_('ไม่สามารถลดจำนวนโต๊ะได้ เพราะโต๊ะ ' + bad[0].t + ' มีการจองอยู่');
  }
  return out;
}

function adminSaveConfig(tk, c, newPass) {
  return run_(function () {
    auth_(tk);
    c = c || {};
    locked_(function () {
      const cur = getCfg_(), out = {}, oldImgs = [], newImgs = [];
      if (has_(c, 'name')) out.name = need_(h_(c.name, 100), 'กรุณากรอกชื่อระบบ');
      if (has_(c, 'sub')) out.sub = h_(c.sub, 200);
      if (has_(c, 'obj')) out.obj = h_(c.obj, 2000);
      if (has_(c, 'pp')) out.pp = h_(c.pp, 40).replace(/\s+/g, '');
      if (has_(c, 'target')) {
        const t = num_(c.target, 0);
        if (!(t > 0) || t > 1e10) fail_('เป้าหมายเงินบริจาคไม่ถูกต้อง');
        out.target = t;
      }
      if (has_(c, 'tgToken')) {
        const v = txt_(c.tgToken, 100);
        if (v && !/^\d{5,}:[A-Za-z0-9_-]{20,}$/.test(v)) fail_('รูปแบบ Bot Token ไม่ถูกต้อง');
        out.tgToken = v;
      }
      if (has_(c, 'tgChat')) {
        const v = txt_(c.tgChat, 40);
        if (v && !/^(-?\d{3,20}|@\w{3,})$/.test(v)) fail_('รูปแบบ Chat ID ไม่ถูกต้อง');
        out.tgChat = v;
      }
      IMG_KEYS.forEach(function (k) {
        if (has_(c, k) && c[k]) {
          const u = resolveImg_(c[k], k);
          if (!u) fail_('ไฟล์รูปภาพไม่ถูกต้อง');
          out[k] = u;
          if (cur[k] && cur[k] !== u) oldImgs.push(cur[k]);
          newImgs.push(u);
        }
      });
      Object.assign(out, validTableCfg_(c, cur));
      if (Object.keys(out).length) setCfg_(out);
      trashOrphans_(oldImgs, newImgs);

      if (newPass !== undefined && newPass !== null && String(newPass).length) {
        const np = String(newPass);
        if (np.length < 6 || np.length > 100) fail_('รหัสผ่านใหม่ต้องมีความยาว 6–100 ตัวอักษร');
        setPass_(np);
        bumpTokens_();
        if (tk) CacheService.getScriptCache().put('tok_' + tk, tokVer_(), APP.TOKEN_TTL);  // คงเซสชันปัจจุบัน
      }
    });
    bust_();
    return { ok: true };
  });
}

function adminSaveTables(tk, c) {
  return run_(function () {
    auth_(tk);
    locked_(function () {
      const out = validTableCfg_(c || {}, getCfg_());
      if (Object.keys(out).length) setCfg_(out);
    });
    bust_();
    return { ok: true };
  });
}

function adminSaveProducts(tk, list) {
  return run_(function () {
    auth_(tk);
    if (!Array.isArray(list)) fail_('ข้อมูลสินค้าไม่ถูกต้อง');
    if (list.length > 100) fail_('จำนวนสินค้ามากเกินไป');
    locked_(function () {
      const old = getProducts_(), oldById = {}, seen = {}, out = [], oldImgs = [], newImgs = [];
      old.forEach(function (p) { oldById[p.id] = p; oldImgs.push(p.img); });
      list.forEach(function (x, i) {
        x = x || {};
        const name = need_(h_(x.name, 120), 'กรุณากรอกชื่อสินค้า');
        const price = num_(x.price, 0);
        if (!(price > 0) || price > 10000000) fail_('ราคาสินค้า "' + name + '" ไม่ถูกต้อง');
        let id = Number(x.id);
        if (!isFinite(id) || id <= 0 || seen[id]) id = now_() + i;
        seen[id] = true;
        const prev = oldById[id];
        const sz = {}, src = x.sz && typeof x.sz === 'object' ? x.sz : {};
        Object.keys(src).forEach(function (k0) {
          const k = sizeKey_(k0);
          if (!k) return;
          const n = Math.floor(num_(src[k0] && src[k0].n, 0));
          if (n < 0 || n > 100000) fail_('จำนวนสต็อกไซซ์ ' + k + ' ไม่ถูกต้อง');
          const s = prev && prev.sz[k] ? prev.sz[k].s : 0;          // ยอดจองใช้ค่าจากเซิร์ฟเวอร์เท่านั้น
          if (n < s) fail_(name + ' ไซซ์ ' + k + ': จำนวนทั้งหมดต้องไม่น้อยกว่าที่จองแล้ว (' + s + ')');
          sz[k] = { n: n, s: s };
        });
        if (!Object.keys(sz).length) fail_('กรุณาเพิ่มไซซ์อย่างน้อย 1 รายการให้ "' + name + '"');
        if (prev) {
          Object.keys(prev.sz).forEach(function (k) {
            if (!sz[k] && prev.sz[k].s > 0) fail_('ไม่สามารถลบไซซ์ ' + k + ' ของ "' + name + '" เพราะมีการจองแล้ว');
          });
        }
        let img = prev ? prev.img : '';
        if (x.img) {
          const u = resolveImg_(x.img, 'prod');
          if (u) img = u;
        }
        newImgs.push(img);
        out.push({
          id: id, name: name, color: h_(x.color, 40) || '-', price: price,
          emoji: h_(x.emoji, 8) || '🛍️', img: img, sz: JSON.stringify(sz)
        });
      });
      replaceAll_('Products', out);
      trashOrphans_(oldImgs, newImgs);
    });
    bust_();
    return { ok: true };
  });
}

function adminSaveNews(tk, list) {
  return run_(function () {
    auth_(tk);
    if (!Array.isArray(list)) fail_('ข้อมูลข่าวไม่ถูกต้อง');
    if (list.length > 100) fail_('จำนวนข่าวมากเกินไป');
    locked_(function () {
      const oldImgs = rows_('News').map(function (n) { return n.img; }), newImgs = [], out = [], seen = {};
      list.forEach(function (x, i) {
        x = x || {};
        let id = Number(x.id);
        if (!isFinite(id) || id <= 0 || seen[id]) id = now_() + i;
        seen[id] = true;
        const img = resolveImg_(x.img, 'news');
        newImgs.push(img);
        out.push({ id: id, at: num_(x.at, now_()), t: need_(h_(x.t, 200), 'กรุณากรอกหัวข้อข่าว'), d: h_(x.d, 3000), img: img });
      });
      replaceAll_('News', out);
      trashOrphans_(oldImgs, newImgs);
    });
    bust_();
    return { ok: true };
  });
}

function adminSaveSchedule(tk, list) {
  return run_(function () {
    auth_(tk);
    if (!Array.isArray(list)) fail_('ข้อมูลกำหนดการไม่ถูกต้อง');
    if (list.length > 100) fail_('จำนวนกำหนดการมากเกินไป');
    locked_(function () {
      const oldImgs = rows_('Schedule').map(function (s) { return s.img; }), newImgs = [], out = [], seen = {};
      list.forEach(function (x, i) {
        x = x || {};
        let id = Number(x.id);
        if (!isFinite(id) || id <= 0 || seen[id]) id = now_() + i;
        seen[id] = true;
        const img = resolveImg_(x.img, 'sch');
        newImgs.push(img);
        out.push({ id: id, d: h_(x.d, 100), t: need_(h_(x.t, 200), 'กรุณากรอกชื่อกิจกรรม'), det: h_(x.det, 1000), img: img });
      });
      replaceAll_('Schedule', out);
      trashOrphans_(oldImgs, newImgs);
    });
    bust_();
    return { ok: true };
  });
}

function adminResetAll(tk, confirm) {
  return run_(function () {
    auth_(tk);
    if (confirm !== 'RESET') fail_('ไม่ได้รับการยืนยันการล้างข้อมูล');
    locked_(function () {
      replaceAll_('Donations', []);
      replaceAll_('Orders', []);
      replaceAll_('Bookings', []);
      const pr = prodRows_();
      pr.forEach(function (e) {
        Object.keys(e.p.sz).forEach(function (k) { e.p.sz[k].s = 0; });
        writeProdSz_(e);
      });
      const props = PropertiesService.getScriptProperties();
      Object.keys(props.getProperties()).forEach(function (k) { if (k.indexOf('CNT_') === 0) props.deleteProperty(k); });
      const files = folder_('slip').getFiles();
      while (files.hasNext()) { try { files.next().setTrashed(true); } catch (e) {} }
    });
    bust_();
    return { ok: true };
  });
}
