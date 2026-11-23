-- Flow Session Share - PostgreSQL Database Schema
-- Provides invitation metadata, cryptographic hashes, session delegation states, and audit trails.

-- 1. Invitations Table
CREATE TABLE IF NOT EXISTS session_invitations (
    id VARCHAR(64) PRIMARY KEY,
    owner_id VARCHAR(64) NOT NULL,
    owner_label VARCHAR(128) NOT NULL,
    domain VARCHAR(255) NOT NULL,
    delegated_scope VARCHAR(64) NOT NULL DEFAULT 'read_write',
    recipient_email VARCHAR(255),
    recipient_passcode_hash VARCHAR(128),
    token_hash VARCHAR(128) UNIQUE NOT NULL,
    encrypted_payload TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active', -- 'active', 'claimed', 'revoked', 'expired'
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    claimed_at TIMESTAMP WITH TIME ZONE,
    claimed_by VARCHAR(128),
    revoked_at TIMESTAMP WITH TIME ZONE,
    max_uses INT NOT NULL DEFAULT 1,
    use_count INT NOT NULL DEFAULT 0
);

-- Index on token_hash for rapid single-use lookup
CREATE INDEX IF NOT EXISTS idx_invitations_token_hash ON session_invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_invitations_owner ON session_invitations(owner_id);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON session_invitations(status);
CREATE INDEX IF NOT EXISTS idx_invitations_expires_at ON session_invitations(expires_at);

-- 2. Audit Log Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    invitation_id VARCHAR(64),
    event_type VARCHAR(64) NOT NULL, -- 'CREATED', 'CLAIM_ATTEMPT', 'CLAIMED', 'REVOKED', 'EXPIRED', 'ACCESS_GATEWAY'
    actor_id VARCHAR(128) NOT NULL,
    domain VARCHAR(255) NOT NULL,
    ip_address VARCHAR(64),
    user_agent TEXT,
    details TEXT,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_invitation ON audit_logs(invitation_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp DESC);

-- 3. Delegated Active Grants (Session Gateway Validation Cache)
CREATE TABLE IF NOT EXISTS delegated_session_grants (
    grant_id VARCHAR(64) PRIMARY KEY,
    invitation_id VARCHAR(64) REFERENCES session_invitations(id) ON DELETE CASCADE,
    domain VARCHAR(255) NOT NULL,
    grantee_id VARCHAR(128) NOT NULL,
    delegated_token VARCHAR(512) NOT NULL,
    scope VARCHAR(64) NOT NULL,
    is_valid BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_grants_token ON delegated_session_grants(delegated_token);
CREATE INDEX IF NOT EXISTS idx_grants_domain ON delegated_session_grants(domain);
