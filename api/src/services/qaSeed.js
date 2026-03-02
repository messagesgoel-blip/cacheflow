const pool = require('../db/client');
const encryption = require('./encryption');

/**
 * Seed QA user with remotes if QA_SEED_ENABLED or CACHEFLOW_QA_REMOTE_SEED is true
 * This is used for automated E2E testing with real provider mocks
 */
async function seedQARemotes() {
  const seedEnabled = process.env.QA_SEED_ENABLED === 'true';
  const legacySeedEnabled = process.env.CACHEFLOW_QA_REMOTE_SEED === 'true';
  
  if (!seedEnabled && !legacySeedEnabled) return;

  const source = seedEnabled ? 'QA_SEED_ENABLED' : 'CACHEFLOW_QA_REMOTE_SEED';
  
  try {
    // Find sup@goels.in user
    const userResult = await pool.query("SELECT id FROM users WHERE email = 'sup@goels.in'");
    if (userResult.rowCount === 0) {
      console.warn(`[QA] QA user sup@goels.in not found, skipping remote seed (source: ${source})`);
      return;
    }
    const userId = userResult.rows[0].id;
    console.log(`[QA] Seeding remotes for QA user ${userId} (email: sup@goels.in, source: ${source})...`);

    const remotes = [
      {
        provider: 'google',
        accountKey: 'g1',
        accountEmail: 'g1@example.com',
        displayName: 'Google Drive A',
        accessToken: 'google-access-a',
        refreshToken: 'google-refresh-a'
      },
      {
        provider: 'google',
        accountKey: 'g2',
        accountEmail: 'g2@example.com',
        displayName: 'Google Drive B',
        accessToken: 'google-access-b'
      },
      {
        provider: 'dropbox',
        accountKey: 'd1',
        accountEmail: 'd1@example.com',
        displayName: 'Dropbox A',
        accessToken: 'dropbox-access-a'
      },
      {
        provider: 'filen',
        accountKey: 'qa-tester@filen.io',
        accountEmail: 'qa-tester@filen.io',
        displayName: 'QA Mock Drive',
        accessToken: 'mock-qa-token'
      }
    ];

    let seededCount = 0;
    for (const r of remotes) {
      const accessTokenEnc = encryption.encrypt(r.accessToken);
      const refreshTokenEnc = r.refreshToken ? encryption.encrypt(r.refreshToken) : null;

      const result = await pool.query(
        `INSERT INTO user_remotes (
          user_id, provider, account_key, account_email, 
          display_name, access_token_enc, refresh_token_enc, 
          expires_at, key_version, updated_at, disabled
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), FALSE)
        ON CONFLICT (user_id, provider, account_key)
        DO UPDATE SET
          account_email = EXCLUDED.account_email,
          display_name = EXCLUDED.display_name,
          access_token_enc = EXCLUDED.access_token_enc,
          refresh_token_enc = COALESCE(EXCLUDED.refresh_token_enc, user_remotes.refresh_token_enc),
          updated_at = NOW(),
          disabled = FALSE
        RETURNING id`,
        [
          userId, r.provider, r.accountKey, r.accountEmail,
          r.displayName, accessTokenEnc, refreshTokenEnc,
          new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          encryption.KEY_VERSION
        ]
      );
      if (result.rowCount > 0) seededCount++;
    }

    console.log(`[QA] Successfully seeded ${seededCount} remotes for sup@goels.in`);
  } catch (err) {
    console.error('[QA] Failed to seed remotes:', err.message);
  }
}

module.exports = { seedQARemotes };
