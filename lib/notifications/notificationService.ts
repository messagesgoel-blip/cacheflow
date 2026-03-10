/**
 * Notification Service — abstraction for delivering notifications.
 *
 * Supports multiple channels: in-app (toast), email.
 * Email delivery is stubbed by default - requires SMTP configuration to enable.
 *
 * Gate: SSE-1
 * Task: 6.1@QUOTA-1
 */

import { formatBytes } from '../utils/formatBytes';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/ErrorCode';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NotificationChannel = 'in-app' | 'email';

export type NotificationLevel = 'info' | 'warning' | 'error' | 'critical';

export interface NotificationPayload {
  /** Unique identifier for this notification */
  id: string;
  /** Notification title */
  title: string;
  /** Notification body/message */
  message: string;
  /** Severity level */
  level: NotificationLevel;
  /** Which channels to deliver to */
  channels: NotificationChannel[];
  /** Optional metadata/context */
  metadata?: Record<string, unknown>;
  /** Timestamp */
  timestamp: Date;
}

export interface InAppNotificationPayload extends NotificationPayload {
  metadata?: Omit<NotificationMetadata, 'recipientEmail'>;
}

export interface NotificationMetadata {
  userId?: string;
  providerName?: string;
  percentUsed?: number;
  freeSpace?: number;
  isCritical?: boolean;
  recipientEmail?: string;
  [key: string]: unknown;
}

export interface EmailNotificationPayload extends NotificationPayload {
  /** Recipient email address */
  recipientEmail: string;
  /** Plain text body (for email) */
  plainTextBody?: string;
  /** HTML body (for email) */
  htmlBody?: string;
}

export interface NotificationResult {
  success: boolean;
  deliveredTo?: NotificationChannel[];
  error?: AppError;
}

// ---------------------------------------------------------------------------
// Email configuration
// ---------------------------------------------------------------------------

export interface EmailConfig {
  /** SMTP host */
  host?: string;
  /** SMTP port */
  port?: number;
  /** SMTP user */
  user?: string;
  /** SMTP password */
  password?: string;
  /** From address */
  fromAddress: string;
  /** From name */
  fromName?: string;
}

/**
 * Get email configuration from environment.
 * Returns null if email is not configured.
 */
export function getEmailConfig(): EmailConfig | null {
  if (typeof process === 'undefined' || !process.env) {
    return null;
  }

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  const fromAddress = process.env.SMTP_FROM_ADDRESS;

  // If no SMTP config, email is disabled
  if (!host || !fromAddress) {
    return null;
  }

  return {
    host,
    port: port ? parseInt(port, 10) : 587,
    user,
    password,
    fromAddress,
    fromName: process.env.SMTP_FROM_NAME,
  };
}

/**
 * Check if email notifications are enabled.
 */
export function isEmailEnabled(): boolean {
  return getEmailConfig() !== null;
}

// ---------------------------------------------------------------------------
// Notification Service
// ---------------------------------------------------------------------------

class NotificationService {
  private emailConfig: EmailConfig | null = null;

  constructor() {
    this.emailConfig = getEmailConfig();
  }

  /**
   * Send a notification to specified channels.
   *
   * For in-app: Dispatches a custom event that the toast system can listen to.
   * For email: Uses SMTP if configured, otherwise logs and returns success=false.
   */
  async send(payload: NotificationPayload): Promise<NotificationResult> {
    const deliveredTo: NotificationChannel[] = [];
    let lastError: AppError | undefined;

    // Always try in-app
    if (payload.channels.includes('in-app')) {
      try {
        if (this.sendInApp(payload)) {
          deliveredTo.push('in-app');
        }
      } catch (err) {
        console.error('[NotificationService] In-app delivery failed:', err);
        lastError = AppError.fromUnknown(err, ErrorCode.INTERNAL_ERROR);
      }
    }

    // Try email if requested and configured
    if (payload.channels.includes('email')) {
      const emailResult = await this.sendEmail(payload);
      if (emailResult.success) {
        deliveredTo.push('email');
      } else if (emailResult.error) {
        lastError = emailResult.error;
      }
    }

    return {
      success: deliveredTo.length > 0,
      deliveredTo,
      error: deliveredTo.length > 0 ? undefined : lastError,
    };
  }

