const request = require('supertest');
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = require('../app');

describe('GPT Site Generator End-to-End', () => {
  it('GET / should serve homepage', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toBe(200);
    expect(res.text).toMatch(/GPT Site Generator/);
  });

  it('POST /upload should reject non-image files', async () => {
    const res = await request(app)
      .post('/upload')
      .attach('images', Buffer.from('notanimage'), 'test.txt');
    expect(res.statusCode).toBe(400);
  });

  it('POST /upload should accept image files', async () => {
    const res = await request(app)
      .post('/upload')
      .attach('images', path.join(__dirname, 'fixtures', 'test.png'));
    expect([200, 201]).toContain(res.statusCode);
    expect(res.body.images || res.body.urls).toBeDefined();
  });

  it('POST /api/images/generate-image should require prompt', async () => {
    const res = await request(app)
      .post('/api/images/generate-image')
      .send({});
    expect(res.statusCode).toBe(400);
  });

  // You can add more tests for /generate, error cases, etc.
});
