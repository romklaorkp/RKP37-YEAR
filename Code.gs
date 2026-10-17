/**
 * ==============================================================================================
 * ระบบผ้าป่าเพื่อการศึกษา โรงเรียนร่มเกล้าพิทยาสรรค์ (RKP Education Fundraising System)
 * Google Apps Script Backend (Code.gs)
 * ==============================================================================================
 * รองรับการทำงานทั้งแบบ:
 * 1. Web App บน Google Apps Script โดยตรง (ผ่าน google.script.run และ doGet/doPost)
 * 2. REST API เชื่อมต่อกับเว็บหน้าบ้านภายนอก (ผ่าน doGet/doPost JSON API)
 * 
 * คุณสมบัติ:
 * - บันทึกและซิงค์ข้อมูลกับ Google Sheets อัตโนมัติ 6 ชีต (Settings, Donations, Orders, Tables, Products, News)
 * - อัปโหลดสลิปหลักฐานการโอนเงินเข้า Google Drive (โฟลเดอร์ RKP_Donation_Slips) อัตโนมัติ
 * - แจ้งเตือนผ่าน Telegram Bot แบบเรียลไทม์ (เมื่อมีบริจาค, จองโต๊ะ, สั่งซื้อ, แนบสลิป, สต็อกเหลือน้อย)
 * - ระบบตรวจสอบและอนุมัติสลิป (Approve/Reject) พร้อมคืนสต็อกและคืนสถานะโต๊ะอัตโนมัติ
 * - ระบบสืบค้นข้อมูลรายการ (Search by ID & Phone) และออกใบรับเงินบริจาค
 * - รายงานสรุปข้อมูล Export เป็น CSV/JSON
 * ==============================================================================================
 */

// ชื่อโฟลเดอร์สำหรับเก็บสลิปใน Google Drive
var DRIVE_SLIP_FOLDER_NAME = "RKP_Donation_Slips";

/**
 * ฟังก์ชันเริ่มต้นเมื่อเปิดเว็บแอปผ่านเบราว์เซอร์
 */
