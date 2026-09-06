const express = require('express');
const http = require('http');
const licenseProxyRoutes = require('../server/routes/licenseProxyRoutes');

const app = express();
app.use(express.json());
app.use('/api/licenses', licenseProxyRoutes);

function request(port, method, path, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: 'localhost',
      port: port,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    }, res => {
      let resBody = '';
      res.on('data', chunk => resBody += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(resBody) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: resBody });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log('=== STARTING LICENSE PROXY TEST SUITE ===\n');
  const server = http.createServer(app);
  const TEST_PORT = 3998;

  await new Promise((resolve) => server.listen(TEST_PORT, resolve));

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, extra = '') {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} - ${extra}`);
      failed++;
    }
  }

  try {
    // 1. Proxy Status & External Health
    const statusRes = await request(TEST_PORT, 'GET', '/api/licenses/status');
    assert(
      statusRes.status === 200 && statusRes.data.proxy_status === 'online',
      '1. Proxy status returns online with external API metadata',
      JSON.stringify(statusRes.data)
    );

    // 2. Fetch all licenses
    const listRes = await request(TEST_PORT, 'GET', '/api/licenses');
    assert(
      listRes.status === 200 && listRes.data.success === true && Array.isArray(listRes.data.licenses),
      '2. Get all licenses via proxy',
      `Status: ${listRes.status}, Total: ${listRes.data?.total_count}`
    );

    // 3. Fetch with filter ?status=Used
    const filteredRes = await request(TEST_PORT, 'GET', '/api/licenses?status=Used');
    assert(
      filteredRes.status === 200 && filteredRes.data.success === true,
      '3. Filter licenses by status (?status=Used)',
      JSON.stringify(filteredRes.data?.licenses?.length)
    );

    // 4. Fetch single license if available
    if (listRes.data?.licenses?.length > 0) {
      const sampleKey = listRes.data.licenses[0].key;
      const singleRes = await request(TEST_PORT, 'GET', `/api/licenses/${encodeURIComponent(sampleKey)}`);
      assert(
        singleRes.status === 200 && singleRes.data.success === true && singleRes.data.license?.key === sampleKey,
        `4. Fetch single license by key (${sampleKey})`,
        JSON.stringify(singleRes.data)
      );

      // 5. Test HWID reset on the sample key
      const resetRes = await request(TEST_PORT, 'POST', '/api/licenses/reset-hwid', { key: sampleKey });
      assert(
        resetRes.status === 200 && resetRes.data.success === true,
        `5. Reset HWID for license (${sampleKey})`,
        JSON.stringify(resetRes.data)
      );
    }

    // 6. Test Create License via Proxy
    const createRes = await request(TEST_PORT, 'POST', '/api/licenses/create', {
      duration: '1 Day',
      note: 'Proxy Automated Verification',
      count: 1
    });
    assert(
      createRes.status === 200 && createRes.data.success === true && Array.isArray(createRes.data.licenses),
      '6. Create new license key via proxy',
      JSON.stringify(createRes.data)
    );

    // 7. Ban a known license key via proxy
    if (listRes.data?.licenses?.length > 0) {
      const targetKey = listRes.data.licenses[0].key;

      const banRes = await request(TEST_PORT, 'POST', '/api/licenses/ban', {
        key: targetKey,
        reason: 'Automated test suite ban'
      });
      assert(
        banRes.status === 200 && banRes.data.success === true,
        `7. Ban license key via proxy (${targetKey})`,
        JSON.stringify(banRes.data)
      );

      // 8. Unban the license key via proxy
      const unbanRes = await request(TEST_PORT, 'POST', '/api/licenses/unban', {
        key: targetKey
      });
      assert(
        unbanRes.status === 200 && unbanRes.data.success === true,
        `8. Unban license key via proxy (${targetKey})`,
        JSON.stringify(unbanRes.data)
      );
    }

    console.log(`\n========================================`);
    console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log(`========================================`);

    server.close();
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test execution error:', err);
    server.close();
    process.exit(1);
  }
}

runTests();
