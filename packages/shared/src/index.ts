/**
 * @fileoverview Public barrel for `@nocturna/shared`.
 *
 * Shared between the Fastify/Socket.io server and the React client so the
 * night engine, types, and socket contract never drift apart.
 */

export * from './types.js';
export * from './nightScheduler.js';
export * from './nightResolution.js';
export * from './defaultRoles.js';
export * from './winConditions.js';
export * from './sanitize.js';
export * from './socketEvents.js';
