import { formatSafeDigestCaption } from '../src/modules/telegram/bot.js';

function testFormatSafeDigestCaption() {
  const statusText = "✅ <b>INSTAGRAM'A REELS OLARAK YAYINLANDI!</b>";

  // Test 1: Normal uzunluk
  const normalText = "🎬 DONANIMPOST ÖĞLE BÜLTENİ\n\n1️⃣ Test Haber Başlığı\n2️⃣ İkinci haber";
  const res1 = formatSafeDigestCaption(normalText, statusText);
  console.log("Test 1 Result Length:", res1.length);
  if (res1.length > 1024) throw new Error("Test 1 failed: > 1024");
  if (!res1.includes(statusText)) throw new Error("Test 1 failed: statusText not found");

  // Test 2: Çok uzun metin (1200 karakter)
  const longText = "A".repeat(1200);
  const res2 = formatSafeDigestCaption(longText, statusText, 1015);
  console.log("Test 2 Result Length:", res2.length);
  if (res2.length > 1015) throw new Error(`Test 2 failed: length ${res2.length} > 1015`);
  if (!res2.endsWith(statusText)) throw new Error("Test 2 failed: does not end with statusText");
  if (!res2.includes("...")) throw new Error("Test 2 failed: does not have ellipsis");

  // Test 3: Sınırda metin (1000 karakter)
  const edgeText = "B".repeat(1000);
  const res3 = formatSafeDigestCaption(edgeText, statusText, 1015);
  console.log("Test 3 Result Length:", res3.length);
  if (res3.length > 1015) throw new Error(`Test 3 failed: length ${res3.length} > 1015`);

  console.log("✅ Tüm formatSafeDigestCaption testleri başarıyla geçti!");
  process.exit(0);
}

testFormatSafeDigestCaption();