  /**
   * Send in-app notification via custom event.
   */
  private sendInApp(payload: NotificationPayload): boolean {
    if (typeof window !== 'undefined') {
      const { metadata, ...rest } = payload;
      const safePayload: InAppNotificationPayload = {
        ...rest,
        metadata: this.publicMetadata(metadata as NotificationMetadata | undefined),
      };
      window.dispatchEvent(new CustomEvent('cacheflow:notification', {
        detail: safePayload,
      }));
      return true;
    }
    console.log(`[NotificationService] In-app delivery unavailable outside browser for ${payload.id}`);
    return false;
  }

  /**
   * Send email notification.
   * Stub: logs the notification if SMTP not configured.
   */
  private publicMetadata(metadata?: NotificationMetadata): InAppNotificationPayload['metadata'] {
    if (!metadata) {
      return undefined;
    }

    const { recipientEmail: _recipientEmail, ...publicMetadata } = metadata;
    return publicMetadata;
  }

  private getRecipientEmail(payload: NotificationPayload): string {
    if ('recipientEmail' in payload && typeof payload.recipientEmail === 'string') {
      return payload.recipientEmail.trim();
    }

    const metadata = payload.metadata as NotificationMetadata | undefined;
    return typeof metadata?.recipientEmail === 'string'
      ? metadata.recipientEmail.trim()
      : '';
  }

  private async sendEmail(payload: NotificationPayload): Promise<{ success: boolean; error?: AppError }> {
    const recipientEmail = this.getRecipientEmail(payload);

    if (!recipientEmail) {
      return {
        success: false,
        error: new AppError({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Recipient email is required for email notifications',
        }),
      };
    }

    // Check if email is configured
    if (!this.emailConfig) {
      console.log(`[NotificationService] Email not configured, skipping: ${payload.title}`);
      return {
        success: false,
        error: new AppError({
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Email notifications are not configured',
        }),
      };
    }

    // TODO: Implement actual SMTP sending using nodemailer or similar
    // For now, stub: log non-PII metadata only.
    console.log(`[NotificationService] [STUB] Would send email:`, {
      subject: `[CacheFlow] ${payload.title}`,
      recipient: 'redacted',
    });

    return {
      success: false,
      error: new AppError({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Email sending is not implemented',
      }),
    };
  }

  /**
   * Send a quota alert notification.
   */
  async sendQuotaAlert(
    userId: string,
    providerName: string,
    percentUsed: number,
    freeSpace: number,
    isCritical: boolean,
    recipientEmail?: string
  ): Promise<NotificationResult> {
    const channels: NotificationChannel[] = ['in-app'];
    if (recipientEmail?.trim()) {
      channels.push('email');
    }

    const payload: EmailNotificationPayload = {
      id: `quota-${providerName.toLowerCase()}-${Date.now()}`,
      title: isCritical ? 'Storage Critical' : 'Storage Low',
      message: `${providerName} storage at ${percentUsed}% capacity. ${formatBytes(freeSpace)} remaining.`,
      level: isCritical ? 'critical' : 'warning',
      channels,
      recipientEmail: recipientEmail?.trim() || '',
      metadata: {
        userId,
        providerName,
        percentUsed,
        freeSpace,
        isCritical,
      },
      timestamp: new Date(),
    };

    return this.send(payload);
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let notificationService: NotificationService;

export function getNotificationService(): NotificationService {
  if (!notificationService) {
    notificationService = new NotificationService();
  }
  return notificationService;
}

const notificationServiceSingleton = getNotificationService();

export default notificationServiceSingleton;
