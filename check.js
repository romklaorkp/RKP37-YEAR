#!/usr/bin/env node
/**
 * ตรวจโปรเจกต์ก่อน push/deploy
 *  1) syntax ของ Code.gs และ <script> ใน index.html
 *  2) ทุก rpc('ชื่อ') ในหน้าเว็บต้องมีฟังก์ชันชื่อเดียวกันใน Code.gs และอยู่ใน rpcTable_
 *  3) appsscript.json เป็น JSON ถูกต้อง
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = path.join(__dirname, '..', 'src');
const read = f => fs.readFileSync(path.join(src, f), 'utf8');
let errors = 0;
const bad = m => { console.error('✗ ' + m); errors++; };
const ok = m => console.log('✓ ' + m);

const code = read('Code.gs');
try { new vm.Script(code, { filename: 'Code.gs' }); ok('Code.gs syntax'); }
catch (e) { bad('Code.gs: ' + e.message); }

const html = read('index.html');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const inline = scripts[scripts.length - 1] || '';
try { new vm.Script(inline, { filename: 'index.html' }); ok('index.html inline script syntax'); }
catch (e) { bad('index.html: ' + e.message); }

try { JSON.parse(read('appsscript.json')); ok('appsscript.json'); }
catch (e) { bad('appsscript.json: ' + e.message); }

const used = new Set([...inline.matchAll(/rpc\(\s*'(\w+)'/g)].map(m => m[1]));
// ชื่อที่ถูกส่งผ่านตัวแปร (persist)
['adminSaveProducts', 'adminSaveNews', 'adminSaveSchedule'].forEach(n => used.add(n));
const table = (code.match(/function rpcTable_\(\)\s*\{[\s\S]*?\n\}/) || [''])[0];
used.forEach(n => {
  if (!new RegExp('function\\s+' + n + '\\s*\\(').test(code)) bad('ไม่พบฟังก์ชัน ' + n + ' ใน Code.gs');
  else if (!table.includes(n)) bad(n + ' ไม่อยู่ใน rpcTable_ (doPost)');
});
if (!errors) ok('RPC ครบ ' + used.size + ' ฟังก์ชัน');

if (/const API_URL = '[^']+'/.test(html)) console.warn('! API_URL ถูกตั้งค่าไว้ในไฟล์แล้ว (ตรวจว่าตั้งใจ)');
process.exit(errors ? 1 : 0);
