// Rend scene.html image par image et encode la vidéo avec ffmpeg.
// Usage : node render.js                -> transio.mp4 (60 s, 1080p, 30 i/s)
//         node render.js stills 3 9 20  -> stills/t3.png ... (aperçus)
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const FPS = 30, DUR = 60;
const dir = __dirname;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('file://' + path.join(dir, 'scene.html') + '#render');
  await page.evaluate(() => window.ready);

  const grab = async t => {
    const url = await page.evaluate(t => { render(t); return document.getElementById('c').toDataURL('image/jpeg', 0.95); }, t);
    return Buffer.from(url.split(',')[1], 'base64');
  };

  if (process.argv[2] === 'stills') {
    fs.mkdirSync(path.join(dir, 'stills'), { recursive: true });
    for (const s of process.argv.slice(3)) fs.writeFileSync(path.join(dir, 'stills', `t${s}.jpg`), await grab(parseFloat(s)));
    await browser.close(); return;
  }

  const audio = path.join(dir, 'music.wav');
  const args = ['-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-'];
  if (fs.existsSync(audio)) args.push('-i', audio, '-c:a', 'aac', '-b:a', '192k', '-shortest');
  args.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(dir, 'transio.mp4'));
  const ff = spawn('ffmpeg', args, { stdio: ['pipe', 'ignore', 'inherit'] });

  const total = FPS * DUR;
  for (let i = 0; i < total; i++) {
    const buf = await grab(i / FPS);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 150 === 0) console.log(`frame ${i}/${total}`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await browser.close();
  console.log('ok -> transio.mp4');
})();
