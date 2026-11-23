import crypto from 'crypto';
import jwt from 'jsonwebtoken';
const JWT_SECRET = process.env.JWT_SECRET || 'flow-session-share-super-secret-key-change-in-prod-2025';
export class TokenService {
    /**
     * Generates a cryptographically secure random token (URL-safe base64).
     */
    static generateSecureToken(byteLength = 32) {
        return crypto.randomBytes(byteLength).toString('base64url');
    }
    /**
     * Creates a SHA-256 hash of a token for secure database indexing.
     * Storing hashes prevents database exposure from revealing active tokens.
     */
    static hashToken(token) {
        return crypto.createHash('sha256').update(token).digest('hex');
    }
    /**
     * Hashes a recipient passcode with an optional salt using PBKDF2/SHA-256.
     */
    static hashPasscode(passcode, salt = 'flow-salt') {
        return crypto.pbkdf2Sync(passcode, salt, 10000, 32, 'sha256').toString('hex');
    }
    /**
     * Verifies a passcode against the stored hash.
     */
    static verifyPasscode(inputPasscode, storedHash, salt = 'flow-salt') {
        const computed = this.hashPasscode(inputPasscode, salt);
        return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(storedHash));
    }
    /**
     * Issues a cryptographically signed delegated session token (JWT).
     * Conforms to RFC 8693 token exchange standards for delegated authorization.
     */
    static issueDelegatedSessionToken(payload) {
        return jwt.sign(payload, JWT_SECRET, {
            algorithm: 'HS256',
        });
    }
    /**
     * Verifies and decodes a delegated session token.
     */
    static verifyDelegatedSessionToken(token) {
        try {
            return jwt.verify(token, JWT_SECRET);
        }
        catch {
            return null;
        }
    }
}
