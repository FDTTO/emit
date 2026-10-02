/*
 * EMIT's console: the kit in console/, told what EMIT's OpenAPI document
 * cannot say. Everything below is about this API; nothing in console/ is.
 */
import { start } from './console/index.js';

start({
  brand: 'EMIT',

  /* Who may call: each security scheme as the reader knows it. A scheme not
     listed here is shown under its own name, never hidden. */
  scopes: {
    bearerAuth: { key: 'admin', label: 'ADMIN', icon: 'shield', color: '#c4a4ec',
                  serves: 'tenant management', grants: 'admin token, tenant management',
                  missing: 'the admin token, returned by Login' },
    apiKeyAuth: { key: 'tenant', label: 'TENANT', icon: 'apiKey', color: '#88cdd5',
                  serves: 'documents', grants: "a tenant's key, its documents",
                  missing: "a tenant's key, returned once when it is created" }
  },

  /* Responses that hand the reader a credential, and the scheme it is for.
     The spec cannot express that LoginResponse.token feeds bearerAuth. */
  credentialSources: [
    { method: 'post', path: '/v1/auth/login', field: 'token',  scheme: 'bearerAuth', noun: 'token', action: 'Log in' },
    { method: 'post', path: '/v1/tenants',    field: 'apiKey', scheme: 'apiKeyAuth', noun: 'key',   action: 'Create a tenant' }
  ],

  /* Where the API says whether it is up. The OpenAPI document does not. */
  healthPath: '/actuator/health',

  /* The document's lifecycle: drawn as a figure and followed after
     generate. The transitions are not in the OpenAPI document; the figure
     is drawn only while the spec still declares these states. Each state
     takes one of the console's kinds (pending, processing, done, failed),
     which is how the console knows what it means. */
  lifecycle: {
    schema: 'DocumentResponse',
    field: 'status',
    subject: 'Document',
    title: 'Document lifecycle',
    result: 'PDF',
    already: 'Already generated',
    /* The state a 409 from generate says the document is already in. */
    conflictState: function (body) {
      const named = /but is ([A-Z]+)/.exec(body.message || '');
      return named ? named[1] : null;
    },
    /* When the request was queued, picked up and finished, on the server's clock. */
    stamps: { queued: 'queuedAt', started: 'startedAt', finished: 'finishedAt' },
    run: [
      { state: 'PENDING', kind: 'pending', caption: 'persisted on create', waiting: 'Queued in Kafka' },
      { via: 'kafka' },
      { state: 'PROCESSING', kind: 'processing', caption: 'worker picked up', waiting: 'Rendering the PDF' },
      { via: 'render' }
    ],
    outcomes: [
      { state: 'DONE', kind: 'done', caption: 'pdf ready', said: 'PDF ready' },
      { state: 'FAILED', kind: 'failed', caption: 'retries exhausted', said: 'Generation failed' }
    ],
    /* The calls that start a run, read its state and collect the result.
       Checked against the spec before anything is followed. */
    follow: {
      start:  { method: 'post', path: '/v1/documents/{id}/generate' },
      read:   { method: 'get',  path: '/v1/documents/{id}' },
      result: { method: 'get',  path: '/v1/documents/{id}/pdf' }
    }
  },

  /* The walkthrough, each step done when the page sees what it leaves
     behind. A document's steps chain: a later one proves the earlier. A
     tenant's schema name is unique, so a run sends a fresh one. */
  journey: [
    { label: 'Log in', method: 'post', path: '/v1/auth/login', done: { held: 'bearerAuth' }, proof: 'token in Authorize' },
    { label: 'Create a tenant', method: 'post', path: '/v1/tenants', done: { held: 'apiKeyAuth' }, proof: 'key in Authorize',
      body: function (stamp) { return { name: 'Journey ' + stamp, schemaName: 'journey_' + stamp }; } },
    { label: 'Create a document', method: 'post', path: '/v1/documents', done: { answered: true }, proof: 'id carried', chain: true },
    { label: 'Generate the PDF', method: 'post', path: '/v1/documents/{id}/generate', done: { run: 'DONE' }, proof: 'pdf ready', chain: true },
    { label: 'Download the PDF', method: 'get', path: '/v1/documents/{id}/pdf', done: { answered: true }, proof: 'downloaded', chain: true }
  ],

  /* Icons for operations, from the last path segment when it names an
     action (verbs only: a resource name would make GET and POST on one path
     collide), otherwise from the resource and whether the call targets the
     collection or one item. */
  actionIcons: { pdf: 'download', generate: 'bolt', login: 'key', deactivate: 'powerOff', reactivate: 'restore' },
  resourceIcons: {
    documents: { list: 'list', item: 'doc', create: 'docPlus' },
    tenants: { list: 'list', item: 'building', create: 'buildingPlus' }
  },

  /* The refusals every guarded route shares, said once instead of per route. */
  sharedRefusals: ['missing-credential', 'invalid-api-key', 'invalid-token',
    'wrong-credential', 'tenant-inactive', 'rate-limited', 'invalid-id'],

  /* The API's own headers lead a result: the id to quote, then the budget. */
  ownHeaders: ['x-request-id', 'ratelimit-limit', 'ratelimit-remaining', 'ratelimit-reset', 'retry-after'],

  failureHint: 'Running locally? The app must be up with the dev profile.'
});
