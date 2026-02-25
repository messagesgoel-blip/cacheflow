#!/usr/bin/env node
'use strict';

// Test script for file browser API endpoints
const http = require('http');

const API_URL = process.env.API_URL || 'http://localhost:8100';
const TEST_TOKEN = process.env.TEST_TOKEN || 'test-token';

async function testEndpoint(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 8100,
      path: path,
      method: method,
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          resolve({
            status: res.statusCode,
            data: json
          });
        } catch (err) {
          resolve({
            status: res.statusCode,
            data: data
          });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

async function runTests() {
  console.log('Testing File Browser API Endpoints...\n');

  try {
    // Test 1: Browse root directory
    console.log('1. Testing GET /files/browse...');
    const browseResult = await testEndpoint('GET', '/files/browse');
    console.log(`   Status: ${browseResult.status}`);
    if (browseResult.status === 200) {
      console.log(`   Response has ${browseResult.data.folders?.length || 0} folders`);
      console.log(`   Response has ${browseResult.data.files?.length || 0} files`);
    }
    console.log();

    // Test 2: Create a test folder
    console.log('2. Testing POST /files/folders...');
    const createFolderResult = await testEndpoint('POST', '/files/folders', {
      path: 'test-folder-' + Date.now()
    });
    console.log(`   Status: ${createFolderResult.status}`);
    if (createFolderResult.status === 201) {
      console.log(`   Folder created: ${createFolderResult.data.folder?.path}`);
    }
    console.log();

    // Test 3: Get storage locations
    console.log('3. Testing GET /storage/locations...');
    const locationsResult = await testEndpoint('GET', '/storage/locations');
    console.log(`   Status: ${locationsResult.status}`);
    if (locationsResult.status === 200) {
      console.log(`   Found ${locationsResult.data.locations?.length || 0} storage locations`);
    }
    console.log();

    // Test 4: Get storage usage
    console.log('4. Testing GET /storage/usage...');
    const usageResult = await testEndpoint('GET', '/storage/usage');
    console.log(`   Status: ${usageResult.status}`);
    if (usageResult.status === 200) {
      console.log(`   Quota: ${usageResult.data.quota?.used || 0} / ${usageResult.data.quota?.total || 0} bytes`);
    }
    console.log();

    console.log('All tests completed!');
    console.log('\nNote: Some tests may fail if the API is not running or authentication fails.');
    console.log('To run these tests properly:');
    console.log('1. Start the API server');
    console.log('2. Set TEST_TOKEN environment variable to a valid JWT token');
    console.log('3. Run: node test-file-browser.js');

  } catch (error) {
    console.error('Test failed:', error.message);
    console.log('\nMake sure the API server is running on port 8100');
  }
}

runTests();