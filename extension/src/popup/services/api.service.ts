const API_BASE_URL = 'http://localhost:4000/api/sessions';
const GATEWAY_URL = 'http://localhost:4000/api/gateway';

export interface ShareInvitationParams {
  domain: string;
  delegatedScope: string;
  ownerId?: string;
  ownerLabel?: string;
  recipientEmail?: string;
  recipientPasscode?: string;
  expirationMinutes: number;
  encryptedPayload: string;
}

export interface ShareInvitationResult {
  id: string;
  token: string;
  domain: string;
  delegatedScope: string;
  ownerLabel: string;
  expiresAt: string;
  shareUrl: string;
}

export interface ActiveShareItem {
  id: string;
  owner_id: string;
  owner_label: string;
  domain: string;
  delegated_scope: string;
  recipient_email?: string;
  status: 'active' | 'claimed' | 'revoked' | 'expired';
  expires_at: string;
  created_at: string;
  claimed_at?: string;
  claimed_by?: string;
  revoked_at?: string;
  use_count: number;
  max_uses: number;
}

export interface AuditLogItem {
  id: string;
  invitation_id?: string;
  event_type: string;
  actor_id: string;
  domain: string;
  ip_address?: string;
  timestamp: string;
  details?: string;
}

export class ApiService {
  public static async createShare(params: ShareInvitationParams): Promise<ShareInvitationResult> {
    const res = await fetch(`${API_BASE_URL}/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to create share invitation.');
    }
    return data.invitation;
  }

  public static async getInvitationMetadata(token: string): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/invitation/${encodeURIComponent(token)}`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to retrieve invitation.');
    }
    return data;
  }

  public static async claimInvitation(token: string, recipientId: string, passcode?: string): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, recipientId, passcode }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to claim invitation.');
    }
    return data;
  }

  public static async revokeShare(id: string, actorId: string = 'user_owner_default'): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/revoke/${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actorId }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to revoke invitation.');
    }
  }

  public static async getActiveShares(ownerId: string = 'user_owner_default'): Promise<ActiveShareItem[]> {
    const res = await fetch(`${API_BASE_URL}/active?ownerId=${encodeURIComponent(ownerId)}`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to fetch active shares.');
    }
    return data.shares || [];
  }

  public static async getAuditLogs(ownerId: string = 'user_owner_default'): Promise<AuditLogItem[]> {
    const res = await fetch(`${API_BASE_URL}/audit-log?ownerId=${encodeURIComponent(ownerId)}`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to fetch audit logs.');
    }
    return data.logs || [];
  }

  public static async verifyGateway(token: string): Promise<any> {
    const res = await fetch(`${GATEWAY_URL}/verify?token=${encodeURIComponent(token)}`);
    return await res.json();
  }
}
