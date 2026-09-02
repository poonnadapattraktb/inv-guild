# INV Guild

เว็บแบบทดสอบอาชีพสำหรับสมาชิก INV Guild ตัวหน้าเว็บ deploy บน GitHub Pages และเก็บสมาชิกใน Supabase เพื่อให้ผลที่บันทึกแล้วเปิดดูได้จากทุกเครื่อง

## URL และพฤติกรรม

- ทุก URL เริ่มต้นที่หน้า Home
- `https://poonnadapattraktb.github.io/inv-guild/` เป็น guest และมีปุ่ม `เลือกอาชีพ` เสมอ ผลแบบทดสอบจะไม่ถูกบันทึก
- `https://poonnadapattraktb.github.io/inv-guild/?id=<UUID>` เปิดลิงก์เฉพาะสมาชิก
- สมาชิกที่ยังไม่มีอาชีพจะเห็นปุ่ม `เลือกอาชีพ` เพื่อเลือก avatar และทำแบบทดสอบได้หนึ่งครั้ง
- สมาชิกที่มีอาชีพแล้วจะเห็นปุ่ม `ดูข้อมูลของท่าน` เพื่อเปิดหน้าโปรไฟล์ และไม่มีปุ่มทำแบบทดสอบใหม่
- ทำเนียบอาชีพแสดงข้อมูลอาชีพทั่วไป ส่วน Guild Roster เปิดโปรไฟล์ของสมาชิก

ใช้ query parameter ต่อท้าย GitHub Pages project root โดยตรง หน้า `index.html` จะถูกเปิดให้อัตโนมัติ ห้ามใช้ path `/id` เพราะ GitHub Pages project site ไม่มี rewrite rule สำหรับ SPA

## ตั้งค่า Supabase

1. สร้าง Supabase project
2. เปิด SQL Editor แล้วรันตามลำดับ [supabase/migrations/001_members.sql](supabase/migrations/001_members.sql) และ [supabase/migrations/002_direct_rest_api.sql](supabase/migrations/002_direct_rest_api.sql)
3. นำ Project URL และ publishable key ใส่ใน [config.js](config.js):

```js
window.INV_GUILD_CONFIG = {
	supabaseUrl: "https://YOUR_PROJECT.supabase.co",
	supabasePublishableKey: "YOUR_PUBLISHABLE_KEY"
};
```

Publishable key สามารถอยู่ใน GitHub Pages ได้ ห้ามใส่ secret key โดยเด็ดขาด หน้าเว็บเรียก REST API ของตาราง `members` ตรง ๆ (ไม่มี RPC function แล้ว) การป้องกันข้อมูลทำด้วย column-level grant และ RLS policy ใน migration 002: อ่านได้ทุกแถวทุกคอลัมน์ แต่แก้ได้เฉพาะ `class_id` / `avatar_id` / `assigned_at` และแก้ได้เฉพาะตอนที่ `class_id` ยังเป็น null เท่านั้น จึงเลือกอาชีพซ้ำทับของเดิมไม่ได้แม้ยิง request ตรงด้วย curl

Migration จะย้ายสมาชิกตัวอย่างเดิม 12 คนเข้า Supabase พร้อมอาชีพเดิม หากไม่ต้องการข้อมูลตัวอย่างให้ลบส่วน `insert into public.members` ก่อนรันครั้งแรก

## เพิ่มสมาชิกสำหรับทำแบบทดสอบ

สร้างสมาชิกที่ยังไม่มี `class_id` และเก็บ UUID ที่คืนมา:

```sql
insert into public.members (id, name, role)
values (gen_random_uuid(), 'ชื่อสมาชิก', 'ตำแหน่งงาน')
returning id, name;
```

สร้างลิงก์เชิญจากสมาชิกที่ยังไม่ได้ทำแบบทดสอบ:

```sql
select name, 'https://poonnadapattraktb.github.io/inv-guild/?id=' || id as invite_url
from public.members
where class_id is null
order by name;
```

UUID ทำหน้าที่เป็น invite token จึงควรส่งให้เจ้าของลิงก์โดยตรง เมื่อบันทึกแล้ว RLS policy `members_assign_once` จะไม่ยอมให้เปลี่ยนอาชีพอีก แม้มี request ซ้ำ เปิดพร้อมกันหลายเครื่อง หรือยิง PATCH ตรงด้วย curl การแก้ข้อมูลภายหลังต้องทำโดยผู้ดูแลใน Supabase

## รันในเครื่อง

```bash
python3 -m http.server 8000
```

เปิด `http://localhost:8000/` สำหรับ guest หรือ `http://localhost:8000/?id=<UUID>` สำหรับสมาชิก ห้ามเปิด `index.html` ด้วย `file://` เพราะ browser จะโหลดไฟล์ JSON ไม่ได้

หากยังไม่ตั้งค่า Supabase แบบ guest จะยังใช้งานได้ แต่ Guild Roster และลิงก์สมาชิกจะยังไม่พร้อมใช้งาน

## Deploy

Deploy repository ด้วย GitHub Pages แล้วตรวจทั้ง `https://poonnadapattraktb.github.io/inv-guild/` และลิงก์ UUID จริงหลัง migration สำเร็จ