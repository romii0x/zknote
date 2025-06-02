import { jest } from '@jest/globals';
import { TextEncoder, TextDecoder } from 'util';
import { JSDOM } from 'jsdom';
import { Buffer } from 'buffer';

// Minimal JSDOM setup for global environment
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
global.DOMException = dom.window.DOMException;
global.Event = dom.window.Event;
global.CustomEvent = dom.window.CustomEvent;
global.Buffer = Buffer;

// Jest timeout
jest.setTimeout(10000);

// Minimal env vars
process.env.NODE_ENV = 'test';
process.env.PORT = 3001;
process.env.DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/shoutbin_test';
process.env.LOG_LEVEL = 'error';

// Minimal crypto/fetch mocks if not present
if (typeof global.crypto === 'undefined') {
  global.crypto = {
    getRandomValues: arr => (arr[0] = 42, arr),
    subtle: {
      generateKey: jest.fn(),
      exportKey: jest.fn(),
      importKey: jest.fn(),
      deriveKey: jest.fn(),
      encrypt: jest.fn(),
      decrypt: jest.fn()
    }
  };
}
if (typeof global.fetch === 'undefined') {
  global.fetch = jest.fn();
} 