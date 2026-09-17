/**
 * @fileoverview Tests for LAN advertise helpers (no loopback in QR).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAdvertiseInfo,
  isLoopbackHost,
  isPrivateLanIpv4,
  pickPreferredLanIp,
  validateJoinUrlForQr,
} from './lanAdvertise.js';

describe('lanAdvertise', () => {
  it('rejects loopback hosts', () => {
    assert.equal(isLoopbackHost('localhost'), true);
    assert.equal(isLoopbackHost('127.0.0.1'), true);
    assert.equal(isLoopbackHost('127.1.2.3'), true);
    assert.equal(isLoopbackHost('::1'), true);
    assert.equal(isLoopbackHost('[::1]'), true);
    assert.equal(isLoopbackHost('0.0.0.0'), true);
    assert.equal(isLoopbackHost('192.168.1.10'), false);
  });

  it('classifies private / link-local IPv4', () => {
    assert.equal(isPrivateLanIpv4('10.0.0.1'), true);
    assert.equal(isPrivateLanIpv4('172.16.0.1'), true);
    assert.equal(isPrivateLanIpv4('172.31.255.1'), true);
    assert.equal(isPrivateLanIpv4('172.32.0.1'), false);
    assert.equal(isPrivateLanIpv4('192.168.0.5'), true);
    assert.equal(isPrivateLanIpv4('169.254.1.1'), true);
    assert.equal(isPrivateLanIpv4('8.8.8.8'), false);
    assert.equal(isPrivateLanIpv4('not-an-ip'), false);
  });

  it('prefers private LAN IPs over public', () => {
    assert.equal(
      pickPreferredLanIp(['8.8.8.8', '192.168.0.5']),
      '192.168.0.5',
    );
    assert.equal(pickPreferredLanIp(['127.0.0.1', '10.1.1.1']), '10.1.1.1');
    assert.equal(pickPreferredLanIp(['8.8.8.8']), '8.8.8.8');
    assert.equal(pickPreferredLanIp([]), null);
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

  it('accepts full URL override and strips path/query', () => {
    const info = buildAdvertiseInfo(
      3001,
      ['192.168.1.20'],
      'http://10.0.0.9:4000/join?x=1',
    );
    assert.equal(info.advertiseBase, 'http://10.0.0.9:4000');
    assert.equal(info.usedOverride, true);
  });

  it('fails on invalid override', () => {
    const info = buildAdvertiseInfo(3001, ['192.168.1.20'], 'http://');
    assert.equal(info.advertiseBase, null);
    assert.ok(info.error);
  });

  it('validateJoinUrlForQr refuses loopback and junk', () => {
    assert.match(
      validateJoinUrlForQr('http://localhost:3001') ?? '',
      /loopback/i,
    );
    assert.match(validateJoinUrlForQr('not a url') ?? '', /valid/i);
    assert.equal(
      validateJoinUrlForQr('http://192.168.1.5:3001/?pin=1'),
      null,
    );
  });
});
