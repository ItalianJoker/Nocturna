/**
 * @fileoverview Tests for LAN advertise helpers (no loopback in QR).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAdvertiseInfo,
  isLoopbackHost,
  pickPreferredLanIp,
  validateJoinUrlForQr,
} from './lanAdvertise.js';

describe('lanAdvertise', () => {
  it('rejects loopback hosts', () => {
    assert.equal(isLoopbackHost('localhost'), true);
    assert.equal(isLoopbackHost('127.0.0.1'), true);
    assert.equal(isLoopbackHost('::1'), true);
    assert.equal(isLoopbackHost('192.168.1.10'), false);
  });

  it('prefers private LAN IPs', () => {
    assert.equal(
      pickPreferredLanIp(['8.8.8.8', '192.168.0.5']),
      '192.168.0.5',
    );
  });

  it('builds advertise base with port and never loopback', () => {
    const info = buildAdvertiseInfo(3001, ['192.168.1.20']);
    assert.equal(info.advertiseBase, 'http://192.168.1.20:3001');
    assert.equal(validateJoinUrlForQr(info.advertiseBase!), null);
  });

  it('fails loud when only loopback exists', () => {
    const info = buildAdvertiseInfo(3001, []);
    assert.equal(info.advertiseBase, null);
    assert.ok(info.error);
  });

  it('rejects loopback override', () => {
    const info = buildAdvertiseInfo(3001, ['192.168.1.20'], '127.0.0.1');
    assert.equal(info.advertiseBase, null);
    assert.ok(info.error);
  });

  it('honours non-loopback override and port', () => {
    const info = buildAdvertiseInfo(8080, ['192.168.1.20'], '10.0.0.5');
    assert.equal(info.advertiseBase, 'http://10.0.0.5:8080');
  });
});
