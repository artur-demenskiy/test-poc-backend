import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';

/**
 * Email job data structure for processing email requests
 * Defines the complete payload for email processing jobs
 */
export interface EmailJobData {
  recipients: string | string[]; // Single or multiple email recipients
  subject: string; // Email subject line
  template: string; // Email template identifier
  context?: Record<string, unknown>; // Template context variables
  attachments?: Array<{
    filename: string; // Attachment filename
    content: string | Uint8Array; // Attachment content
    contentType?: string; // MIME content type
  }>;
  priority?: 'low' | 'normal' | 'high'; // Email processing priority
}

/**
 * Email job execution result
 * Provides detailed information about email processing outcome
 */
export interface EmailJobResult {
  success: boolean; // Overall job success status
  messageId?: string; // Unique message identifier
  error?: string; // Error message if failed
  sentTo: string[]; // Successfully sent email addresses
  template: string; // Template used for email
}

/**
 * Email processing processor for background job queue
 * Handles email composition, rendering, and delivery in background
 *
 * Features:
 * - Priority-based email processing
 * - Template rendering with context
 * - Attachment processing and validation
 * - SMTP delivery simulation
 * - Comprehensive error handling and logging
 * - Performance monitoring and timing
 *
 * Processing Flow:
 * 1. Validate email data and recipients
 * 2. Render email template with context
 * 3. Process attachments if present
 * 4. Simulate SMTP delivery
 * 5. Confirm delivery and generate results
 */
@Processor('email')
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);

  /**
   * Main email processing handler for 'send-email' jobs
   * Orchestrates the complete email sending process
   * @param job - Bull job containing email data
   * @returns Email processing result with success/failure details
   */
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
      // Validate required email fields
      if (!recipients || !subject || !template) {
        throw new Error('Missing required email fields: recipients, subject, template');
      }

      // Normalize recipients to array format
      const recipientsArray = Array.isArray(recipients) ? recipients : [recipients];

      // Process email sending with priority-based timing
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
   * Simulate complete email sending process
   * Processes emails with priority-based delays and error handling
   * @param recipients - Array of email addresses to send to
   * @param subject - Email subject line
   * @param template - Email template identifier
   * @param context - Template context variables
   * @param attachments - Array of email attachments
   * @param priority - Email processing priority level
   * @returns Array of successfully sent email addresses
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

    // Calculate processing delay based on priority
    const delay = this.getDelayByPriority(priority);

    // Process each recipient individually with error isolation
    for (const recipient of recipients) {
      try {
        // Simulate complete email processing pipeline
        await this.simulateEmailProcessing(recipient, subject, template, context, attachments);
        sentEmails.push(recipient);
        this.logger.debug(`Email processed for ${recipient}`);
      } catch (error) {
        // Track failed emails for reporting
        failedEmails.push(recipient);
        this.logger.warn(`Failed to process email for ${recipient}:`, error);
      }

      // Add priority-based delay between email processing
      if (delay > 0) {
        await this.simulateDelay(delay);
      }
    }

    // Log summary of failed emails
    if (failedEmails.length > 0) {
      this.logger.warn(`Failed to send emails to: ${failedEmails.join(', ')}`);
    }

    return sentEmails;
  }

  /**
   * Simulate complete email processing pipeline
   * Executes all steps required for email delivery
   * @param recipient - Email recipient address
   * @param subject - Email subject line
   * @param template - Email template identifier
   * @param context - Template context variables
   * @param attachments - Array of email attachments
   */
  private async simulateEmailProcessing(
    recipient: string,
    subject: string,
    template: string,
    context: Record<string, unknown>,
    attachments: Array<{ filename: string; content: string | Uint8Array; contentType?: string }>
  ): Promise<void> {
    // Step 1: Render email template with context
    await this.simulateTemplateRendering(template, context);

    // Step 2: Process attachments if present
    if (attachments.length > 0) {
      await this.simulateAttachmentProcessing(attachments);
    }

    // Step 3: Send email via SMTP
    await this.simulateSmtpSending(recipient, subject);

    // Step 4: Confirm successful delivery
    await this.simulateDeliveryConfirmation(recipient);
  }

  /**
   * Simulate email template rendering process
   * Processes template with context variables and generates email content
   * @param template - Template identifier to render
   * @param context - Context variables for template rendering
   */
  private async simulateTemplateRendering(
    template: string,
    _context: Record<string, unknown>
  ): Promise<void> {
    // Simulate template processing time (50-150ms)
    await this.simulateDelay(50 + Math.random() * 100);
    this.logger.debug(`Template rendered: ${template}`);
  }

  /**
   * Simulate attachment processing and validation
   * Processes each attachment with content type detection
   * @param attachments - Array of email attachments to process
   */
  private async simulateAttachmentProcessing(
    attachments: Array<{ filename: string; content: string | Uint8Array; contentType?: string }>
  ): Promise<void> {
    for (const attachment of attachments) {
      // Detect content type if not provided
      const contentType = attachment.contentType || this.detectContentType(attachment.filename);

      // Simulate attachment processing time (20-70ms)
      await this.simulateDelay(20 + Math.random() * 50);
      this.logger.debug(`Attachment processed: ${attachment.filename} (${contentType})`);
    }
  }

  /**
   * Simulate SMTP email delivery
   * Represents actual email transmission to recipient
   * @param recipient - Email recipient address
   * @param subject - Email subject line
   */
  private async simulateSmtpSending(recipient: string, subject: string): Promise<void> {
    // Simulate SMTP transmission time (100-300ms)
    await this.simulateDelay(100 + Math.random() * 200);
    this.logger.debug(`Email sent via SMTP to ${recipient}: ${subject}`);
  }

  /**
   * Simulate email delivery confirmation
   * Represents delivery receipt or confirmation
   * @param recipient - Email recipient address
   */
  private async simulateDeliveryConfirmation(recipient: string): Promise<void> {
    // Simulate delivery confirmation time (50-150ms)
    await this.simulateDelay(50 + Math.random() * 100);
    this.logger.debug(`Delivery confirmed for ${recipient}`);
  }

  /**
   * Detect MIME content type from file extension
   * Maps common file extensions to appropriate MIME types
   * @param filename - Filename to analyze
   * @returns MIME content type string
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
   * Get processing delay based on email priority
   * Higher priority emails have shorter delays for faster processing
   * @param priority - Email priority level
   * @returns Delay in milliseconds
   */
  private getDelayByPriority(priority: 'low' | 'normal' | 'high'): number {
    switch (priority) {
      case 'low':
        return 1000; // 1 second delay for low priority
      case 'high':
        return 100; // 100ms delay for high priority
      default:
        return 500; // 500ms delay for normal priority
    }
  }

  /**
   * Simulate processing delay for realistic timing
   * @param ms - Delay duration in milliseconds
   */
  private async simulateDelay(ms: number): Promise<void> {
    return new Promise(resolve => {
      // eslint-disable-next-line no-undef
      setTimeout(resolve, ms);
    });
  }

  /**
   * Generate unique message identifier
   * Creates timestamp-based ID with random suffix for uniqueness
   * @returns Unique message identifier string
   */
  private generateMessageId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `msg_${timestamp}_${random}`;
  }
}
