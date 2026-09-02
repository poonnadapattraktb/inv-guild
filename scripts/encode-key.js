#!/usr/bin/env node
"use strict";

const crypto = require("crypto");

const DECODE_KEY_LEN = 8;

function xorString(str, key) {
  let out = "";
  for (let i = 0; i < str.length; i++) {
    out += String.fromCharCode(str.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return out;
}

const rawKey = process.argv[2];
if (!rawKey) {
  console.error("Usage: node scripts/encode-key.js <supabase-publishable-key> [decode-key]");
  process.exit(1);
}

const decodeKey = process.argv[3] || crypto.randomBytes(DECODE_KEY_LEN / 2).toString("hex");
const encoded = Buffer.from(xorString(rawKey, decodeKey), "binary").toString("base64");

console.log("config.js:");
console.log('  supabasePublishableKeyEncoded: "' + encoded + '"');
console.log("");
console.log("ac param (ใส่ใน invite URL):");
console.log("  ac=" + decodeKey);
console.log("");
console.log("ตัวอย่าง URL เต็ม:");
console.log("  /inv-guild/?id=<member-nano-id>&ac=" + decodeKey);