function doGet(e) {
  try {
    // ตรวจสอบว่ามีการเรียกแบบ API (เช่น ?action=getInitialData)
    if (e && e.parameter && e.parameter.action) {
      return handleApiRequest(e.parameter.action, e.parameter, 'GET');
    }

    // กรณีเปิดเป็นหน้าเว็บปกติ ให้ Render ไฟล์ index.html
    var template = HtmlService.createTemplateFromFile('index');
    return template.evaluate()
      .setTitle('ระบบผ้าป่าเพื่อการศึกษา โรงเรียนร่มเกล้าพิทยาสรรค์')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * ฟังก์ชันรับคำขอ HTTP POST (สำหรับการเรียก API ภายนอก หรือ Fetch จากหน้าเว็บ)
 */
function doPost(e) {
  try {
    var payload = {};
    if (e && e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (jsonErr) {
        payload = e.parameter || {};
      }
    } else if (e && e.parameter) {
      payload = e.parameter;
    }

    var action = payload.action || (e && e.parameter ? e.parameter.action : '');
    return handleApiRequest(action, payload, 'POST');
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * ฟังก์ชันช่วยรวมไฟล์ HTML หรือ Script ย่อย (สำหรับการแยกไฟล์ใน Google Apps Script)
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * จัดการ Routing ของ API ทั้ง GET และ POST
 */
function handleApiRequest(action, params, method) {
  var result = { success: false, action: action };

  try {
    switch (action) {
      case 'initDatabase':
        result = initDatabase();
        break;

      case 'getInitialData':
        result = getInitialData();
        break;

      case 'submitDonation':
        result = submitDonation(params.data || params);
        break;

      case 'submitOrder':
        result = submitOrder(params.data || params);
        break;

      case 'submitTableBooking':
        result = submitTableBooking(params.data || params);
        break;

      case 'searchRecord':
        result = searchRecord(params.id, params.phone);
        break;

      case 'updateRecordStatus':
        result = updateRecordStatus(params.id, params.kind, params.status, params.reason);
        break;

      case 'saveSettings':
        result = saveSettings(params.data || params);
        break;

      case 'saveProduct':
        result = saveProduct(params.data || params);
        break;

      case 'deleteProduct':
        result = deleteProduct(params.id);
        break;

      case 'saveTable':
        result = saveTable(params.data || params);
        break;

      case 'deleteTable':
        result = deleteTable(params.id);
        break;

      case 'saveAttendees':
        result = saveAttendees(params.attendees);
        break;

      case 'saveNews':
        result = saveNews(params.data || params);
        break;

      case 'deleteNews':
        result = deleteNews(params.id);
        break;

      case 'updateNewsStatus':
        result = updateNewsStatus(params.id, params.status);
        break;

      case 'testTelegram':
        result = testTelegram(params.chatId, params.botToken);
        break;

      case 'getReport':
        result = getReportData(params.type, params.from, params.to);
        break;

      default:
        result = { success: false, message: 'Unknown action: ' + action };
        break;
    }
  } catch (ex) {
    result = { success: false, error: ex.toString() };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * เข้าถึง Google Spreadsheet ปัจจุบัน หรือผูกกับ ID ที่ระบุ
 */
function getSpreadsheet() {
  try {
    return SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {
    var props = PropertiesService.getScriptProperties();
    var sheetId = props.getProperty('SPREADSHEET_ID');
    if (sheetId) {
      return SpreadsheetApp.openById(sheetId);
    }
    throw new Error('ไม่พบ Google Spreadsheet กรุณาเปิดสคริปต์นี้จาก Google Sheet หรือตั้งค่า SPREADSHEET_ID ใน Script Properties');
  }
}

/**
 * ----------------------------------------------------------------------------------------------
 * ฟังก์ชันสร้างและตั้งค่าชีตทั้งหมดใน Google Sheets อัตโนมัติ (ครั้งแรก)
 * ----------------------------------------------------------------------------------------------
 */
function initDatabase() {
  var ss = getSpreadsheet();
  
  // 1. ชีต Settings
  var settingsSheet = ss.getSheetByName('Settings');
  if (!settingsSheet) {
    settingsSheet = ss.insertSheet('Settings');
    settingsSheet.appendRow(['Key', 'Value', 'Description']);
    
    var defaultSettings = [
      ['school_name', 'โรงเรียนร่มเกล้าพิทยาสรรค์', 'ชื่อโรงเรียน'],
      ['system_name', 'ระบบผ้าป่าเพื่อการศึกษา', 'ชื่อระบบ'],
      ['fundraising_goal', '500000', 'เป้าหมายระดมทุน (บาท)'],
      ['donor_baseline', '184', 'จำนวนผู้บริจาคตั้งต้น'],
      ['donation_baseline', '327500', 'ยอดเงินบริจาคตั้งต้น (บาท)'],
      ['sales_baseline', '185', 'ยอดขายตั้งต้น (ชิ้น)'],
      ['attendees', '420', 'จำนวนผู้เข้าร่วมงาน'],
      ['pp_number', '0812345678', 'เบอร์ PromptPay'],
      ['pp_recipient', 'โรงเรียนร่มเกล้าพิทยาสรรค์', 'ชื่อบัญชี PromptPay'],
      ['pp_enabled', 'TRUE', 'เปิดแสดง QR Code หรือไม่'],
      ['pp_image', '', 'URL รูป QR PromptPay'],
      ['hero_image_url', '', 'URL ภาพแบนเนอร์ Hero'],
      ['logo_image_url', '', 'URL โลโก้'],
      ['tg_bot_token', '', 'Telegram Bot Token'],
      ['tg_chat_id', '', 'Telegram Chat ID'],
      ['tg_enabled', 'FALSE', 'เปิดการแจ้งเตือน Telegram'],
      ['tg_notify_donation', 'TRUE', 'แจ้งเตือนเมื่อมีเงินบริจาค'],
      ['tg_notify_table', 'TRUE', 'แจ้งเตือนเมื่อมีการจองโต๊ะ'],
      ['tg_notify_order', 'TRUE', 'แจ้งเตือนเมื่อมีการสั่งของที่ระลึก'],
      ['tg_notify_slip', 'TRUE', 'แจ้งเตือนเมื่อมีสลิปรอตรวจสอบ'],
      ['tg_notify_stock', 'TRUE', 'แจ้งเตือนเมื่อสต็อกใกล้หมด']
    ];
    settingsSheet.getRange(2, 1, defaultSettings.length, 3).setValues(defaultSettings);
    settingsSheet.setFrozenRows(1);
  }

  // 2. ชีต Donations
  var donationsSheet = ss.getSheetByName('Donations');
  if (!donationsSheet) {
    donationsSheet = ss.insertSheet('Donations');
    donationsSheet.appendRow([
      'ID', 'Name', 'Phone', 'Email', 'Type', 'Amount', 
      'Visible', 'ReceiptRequested', 'Message', 'SlipUrl', 
      'Status', 'Date', 'Timestamp', 'Reason'
    ]);
    // ข้อมูลตัวอย่าง
    donationsSheet.appendRow([
      'DON-2569-000124', 'นางสาวกมลชนก ใจดี', '0812345678', 'kamol@example.com', 'ศิษย์เก่า', 1500,
      'TRUE', 'TRUE', 'ขอให้อาจารย์และน้องๆ ทุกคนมีความสุขค่ะ', '',
      'approved', '17/10/2569 09:30', new Date().toISOString(), ''
    ]);
    donationsSheet.appendRow([
      'DON-2569-000123', 'นายธนกร มีสุข', '0891234567', 'thanakorn@example.com', 'ผู้ปกครอง', 3000,
      'TRUE', 'FALSE', 'ร่วมทำบุญพัฒนาห้องคอมพิวเตอร์', '',
      'pending', '17/10/2569 10:20', new Date().toISOString(), ''
    ]);
    donationsSheet.setFrozenRows(1);
  }

  // 3. ชีต Orders
  var ordersSheet = ss.getSheetByName('Orders');
  if (!ordersSheet) {
    ordersSheet = ss.insertSheet('Orders');
    ordersSheet.appendRow([
      'ID', 'Name', 'Phone', 'ProductId', 'ProductName', 'Color', 
      'Size', 'Qty', 'Amount', 'Method', 'SlipUrl', 'Status', 
      'Date', 'Timestamp', 'Reason'
    ]);
    ordersSheet.appendRow([
      'ORD-2569-000077', 'นางสาวศิริพร แก้วใส', '0861234567', 1, 'เสื้อผ้าป่า สีม่วง', 'ม่วง',
      'L', 2, 598, 'รับวันงาน', '', 'pending',
      '17/10/2569 11:00', new Date().toISOString(), ''
    ]);
    ordersSheet.setFrozenRows(1);
  }

  // 4. ชีต Tables (โต๊ะ 80 ตัว)
  var tablesSheet = ss.getSheetByName('Tables');
  if (!tablesSheet) {
    tablesSheet = ss.insertSheet('Tables');
    tablesSheet.appendRow([
      'TableID', 'TableNumber', 'Price', 'Seats', 'Status', 
      'BookerName', 'Phone', 'GroupName', 'Attendees', 'Note', 
      'SlipUrl', 'Date', 'Timestamp', 'Reason'
    ]);
    
    var bookedSeed = [3, 9];
    for (var i = 25; i <= 80; i++) {
      bookedSeed.push(i);
    }

    var tableRows = [];
    for (var t = 1; t <= 80; t++) {
      var status = 'available';
      var booker = '';
      var phone = '';
      var group = '';
      var note = '';
      var dateStr = '';

      if (t === 5) {
        status = 'pending';
        booker = 'นายสมพงษ์ ยอดรัก';
        phone = '0831234567';
        group = 'ศิษย์เก่ารุ่น 22';
        dateStr = '17/10/2569 08:45';
      } else if (t === 3) {
        status = 'booked';
        booker = 'กลุ่มเพื่อนศิษย์เก่า';
        phone = '0821234567';
        group = 'เพื่อนศิษย์เก่ามุกดาหาร';
        dateStr = '16/10/2569 15:00';
      } else if (bookedSeed.indexOf(t) !== -1) {
        status = 'booked';
        booker = 'ผู้สนับสนุนโต๊ะ T' + (t < 10 ? '0' + t : t);
        dateStr = '15/10/2569 12:00';
      }

      tableRows.push([
        t,
        'T' + (t < 10 ? '0' + t : t),
        3000,
        8,
        status,
        booker,
        phone,
        group,
        status === 'available' ? 0 : 8,
        note,
        '',
        dateStr,
        new Date().toISOString(),
        ''
      ]);
    }
    tablesSheet.getRange(2, 1, tableRows.length, 14).setValues(tableRows);
    tablesSheet.setFrozenRows(1);
  }

  // 5. ชีต Products
  var productsSheet = ss.getSheetByName('Products');
  if (!productsSheet) {
    productsSheet = ss.insertSheet('Products');
    productsSheet.appendRow(['ID', 'Name', 'Price', 'Color', 'Sizes', 'Stock', 'Reserved', 'ImageUrl']);
    var defaultProducts = [
      [1, 'เสื้อผ้าป่า สีม่วง', 299, 'ม่วง', 'S,M,L,XL,2XL', 100, 73, 'https://images.pexels.com/photos/3735641/pexels-photo-3735641.jpeg?auto=compress&cs=tinysrgb&w=800'],
      [2, 'เสื้อผ้าป่า สีแสด', 299, 'แสด', 'S,M,L,XL,2XL', 100, 42, 'https://images.pexels.com/photos/3735641/pexels-photo-3735641.jpeg?auto=compress&cs=tinysrgb&w=800'],
      [3, 'เสื้อโปโล', 399, 'ม่วง', 'S,M,L,XL', 70, 31, 'https://images.pexels.com/photos/3735641/pexels-photo-3735641.jpeg?auto=compress&cs=tinysrgb&w=800'],
      [4, 'กระเป๋าผ้า', 159, 'ธรรมชาติ', 'มาตรฐาน', 80, 26, 'https://images.pexels.com/photos/3735641/pexels-photo-3735641.jpeg?auto=compress&cs=tinysrgb&w=800'],
      [5, 'แก้วที่ระลึก', 129, 'ขาว', 'มาตรฐาน', 60, 13, 'https://images.pexels.com/photos/3735641/pexels-photo-3735641.jpeg?auto=compress&cs=tinysrgb&w=800']
    ];
    productsSheet.getRange(2, 1, defaultProducts.length, 8).setValues(defaultProducts);
    productsSheet.setFrozenRows(1);
  }

  // 6. ชีต News
  var newsSheet = ss.getSheetByName('News');
  if (!newsSheet) {
    newsSheet = ss.insertSheet('News');
    newsSheet.appendRow([
      'ID', 'Title', 'Category', 'Summary', 'Body', 
      'Date', 'Author', 'Status', 'Pinned', 'ShowHome', 
      'ImageUrl', 'CreatedAt', 'UpdatedAt'
    ]);
    var defaultNews = [
      [
        'NEWS-2569-000001',
        'กำหนดการงานผ้าป่าเพื่อการศึกษา ประจำปี 2569',
        'กำหนดการ',
        'ติดตามกำหนดการกิจกรรมและช่วงเวลาสำคัญของงาน',
        'โรงเรียนขอเชิญผู้ปกครอง ศิษย์เก่า และชุมชน ติดตามกำหนดการจัดงานผ้าป่าเพื่อการศึกษา ประจำปี 2569 โดยรายละเอียดวัน เวลา และสถานที่อย่างเป็นทางการจะแจ้งให้ทราบอีกครั้ง',
        '2026-10-17',
        'โรงเรียนร่มเกล้าพิทยาสรรค์',
        'published',
        'TRUE',
        'TRUE',
        'https://images.pexels.com/photos/10333232/pexels-photo-10333232.jpeg?auto=compress&cs=tinysrgb&w=800',
        new Date().toISOString(),
        new Date().toISOString()
      ],
      [
        'NEWS-2569-000002',
        'ขอเชิญร่วมบริจาคเพื่อพัฒนาการศึกษา',
        'ข่าวผ้าป่า',
        'ร่วมแบ่งปันโอกาสให้นักเรียนผ่านกิจกรรมผ้าป่าเพื่อการศึกษา',
        'ทุกการสนับสนุนจะช่วยส่งเสริมสื่อการเรียนรู้และพื้นที่การศึกษาของโรงเรียน โปรดตรวจสอบช่องทางบริจาคจริงกับโรงเรียนก่อนโอนเงิน',
        '2026-10-16',
        'ฝ่ายประชาสัมพันธ์',
        'published',
        'FALSE',
        'TRUE',
        'https://images.pexels.com/photos/1390657/pexels-photo-1390657.jpeg?auto=compress&cs=tinysrgb&w=800',
        new Date().toISOString(),
        new Date().toISOString()
      ],
      [
        'NEWS-2569-000003',
        'เสื้อที่ระลึกงานผ้าป่า เปิดให้จองแล้ว',
        'โปรโมชั่นของที่ระลึก',
        'เลือกเสื้อและของที่ระลึกเพื่อร่วมสนับสนุนกิจกรรม',
        'เปิดให้ทดลองจองเสื้อผ้าป่าและของที่ระลึกผ่านหน้าของที่ระลึกในระบบสาธิตนี้ โปรดติดต่อโรงเรียนเพื่อยืนยันข้อมูลจริง',
        '2026-10-15',
        'ฝ่ายจัดงาน',
        'published',
        'FALSE',
        'TRUE',
        'https://images.pexels.com/photos/3735641/pexels-photo-3735641.jpeg?auto=compress&cs=tinysrgb&w=800',
        new Date().toISOString(),
        new Date().toISOString()
      ],
      [
        'NEWS-2569-000004',
        'ข้อมูลการเดินทางมายังโรงเรียน',
        'รายละเอียดการเดินทาง',
        'รายละเอียดการเดินทางอยู่ระหว่างการตรวจสอบ',
        'ฝ่ายจัดงานกำลังตรวจสอบเส้นทางและจุดจอดรถ โดยจะเผยแพร่ข้อมูลที่ยืนยันแล้วต่อไป',
        '2026-10-14',
        'ฝ่ายสถานที่',
        'draft',
        'FALSE',
        'TRUE',
        'https://images.pexels.com/photos/38254524/pexels-photo-38254524.jpeg',
        new Date().toISOString(),
        new Date().toISOString()
      ],
      [
        'NEWS-2569-000005',
        'ภาพบรรยากาศกิจกรรมของนักเรียน',
        'รูปภาพกิจกรรม',
        'ประมวลภาพกิจกรรมเตรียมงาน',
        'ภาพบรรยากาศกิจกรรมภายในโรงเรียนสำหรับการเตรียมงานผ้าป่าเพื่อการศึกษา',
        '2026-10-13',
        'ฝ่ายประชาสัมพันธ์',
        'hidden',
        'FALSE',
        'TRUE',
        'https://images.pexels.com/photos/10646604/pexels-photo-10646604.jpeg?auto=compress&cs=tinysrgb&w=800',
        new Date().toISOString(),
        new Date().toISOString()
      ]
    ];
    newsSheet.getRange(2, 1, defaultNews.length, 13).setValues(defaultNews);
    newsSheet.setFrozenRows(1);
  }

  return { success: true, message: 'สร้างฐานข้อมูลและชีตตั้งต้นเรียบร้อยแล้ว' };
}

/**
 * ----------------------------------------------------------------------------------------------
 * ฟังก์ชันดึงข้อมูลเริ่มต้นทั้งหมด (Initial Data) ส่งให้หน้าเว็บ
 * ----------------------------------------------------------------------------------------------
 */
function getInitialData() {
  var ss = getSpreadsheet();
  
  // ตรวจสอบว่ามีชีตครบหรือไม่ ถ้ายังไม่มีให้สร้างก่อน
  if (!ss.getSheetByName('Settings')) {
    initDatabase();
  }

  // 1. อ่านการตั้งค่า (Settings)
  var settingsSheet = ss.getSheetByName('Settings');
  var settingsData = settingsSheet.getDataRange().getValues();
  var settings = {};
  for (var i = 1; i < settingsData.length; i++) {
    var key = settingsData[i][0];
    var val = settingsData[i][1];
    if (key) {
      if (val === 'TRUE' || val === true) val = true;
      else if (val === 'FALSE' || val === false) val = false;
      else if (!isNaN(Number(val)) && val !== '' && typeof val !== 'boolean') val = Number(val);
      settings[key] = val;
    }
  }

  // 2. อ่านรายการสินค้า (Products)
  var productsSheet = ss.getSheetByName('Products');
  var productsData = productsSheet.getDataRange().getValues();
  var products = [];
  for (var p = 1; p < productsData.length; p++) {
    var pRow = productsData[p];
    if (pRow[0]) {
      products.push({
        id: Number(pRow[0]),
        name: String(pRow[1]),
        price: Number(pRow[2]),
        color: String(pRow[3]),
        sizes: String(pRow[4]),
        stock: Number(pRow[5]),
        reserved: Number(pRow[6] || 0),
        imageUrl: String(pRow[7] || '')
      });
    }
  }

  // 3. อ่านโต๊ะ (Tables)
  var tablesSheet = ss.getSheetByName('Tables');
  var tablesData = tablesSheet.getDataRange().getValues();
  var tables = [];
  for (var t = 1; t < tablesData.length; t++) {
    var tRow = tablesData[t];
    if (tRow[0]) {
      tables.push({
        id: Number(tRow[0]),
        number: String(tRow[1]),
        price: Number(tRow[2]),
        seats: Number(tRow[3]),
        status: String(tRow[4]),
        bookerName: String(tRow[5] || ''),
        phone: String(tRow[6] || ''),
        group: String(tRow[7] || ''),
        attendees: Number(tRow[8] || 0),
        note: String(tRow[9] || ''),
        slipUrl: String(tRow[10] || ''),
        date: String(tRow[11] || '')
      });
    }
  }

  // 4. อ่านข่าวสาร (News)
  var newsSheet = ss.getSheetByName('News');
  var newsData = newsSheet.getDataRange().getValues();
  var news = [];
  for (var n = 1; n < newsData.length; n++) {
    var nRow = newsData[n];
    if (nRow[0]) {
      news.push({
        id: String(nRow[0]),
        title: String(nRow[1]),
        category: String(nRow[2]),
        summary: String(nRow[3]),
        body: String(nRow[4]),
        date: String(nRow[5]),
        author: String(nRow[6]),
        status: String(nRow[7]),
        pinned: nRow[8] === true || nRow[8] === 'TRUE',
        showHome: nRow[9] === true || nRow[9] === 'TRUE',
        imageUrl: String(nRow[10] || ''),
        createdAt: String(nRow[11] || ''),
        updatedAt: String(nRow[12] || '')
      });
    }
  }

  // 5. อ่านประวัติรายการ (Donations, Orders, Tables) รวมเป็น Records
  var records = [];

  // บริจาค
  var donSheet = ss.getSheetByName('Donations');
  if (donSheet) {
    var donData = donSheet.getDataRange().getValues();
    for (var d = 1; d < donData.length; d++) {
      var dRow = donData[d];
      if (dRow[0]) {
        records.push({
          id: String(dRow[0]),
          kind: 'บริจาค',
          name: String(dRow[1]),
          phone: String(dRow[2]),
          email: String(dRow[3] || ''),
          type: String(dRow[4] || 'บุคคลทั่วไป'),
          amount: Number(dRow[5] || 0),
          visible: dRow[6] === true || dRow[6] === 'TRUE',
          receipt: dRow[7] === true || dRow[7] === 'TRUE',
          detail: String(dRow[8] || 'ร่วมบริจาคเพื่อการศึกษา'),
          slip: String(dRow[9] || ''),
          status: String(dRow[10] || 'pending'),
          date: String(dRow[11] || ''),
          iso: String(dRow[12] ? String(dRow[12]).slice(0, 10) : ''),
          reason: String(dRow[13] || '')
        });
      }
    }
  }

  // คำสั่งซื้อสินค้า
  var ordSheet = ss.getSheetByName('Orders');
  if (ordSheet) {
    var ordData = ordSheet.getDataRange().getValues();
    for (var o = 1; o < ordData.length; o++) {
      var oRow = ordData[o];
      if (oRow[0]) {
        records.push({
          id: String(oRow[0]),
          kind: 'สินค้า',
          name: String(oRow[1]),
          phone: String(oRow[2]),
          productId: Number(oRow[3]),
          detail: String(oRow[4]) + ' สี' + String(oRow[5]) + ' ไซซ์ ' + String(oRow[6]) + ' × ' + String(oRow[7]),
          amount: Number(oRow[8] || 0),
          method: String(oRow[9] || ''),
          slip: String(oRow[10] || ''),
          status: String(oRow[11] || 'pending'),
          date: String(oRow[12] || ''),
          iso: String(oRow[13] ? String(oRow[13]).slice(0, 10) : ''),
          reason: String(oRow[14] || ''),
          qty: Number(oRow[7])
        });
      }
    }
  }

  // โต๊ะ
  for (var tb = 0; tb < tables.length; tb++) {
    var item = tables[tb];
    if (item.status === 'booked' || item.status === 'pending') {
      records.push({
        id: 'TABLE-2569-' + ('000000' + item.id).slice(-6),
        kind: 'โต๊ะ',
        tableId: item.id,
        name: item.bookerName || 'ไม่ระบุผู้จอง',
        phone: item.phone,
        amount: item.price,
        detail: 'โต๊ะ ' + item.number + ' · ' + (item.attendees || item.seats) + ' คน · ' + (item.group || 'ทั่วไป'),
        slip: item.slipUrl,
        status: item.status,
        date: item.date || '—',
        iso: new Date().toISOString().slice(0, 10)
      });
    }
  }

  // เรียงลำดับรายการล่าสุดขึ้นก่อน
  records.reverse();

  return {
    success: true,
    settings: settings,
    products: products,
    tables: tables,
    news: news,
    records: records
  };
}

/**
 * ----------------------------------------------------------------------------------------------
 * ฟังก์ชันบันทึกการบริจาค (Submit Donation)
 * ----------------------------------------------------------------------------------------------
 */
function submitDonation(data) {
  var ss = getSpreadsheet();
  var donSheet = ss.getSheetByName('Donations');
  if (!donSheet) {
    initDatabase();
    donSheet = ss.getSheetByName('Donations');
  }

  // กำหนดรหัสรายการ DON-2569-xxxxxx
  var lastRow = donSheet.getLastRow();
  var nextNum = 125 + (lastRow - 2 > 0 ? (lastRow - 2) : 0);
  var id = 'DON-2569-' + ('000000' + nextNum).slice(-6);

  var nowStr = Utilities.formatDate(new Date(), 'GMT+7', 'dd/MM/yyyy HH:mm');
  var isoStr = new Date().toISOString();

  // อัปโหลดสลิปถ้ามี
  var slipUrl = '';
  if (data.slipBase64) {
    slipUrl = uploadSlipToDrive(data.slipBase64, id + '-slip.jpg', data.slipMimeType || 'image/jpeg');
  } else if (data.slipUrl) {
    slipUrl = data.slipUrl;
  }

  var row = [
    id,
    data.name || '',
    data.phone || '',
    data.email || '',
    data.type || 'บุคคลทั่วไป',
    Number(data.amount || 0),
    data.visible ? 'TRUE' : 'FALSE',
    data.receipt ? 'TRUE' : 'FALSE',
    data.message || '',
    slipUrl,
    'pending',
    nowStr,
    isoStr,
    ''
  ];

  donSheet.appendRow(row);

  // แจ้งเตือน Telegram
  var tgMsg = "<b>[มีรายการบริจาคใหม่]</b>\n" +
              "เลขที่: <code>" + id + "</code>\n" +
              "ผู้บริจาค: " + data.name + " (" + (data.type || 'ทั่วไป') + ")\n" +
              "เบอร์โทร: " + data.phone + "\n" +
              "จำนวนเงิน: <b>" + Number(data.amount).toLocaleString('th-TH') + " บาท</b>\n" +
              "ขอใบอนุโมทนา: " + (data.receipt ? 'ใช่' : 'ไม่ใช่') + "\n" +
              "สถานะ: รอตรวจสอบหลักฐาน\n" +
              (slipUrl ? ("สลิป: " + slipUrl + "\n") : "") +
              "วันเวลา: " + nowStr;

  sendTelegramNotification('tg_notify_donation', tgMsg, data.slipBase64);

  return {
    success: true,
    id: id,
    slipUrl: slipUrl,
    date: nowStr,
    message: 'ส่งข้อมูลบริจาคเรียบร้อยแล้ว เจ้าหน้าที่จะตรวจสอบสลิปภายใน 24 ชม.'
  };
}

/**
 * ----------------------------------------------------------------------------------------------
 * ฟังก์ชันสั่งจองของที่ระลึก (Submit Order)
 * ----------------------------------------------------------------------------------------------
 */
function submitOrder(data) {
  var ss = getSpreadsheet();
  var ordSheet = ss.getSheetByName('Orders');
  var prodSheet = ss.getSheetByName('Products');
  if (!ordSheet || !prodSheet) {
    initDatabase();
    ordSheet = ss.getSheetByName('Orders');
    prodSheet = ss.getSheetByName('Products');
  }

  // ตรวจสอบสต็อกสินค้า
  var prodData = prodSheet.getDataRange().getValues();
  var prodRowIndex = -1;
  var product = null;

  for (var i = 1; i < prodData.length; i++) {
    if (Number(prodData[i][0]) === Number(data.productId)) {
      prodRowIndex = i + 1; // 1-indexed ใน sheet
      product = {
        id: Number(prodData[i][0]),
        name: prodData[i][1],
        price: Number(prodData[i][2]),
        stock: Number(prodData[i][5]),
        reserved: Number(prodData[i][6] || 0)
      };
      break;
    }
  }

  if (!product) {
    return { success: false, message: 'ไม่พบสินค้าที่เลือก' };
  }

  var qty = Number(data.qty || 1);
  var available = product.stock - product.reserved;
  if (qty > available) {
    return { success: false, message: 'สินค้าไม่เพียงพอ (คงเหลือ ' + available + ' ชิ้น)' };
  }

  // ตัดยอดจองเพิ่มในชีต Products
  prodSheet.getRange(prodRowIndex, 7).setValue(product.reserved + qty);

  // สร้างเลขออเดอร์ ORD-2569-xxxxxx
  var lastRow = ordSheet.getLastRow();
  var nextNum = 78 + (lastRow - 2 > 0 ? (lastRow - 2) : 0);
  var id = 'ORD-2569-' + ('000000' + nextNum).slice(-6);

  var nowStr = Utilities.formatDate(new Date(), 'GMT+7', 'dd/MM/yyyy HH:mm');
  var totalAmount = product.price * qty;

  var slipUrl = '';
  if (data.slipBase64) {
    slipUrl = uploadSlipToDrive(data.slipBase64, id + '-slip.jpg', data.slipMimeType || 'image/jpeg');
  } else if (data.slipUrl) {
    slipUrl = data.slipUrl;
  }

  ordSheet.appendRow([
    id,
    data.name,
    data.phone,
    product.id,
    product.name,
    data.color || 'ม่วง',
    data.size || 'มาตรฐาน',
    qty,
    totalAmount,
    data.method || 'รับที่โรงเรียน',
    slipUrl,
    'pending',
    nowStr,
    new Date().toISOString(),
    ''
  ]);

  // ตรวจสอบว่าสินค้าใกล้หมดหรือไม่ (คงเหลือ <= 10)
  var remain = product.stock - (product.reserved + qty);
  if (remain <= 10) {
    var stockMsg = "⚠️ <b>[แจ้งเตือนสต็อกสินค้าใกล้หมด]</b>\n" +
                   "สินค้า: " + product.name + "\n" +
                   "คงเหลือ: <b>" + remain + " ชิ้น</b> เท่านั้น";
    sendTelegramNotification('tg_notify_stock', stockMsg);
  }

  // แจ้งเตือนออเดอร์ใหม่
  var tgMsg = "🛍️ <b>[มีคำสั่งจองของที่ระลึกใหม่]</b>\n" +
              "เลขที่: <code>" + id + "</code>\n" +
              "สินค้า: " + product.name + " (" + data.color + " / " + data.size + ") จำนวน " + qty + " ชิ้น\n" +
              "ผู้จอง: " + data.name + " (" + data.phone + ")\n" +
              "ยอดเงิน: <b>" + totalAmount.toLocaleString('th-TH') + " บาท</b>\n" +
              "วิธีรับ: " + (data.method || 'รับที่โรงเรียน') + "\n" +
              "สถานะ: รอตรวจสอบการชำระเงิน";

  sendTelegramNotification('tg_notify_order', tgMsg, data.slipBase64);

  return {
    success: true,
    id: id,
    amount: totalAmount,
    slipUrl: slipUrl,
    date: nowStr,
    message: 'สั่งจองของที่ระลึกเรียบร้อยแล้ว'
  };
}

/**
 * ----------------------------------------------------------------------------------------------
 * ฟังก์ชันจองโต๊ะออนไลน์ (Submit Table Booking)
 * ----------------------------------------------------------------------------------------------
 */
function submitTableBooking(data) {
  var ss = getSpreadsheet();
  var tablesSheet = ss.getSheetByName('Tables');
  if (!tablesSheet) {
    initDatabase();
    tablesSheet = ss.getSheetByName('Tables');
  }

  var tableId = Number(data.tableId);
  var tableData = tablesSheet.getDataRange().getValues();
  var rowIndex = -1;
  var currentStatus = '';

  for (var i = 1; i < tableData.length; i++) {
    if (Number(tableData[i][0]) === tableId) {
      rowIndex = i + 1;
      currentStatus = tableData[i][4];
      break;
    }
  }

  if (rowIndex === -1) {
    return { success: false, message: 'ไม่พบหมายเลขโต๊ะที่ต้องการ' };
  }

  if (currentStatus !== 'available') {
    return { success: false, message: 'ขออภัย โต๊ะนี้ถูกจองไปแล้ว กรุณาเลือกโต๊ะอื่น' };
  }

  var code = 'T' + ('0' + tableId).slice(-2);
  var recordId = 'TABLE-2569-' + ('000000' + tableId).slice(-6);
  var nowStr = Utilities.formatDate(new Date(), 'GMT+7', 'dd/MM/yyyy HH:mm');

  var slipUrl = '';
  if (data.slipBase64) {
    slipUrl = uploadSlipToDrive(data.slipBase64, recordId + '-slip.jpg', data.slipMimeType || 'image/jpeg');
  } else if (data.slipUrl) {
    slipUrl = data.slipUrl;
  }

  // อัปเดตข้อมูลโต๊ะ
  tablesSheet.getRange(rowIndex, 5).setValue('pending'); // สถานะ
  tablesSheet.getRange(rowIndex, 6).setValue(data.name || '');
  tablesSheet.getRange(rowIndex, 7).setValue(data.phone || '');
  tablesSheet.getRange(rowIndex, 8).setValue(data.group || '');
  tablesSheet.getRange(rowIndex, 9).setValue(Number(data.attendees || 8));
  tablesSheet.getRange(rowIndex, 10).setValue(data.note || '');
  tablesSheet.getRange(rowIndex, 11).setValue(slipUrl);
  tablesSheet.getRange(rowIndex, 12).setValue(nowStr);
  tablesSheet.getRange(rowIndex, 13).setValue(new Date().toISOString());

  // แจ้งเตือน Telegram
  var tgMsg = "🍽️ <b>[มีการจองโต๊ะใหม่]</b>\n" +
              "โต๊ะ: <b>" + code + "</b> (3,000 บาท / 8 ที่นั่ง)\n" +
              "ผู้จอง: " + data.name + "\n" +
              "หน่วยงาน/กลุ่ม: " + (data.group || '-') + "\n" +
              "เบอร์โทร: " + data.phone + "\n" +
              "จำนวนคน: " + (data.attendees || 8) + " คน\n" +
              "สถานะ: รอตรวจสอบหลักฐานการโอนเงิน";

  sendTelegramNotification('tg_notify_table', tgMsg, data.slipBase64);

  return {
    success: true,
    id: recordId,
    tableId: tableId,
    tableCode: code,
    amount: 3000,
    date: nowStr,
    message: 'ส่งข้อมูลการจองโต๊ะเรียบร้อยแล้ว'
  };
}

/**
 * ----------------------------------------------------------------------------------------------
 * ฟังก์ชันค้นหารายการ (Search by ID & Phone)
 * ----------------------------------------------------------------------------------------------
 */
function searchRecord(id, phone) {
  if (!id || !phone) {
    return { success: false, message: 'กรุณากรอกเลขที่รายการและเบอร์โทรศัพท์' };
  }

  var init = getInitialData();
  var records = init.records || [];
  var cleanId = String(id).trim().toUpperCase();
  var cleanPhone = String(phone).trim().replace(/[^0-9]/g, '');

  for (var i = 0; i < records.length; i++) {
    var r = records[i];
    var rId = String(r.id).trim().toUpperCase();
    var rPhone = String(r.phone).trim().replace(/[^0-9]/g, '');

    if (rId === cleanId && (rPhone === cleanPhone || cleanPhone === '')) {
      return {
        success: true,
        record: r
      };
    }
  }

  return { success: false, message: 'ไม่พบรายการที่ตรงกับข้อมูล กรุณาตรวจสอบเลขที่และเบอร์โทรศัพท์' };
}

/**
 * ----------------------------------------------------------------------------------------------
 * ฟังก์ชันเปลี่ยนสถานะรายการ (Approve / Reject) สำหรับผู้ดูแล
 * ----------------------------------------------------------------------------------------------
 */
function updateRecordStatus(id, kind, newStatus, reason) {
  var ss = getSpreadsheet();
  var cleanId = String(id).trim().toUpperCase();
  var found = false;

  // กรณีเป็นรายการบริจาค
  if (cleanId.indexOf('DON') === 0 || kind === 'บริจาค') {
    var donSheet = ss.getSheetByName('Donations');
    var donData = donSheet.getDataRange().getValues();
    for (var d = 1; d < donData.length; d++) {
      if (String(donData[d][0]).trim().toUpperCase() === cleanId) {
        donSheet.getRange(d + 1, 11).setValue(newStatus);
        if (reason) donSheet.getRange(d + 1, 14).setValue(reason);
        found = true;
        break;
      }
    }
  }

  // กรณีเป็นคำสั่งซื้อสินค้า
  if (cleanId.indexOf('ORD') === 0 || kind === 'สินค้า') {
    var ordSheet = ss.getSheetByName('Orders');
    var ordData = ordSheet.getDataRange().getValues();
    var prodSheet = ss.getSheetByName('Products');
    var prodData = prodSheet.getDataRange().getValues();

    for (var o = 1; o < ordData.length; o++) {
      if (String(ordData[o][0]).trim().toUpperCase() === cleanId) {
        var oldStatus = ordData[o][11];
        ordSheet.getRange(o + 1, 12).setValue(newStatus);
        if (reason) ordSheet.getRange(o + 1, 15).setValue(reason);

        // หากถูก Reject ให้คืนยอดจองสินค้ากลับเข้าสต็อก
        if (newStatus === 'rejected' && oldStatus !== 'rejected') {
          var pId = Number(ordData[o][3]);
          var qty = Number(ordData[o][7]);
          for (var p = 1; p < prodData.length; p++) {
            if (Number(prodData[p][0]) === pId) {
              var currentReserved = Number(prodData[p][6] || 0);
              prodSheet.getRange(p + 1, 7).setValue(Math.max(0, currentReserved - qty));
              break;
            }
          }
        }
        found = true;
        break;
      }
    }
  }

  // กรณีเป็นโต๊ะ
  if (cleanId.indexOf('TABLE') === 0 || kind === 'โต๊ะ') {
    var tableSheet = ss.getSheetByName('Tables');
    var tableData = tableSheet.getDataRange().getValues();
    var tableIdNum = parseInt(cleanId.replace(/[^0-9]/g, '').slice(-2), 10);

    for (var t = 1; t < tableData.length; t++) {
      if (Number(tableData[t][0]) === tableIdNum) {
        var tableStatus = (newStatus === 'approved') ? 'booked' : (newStatus === 'rejected' ? 'available' : newStatus);
        tableSheet.getRange(t + 1, 5).setValue(tableStatus);
        if (reason) tableSheet.getRange(t + 1, 14).setValue(reason);
        if (newStatus === 'rejected') {
          // เคลียร์ชื่อผู้จองออกเมื่อไม่ผ่าน
          tableSheet.getRange(t + 1, 6, 1, 5).setValues([['', '', '', 0, '']]);
        }
        found = true;
        break;
      }
    }
  }

  if (!found) {
    return { success: false, message: 'ไม่พบรายการที่ต้องการเปลี่ยนสถานะ' };
  }

  return { success: true, message: 'อัปเดตสถานะเป็น ' + newStatus + ' เรียบร้อยแล้ว' };
}

/**
 * ----------------------------------------------------------------------------------------------
 * ฟังก์ชันบันทึกการตั้งค่าระบบ (Settings)
 * ----------------------------------------------------------------------------------------------
 */
function saveSettings(settingsObj) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('Settings');
  if (!sheet) {
    initDatabase();
    sheet = ss.getSheetByName('Settings');
  }

  var data = sheet.getDataRange().getValues();
  for (var key in settingsObj) {
    var val = settingsObj[key];
    var found = false;
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === key) {
        sheet.getRange(i + 1, 2).setValue(String(val));
        found = true;
        break;
      }
    }
    if (!found) {
      sheet.appendRow([key, String(val), '']);
    }
  }

  return { success: true, message: 'บันทึกการตั้งค่าระบบเรียบร้อยแล้ว' };
}

/**
 * ----------------------------------------------------------------------------------------------
 * ฟังก์ชันจัดการสินค้า (CRUD Products)
 * ----------------------------------------------------------------------------------------------
 */
function saveProduct(product) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('Products');
  var data = sheet.getDataRange().getValues();
  var id = Number(product.id);
  var found = false;

  for (var i = 1; i < data.length; i++) {
    if (Number(data[i][0]) === id) {
      sheet.getRange(i + 1, 2).setValue(product.name);
      sheet.getRange(i + 1, 3).setValue(Number(product.price));
      sheet.getRange(i + 1, 4).setValue(product.color);
      sheet.getRange(i + 1, 5).setValue(product.sizes);
      sheet.getRange(i + 1, 6).setValue(Number(product.stock));
      if (product.imageUrl) sheet.getRange(i + 1, 8).setValue(product.imageUrl);
      found = true;
      break;
    }
  }

  if (!found) {
    var newId = Date.now();
    sheet.appendRow([
      newId,
      product.name,
      Number(product.price),
      product.color,
      product.sizes,
      Number(product.stock),
      0,
      product.imageUrl || ''
    ]);
  }

  return { success: true, message: 'บันทึกข้อมูลสินค้าเรียบร้อยแล้ว' };
}

function deleteProduct(id) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('Products');
  var data = sheet.getDataRange().getValues();
  var idNum = Number(id);

  for (var i = 1; i < data.length; i++) {
    if (Number(data[i][0]) === idNum) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'ลบสินค้าเรียบร้อยแล้ว' };
    }
  }
  return { success: false, message: 'ไม่พบสินค้าที่ต้องการลบ' };
}

