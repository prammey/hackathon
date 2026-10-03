// Generates fixtures/canvas-shop: a fictional shop laid out like old WYSIWYG "canvas" sites — every
// block absolutely positioned on a huge board, products split into separate picture/name/price blocks.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../fixtures/canvas-shop");
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const colors = ["#e63946", "#2a9d8f", "#e9c46a", "#264653", "#f4a261", "#8338ec", "#3a86ff", "#06d6a0"];
const products = ["Electric Go-Kart", "Folding E-Bike", "Kids' Jeep 12V", "Robot Vacuum", "Pool Table", "Telescope 20x", "Drone Pro", "Hoverboard", "Tandem Scooter", "Garden Robot", "Mini Tractor", "Karaoke Box", "Fat-Tyre Bike", "Toy Tank RC", "Camping Fridge", "Solar Lamp Set", "Massage Chair", "Electric Trike", "Smart Mirror", "Air Fryer XL"];
const pic = (i) => {
  const c = colors[i % colors.length];
  return `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="130"><rect width="200" height="130" fill="#fff"/><rect x="30" y="40" width="140" height="55" rx="14" fill="${c}"/><circle cx="62" cy="100" r="17" fill="#222"/><circle cx="140" cy="100" r="17" fill="#222"/><rect x="70" y="20" width="60" height="28" rx="6" fill="${c}" opacity=".7"/></svg>`)}`;
};
const blocks = [];
let id = 0;
const add = (x, y, w, h, html) => blocks.push(`<div id="e${id++}" style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;">${html}</div>`);
// header bits
add(10, 8, 300, 40, `<font size="6" color="#0a8a0a"><b>www.MEGA<font color="#c00">SHOP</font>.example</b></font>`);
add(330, 12, 200, 30, `<a href="#"><font color="#c00" size="4"><u>Toys for kids</u></font></a>`);
add(560, 8, 180, 50, `<form onsubmit="event.preventDefault()"><input type="text" name="q" aria-label="Search"><input type="submit" value="Search"></form>`);
add(760, 10, 160, 30, `<marquee><font color="#00f">NEW ITEMS EVERY DAY!!!</font></marquee>`);
// nav column
const cats = ["Aquarium", "Alarms", "ATV (el.)", "Bikes", "Boats", "Cameras", "Drones", "Garden", "Hobby & RC", "Kitchen", "Lamps", "Massage", "Music", "Outdoor", "Robots", "Scooters", "Solar", "Tools", "Toys", "Watches"];
add(10, 70, 120, cats.length * 18, cats.map((c, i) => `<a href="#cat${i}"><font size="${i % 4 === 0 ? 3 : 2}" color="${i % 3 ? "#00c" : "#080"}">${c}</font></a>`).join("<br>"));
// products: picture, name and price as separate pinned blocks
products.forEach((name, i) => {
  const col = i % 4, row = Math.floor(i / 4);
  const x = 150 + col * 215 + Math.round(rand() * 20), y = 70 + row * 220 + Math.round(rand() * 25);
  add(x, y, 200, 130, `<a href="#p${i}"><img src="${pic(i)}" width="200" height="130" alt=""></a>`);
  add(x + 4, y + 132, 190, 24, `<font size="${3 + (i % 3)}" color="${colors[(i + 3) % 8]}"><b>${name}</b></font>`);
  add(x + 4, y + 158, 120, 20, `<font size="2">fra kr. </font><font size="3" color="#c00"><b><u>${(1999 + i * 1250).toLocaleString("nb-NO")},-</u></b></font>`);
  if (i % 5 === 0) add(x + 150, y + 4, 46, 16, `<span style="background:#ff0;color:#c00;font-size:10px"><b>NEW!</b></span>`);
});
// banners, a vertical divider line and spacer gifs
add(150, 1180, 860, 60, `<table width="860" bgcolor="#ffd" border="1"><tr><td><font size="5" color="#d00"><b>SALE! SALE! Everything must go — call 900 12 345</b></font></td></tr></table>`);
add(1030, 70, 3, 1000, `<div style="width:3px;height:1000px;background:#0a2a6a"></div>`);
for (let i = 0; i < 12; i++) add(1040 + (i % 3) * 30, 80 + i * 70, 20, 20, `<img src="data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==" width="20" height="20" alt="">`);
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>MegaShop (fictional canvas-layout test page)</title>
<style>body{margin:0;font-family:Arial,sans-serif;background:#fff}</style></head>
<body><div id="root" style="position:absolute;width:1200px;height:1300px;">
${blocks.join("\n")}
</div></body></html>`;
fs.writeFileSync(path.join(out, "index.html"), html);
console.log(`canvas-shop: ${blocks.length} pinned blocks`);
