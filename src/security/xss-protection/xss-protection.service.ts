import { Injectable } from '@nestjs/common';

export interface SanitizationOptions {
  allowedTags?: string[];
  allowedAttributes?: Record<string, string[]>;
  stripEmpty?: boolean;
}

@Injectable()
export class XssProtectionService {
  private readonly defaultAllowedTags = [
    'b',
    'i',
    'em',
    'strong',
    'a',
    'p',
    'br',
    'span',
    'div',
    'ul',
    'ol',
    'li',
  ];

  private readonly defaultAllowedAttributes = {
    a: ['href', 'title', 'target'],
    img: ['src', 'alt', 'title'],
    span: ['class'],
    div: ['class'],
  };

  /**
   * Sanitize HTML content to prevent XSS
   */
  sanitizeHtml(html: string, options: SanitizationOptions = {}): string {
    if (!html || typeof html !== 'string') {
      return '';
    }

    const allowedTags = options.allowedTags || this.defaultAllowedTags;
    const allowedAttributes = options.allowedAttributes || this.defaultAllowedAttributes;
    const stripEmpty = options.stripEmpty !== false;

    let sanitized = html;

    // Remove script tags and event handlers
    sanitized = this.removeScriptTags(sanitized);
    sanitized = this.removeEventHandlers(sanitized);
    sanitized = this.removeJavaScriptProtocols(sanitized);

    // Remove disallowed tags
    sanitized = this.removeDisallowedTags(sanitized, allowedTags);

    // Remove disallowed attributes
    sanitized = this.removeDisallowedAttributes(sanitized, allowedAttributes);

    // Clean up empty tags if requested
    if (stripEmpty) {
      sanitized = this.removeEmptyTags(sanitized);
    }

    return sanitized.trim();
  }

  /**
   * Sanitize plain text to prevent XSS
   */
  sanitizeText(text: string): string {
    if (!text || typeof text !== 'string') {
      return '';
    }

    return text
      .replace(/[<>]/g, '') // Remove < and >
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .trim();
  }

  /**
   * Validate URL to prevent XSS and injection
   */
  validateUrl(url: string): boolean {
    if (!url || typeof url !== 'string') {
      return false;
    }

    try {
      const parsed = new URL(url);

      // Block dangerous protocols
      const dangerousProtocols = ['javascript:', 'data:', 'vbscript:'];
      if (dangerousProtocols.some(protocol => parsed.protocol.toLowerCase().startsWith(protocol))) {
        return false;
      }

      // Allow only http, https, ftp, mailto, tel
      const allowedProtocols = ['http:', 'https:', 'ftp:', 'mailto:', 'tel:'];
      if (!allowedProtocols.includes(parsed.protocol.toLowerCase())) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Remove script tags and their content
   */
  private removeScriptTags(html: string): string {
    return html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  }

  /**
   * Remove event handler attributes
   */
  private removeEventHandlers(html: string): string {
    return html.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  }

  /**
   * Remove javascript: protocols
   */
  private removeJavaScriptProtocols(html: string): string {
    return html.replace(/javascript:/gi, '');
  }

  /**
   * Remove disallowed HTML tags
   */
  private removeDisallowedTags(html: string, allowedTags: string[]): string {
    const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;

    return html.replace(tagRegex, (match, tagName) => {
      const lowerTagName = tagName.toLowerCase();
      if (allowedTags.includes(lowerTagName)) {
        return match;
      }
      return '';
    });
  }

  /**
   * Remove disallowed attributes
   */
  private removeDisallowedAttributes(
    html: string,
    allowedAttributes: Record<string, string[]>
  ): string {
    const attrRegex = /\s+([a-zA-Z][a-zA-Z0-9]*)\s*=\s*["'][^"']*["']/g;

    return html.replace(attrRegex, (match, attrName) => {
      // Check if this attribute is allowed for any tag
      const isAllowed = Object.values(allowedAttributes).some(attrs =>
        attrs.includes(attrName.toLowerCase())
      );

      return isAllowed ? match : '';
    });
  }

  /**
   * Remove empty HTML tags
   */
  private removeEmptyTags(html: string): string {
    return html.replace(/<([a-zA-Z][a-zA-Z0-9]*)\s*[^>]*>\s*<\/\1>/g, '');
  }

  /**
   * Check if content contains potentially dangerous patterns
   */
  isPotentiallyDangerous(content: string): boolean {
    if (!content || typeof content !== 'string') {
      return false;
    }

    const dangerousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /data:text\/html/i,
      /vbscript:/i,
      /<iframe/i,
      /<object/i,
      /<embed/i,
    ];

    return dangerousPatterns.some(pattern => pattern.test(content));
  }
}