/**
 * ----------------------------------------------------------------------------------------------
 * ฟังก์ชันจัดการโต๊ะ (Tables)
 * ----------------------------------------------------------------------------------------------
 */
function saveTable(table) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('Tables');
  var data = sheet.getDataRange().getValues();
  var id = Number(table.id);
  var found = false;

  for (var i = 1; i < data.length; i++) {
    if (Number(data[i][0]) === id) {
      sheet.getRange(i + 1, 3).setValue(Number(table.price));
      sheet.getRange(i + 1, 4).setValue(Number(table.seats));
      sheet.getRange(i + 1, 5).setValue(table.status);
      found = true;
      break;
    }
  }

  if (!found) {
    var maxId = 0;
    for (var j = 1; j < data.length; j++) {
      var currId = Number(data[j][0]);
      if (currId > maxId) maxId = currId;
    }
    var newId = maxId + 1;
    var numCode = 'T' + ('0' + newId).slice(-2);
    sheet.appendRow([newId, numCode, Number(table.price || 3000), Number(table.seats || 8), table.status || 'available', '', '', '', 0, '', '', '', '', '']);
  }

  return { success: true, message: 'บันทึกข้อมูลโต๊ะเรียบร้อยแล้ว' };
}

function deleteTable(id) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('Tables');
  var data = sheet.getDataRange().getValues();
  var idNum = Number(id);

  for (var i = 1; i < data.length; i++) {
    if (Number(data[i][0]) === idNum) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'ลบโต๊ะเรียบร้อยแล้ว' };
    }
  }
  return { success: false, message: 'ไม่พบโต๊ะที่ต้องการลบ' };
}

