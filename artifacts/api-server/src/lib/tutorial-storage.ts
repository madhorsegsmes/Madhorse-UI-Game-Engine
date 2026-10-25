import { Storage } from '@google-cloud/storage';

// Replit App Storage sidecar authentication; no credentials are exposed to clients.
export const tutorialStorage = new Storage({
  credentials: {
    audience: 'replit',
    subject_token_type: 'access_token',
    token_url: 'http://127.0.0.1:1106/token',
    type: 'external_account',
    credential_source: {
      url: 'http://127.0.0.1:1106/credential',
      format: { type: 'json', subject_token_field_name: 'access_token' },
    },
    universe_domain: 'googleapis.com',
  },
  projectId: '',
});
