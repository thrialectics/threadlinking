import { describe, it, expect } from 'vitest';
import {
  sanitizeString,
  validateTag,
  validateUrl,
  formatDate,
  truncate,
  parseTags,
  MAX_TAG_LENGTH,
  MAX_SNIPPET_LENGTH,
} from '../src/core/utils.js';

describe('sanitizeString', () => {
  it('should trim whitespace', () => {
    expect(sanitizeString('  hello  ')).toBe('hello');
  });

  it('should preserve tabs and newlines', () => {
    expect(sanitizeString('hello\tworld\ntest')).toBe('hello\tworld\ntest');
  });

  it('should remove null bytes', () => {
    expect(sanitizeString('hello\x00world')).toBe('helloworld');
  });

  it('should remove control characters except tabs and newlines', () => {
    expect(sanitizeString('hello\x01\x02world')).toBe('helloworld');
  });

  it('should truncate to max length', () => {
    const long = 'a'.repeat(100);
    expect(sanitizeString(long, 50)).toBe('a'.repeat(50));
  });

  it('should handle empty string', () => {
    expect(sanitizeString('')).toBe('');
  });
});

describe('validateTag', () => {
  it('should accept valid tags', () => {
    expect(validateTag('myproject')).toBe('myproject');
    expect(validateTag('my-project')).toBe('my-project');
    expect(validateTag('my_project_123')).toBe('my_project_123');
  });

  it('should throw on empty tag', () => {
    expect(() => validateTag('')).toThrow('Tag cannot be empty');
  });

  it('should throw on tag with invalid characters', () => {
    expect(() => validateTag('test<script>')).toThrow('invalid characters');
    expect(() => validateTag('test"quote')).toThrow('invalid characters');
    expect(() => validateTag("test'quote")).toThrow('invalid characters');
    expect(() => validateTag('test&amp')).toThrow('invalid characters');
  });

  it('should throw on tag exceeding max length', () => {
    const longTag = 'a'.repeat(MAX_TAG_LENGTH + 1);
    expect(() => validateTag(longTag)).toThrow('Tag too long');
  });
});

describe('validateUrl', () => {
  it('should accept valid http URLs', () => {
    expect(validateUrl('http://example.com')).toBe('http://example.com/');
    expect(validateUrl('https://example.com/path?query=1')).toBe(
      'https://example.com/path?query=1'
    );
  });

  it('should return empty string for empty input', () => {
    expect(validateUrl('')).toBe('');
  });

  it('should throw on invalid URL', () => {
    expect(() => validateUrl('not-a-url')).toThrow('Invalid URL format');
  });

  it('should throw on non-http(s) schemes', () => {
    expect(() => validateUrl('ftp://example.com')).toThrow('http or https');
    expect(() => validateUrl('file:///etc/passwd')).toThrow('http or https');
    expect(() => validateUrl('javascript:alert(1)')).toThrow('http or https');
  });
});

describe('formatDate', () => {
  it('should format ISO dates', () => {
    const result = formatDate('2026-01-24T15:30:00.000Z');
    expect(result).toBe('2026-01-24 15:30');
  });

  it('should return original string on invalid date', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });
});

describe('truncate', () => {
  it('should not truncate short text', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('should truncate long text with ellipsis', () => {
    expect(truncate('hello world', 8)).toBe('hello...');
  });

  it('should handle exact length', () => {
    expect(truncate('hello', 5)).toBe('hello');
  });
});

describe('parseTags', () => {
  it('should parse comma-separated tags', () => {
    expect(parseTags('auth, api, decision')).toEqual(['auth', 'api', 'decision']);
  });

  it('should lowercase tags', () => {
    expect(parseTags('Auth, API')).toEqual(['auth', 'api']);
  });

  it('should filter empty tags', () => {
    expect(parseTags('auth, , api')).toEqual(['auth', 'api']);
  });

  it('should handle single tag', () => {
    expect(parseTags('auth')).toEqual(['auth']);
  });

  it('should handle empty string', () => {
    expect(parseTags('')).toEqual([]);
  });
});
