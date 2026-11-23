import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'flow-session-share-super-secret-key-change-in-prod-2025';

export interface DelegatedTokenPayload {
  grantId: string;
  invitationId: string;
  domain: string;
  grantorId: string;
  granteeId: string;
  scope: string;
  exp: number;
}

export class TokenService {
  /**
   * Generates a cryptographically secure random token (URL-safe base64).
   */
  public static generateSecureToken(byteLength: number = 32): string {
    return crypto.randomBytes(byteLength).toString('base64url');
  }

  /**
   * Creates a SHA-256 hash of a token for secure database indexing.
   * Storing hashes prevents database exposure from revealing active tokens.
   */
  public static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Hashes a recipient passcode with an optional salt using PBKDF2/SHA-256.
   */
  public static hashPasscode(passcode: string, salt: string = 'flow-salt'): string {
    return crypto.pbkdf2Sync(passcode, salt, 10000, 32, 'sha256').toString('hex');
  }

  /**
   * Verifies a passcode against the stored hash.
   */
  public static verifyPasscode(inputPasscode: string, storedHash: string, salt: string = 'flow-salt'): boolean {
    const computed = this.hashPasscode(inputPasscode, salt);
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(storedHash));
  }

  /**
   * Issues a cryptographically signed delegated session token (JWT).
   * Conforms to RFC 8693 token exchange standards for delegated authorization.
   */
  public static issueDelegatedSessionToken(payload: DelegatedTokenPayload): string {
    return jwt.sign(payload, JWT_SECRET, {
      algorithm: 'HS256',
    });
  }

  /**
   * Verifies and decodes a delegated session token.
   */
  public static verifyDelegatedSessionToken(token: string): DelegatedTokenPayload | null {
    try {
      return jwt.verify(token, JWT_SECRET) as DelegatedTokenPayload;
    } catch {
      return null;
    }
  }
}
