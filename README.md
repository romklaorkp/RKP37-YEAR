# ระบบผ้าป่าเพื่อการศึกษา – โรงเรียนร่มเกล้าพิทยาสรรค์

Backend เป็น Google Apps Script (`Code.gs`) ฐานข้อมูล Google Sheets เก็บสลิป/รูปใน Google Drive

## ไฟล์
| ไฟล์ | หน้าที่ |
|---|---|
| `Code.gs` | Backend ทุกฟังก์ชัน |
| `index.html` | หน้าเว็บ (ไฟล์ HTML ที่คุณมีอยู่ ต้องตั้งชื่อ `index.html`) |
| `appsscript.json` | Manifest (timezone, scopes, web app) |

## ติดตั้งแบบ clasp (แนะนำสำหรับ GitHub)
```bash
npm i -g @google/clasp
clasp login
clasp create --type webapp --title "RK Fundraiser"   # หรือ clasp clone <scriptId>
clasp push -f
```
1. เปิด Apps Script Editor → เลือกฟังก์ชัน `setup` → Run → อนุญาตสิทธิ์ (สร้าง Sheet + โฟลเดอร์ Drive อัตโนมัติ)
2. Deploy → New deployment → Web app → Execute as **Me**, Who has access **Anyone**
3. เข้าสู่ระบบ Admin ครั้งแรก: `admin` / `admin1234` แล้วเปลี่ยนรหัสผ่านที่เมนู "ตั้งค่าระบบ" ทันที
4. ลืมรหัสผ่าน: รัน `resetAdminPassword` จาก Editor

## ติดตั้งแบบ copy-paste
สร้าง Apps Script project → วาง `Code.gs` → เพิ่มไฟล์ HTML ชื่อ `index` วางเนื้อหา `index.html` → เปิด "Show appsscript.json" แล้ววางค่าจากไฟล์ → รัน `setup` → Deploy

## แก้ index.html ให้ใช้กับระบบจริง
โค้ด `rpc()` เดิมเรียก `google.script.run` อยู่แล้ว จึงใช้ได้ทันทีเมื่อ Deploy ผ่าน Apps Script
(Mock ด้วย localStorage จะทำงานเฉพาะตอนเปิดไฟล์นอก Apps Script)

## ฟังก์ชัน RPC
`getPublic, adminLogin, adminLogout, adminGetAll, submitDonation, submitOrder, submitTable, searchItem, adminReview, adminGetSlip, adminSaveConfig, adminSaveProducts, adminSaveNews, adminSaveSchedule, adminSaveTables, adminResetAll`

มี `doPost` สำหรับเรียกเป็น JSON API ด้วย (`{"fn":"getPublic","args":[]}` แบบ `Content-Type: text/plain`) เผื่อโฮสต์หน้าเว็บบน GitHub Pages

## ความปลอดภัยที่ทำไว้
- รหัสผ่านเก็บแบบ salted hash, token เก็บใน CacheService, จำกัดการลองรหัสผิด 5 ครั้ง/10 นาที
- ตรวจสอบ/ทำความสะอาดข้อมูลทุกช่อง (escape กัน XSS เพราะหน้าเว็บใช้ innerHTML)
- ราคา/ยอดรวม/สต็อก คำนวณฝั่งเซิร์ฟเวอร์เท่านั้น ใช้ LockService กันจองซ้ำ/สต็อกติดลบ
- สลิปเก็บใน Drive แบบส่วนตัว ดูได้เฉพาะ Admin; ค้นหารายการต้องใช้เลขที่ + เบอร์โทร
- Bot Token ของ Telegram ไม่ถูกส่งให้หน้าเว็บสาธารณะ
