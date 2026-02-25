#!/usr/bin/env node
'use strict';

// Simple API test to check if endpoints exist
const http = require('http');

const PORT = 8100;
const HOST = 'localhost';

function testEndpoint(method, path, description) {
  return new Promise((resolve) => {
    const options = {
      hostname: HOST,
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        console.log(`${description}:`);
        console.log(`  Status: ${res.statusCode}`);
        if (res.statusCode === 401 || res.statusCode === 403) {
          console.log(`  Note: Authentication required (expected)`);
        } else if (res.statusCode >= 400) {
          try {
            const json = JSON.parse(data);
            console.log(`  Error: ${json.error || 'Unknown error'}`);
          } catch {
            console.log(`  Response: ${data.substring(0, 100)}...`);
          }
        }
        console.log();
        resolve({ status: res.statusCode, path });
      });
    });

    req.on('error', (err) => {
      console.log(`${description}:`);
      console.log(`  ERROR: ${err.message}`);
      console.log(`  Note: API server may not be running on port ${PORT}`);
      console.log();
      resolve({ status: 0, path, error: err.message });
    });

    req.end();
  });
}

async function runTests() {
  console.log('Testing File Browser API Endpoints\n');
  console.log('=' .repeat(50));

  const endpoints = [
    { method: 'GET', path: '/files/browse', desc: 'Browse root directory' },
    { method: 'GET', path: '/files/browse?path=/test', desc: 'Browse test directory' },
    { method: 'GET', path: '/storage/locations', desc: 'Get storage locations' },
    { method: 'GET', path: '/storage/usage', desc: 'Get storage usage' },
    { method: 'GET', path: '/files', desc: 'Original files endpoint (backward compat)' },
    { method: 'GET', path: '/health', desc: 'Health check' },
  ];

  const results = [];

  for (const endpoint of endpoints) {
    const result = await testEndpoint(endpoint.method, endpoint.path, endpoint.desc);
    results.push(result);
  }

  console.log('=' .repeat(50));
  console.log('Summary:');

  const successful = results.filter(r => r.status > 0 && r.status !== 401 && r.status !== 403).length;
  const authRequired = results.filter(r => r.status === 401 || r.status === 403).length;
  const failed = results.filter(r => r.status === 0).length;

  console.log(`  Successful connections: ${successful}`);
  console.log(`  Authentication required: ${authRequired} (expected for protected endpoints)`);
  console.log(`  Failed connections: ${failed}`);

  if (failed > 0) {
    console.log('\nNote: Some endpoints failed to connect.');
    console.log('Make sure the API server is running:');
    console.log('  cd /workspace/cacheflow/api');
    console.log('  npm start');
  }
}

runTests();