function saveAttendees(count) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('Settings');
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === 'attendees') {
      sheet.getRange(i + 1, 2).setValue(String(count));
      return { success: true, message: 'บันทึกจำนวนผู้ร่วมงานแล้ว' };
    }
  }
  sheet.appendRow(['attendees', String(count), 'จำนวนผู้เข้าร่วมงาน']);
  return { success: true, message: 'บันทึกจำนวนผู้ร่วมงานแล้ว' };
}

/**
 * ----------------------------------------------------------------------------------------------
 * ฟังก์ชันจัดการข่าวสาร (News CRUD)
 * ----------------------------------------------------------------------------------------------
 */
function saveNews(news) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('News');
  var data = sheet.getDataRange().getValues();
  var id = news.id;
  var found = false;
  var nowIso = new Date().toISOString();

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.getRange(i + 1, 2).setValue(news.title);
      sheet.getRange(i + 1, 3).setValue(news.category);
      sheet.getRange(i + 1, 4).setValue(news.summary);
      sheet.getRange(i + 1, 5).setValue(news.body);
      sheet.getRange(i + 1, 6).setValue(news.date);
      sheet.getRange(i + 1, 7).setValue(news.author);
      sheet.getRange(i + 1, 8).setValue(news.status);
      sheet.getRange(i + 1, 9).setValue(news.pinned ? 'TRUE' : 'FALSE');
      sheet.getRange(i + 1, 10).setValue(news.showHome ? 'TRUE' : 'FALSE');
      if (news.imageUrl) sheet.getRange(i + 1, 11).setValue(news.imageUrl);
      sheet.getRange(i + 1, 13).setValue(nowIso);
      found = true;
      break;
    }
  }

  if (!found) {
    var lastRow = sheet.getLastRow();
    var nextId = 'NEWS-2569-' + ('000000' + (lastRow + 1)).slice(-6);
    sheet.appendRow([
      nextId,
      news.title,
      news.category,
      news.summary,
      news.body,
      news.date || nowIso.slice(0, 10),
      news.author || 'โรงเรียนร่มเกล้าพิทยาสรรค์',
      news.status || 'draft',
      news.pinned ? 'TRUE' : 'FALSE',
      news.showHome ? 'TRUE' : 'FALSE',
      news.imageUrl || '',
      nowIso,
      nowIso
    ]);
  }

  return { success: true, message: 'บันทึกข่าวประชาสัมพันธ์เรียบร้อยแล้ว' };
}

