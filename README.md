# ระบบผ้าป่าเพื่อการศึกษา – โรงเรียนร่มเกล้าพิทยาสรรค์

เว็บแอประดมทุนผ้าป่า: บริจาค · จองของที่ระลึก · จองโต๊ะ · ค้นหาสถานะ · หลังบ้าน Admin
Backend = Google Apps Script, ฐานข้อมูล = Google Sheets, เก็บสลิป/รูป = Google Drive

## โครงสร้างโปรเจกต์
```
├── src/
│   ├── Code.gs            # Backend ทุกฟังก์ชัน (RPC + doGet/doPost)
│   ├── index.html         # หน้าเว็บ (ต้องชื่อ index.html)
│   └── appsscript.json    # Manifest
├── scripts/check.js       # ตรวจ syntax + ความครบของ RPC
├── .github/workflows/
│   ├── ci.yml                    # ตรวจโค้ดทุก PR
│   ├── deploy-apps-script.yml    # push ขึ้น Apps Script อัตโนมัติเมื่อ merge main
│   └── pages.yml                 # (ทางเลือก) โฮสต์หน้าเว็บบน GitHub Pages
├── .clasp.json.example, .claspignore, package.json, LICENSE
```

## ติดตั้ง (ครั้งแรก)
```bash
npm install
npx clasp login
npm run create          # สร้างโปรเจกต์ Apps Script (หรือ copy .clasp.json.example เป็น .clasp.json ใส่ scriptId เอง)
npm run push
```
1. เปิด Apps Script Editor (`npm run open`) → เลือกฟังก์ชัน **`setup`** → Run → อนุญาตสิทธิ์
   (สร้าง Google Sheet, โฟลเดอร์ Drive และค่าตั้งต้นให้อัตโนมัติ)
2. **Deploy → New deployment → Web app** → Execute as **Me** / Who has access **Anyone**
3. เข้าหน้าเว็บ → เมนู Admin → `admin` / `admin1234` → **เปลี่ยนรหัสผ่านทันที** ที่เมนูตั้งค่าระบบ
4. ลืมรหัสผ่าน: รัน `resetAdminPassword` จาก Editor
5. (ถ้าต้องการแจ้งเตือน) ตั้ง Bot Token / Chat ID ที่เมนูตั้งค่า แล้วรัน `testTelegram` เพื่อทดสอบ

> ต้องเปิด Apps Script API ที่ https://script.google.com/home/usersettings ก่อนใช้ clasp
> ถ้าไม่ใช้ clasp: สร้างโปรเจกต์ใน Apps Script แล้ว copy 3 ไฟล์ใน `src/` ไปวาง (HTML ตั้งชื่อ `index`)

## Deploy อัตโนมัติด้วย GitHub Actions
ตั้ง **Settings → Secrets and variables → Actions**

| Secret | ค่า |
|---|---|
| `SCRIPT_ID` | Script ID (Project Settings ใน Apps Script) |
| `CLASPRC_JSON` | เนื้อหาไฟล์ `~/.clasprc.json` หลัง `clasp login` |
| `DEPLOYMENT_ID` | (ไม่บังคับ) Deployment ID ของ Web App ให้ URL เดิมอัปเดตเอง |
| `APPS_SCRIPT_URL` | (เฉพาะ GitHub Pages) URL Web App ที่ลงท้าย `/exec` |

Merge เข้า `main` → ตรวจโค้ด → `clasp push` → อัปเดต deployment

## GitHub Pages (ทางเลือก)
เปิด Settings → Pages → Source: **GitHub Actions** และตั้ง secret `APPS_SCRIPT_URL`
workflow จะแทนค่า `API_URL` ใน `index.html` ให้ตอน build (หน้าเว็บเรียก `doPost` ผ่าน fetch)
ถ้าเปิดไฟล์โดยไม่มี `API_URL` และไม่ได้อยู่ใน Apps Script จะใช้ข้อมูลจำลองในเบราว์เซอร์ (รหัส Admin ทดสอบ `admin1234`)

## ฟังก์ชัน RPC
`getPublic, adminLogin, adminLogout, adminGetAll, submitDonation, submitOrder, submitTable, searchItem, adminReview, adminGetSlip, adminSaveConfig, adminSaveProducts, adminSaveNews, adminSaveSchedule, adminSaveTables, adminResetAll`
ฟังก์ชันสำหรับเจ้าของ (รันจาก Editor): `setup`, `resetAdminPassword`, `testTelegram`

## ความปลอดภัย
- รหัสผ่านเก็บแบบ salted hash, token ใน CacheService, จำกัดลองรหัสผิด 5 ครั้ง/10 นาที
- ทำความสะอาด/escape ข้อมูลทุกช่อง (กัน XSS) ราคา ยอดรวม สต็อก คำนวณฝั่งเซิร์ฟเวอร์ + LockService กันจองซ้ำ
- สลิปเป็นไฟล์ส่วนตัวใน Drive ดูได้เฉพาะ Admin; ค้นหารายการต้องใช้เลขที่ + เบอร์โทร
- Bot Token Telegram ไม่ถูกส่งไปหน้าเว็บสาธารณะ
- **อย่า commit** `.clasp.json`, `.clasprc.json` (อยู่ใน .gitignore แล้ว)

## License
MIT
