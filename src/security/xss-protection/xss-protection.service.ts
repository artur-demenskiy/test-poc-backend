import { Injectable } from '@nestjs/common';

/**
 * HTML sanitization configuration options
 * Defines what HTML elements and attributes are allowed during sanitization
 */
export interface SanitizationOptions {
  allowedTags?: string[]; // HTML tags that are permitted
  allowedAttributes?: Record<string, string[]>; // Attributes allowed per tag
  stripEmpty?: boolean; // Whether to remove empty tags
}

/**
 * XSS Protection Service for Content Security
 *
 * This service provides comprehensive protection against Cross-Site Scripting (XSS) attacks:
 * - HTML content sanitization with configurable allowlists
 * - Plain text sanitization for safe content display
 * - URL validation to prevent protocol-based attacks
 * - Dangerous content pattern detection
 * - Configurable security policies
 *
 * Security Features:
 * - Script tag removal and content filtering
 * - Event handler attribute stripping
 * - JavaScript protocol blocking
 * - Configurable HTML tag and attribute allowlists
 * - Empty tag cleanup and content validation
 *
 * Protection Levels:
 * - HTML: Full HTML sanitization with allowlist approach
 * - Text: Plain text sanitization for maximum security
 * - URL: Protocol validation and dangerous URL blocking
 * - Pattern: Dangerous content pattern detection
 */
@Injectable()
export class XssProtectionService {
  // Default allowed HTML tags for safe content
  private readonly defaultAllowedTags = [
    'b',
    'i',
    'em',
    'strong', // Basic text formatting
    'a',
    'p',
    'br', // Links and paragraphs
    'span',
    'div', // Container elements
    'ul',
    'ol',
    'li', // Lists
  ];

  // Default allowed attributes per HTML tag
  private readonly defaultAllowedAttributes = {
    a: ['href', 'title', 'target'], // Link attributes
    img: ['src', 'alt', 'title'], // Image attributes
    span: ['class'], // Span attributes
    div: ['class'], // Div attributes
  };

  /**
   * Sanitize HTML content to prevent XSS attacks
   * Removes dangerous elements and attributes while preserving safe content
   * @param html - HTML content to sanitize
   * @param options - Sanitization configuration options
   * @returns Sanitized HTML string safe for display
   */
  sanitizeHtml(html: string, options: SanitizationOptions = {}): string {
    if (!html || typeof html !== 'string') {
      return '';
    }

    const allowedTags = options.allowedTags || this.defaultAllowedTags;
    const allowedAttributes = options.allowedAttributes || this.defaultAllowedAttributes;
    const stripEmpty = options.stripEmpty !== false;

    let sanitized = html;

    // Step 1: Remove dangerous script content
    sanitized = this.removeScriptTags(sanitized);
    sanitized = this.removeEventHandlers(sanitized);
    sanitized = this.removeJavaScriptProtocols(sanitized);

    // Step 2: Remove disallowed HTML tags
    sanitized = this.removeDisallowedTags(sanitized, allowedTags);

    // Step 3: Remove disallowed attributes
    sanitized = this.removeDisallowedAttributes(sanitized, allowedAttributes);

    // Step 4: Clean up empty tags if requested
    if (stripEmpty) {
      sanitized = this.removeEmptyTags(sanitized);
    }

    return sanitized.trim();
  }

  /**
   * Sanitize plain text to prevent XSS
   * Removes all HTML-like characters and dangerous patterns
   * @param text - Plain text to sanitize
   * @returns Sanitized text safe for display
   */
  sanitizeText(text: string): string {
    if (!text || typeof text !== 'string') {
      return '';
    }

    return text
      .replace(/[<>]/g, '') // Remove < and > characters
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .trim();
  }

  /**
   * Validate URL to prevent XSS and injection attacks
   * Checks protocol safety and blocks dangerous URLs
   * @param url - URL string to validate
   * @returns True if URL is safe, false if dangerous
   */
  validateUrl(url: string): boolean {
    if (!url || typeof url !== 'string') {
      return false;
    }

    try {
      const parsed = new URL(url);

      // Block dangerous protocols that can execute code
      const dangerousProtocols = ['javascript:', 'data:', 'vbscript:'];
      if (dangerousProtocols.some(protocol => parsed.protocol.toLowerCase().startsWith(protocol))) {
        return false;
      }

      // Allow only safe, standard protocols
      const allowedProtocols = ['http:', 'https:', 'ftp:', 'mailto:', 'tel:'];
      if (!allowedProtocols.includes(parsed.protocol.toLowerCase())) {
        return false;
      }

      return true;
    } catch {
      // Invalid URL format
      return false;
    }
  }

  /**
   * Remove script tags and their content completely
   * Eliminates all script elements that could execute malicious code
   * @param html - HTML content to process
   * @returns HTML with all script tags removed
   */
  private removeScriptTags(html: string): string {
    return html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  }

  /**
   * Remove event handler attributes from HTML
   * Strips onclick, onload, onerror, etc. attributes that could execute code
   * @param html - HTML content to process
   * @returns HTML with event handlers removed
   */
  private removeEventHandlers(html: string): string {
    return html.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  }

  /**
   * Remove javascript: protocol references
   * Blocks javascript: URLs that could execute malicious code
   * @param html - HTML content to process
   * @returns HTML with javascript: protocols removed
   */
  private removeJavaScriptProtocols(html: string): string {
    return html.replace(/javascript:/gi, '');
  }

  /**
   * Remove disallowed HTML tags based on allowlist
   * Filters HTML to only include permitted tags
   * @param html - HTML content to filter
   * @param allowedTags - Array of permitted HTML tag names
   * @returns HTML with only allowed tags preserved
   */
  private removeDisallowedTags(html: string, allowedTags: string[]): string {
    const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;

    return html.replace(tagRegex, (match, tagName) => {
      const lowerTagName = tagName.toLowerCase();
      if (allowedTags.includes(lowerTagName)) {
        return match; // Keep allowed tags
      }
      return ''; // Remove disallowed tags
    });
  }

  /**
   * Remove disallowed HTML attributes based on allowlist
   * Filters attributes to only include permitted ones per tag
   * @param html - HTML content to filter
   * @param allowedAttributes - Object mapping tags to allowed attributes
   * @returns HTML with only allowed attributes preserved
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

      return isAllowed ? match : ''; // Keep allowed attributes, remove disallowed
    });
  }

  /**
   * Remove empty HTML tags from content
   * Cleans up tags with no content for cleaner output
   * @param html - HTML content to clean
   * @returns HTML with empty tags removed
   */
  private removeEmptyTags(html: string): string {
    return html.replace(/<([a-zA-Z][a-zA-Z0-9]*)\s*[^>]*>\s*<\/\1>/g, '');
  }

  /**
   * Check if content contains potentially dangerous patterns
   * Detects common XSS attack vectors and malicious content
   * @param content - Content to analyze for dangerous patterns
   * @returns True if dangerous patterns detected, false if safe
   */
  isPotentiallyDangerous(content: string): boolean {
    if (!content || typeof content !== 'string') {
      return false;
    }

    // Common XSS attack patterns to detect
    const dangerousPatterns = [
      /<script/i, // Script tags
      /javascript:/i, // JavaScript protocol
      /on\w+\s*=/i, // Event handlers
      /data:text\/html/i, // Data URLs with HTML
      /vbscript:/i, // VBScript protocol
      /<iframe/i, // Iframe elements
      /<object/i, // Object elements
      /<embed/i, // Embed elements
    ];

    // Check if any dangerous patterns are found
    return dangerousPatterns.some(pattern => pattern.test(content));
  }
}
