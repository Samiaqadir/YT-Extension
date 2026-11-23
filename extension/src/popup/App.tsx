import React, { useState, useEffect } from 'react';
import { Play, Lock, User, CheckCircle2, AlertCircle, ArrowRight, LogOut, Radio, Sparkles } from 'lucide-react';

interface AuthUser {
  id: string;
  username: string;
  role: string;
}

interface UserSession {
  token: string;
  domain: string;
  studioUrl: string;
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<UserSession | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load existing session from chrome.storage on mount
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get(['flow_auth_user', 'flow_auth_session'], (result) => {
        if (result.flow_auth_user && result.flow_auth_session) {
          setUser(result.flow_auth_user);
          setSession(result.flow_auth_session);
        }
      });
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    try {
      const res = await fetch('http://localhost:4000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Login failed. Please check your credentials.');
        setIsLoading(false);
        return;
      }

      const loggedInUser: AuthUser = data.user;
      const userSession: UserSession = data.session;

      setUser(loggedInUser);
      setSession(userSession);

      // Save to Chrome Storage & Inject Browser Cookies
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.set({
          flow_auth_user: loggedInUser,
          flow_auth_session: userSession,
        });

        const targetUrl = (userSession as any).targetUrl || userSession.studioUrl || 'https://flow.google.com';

        // Set session cookies directly in Chrome browser jar
        if (chrome.cookies?.set) {
          const cookieUrl = targetUrl.startsWith('http') ? new URL(targetUrl).origin + '/' : 'https://flow.google.com/';
          const isHttps = cookieUrl.startsWith('https:');

          await new Promise((resolve) => {
            chrome.cookies.set(
              {
                url: cookieUrl,
                name: (userSession as any).cookieName || 'flow_session',
                value: userSession.token,
                path: '/',
                secure: isHttps,
              },
              resolve
            );
          });

          await new Promise((resolve) => {
            chrome.cookies.set(
              {
                url: cookieUrl,
                name: 'flow_delegated_session',
                value: userSession.token,
                path: '/',
                secure: isHttps,
              },
              resolve
            );
          });

          // Open target account URL with cookies already applied!
          if (chrome.tabs?.create) {
            chrome.tabs.create({ url: targetUrl });
          }
        } else {
          chrome.runtime.sendMessage({
            type: 'INJECT_DELEGATED_SESSION',
            payload: {
              grantId: 'grant_user_' + loggedInUser.id,
              domain: userSession.domain,
              token: userSession.token,
              targetUrl,
            },
          });
        }
      } else {
        // Fallback for non-extension browser testing
        const targetUrl = (userSession as any).targetUrl || userSession.studioUrl || 'https://flow.google.com';
        window.open(targetUrl, '_blank');
      }
    } catch (err: any) {
      setErrorMsg('Cannot connect to Flow Gateway: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenStudio = async () => {
    const url = (session as any)?.targetUrl || session?.studioUrl || 'https://flow.google.com';
    if (typeof chrome !== 'undefined') {
      if (chrome.cookies?.set && session?.token) {
        const cookieUrl = url.startsWith('http') ? new URL(url).origin + '/' : 'https://flow.google.com/';
        const isHttps = cookieUrl.startsWith('https:');
        await new Promise((resolve) => {
          chrome.cookies.set(
            {
              url: cookieUrl,
              name: (session as any).cookieName || 'flow_session',
              value: session.token,
              path: '/',
              secure: isHttps,
            },
            resolve
          );
        });
      }
      if (chrome.tabs?.create) {
        chrome.tabs.create({ url });
        return;
      }
    }
    window.open(url, '_blank');
  };

  const handleSignOut = () => {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.remove(['flow_auth_user', 'flow_auth_session'], () => {
        setUser(null);
        setSession(null);
      });
    } else {
      setUser(null);
      setSession(null);
    }
  };

  return (
    <div className="w-[380px] min-h-[520px] bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-red-600 selection:text-white">
      {/* Header */}
      <header className="px-5 py-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-red-600 to-pink-600 flex items-center justify-center shadow-lg shadow-red-600/30 font-bold text-white text-base">
            <Play className="w-4 h-4 fill-current ml-0.5" />
          </div>
          <div>
            <h1 className="font-extrabold text-sm tracking-tight text-white leading-tight">Flow Video Studio</h1>
            <p className="text-[10px] text-slate-400 font-medium">YouTube Automation Suite</p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-red-950/60 border border-red-500/30">
          <Radio className="w-2.5 h-2.5 text-red-400 animate-pulse" />
          <span className="text-[10px] font-bold text-red-300">Creator Portal</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-5 flex flex-col justify-center">
        {errorMsg && (
          <div className="mb-4 bg-red-950/80 border border-red-500/40 rounded-xl p-3 flex items-start space-x-2 text-xs text-red-300 animate-fade-in">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <span className="leading-tight">{errorMsg}</span>
          </div>
        )}

        {!user ? (
          /* LOGIN SCREEN */
          <div className="space-y-4">
            <div className="text-center mb-5">
              <h2 className="text-lg font-bold text-white flex items-center justify-center space-x-1.5">
                <span>Creator Sign In</span>
                <Sparkles className="w-4 h-4 text-amber-400" />
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Enter your account credentials created on the Admin Panel to authenticate your video creation session.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Username or Email
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter username or email"
                    required
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 font-medium focus:outline-none focus:border-red-500 transition pl-9"
                  />
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 font-medium focus:outline-none focus:border-red-500 transition pl-9"
                  />
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-red-600/30 transition duration-200 text-xs flex items-center justify-center space-x-2 mt-2"
              >
                {isLoading ? (
                  <span>Authenticating Session...</span>
                ) : (
                  <>
                    <span>Sign In & Launch Flow Studio</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="pt-3 border-t border-slate-900 text-center">
              <p className="text-[10px] text-slate-400">
                Enter your credentials created by your Administrator.
              </p>
              <p className="text-[10px] text-slate-600 mt-0.5">
                Admin Panel: <a href="http://localhost:4000/admin" target="_blank" className="text-purple-400 hover:underline">localhost:4000/admin</a>
              </p>
            </div>
          </div>
        ) : (
          /* LOGGED IN SCREEN */
          <div className="space-y-5 text-center py-4 animate-fade-in">
            <div className="w-14 h-14 bg-red-600/20 border border-red-500/30 text-red-400 rounded-2xl flex items-center justify-center mx-auto shadow-xl">
              <CheckCircle2 className="w-7 h-7 text-emerald-400" />
            </div>

            <div>
              <h2 className="text-base font-bold text-white">Authenticated Creator Session</h2>
              <p className="text-xs text-slate-400 mt-1">Logged in as:</p>
              <div className="font-mono text-xs text-red-400 font-semibold bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 inline-block mt-1">
                {user.username}
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 text-left text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Status:</span>
                <span className="text-emerald-400 font-semibold flex items-center">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 mr-1.5 animate-pulse"></span>
                  Active & Connected
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Target Workspace:</span>
                <span className="text-slate-200 font-medium">Official Flow Studio</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleOpenStudio}
              className="w-full bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-red-600/30 transition text-xs flex items-center justify-center space-x-2"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Launch Official Flow Studio ↗</span>
            </button>

            <button
              type="button"
              onClick={handleSignOut}
              className="w-full py-2.5 px-4 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-400 hover:text-slate-200 transition flex items-center justify-center space-x-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="px-5 py-3 border-t border-slate-900 text-center text-[10px] text-slate-500">
        Flow Video Studio &bull; YouTube Automation Suite
      </footer>
    </div>
  );
}
