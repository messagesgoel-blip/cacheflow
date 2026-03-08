import { NextRequest, NextResponse } from 'next/server';
import { VaultSessionManager, getVaultById, validateVaultTOTP, validateVaultPIN } from '@/lib/vault/vaultSession';

interface UnlockRequestBody {
  totp_code?: string;
  pin?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: vaultId } = await params;

    // Validate vault ID format
    if (!vaultId || typeof vaultId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid vault ID' },
        { status: 400 }
      );
    }

    // Parse request body
    const body: UnlockRequestBody = await request.json();
    const { totp_code, pin } = body;

    // Validate request - must have either TOTP code or PIN
    if (!totp_code && !pin) {
      return NextResponse.json(
        { error: 'Either TOTP code or PIN must be provided' },
        { status: 400 }
      );
    }

    // Get vault from storage
    const vault = await getVaultById(vaultId);
    if (!vault) {
      return NextResponse.json(
        { error: 'Vault not found' },
        { status: 404 }
      );
    }

    // Verify TOTP or PIN
    let isValid = false;
    if (totp_code) {
      isValid = await validateVaultTOTP(vaultId, totp_code);
    }
    
    if (!isValid && pin) {
      isValid = await validateVaultPIN(vaultId, pin);
    }

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid TOTP code or PIN' },
        { status: 401 }
      );
    }

    // Create a vault session upon successful authentication
    const userId = vault.userId; // Assuming vault has userId associated
    const session = VaultSessionManager.create(vaultId, userId);

    // Return success response with session token
    return NextResponse.json({
      success: true,
      session_token: session.id,
      expires_at: session.expiresAt.toISOString(),
    }, { status: 200 });

  } catch (error) {
    console.error('Error unlocking vault:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