function deleteNews(id) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('News');
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'ลบข่าวเรียบร้อยแล้ว' };
    }
  }
  return { success: false, message: 'ไม่พบข่าวที่ต้องการลบ' };
}

function updateNewsStatus(id, status) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('News');
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.getRange(i + 1, 8).setValue(status);
      sheet.getRange(i + 1, 13).setValue(new Date().toISOString());
      return { success: true, message: 'เปลี่ยนสถานะข่าวแล้ว' };
    }
  }
  return { success: false, message: 'ไม่พบข่าว' };
}

/**
 * ----------------------------------------------------------------------------------------------
 * ฟังก์ชันอัปโหลดสลิปเข้า Google Drive
 * ----------------------------------------------------------------------------------------------
 */
function uploadSlipToDrive(base64Data, fileName, mimeType) {
  try {
    if (!base64Data) return '';

    // ตัด Prefix data:image/jpeg;base64, ออกหากมี
    var pureBase64 = base64Data;
    if (base64Data.indexOf('base64,') !== -1) {
      pureBase64 = base64Data.split('base64,')[1];
    }

    var decoded = Utilities.base64Decode(pureBase64);
    var blob = Utilities.newBlob(decoded, mimeType || 'image/jpeg', fileName || ('slip-' + Date.now() + '.jpg'));

    // หาหรือสร้างโฟลเดอร์ใน Google Drive
    var folders = DriveApp.getFoldersByName(DRIVE_SLIP_FOLDER_NAME);
    var folder;
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder(DRIVE_SLIP_FOLDER_NAME);
    }

    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    // ส่งคืน View Link สำหรับเปิดดูภาพได้โดยตรง
    return 'https://drive.google.com/uc?export=view&id=' + file.getId();
  } catch (err) {
    Logger.log('Drive Upload Error: ' + err.toString());
    return '';
  }
}

