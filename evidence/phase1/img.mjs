import { chromium } from '/opt/homebrew/lib/node_modules/@playwright/test/index.mjs';
const b = await chromium.launch({ executablePath: process.env.CHROME_BIN });
const p = await b.newPage({ viewport: { width: 640, height: 200 } });
await p.setContent('<canvas id=c width=600 height=160></canvas><script>const x=c.getContext("2d");x.fillStyle="#fff8e1";x.fillRect(0,0,600,160);x.fillStyle="#222";x.font="bold 28px Georgia";x.fillText("Solicitud de beneficios",20,50);x.font="22px Georgia";x.fillText("Fecha límite: 15 de marzo de 2027",20,95);x.fillText("Adjunte su comprobante de domicilio",20,135);</script>');
await p.locator('#c').screenshot({ path: 'ocr.png' }); await b.close();
