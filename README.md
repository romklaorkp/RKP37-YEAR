# ระบบผ้าป่าเพื่อการศึกษา โรงเรียนร่มเกล้าพิทยาสรรค์

งาน "คืนสู่เหย้า 39 ปี ชาวม่วง-แสด" · ระบบบริจาค จองของที่ระลึก จองโต๊ะออนไลน์ และหลังบ้าน Admin

- **Frontend:** `site/index.html` (HTML + CSS + JavaScript ไฟล์เดียว · Bootstrap 5 · SweetAlert2) โฮสต์บน GitHub Pages
- **Backend:** `apps-script/Code.gs` (Google Apps Script) · ฐานข้อมูล Google Sheets · เก็บรูป/สลิปใน Google Drive
- **การเชื่อมต่อ:** JSONP (หน้าเว็บเรียก `.../exec?action=...&callback=...`)

```
├─ site/                    ← โฟลเดอร์ที่ถูกเผยแพร่ขึ้น GitHub Pages
│  ├─ index.html
│  ├─ config.js             ← ใส่ URL ของ Apps Script ที่นี่
│  └─ .nojekyll
├─ apps-script/
│  ├─ Code.gs               ← วางใน Apps Script
│  └─ appsscript.json
└─ .github/workflows/deploy.yml
```

## 1) ติดตั้งฝั่ง Google (Backend)
1. เปิด [script.google.com](https://script.google.com) สร้างโปรเจกต์ใหม่ → วางโค้ดจาก `apps-script/Code.gs`
2. แก้ค่า `SHEET_ID` และ `FOLDER_ID` ด้านบนไฟล์ให้ตรงกับ Google Sheet และโฟลเดอร์ Drive ของคุณ
3. (ทางเลือก) Project Settings → ติ๊ก *Show "appsscript.json"* แล้ววางค่าจาก `apps-script/appsscript.json`
4. เลือกฟังก์ชัน `setup` กด **Run** → อนุญาตสิทธิ์ (Sheets, Drive, Docs) ระบบจะสร้างชีต หัวตาราง และโฟลเดอร์ย่อยให้อัตโนมัติ
5. **Deploy → New deployment → Web app** · Execute as: *Me* · Who has access: *Anyone* → คัดลอก URL ที่ลงท้าย `/exec`
6. ทดสอบเปิด URL ควรได้ข้อความ `ready` และ `...?action=getPublic&callback=t` ต้องได้ข้อมูลกลับมา

> แก้ `Code.gs` ทุกครั้งต้อง Deploy → Manage deployments → Edit → **New version** เพื่อให้ URL เดิมใช้โค้ดใหม่

## 2) เผยแพร่ฝั่งหน้าเว็บ (GitHub Pages)
1. สร้าง repository ใหม่บน GitHub แล้วอัปโหลดไฟล์ทั้งหมดในโฟลเดอร์นี้ (branch `main`)
2. แก้ `site/config.js` ใส่ URL `/exec` ของคุณ
3. ไปที่ **Settings → Pages → Source: GitHub Actions**
4. Push ขึ้น `main` ระบบจะ Deploy อัตโนมัติ เว็บจะอยู่ที่ `https://<ชื่อผู้ใช้>.github.io/<ชื่อ repo>/`

## 3) เริ่มใช้งาน
- ล็อกอิน Admin: ปุ่ม 🔑 มุมขวาบน → `admin` / `1234` → **เปลี่ยนรหัสผ่านทันที** ที่เมนู "ตั้งค่า"
- เพิ่มสินค้า/โต๊ะ/ข่าว/กำหนดการ และตั้งค่า QR PromptPay, โลโก้, Telegram ได้จากหลังบ้าน
- ถ้าสินค้าว่าง ให้รันฟังก์ชัน `seedProducts()` ใน Apps Script หรือเพิ่มจากเมนู "สินค้า & สต็อก"

## ข้อควรระวังด้านความปลอดภัย
- `Code.gs` มี `SHEET_ID`, `FOLDER_ID` และค่า `SALT` ของรหัสผ่าน ถ้าจะเก็บ repo เป็น **public** ให้ใส่ค่าจริงเฉพาะใน Apps Script (ในไฟล์บน GitHub ใช้ค่าตัวอย่าง) และเปลี่ยน `SALT` ก่อนใช้งานจริง
- JSONP ส่งข้อมูลผ่าน URL (รวมถึงรหัสผ่านตอนล็อกอิน) ใช้งานผ่าน HTTPS เท่านั้น
- สลิปเก็บเป็นไฟล์ส่วนตัวใน Drive Admin ดูผ่านระบบเท่านั้น ส่วนรูปโลโก้/สินค้า/ข่าวเปิดลิงก์สาธารณะ

## ข้อจำกัด
ยังไม่มี Export Excel และการสแกน QR รับสินค้า · รายงาน PDF ใช้หน้าต่างพิมพ์ของเบราว์เซอร์
