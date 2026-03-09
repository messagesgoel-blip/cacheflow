/**
 * Notification Service — abstraction for delivering notifications.
 *
 * Supports multiple channels: in-app (toast), email.
 * Email delivery is stubbed by default - requires SMTP configuration to enable.
 *
 * Gate: SSE-1
 * Task: 6.1@QUOTA-1
 */

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
  error?: string;
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

    // Always try in-app
    if (payload.channels.includes('in-app')) {
      try {
        this.sendInApp(payload);
        deliveredTo.push('in-app');
      } catch (err) {
        console.error('[NotificationService] In-app delivery failed:', err);
      }
    }

    // Try email if requested and configured
    if (payload.channels.includes('email')) {
      const emailResult = await this.sendEmail(payload);
      if (emailResult.success) {
        deliveredTo.push('email');
      }
    }

    return {
      success: deliveredTo.length > 0,
      deliveredTo,
    };
  }

  /**
   * Send in-app notification via custom event.
   */
  private sendInApp(payload: NotificationPayload): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cacheflow:notification', {
        detail: payload,
      }));
    }
    // Also log for server-side visibility
    console.log(`[NotificationService] In-app: [${payload.level}] ${payload.title}: ${payload.message}`);
  }

  /**
   * Send email notification.
   * Stub: logs the notification if SMTP not configured.
   */
  private async sendEmail(payload: NotificationPayload): Promise<{ success: boolean; error?: string }> {
    // Check if email is configured
    if (!this.emailConfig) {
      console.log(`[NotificationService] Email not configured, skipping: ${payload.title}`);
      return {
        success: false,
        error: 'Email not configured',
      };
    }

    // TODO: Implement actual SMTP sending using nodemailer or similar
    // For now, stub: log the email that would be sent
    console.log(`[NotificationService] [STUB] Would send email:`, {
      from: this.emailConfig.fromAddress,
      to: payload.metadata?.email,
      subject: `[CacheFlow] ${payload.title}`,
      body: payload.message,
    });

    return {
      success: false,
      error: 'Email sending not implemented (stub)',
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
    isCritical: boolean
  ): Promise<NotificationResult> {
    const payload: NotificationPayload = {
      id: `quota-${providerName.toLowerCase()}-${Date.now()}`,
      title: isCritical ? 'Storage Critical' : 'Storage Low',
      message: `${providerName} storage at ${percentUsed}% capacity. ${formatBytes(freeSpace)} remaining.`,
      level: isCritical ? 'critical' : 'warning',
      channels: ['in-app', 'email'],
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
// Helper
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
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

export default NotificationService;
