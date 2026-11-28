export const DEFAULT_API_BASE = 'https://yt-extension-vercel-admin.vercel.app';

export async function getApiBaseUrl(): Promise<string> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    try {
      const data = await chrome.storage.local.get('flow_api_base');
      if (data.flow_api_base && typeof data.flow_api_base === 'string') {
        return data.flow_api_base.replace(/\/+$/, '');
      }
    } catch (e) {
      console.warn('[Config] Error reading API base URL:', e);
    }
  }
  return DEFAULT_API_BASE;
}

export async function setApiBaseUrl(url: string): Promise<void> {
  const cleanUrl = url.trim().replace(/\/+$/, '');
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await chrome.storage.local.set({ flow_api_base: cleanUrl });
  }
}