/**
 * ----------------------------------------------------------------------------------------------
 * ฟังก์ชันส่งการแจ้งเตือนไปยัง Telegram Bot
 * ----------------------------------------------------------------------------------------------
 */
function sendTelegramNotification(settingKey, messageText, photoBase64) {
  try {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName('Settings');
    if (!sheet) return;

    var data = sheet.getDataRange().getValues();
    var settings = {};
    for (var i = 1; i < data.length; i++) {
      settings[data[i][0]] = data[i][1];
    }

    // ตรวจสอบว่าเปิด Telegram หรือไม่
    var tgEnabled = settings['tg_enabled'] === 'TRUE' || settings['tg_enabled'] === true;
    if (!tgEnabled) return;

    // ตรวจสอบว่าเปิดการแจ้งเตือนประเภทนี้หรือไม่
    if (settingKey && settings[settingKey] !== 'TRUE' && settings[settingKey] !== true) {
      return;
    }

    var botToken = settings['tg_bot_token'];
    var chatId = settings['tg_chat_id'];

    if (!botToken || !chatId) return;

    var url = 'https://api.telegram.org/bot' + botToken + '/sendMessage';
    var payload = {
      chat_id: chatId,
      text: messageText,
      parse_mode: 'HTML'
    };

    var options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    UrlFetchApp.fetch(url, options);
  } catch (err) {
    Logger.log('Telegram Notification Error: ' + err.toString());
  }
}

