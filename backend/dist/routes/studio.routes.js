import { Router } from 'express';
import { TokenService } from '../services/token.service.js';
const router = Router();
/**
 * Flow Video Creation Screen (YouTube Automation & Studio)
 * Accessible at: http://localhost:4000/studio
 */
router.get('/', async (req, res) => {
    // Check token from browser cookie first, then headers, then query
    const cookieHeader = req.headers.cookie || '';
    let tokenFromCookie = '';
    const cookieMatches = cookieHeader.match(/(?:flow_session|flow_delegated_session|session|token)=([^;]+)/);
    if (cookieMatches && cookieMatches[1]) {
        tokenFromCookie = decodeURIComponent(cookieMatches[1].trim());
    }
    const token = tokenFromCookie ||
        req.query.flow_token ||
        req.query.token ||
        req.headers.authorization?.replace('Bearer ', '');
    const isCookieAuth = !!tokenFromCookie;
    if (!token) {
        // Unauthenticated lock screen
        res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Flow Video Studio - Authentication Required</title>
        <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
      </head>
      <body class="bg-gray-950 text-white min-h-screen flex items-center justify-center p-6 font-sans">
        <div class="max-w-md w-full bg-gray-900 border border-red-500/30 rounded-2xl p-8 shadow-2xl text-center">
          <div class="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl">
            🔒
          </div>
          <h1 class="text-2xl font-bold mb-2">Flow Video Studio</h1>
          <p class="text-gray-400 text-xs mb-6">YouTube Automation & AI Video Creation Suite</p>

          <div class="bg-red-950/40 border border-red-500/20 rounded-xl p-4 text-left mb-6 text-xs text-red-200">
            <strong>Access Restricted:</strong> Please open the <strong>Flow Session Share</strong> Chrome Extension and sign in with your user account to automatically access the Video Creation Studio.
          </div>

          <div class="text-xs text-gray-500">
            Powered by Flow Session Delegation Protocol
          </div>
        </div>
      </body>
      </html>
    `);
        return;
    }
    // Verify token
    const decoded = TokenService.verifyDelegatedSessionToken(token);
    if (!decoded) {
        res.status(401).send(`
      <body style="background:#090d16; color:#ef4444; font-family:sans-serif; text-align:center; padding:50px;">
        <h2>❌ Invalid or Expired Video Studio Session</h2>
        <p>Please log in again through the Flow Chrome Extension.</p>
      </body>
    `);
        return;
    }
    // Render Full Protected Video Creation Screen!
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Flow Video Creation Studio - YouTube Automation</title>
      <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Inter', sans-serif; }
        .glass { background: rgba(17, 24, 39, 0.7); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.08); }
      </style>
      <script>
        // Real-time revocation listener
        setInterval(async () => {
          try {
            const res = await fetch('/api/gateway/verify?token=${token}');
            const data = await res.json();
            if (!data.valid) {
              alert('Session expired or revoked by administrator.');
              window.location.reload();
            }
          } catch(e) {}
        }, 4000);

        function generateScript() {
          const prompt = document.getElementById('topicInput').value.trim();
          if (!prompt) { alert('Please enter a video topic or prompt!'); return; }

          document.getElementById('btnGen').disabled = true;
          document.getElementById('btnGen').innerHTML = '<span class="animate-spin inline-block mr-2">⚡</span> Generating AI Storyboard...';

          setTimeout(() => {
            document.getElementById('scriptSection').classList.remove('hidden');
            document.getElementById('previewSection').classList.remove('hidden');
            document.getElementById('renderProgress').style.width = '100%';
            document.getElementById('btnGen').disabled = false;
            document.getElementById('btnGen').innerHTML = '✨ Generate Video Script & Scenes';
          }, 1500);
        }
      </script>
    </head>
    <body class="bg-gray-950 text-gray-100 min-h-screen flex flex-col">

      <!-- Top Navigation -->
      <header class="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div class="flex items-center space-x-3">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-600 to-pink-600 flex items-center justify-center shadow-lg shadow-red-600/20 font-bold text-xl">
            ▶
          </div>
          <div>
            <div class="flex items-center space-x-2">
              <h1 class="font-extrabold text-lg text-white">Flow Video Creation Studio</h1>
              <span class="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 font-bold uppercase">YouTube Automation</span>
            </div>
            <p class="text-xs text-gray-400">Authenticated AI Video Pipeline & Scheduled Publisher</p>
          </div>
        </div>

        <div class="flex items-center space-x-4 text-xs">
          <div class="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-emerald-950 border border-emerald-500/30 text-emerald-400 font-medium">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Delegated Session Active</span>
          </div>

          <div class="bg-gray-800 px-3 py-1.5 rounded-xl border border-gray-700 flex items-center space-x-2 text-gray-300">
            <span>Channel:</span>
            <strong class="text-white flex items-center">
              <span class="text-red-500 mr-1">●</span> YouTube Connected
            </strong>
          </div>
        </div>
      </header>

      <!-- Main Studio Workspace -->
      <main class="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">

        <!-- Banner -->
        <div class="bg-gradient-to-r from-red-950/40 via-purple-950/30 to-blue-950/30 border border-red-500/20 rounded-2xl p-6">
          <h2 class="text-xl font-bold text-white mb-1">Welcome to Flow Video Creation Studio</h2>
          <p class="text-xs text-gray-300">
            You are securely authenticated through your administrator's shared YouTube automation session. Generate scripts, render multi-scene videos, and queue direct YouTube uploads.
          </p>
        </div>

        <!-- Video Creation Input Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

          <!-- Left 2 Cols: Generation Controls -->
          <div class="lg:col-span-2 space-y-6">

            <!-- Prompt Card -->
            <div class="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4 shadow-xl">
              <h3 class="text-sm font-bold text-white flex items-center space-x-2">
                <span>1. Prompt & Video Parameters</span>
              </h3>

              <div>
                <label class="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                  Video Topic or YouTube Idea
                </label>
                <input
                  type="text"
                  id="topicInput"
                  value="10 Mind-Blowing AI Breakthroughs That Will Change the World in 2026"
                  placeholder="e.g. 5 Habits of Highly Productive People, Tech Review..."
                  class="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-red-500 transition font-medium"
                />
              </div>

              <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div>
                  <label class="block text-[11px] font-semibold text-gray-400 uppercase mb-1">Format</label>
                  <select class="w-full bg-gray-950 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white">
                    <option>YouTube Long Form (16:9)</option>
                    <option selected>YouTube Short / Reel (9:16)</option>
                  </select>
                </div>
                <div>
                  <label class="block text-[11px] font-semibold text-gray-400 uppercase mb-1">Voiceover Style</label>
                  <select class="w-full bg-gray-950 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white">
                    <option selected>Deep Narrative (Adam - AI)</option>
                    <option>Energetic Host (Bella - AI)</option>
                    <option>Tech Documentarian</option>
                  </select>
                </div>
                <div>
                  <label class="block text-[11px] font-semibold text-gray-400 uppercase mb-1">Auto Captions</label>
                  <select class="w-full bg-gray-950 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white">
                    <option selected>Hormozi Kinetic Style</option>
                    <option>Minimalist Subtitles</option>
                    <option>Bold Pop-up Words</option>
                  </select>
                </div>
              </div>

              <button
                type="button"
                id="btnGen"
                onclick="generateScript()"
                class="w-full bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-red-600/30 transition text-xs flex items-center justify-center space-x-2"
              >
                <span>✨ Generate Video Script & Scenes</span>
              </button>
            </div>

            <!-- AI Script & Storyboard Output -->
            <div id="scriptSection" class="hidden bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4 shadow-xl">
              <div class="flex items-center justify-between border-b border-gray-800 pb-3">
                <h3 class="text-sm font-bold text-white">2. AI Storyboard & Multi-Scene Script</h3>
                <span class="text-xs text-green-400 bg-green-950/60 border border-green-500/30 px-2.5 py-0.5 rounded-full font-semibold">Generated (4 Scenes)</span>
              </div>

              <div class="space-y-3 text-xs">
                <div class="bg-gray-950 p-3.5 rounded-xl border border-gray-800">
                  <div class="flex justify-between text-red-400 font-semibold mb-1">
                    <span>Scene 1 (Hook - 0-3s)</span>
                    <span class="text-gray-500">Visual: High-tech holographic brain pulsating</span>
                  </div>
                  <p class="text-gray-300">"What if I told you the way we live and work is about to be completely rewritten by 2026?"</p>
                </div>

                <div class="bg-gray-950 p-3.5 rounded-xl border border-gray-800">
                  <div class="flex justify-between text-red-400 font-semibold mb-1">
                    <span>Scene 2 (Breakthrough - 3-15s)</span>
                    <span class="text-gray-500">Visual: Autonomous humanoid robots collaborating</span>
                  </div>
                  <p class="text-gray-300">"Autonomous AI systems are no longer just chatbots. They now design chips, discover life-saving medications, and orchestrate complex logistics."</p>
                </div>

                <div class="bg-gray-950 p-3.5 rounded-xl border border-gray-800">
                  <div class="flex justify-between text-red-400 font-semibold mb-1">
                    <span>Scene 3 (Call to Action - 15-30s)</span>
                    <span class="text-gray-500">Visual: Subscribe button animation with kinetic glow</span>
                  </div>
                  <p class="text-gray-300">"Hit subscribe so you never fall behind the future of technology!"</p>
                </div>
              </div>
            </div>

          </div>

          <!-- Right Col: Video Preview & YouTube Upload Queue -->
          <div class="space-y-6">

            <!-- Render Player Preview -->
            <div class="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl space-y-4">
              <h3 class="text-sm font-bold text-white">3. Live Render Preview</h3>

              <div class="aspect-video bg-black rounded-xl overflow-hidden relative flex items-center justify-center border border-gray-800">
                <div class="text-center p-4">
                  <div class="w-12 h-12 bg-red-600/30 border border-red-500/50 rounded-full flex items-center justify-center mx-auto mb-2 text-xl cursor-pointer hover:scale-110 transition">
                    ▶
                  </div>
                  <div class="text-xs font-semibold text-gray-300">1080p 60FPS Video Preview</div>
                  <div class="text-[10px] text-gray-500">Ready to Render</div>
                </div>

                <!-- Progress Bar -->
                <div class="absolute bottom-0 left-0 right-0 h-1 bg-gray-800">
                  <div id="renderProgress" class="h-full bg-red-500 transition-all duration-700" style="width: 0%"></div>
                </div>
              </div>

              <div id="previewSection" class="hidden space-y-2">
                <button
                  type="button"
                  onclick="alert('Video render complete! Ready for YouTube Automation Pipeline.')"
                  class="w-full py-2.5 px-4 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-semibold text-xs border border-gray-700 transition"
                >
                  ⬇ Download Final MP4 Video
                </button>
                <button
                  type="button"
                  onclick="alert('Queued for upload to connected YouTube Channel!')"
                  class="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white font-semibold text-xs shadow-lg shadow-red-600/30 transition"
                >
                  🚀 Upload to YouTube Automation Queue
                </button>
              </div>
            </div>

            <!-- YouTube Channel Automation Status -->
            <div class="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl space-y-3 text-xs">
              <h3 class="font-bold text-white">YouTube Automation Queue</h3>
              <div class="flex justify-between items-center text-gray-400">
                <span>Upload Frequency:</span>
                <span class="text-white font-medium">Daily at 5:00 PM EST</span>
              </div>
              <div class="flex justify-between items-center text-gray-400">
                <span>Default Visibility:</span>
                <span class="text-green-400 font-medium">Public</span>
              </div>
              <div class="flex justify-between items-center text-gray-400">
                <span>Session Expiration:</span>
                <span class="text-gray-300 font-mono">${new Date(decoded.exp * 1000).toLocaleTimeString()}</span>
              </div>
            </div>

          </div>

        </div>

      </main>

    </body>
    </html>
  `);
});
export default router;
