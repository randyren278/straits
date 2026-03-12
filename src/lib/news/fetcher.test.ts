import { describe, it, expect } from 'vitest';

describe('News Fetcher', () => {
  describe('fetchNews', () => {
    it.todo('fetches headlines from NewsAPI');
    it.todo('filters headlines by oil/tanker keywords');
    it.todo('filters headlines by Middle East region');
    it.todo('returns max 15 headlines');
  });

  describe('relevance scoring', () => {
    it.todo('assigns higher score to headlines with multiple keywords');
    it.todo('assigns score 0 to headlines with no matching keywords');
  });
});
