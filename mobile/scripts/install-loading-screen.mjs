import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

// This cover is in the first HTML response, so slow JS startup never leaves an
// empty WebView. LoadingScreen.tsx uses the same safe, scalable composition.
export async function installLoadingScreen(html, outputDir, projectRoot) {
  const directory = path.join(outputDir, 'loading');
  await mkdir(directory, { recursive: true });
  await Promise.all([
    copyFile(path.join(projectRoot, 'assets/loading/dark-map.jpg'), path.join(directory, 'dark-map.jpg')),
    copyFile(path.join(projectRoot, 'assets/loading/pin-sticker.png'), path.join(directory, 'pin-sticker.png')),
    copyFile(path.join(projectRoot, 'node_modules/@expo-google-fonts/space-grotesk/700Bold/SpaceGrotesk_700Bold.ttf'), path.join(directory, 'space-grotesk-bold.ttf')),
  ]);
  const head = `
<link rel="preload" href="/loading/dark-map.jpg" as="image">
<link rel="preload" href="/loading/pin-sticker.png" as="image">
<link rel="preload" href="/loading/space-grotesk-bold.ttf" as="font" type="font/ttf" crossorigin>
<style>
@font-face{font-family:GraffitiLaunch;src:url('/loading/space-grotesk-bold.ttf') format('truetype');font-weight:700;font-display:swap}
#graffiti-launch-screen{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#20251F url('/loading/dark-map.jpg') center/cover no-repeat;color:#F9FAF5}
#graffiti-launch-screen .launch-frame{position:relative;width:min(calc(100vw - 32px),calc(56.25vh - 27px),500px);width:min(calc(100vw - 32px),calc(56.25dvh - 27px),500px);aspect-ratio:9/16;container-type:inline-size}
#graffiti-launch-screen .launch-pin{position:absolute;top:10%;left:14%;width:72%;height:54%;object-fit:contain}
#graffiti-launch-screen .launch-title{position:absolute;top:65%;width:100%;margin:0;font-family:GraffitiLaunch,sans-serif;font-weight:700;font-size:14.5cqw;line-height:1;letter-spacing:-.5cqw;text-align:center}
#graffiti-launch-screen .launch-loading{position:absolute;top:84%;left:32.5%;width:35%;text-align:center;font:2.4cqw sans-serif;letter-spacing:.7cqw}
#graffiti-launch-screen .launch-track{height:max(3px,.85cqw);margin-top:2.5cqw;border-radius:2px;overflow:hidden;background:rgba(249,250,245,.2)}
#graffiti-launch-screen .launch-bar{width:65%;height:100%;border-radius:2px;background:#DFFF65;animation:graffiti-loading 1.4s ease-in-out infinite}
@keyframes graffiti-loading{from{transform:translateX(-100%)}to{transform:translateX(160%)}}
@media(prefers-reduced-motion:reduce){#graffiti-launch-screen .launch-bar{animation:none}}
</style>`;
  const screen = `<div id="graffiti-launch-screen" role="status" aria-label="Loading Graffiti Tag" aria-busy="true">
  <div class="launch-frame" aria-hidden="true">
    <img class="launch-pin" src="/loading/pin-sticker.png" alt="" fetchpriority="high">
    <h1 class="launch-title">GRAFFITI<br>TAG</h1>
    <div class="launch-loading">LOADING<div class="launch-track"><div class="launch-bar"></div></div></div>
  </div>
</div>`;
  return html.replace('</head>', `${head}\n</head>`).replace(/(<body\b[^>]*>)/i, `$1\n${screen}`);
}
