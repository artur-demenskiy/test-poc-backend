import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';

export interface EmailJobData {
  recipients: string | string[];
  subject: string;
  template: string;
  context?: Record<string, unknown>;
  attachments?: Array<{
    filename: string;
    content: string | Uint8Array;
    contentType?: string;
  }>;
  priority?: 'low' | 'normal' | 'high';
}

export interface EmailJobResult {
  success: boolean;
  messageId?: string;
  error?: string;
  sentTo: string[];
  template: string;
}

@Processor('email')
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);

  @Process('send-email')
  async handleEmail(job: Job<EmailJobData>): Promise<EmailJobResult> {
    const startTime = Date.now();
    const {
      recipients,
      subject,
      template,
      context,
      attachments = [],
      priority = 'normal',
    } = job.data;

    this.logger.log(
      `Starting email job to ${Array.isArray(recipients) ? recipients.length : 1} recipients, priority: ${priority}`
    );

    const result: EmailJobResult = {
      success: false,
      sentTo: [],
      template,
    };

    try {
      // Validate email data
      if (!recipients || !subject || !template) {
        throw new Error('Missing required email fields: recipients, subject, template');
      }

      // Convert single recipient to array
      const recipientsArray = Array.isArray(recipients) ? recipients : [recipients];

      // Simulate email sending
      const sentEmails = await this.simulateEmailSending(
        recipientsArray,
        subject,
        template,
        context,
        attachments,
        priority
      );

      result.success = true;
      result.sentTo = sentEmails;
      result.messageId = this.generateMessageId();

      const duration = Date.now() - startTime;
      this.logger.log(
        `Email job completed successfully in ${duration}ms. Sent to: ${sentEmails.join(', ')}`
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.error = errorMessage;
      this.logger.error(`Email job failed:`, error);
    }

    return result;
  }

  /**
   * Simulate email sending process
   */
  private async simulateEmailSending(
    recipients: string[],
    subject: string,
    template: string,
    context: Record<string, unknown>,
    attachments: Array<{ filename: string; content: string | Uint8Array; contentType?: string }>,
    priority: 'low' | 'normal' | 'high'
  ): Promise<string[]> {
    const sentEmails: string[] = [];
    const failedEmails: string[] = [];

    // Process emails based on priority
    const delay = this.getDelayByPriority(priority);

    for (const recipient of recipients) {
      try {
        // Simulate email processing
        await this.simulateEmailProcessing(recipient, subject, template, context, attachments);
        sentEmails.push(recipient);
        this.logger.debug(`Email processed for ${recipient}`);
      } catch (error) {
        failedEmails.push(recipient);
        this.logger.warn(`Failed to process email for ${recipient}:`, error);
      }

      // Add delay between emails
      if (delay > 0) {
        await this.simulateDelay(delay);
      }
    }

    if (failedEmails.length > 0) {
      this.logger.warn(`Failed to send emails to: ${failedEmails.join(', ')}`);
    }

    return sentEmails;
  }

  /**
   * Simulate email processing
   */
  private async simulateEmailProcessing(
    recipient: string,
    subject: string,
    template: string,
    context: Record<string, unknown>,
    attachments: Array<{ filename: string; content: string | Uint8Array; contentType?: string }>
  ): Promise<void> {
    // Simulate template rendering
    await this.simulateTemplateRendering(template, context);

    // Simulate attachment processing
    if (attachments.length > 0) {
      await this.simulateAttachmentProcessing(attachments);
    }

    // Simulate SMTP sending
    await this.simulateSmtpSending(recipient, subject);

    // Simulate delivery confirmation
    await this.simulateDeliveryConfirmation(recipient);
  }

  /**
   * Simulate template rendering
   */
  private async simulateTemplateRendering(
    template: string,
    _context: Record<string, unknown>
  ): Promise<void> {
    await this.simulateDelay(50 + Math.random() * 100);
    this.logger.debug(`Template rendered: ${template}`);
  }

  /**
   * Simulate attachment processing
   */
  private async simulateAttachmentProcessing(
    attachments: Array<{ filename: string; content: string | Uint8Array; contentType?: string }>
  ): Promise<void> {
    for (const attachment of attachments) {
      const contentType = attachment.contentType || this.detectContentType(attachment.filename);
      await this.simulateDelay(20 + Math.random() * 50);
      this.logger.debug(`Attachment processed: ${attachment.filename} (${contentType})`);
    }
  }

  /**
   * Simulate SMTP sending
   */
  private async simulateSmtpSending(recipient: string, subject: string): Promise<void> {
    await this.simulateDelay(100 + Math.random() * 200);
    this.logger.debug(`Email sent via SMTP to ${recipient}: ${subject}`);
  }

  /**
   * Simulate delivery confirmation
   */
  private async simulateDeliveryConfirmation(recipient: string): Promise<void> {
    await this.simulateDelay(50 + Math.random() * 100);
    this.logger.debug(`Delivery confirmed for ${recipient}`);
  }

  /**
   * Detect content type from filename
   */
  private detectContentType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf':
        return 'application/pdf';
      case 'doc':
      case 'docx':
        return 'application/msword';
      case 'xls':
      case 'xlsx':
        return 'application/vnd.ms-excel';
      case 'txt':
        return 'text/plain';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      default:
        return 'application/octet-stream';
    }
  }

  /**
   * Get delay based on priority
   */
  private getDelayByPriority(priority: 'low' | 'normal' | 'high'): number {
    switch (priority) {
      case 'low':
        return 1000;
      case 'high':
        return 100;
      default:
        return 500;
    }
  }

  /**
   * Simulate processing delay
   */
  private async simulateDelay(ms: number): Promise<void> {
    return new Promise(resolve => {
      // eslint-disable-next-line no-undef
      setTimeout(resolve, ms);
    });
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `msg_${timestamp}_${random}`;
  }
}
