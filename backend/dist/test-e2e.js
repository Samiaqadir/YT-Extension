import { db } from './config/db.js';
import { TokenService } from './services/token.service.js';
import { AuditService } from './services/audit.service.js';
async function runEndToEndTests() {
    console.log('--- STARTING FLOW SESSION SHARE INTEGRATION TESTS ---');
    // 1. Initialize Database
    console.log('[Test 1] Initializing Database...');
    await db.init();
    console.log('✓ Database initialized successfully.');
    // 2. Token Service & Crypto Checks
    console.log('[Test 2] Testing Token Service & Passcode Hashing...');
    const testToken = TokenService.generateSecureToken(32);
    const tokenHash = TokenService.hashToken(testToken);
    if (!testToken || !tokenHash)
        throw new Error('Token generation failed');
    const passcode = '83921';
    const passHash = TokenService.hashPasscode(passcode);
    const passVerified = TokenService.verifyPasscode(passcode, passHash);
    if (!passVerified)
        throw new Error('Passcode verification failed');
    console.log('✓ Token & Passcode cryptography verified.');
    // 3. JWT Delegated Session Token Issuance & Verification
    console.log('[Test 3] Testing Delegated Session Grant JWT...');
    const jwtPayload = {
        grantId: 'grant_123',
        invitationId: 'invite_456',
        domain: 'localhost:4000/demo/app',
        grantorId: 'user_a_owner',
        granteeId: 'user_b_recipient',
        scope: 'read_write',
        exp: Math.floor(Date.now() / 1000) + 1800,
    };
    const jwtToken = TokenService.issueDelegatedSessionToken(jwtPayload);
    const decoded = TokenService.verifyDelegatedSessionToken(jwtToken);
    if (!decoded || decoded.grantId !== 'grant_123')
        throw new Error('JWT verification failed');
    console.log('✓ Delegated Session Token verified.');
    // 4. Test Session Invitation Creation in DB
    console.log('[Test 4] Testing Session Invitation Creation...');
    const inviteId = 'inv_' + Date.now();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    await db.query(`INSERT INTO session_invitations (
      id, owner_id, owner_label, domain, delegated_scope, 
      recipient_email, recipient_passcode_hash, token_hash, 
      encrypted_payload, status, expires_at, max_uses, use_count
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', $10, 1, 0)`, [
        inviteId,
        'user_owner_default',
        'User A (Session Owner)',
        'localhost:4000/demo/app',
        'read_write',
        'userb@example.com',
        passHash,
        tokenHash,
        JSON.stringify({ iv: 'test_iv', ciphertext: 'test_cipher' }),
        expiresAt,
    ]);
    console.log('✓ Session Invitation inserted.');
    // 5. Test Audit Log
    console.log('[Test 5] Recording and querying Audit Trail...');
    await AuditService.log({
        invitationId: inviteId,
        eventType: 'CREATED',
        actorId: 'user_owner_default',
        domain: 'localhost:4000/demo/app',
        details: { test: true },
    });
    const logs = await AuditService.getLogsForOwner('user_owner_default');
    if (logs.length === 0)
        throw new Error('No audit logs returned');
    console.log(`✓ Audit log verified (${logs.length} logs found).`);
    // 6. Test Querying Invitation by Token Hash
    console.log('[Test 6] Querying Invitation by Token Hash...');
    const queryRes = await db.query(`SELECT * FROM session_invitations WHERE token_hash = $1`, [tokenHash]);
    if (queryRes.rows.length === 0)
        throw new Error('Invitation not found by token hash');
    console.log('✓ Invitation metadata retrieved successfully.');
    // 7. Test Claiming Session & Creating Grant
    console.log('[Test 7] Claiming Invitation & Registering Delegated Grant...');
    const grantId = 'grant_' + Date.now();
    await db.query(`UPDATE session_invitations SET status = 'claimed', use_count = 1, claimed_at = $1 WHERE id = $2`, [new Date().toISOString(), inviteId]);
    await db.query(`INSERT INTO delegated_session_grants (
      grant_id, invitation_id, domain, grantee_id, delegated_token, scope, is_valid, expires_at
    ) VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7)`, [grantId, inviteId, 'localhost:4000/demo/app', 'user_b_recipient', jwtToken, 'read_write', expiresAt]);
    console.log('✓ Session claimed and grant registered.');
    // 8. Test Gateway Grant Verification
    console.log('[Test 8] Gateway Grant Verification...');
    const grantRes = await db.query(`SELECT * FROM delegated_session_grants WHERE grant_id = $1 AND is_valid = TRUE`, [grantId]);
    if (grantRes.rows.length === 0)
        throw new Error('Gateway grant verification failed');
    console.log('✓ Active grant verified by gateway.');
    // 9. Test Revocation
    console.log('[Test 9] Testing Instant Session Revocation...');
    await db.query(`UPDATE session_invitations SET status = 'revoked', revoked_at = $1 WHERE id = $2`, [new Date().toISOString(), inviteId]);
    await db.query(`UPDATE delegated_session_grants SET is_valid = FALSE WHERE invitation_id = $1`, [inviteId]);
    const checkRevoked = await db.query(`SELECT is_valid FROM delegated_session_grants WHERE grant_id = $1`, [grantId]);
    if (checkRevoked.rows[0].is_valid)
        throw new Error('Revocation failed: grant still valid');
    console.log('✓ Grant immediately invalidated upon revocation.');
    // 10. Test Managed User Creation & Login
    console.log('[Test 10] Testing Managed User Creation and Login for Extension...');
    const newUserId = 'usr_' + Date.now();
    const testPass = 'mysecretpass2026';
    const userPassHash = TokenService.hashPasscode(testPass);
    await db.query(`INSERT INTO managed_users (id, username, password_hash, role, status)
     VALUES ($1, $2, $3, 'creator', 'active')`, [newUserId, 'admincreateduser@flow.com', userPassHash]);
    const userCheck = await db.query(`SELECT * FROM managed_users WHERE username = $1`, ['admincreateduser@flow.com']);
    if (userCheck.rows.length === 0)
        throw new Error('User creation failed');
    const user = userCheck.rows[0];
    const isPassValid = TokenService.verifyPasscode(testPass, user.password_hash);
    if (!isPassValid)
        throw new Error('Password verification failed for created user');
    console.log('✓ Managed User Creation and Login verified successfully.');
    console.log('\n======================================================');
    console.log('🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY! (10/10)');
    console.log('======================================================');
    process.exit(0);
}
runEndToEndTests().catch((err) => {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
});
