#!/usr/bin/env node
// Webflow OAuth2 Helper Script
// Run this script to complete the OAuth2 flow and get access token

const readline = require('readline');
const https = require('https');
const querystring = require('querystring');
require('dotenv').config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function getAccessToken() {
  const clientId = process.env.WEBFLOW_CLIENT_ID;
  const clientSecret = process.env.WEBFLOW_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('❌ WEBFLOW_CLIENT_ID and WEBFLOW_CLIENT_SECRET are required in .env file');
    process.exit(1);
  }

  console.log('🚀 Webflow OAuth2 Helper');
  console.log('========================');
  console.log('');
  
  // Step 1: Authorization URL
  const authUrl = `https://webflow.com/oauth/authorize?response_type=code&client_id=${clientId}&scope=sites:read forms:read`;
  
  console.log('Step 1: Visit this URL to authorize the application:');
  console.log(authUrl);
  console.log('');
  
  // Step 2: Get authorization code from user
  const code = await new Promise((resolve) => {
    rl.question('Step 2: After authorization, copy the "code" parameter from the redirect URL and paste it here: ', (answer) => {
      resolve(answer.trim());
    });
  });

  if (!code) {
    console.error('❌ No authorization code provided');
    process.exit(1);
  }

  console.log('');
  console.log('🔄 Exchanging authorization code for access token...');

  try {
    // Step 3: Exchange code for access token
    const tokenData = querystring.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      grant_type: 'authorization_code'
    });

    const tokenResponse = await makeRequest('POST', '/oauth/access_token', tokenData, {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(tokenData)
    });

    const tokenResult = JSON.parse(tokenResponse);

    if (tokenResult.error) {
      console.error('❌ Token exchange failed:', tokenResult.error_description || tokenResult.error);
      process.exit(1);
    }

    console.log('✅ Success! Access token obtained');
    console.log('');
    console.log('📝 Add this to your .env file:');
    console.log(`WEBFLOW_ACCESS_TOKEN="${tokenResult.access_token}"`);
    console.log('');
    console.log('🔍 Token details:');
    console.log('- Access Token:', tokenResult.access_token);
    console.log('- Token Type:', tokenResult.token_type);
    console.log('- Scope:', tokenResult.scope);
    
  } catch (error) {
    console.error('❌ Error during token exchange:', error.message);
    process.exit(1);
  }

  rl.close();
}

function makeRequest(method, path, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.webflow.com',
      port: 443,
      path: path,
      method: method,
      headers: headers
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(responseData);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(data);
    }
    
    req.end();
  });
}

// Run the OAuth flow
getAccessToken().catch((error) => {
  console.error('❌ OAuth flow failed:', error.message);
  process.exit(1);
});