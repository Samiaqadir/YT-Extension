import QRCode from 'qrcode';

export interface EncryptedBundle {
  iv: string; // base64
  ciphertext: string; // base64
}

export class CryptoService {
  /**
   * Generates a secure random 256-bit AES-GCM key using the browser's Web Crypto API.
   */
  public static async generateAESKey(): Promise<CryptoKey> {
    return await window.crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256,
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Exports an AES-GCM CryptoKey as a base64url string suitable for URL hash fragments and QR codes.
   */
  public static async exportKey(key: CryptoKey): Promise<string> {
    const raw = await window.crypto.subtle.exportKey('raw', key);
    return this.bufferToBase64Url(raw);
  }

  /**
   * Imports an AES-GCM CryptoKey from a base64url string.
   */
  public static async importKey(base64UrlKey: string): Promise<CryptoKey> {
    const buffer = this.base64UrlToBuffer(base64UrlKey);
    return await window.crypto.subtle.importKey(
      'raw',
      buffer,
      {
        name: 'AES-GCM',
      },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypts arbitrary serializable data using AES-GCM with a freshly generated 96-bit (12-byte) IV.
   */
  public static async encrypt(data: any, key: CryptoKey): Promise<string> {
    const jsonStr = JSON.stringify(data);
    const encoded = new TextEncoder().encode(jsonStr);

    // 12-byte IV standard for AES-GCM
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const ciphertext = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      encoded
    );

    const bundle: EncryptedBundle = {
      iv: this.bufferToBase64(iv.buffer),
      ciphertext: this.bufferToBase64(ciphertext),
    };

    return JSON.stringify(bundle);
  }

  /**
   * Decrypts an encrypted bundle using the AES-GCM CryptoKey.
   */
  public static async decrypt<T = any>(encryptedJsonStr: string, key: CryptoKey): Promise<T> {
    const bundle: EncryptedBundle = JSON.parse(encryptedJsonStr);
    const iv = this.base64ToBuffer(bundle.iv);
    const ciphertext = this.base64ToBuffer(bundle.ciphertext);

    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: new Uint8Array(iv),
      },
      key,
      ciphertext
    );

    const decoded = new TextDecoder().decode(decrypted);
    return JSON.parse(decoded) as T;
  }

  /**
   * Generates a high-resolution QR code data URL (PNG) from text.
   */
  public static async generateQR(data: string): Promise<string> {
    return await QRCode.toDataURL(data, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 256,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });
  }

  // --- Utility Buffer Encoders ---
  private static bufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  private static base64ToBuffer(base64: string): ArrayBuffer {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  private static bufferToBase64Url(buffer: ArrayBuffer): string {
    return this.bufferToBase64(buffer)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  private static base64UrlToBuffer(base64Url: string): ArrayBuffer {
    let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    return this.base64ToBuffer(base64);
  }
}