/**
 * ฟังก์ชันทดสอบการแจ้งเตือน Telegram จากหน้าตั้งค่า
 */
function testTelegram(customChatId, customToken) {
  try {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName('Settings');
    var data = sheet.getDataRange().getValues();
    var settings = {};
    for (var i = 1; i < data.length; i++) {
      settings[data[i][0]] = data[i][1];
    }

    var token = customToken || settings['tg_bot_token'];
    var chat = customChatId || settings['tg_chat_id'];

    if (!token || !chat) {
      return { success: false, message: 'กรุณากรอก Telegram Bot Token และ Chat ID ให้ครบถ้วน' };
    }

    var testMsg = "🔔 <b>[ทดสอบการเชื่อมต่อระบบสำเร็จ]</b>\n" +
                  "ระบบผ้าป่าเพื่อการศึกษา โรงเรียนร่มเกล้าพิทยาสรรค์\n" +
                  "วันเวลา: " + Utilities.formatDate(new Date(), 'GMT+7', 'dd/MM/yyyy HH:mm:ss');

    var url = 'https://api.telegram.org/bot' + token + '/sendMessage';
    var payload = {
      chat_id: chat,
      text: testMsg,
      parse_mode: 'HTML'
    };

    var res = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    var resCode = res.getResponseCode();
    if (resCode === 200) {
      return { success: true, message: 'ส่งข้อความทดสอบไปยัง Telegram สำเร็จแล้ว!' };
    } else {
      var resJson = JSON.parse(res.getContentText());
      return { success: false, message: 'Telegram Error: ' + (resJson.description || 'เกิดข้อผิดพลาดในการส่ง') };
    }
  } catch (err) {
    return { success: false, message: 'เชื่อมต่อ Telegram ไม่สำเร็จ: ' + err.toString() };
  }
}

/**
 * ----------------------------------------------------------------------------------------------
 * ฟังก์ชันออกข้อมูลรายงาน (Export Data)
 * ----------------------------------------------------------------------------------------------
 */
function getReportData(type, fromDate, toDate) {
  var init = getInitialData();
  var records = init.records || [];

  // กรองตามวันที่ถ้ามี
  if (fromDate || toDate) {
    records = records.filter(function(r) {
      if (fromDate && r.iso && r.iso < fromDate) return false;
      if (toDate && r.iso && r.iso > toDate) return false;
      return true;
    });
  }

  return {
    success: true,
    type: type,
    records: records,
    products: init.products,
    tables: init.tables
  };
}
