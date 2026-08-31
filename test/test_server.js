const http = require('http');

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
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
  console.log('=== STARTING AUTOMATED TEST SUITE ===\n');

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
    // 1. Health check
    const health = await request('GET', '/health');
    assert(health.status === 200 && health.data.status === 'online', '1. Health check endpoint responds online');

    // 2. Unified login - Master Admin
    const adminLogin = await request('POST', '/unified/login', { identifier: 'STREAM_MASTER_SEC_2026', password: '' });
    assert(adminLogin.status === 200 && adminLogin.data.role === 'main_admin', '2. Unified login as Master Admin');

    // 3. Unified login - Reseller
    const resellerLogin = await request('POST', '/unified/login', { identifier: 'apex_streamer', password: 'reseller123' });
    assert(resellerLogin.status === 200 && resellerLogin.data.role === 'sub_admin', '3. Unified login as Reseller');

    // 4. Unified login - Fetcher
    const fetcherLogin = await request('POST', '/unified/login', { identifier: 'fetcher_demo', password: 'fetcher123' });
    assert(fetcherLogin.status === 200 && fetcherLogin.data.role === 'fetcher', '4. Unified login as Fetcher');

    // 5. Unified login - Invalid credentials
    const badLogin = await request('POST', '/unified/login', { identifier: 'invalid_user', password: 'wrongpassword' });
    assert(badLogin.status === 403, '5. Unified login rejects invalid credentials with 403');

    // 6. Admin verify
    const adminVerify = await request('POST', '/admin/verify', { admin_key: 'STREAM_MASTER_SEC_2026' });
    assert(adminVerify.status === 200, '6. Admin key verification');

    // 7. Admin list UIDs
    const uids = await request('GET', '/admin/list?admin_key=STREAM_MASTER_SEC_2026');
    assert(uids.status === 200 && Array.isArray(uids.data.licenses), '7. Admin list UIDs returns licenses array');

    // 8. Admin create UID
    const createUID = await request('POST', '/admin/create', {
      admin_key: 'STREAM_MASTER_SEC_2026',
      uid: 'UID-TEST-9999',
      name: 'Test Gladiator',
      days: 30
    });
    assert(createUID.status === 200 && createUID.data.status === 'success', '8. Admin create new UID');

    // 9. Admin update UID
    const updateUID = await request('POST', '/admin/update', {
      admin_key: 'STREAM_MASTER_SEC_2026',
      uid: 'UID-TEST-9999',
      days: 15
    });
    assert(updateUID.status === 200 && updateUID.data.license.days >= 45, '9. Admin renew UID extension');

    // 10. Admin revoke UID
    const revokeUID = await request('POST', '/admin/revoke', {
      admin_key: 'STREAM_MASTER_SEC_2026',
      uid: 'UID-TEST-9999'
    });
    assert(revokeUID.status === 200 && revokeUID.data.status === 'success', '10. Admin revoke UID');

    // 11. Admin create Reseller & give credits
    const createSub = await request('POST', '/admin/create-subadmin', {
      admin_key: 'STREAM_MASTER_SEC_2026',
      username: 'temp_reseller',
      password: 'pass123',
      note: 'Automated test reseller',
      credits: 20
    });
    assert(createSub.status === 200 && createSub.data.subadmin.credits === 20, '11. Admin create sub-admin reseller');

    const giveCredits = await request('POST', '/admin/give-credits', {
      admin_key: 'STREAM_MASTER_SEC_2026',
      username: 'temp_reseller',
      amount: 50
    });
    assert(giveCredits.status === 200 && giveCredits.data.new_credits === 70, '12. Admin give credits to reseller (20+50=70)');

    // 12. Reseller create UID with credit deduction
    const resAddUID = await request('POST', '/subadmin/create', {
      username: 'temp_reseller',
      password: 'pass123',
      uid: 'UID-RESELLER-1111',
      name: 'Reseller Customer',
      days: 30
    });
    assert(resAddUID.status === 200 && resAddUID.data.remaining_credits === 69, '13. Reseller creates UID and deducts 1 credit (70->69)');

    // 13. Reseller revoke owned UID
    const resRevoke = await request('POST', '/subadmin/revoke', {
      username: 'temp_reseller',
      password: 'pass123',
      uid: 'UID-RESELLER-1111'
    });
    assert(resRevoke.status === 200, '14. Reseller revokes owned UID');

    // 14. Admin delete Reseller
    const delSub = await request('POST', '/admin/delete-subadmin', {
      admin_key: 'STREAM_MASTER_SEC_2026',
      username: 'temp_reseller'
    });
    assert(delSub.status === 200, '15. Admin delete reseller');

    // 15. Admin create Fetcher
    const createFet = await request('POST', '/admin/create-fetcher', {
      admin_key: 'STREAM_MASTER_SEC_2026',
      username: 'temp_fetcher',
      password: 'pass123',
      note: 'Test Fetcher',
      permission_days: 15
    });
    assert(createFet.status === 200 && createFet.data.fetcher.permission_days === 15, '16. Admin create fetcher with 15d permission');

    // 16. Fetcher create UID with fixed days
    const fetCreateUID = await request('POST', '/fetcher/create', {
      username: 'temp_fetcher',
      password: 'pass123',
      uid: 'UID-FETCHER-2222',
      name: 'Fetcher Player'
    });
    assert(fetCreateUID.status === 200 && fetCreateUID.data.license.days === 15, '17. Fetcher creates UID with auto 15-day permission');

    // 17. Fetcher revoke UID
    const fetRevoke = await request('POST', '/fetcher/revoke', {
      username: 'temp_fetcher',
      password: 'pass123',
      uid: 'UID-FETCHER-2222'
    });
    assert(fetRevoke.status === 200, '18. Fetcher revokes owned UID');

    // 18. Admin delete Fetcher
    const delFet = await request('POST', '/admin/delete-fetcher', {
      admin_key: 'STREAM_MASTER_SEC_2026',
      username: 'temp_fetcher'
    });
    assert(delFet.status === 200, '19. Admin delete fetcher');

    // 19. Admin DB status diagnostics
    const diag = await request('GET', '/admin/db-status?admin_key=STREAM_MASTER_SEC_2026');
    assert(diag.status === 200 && diag.data.ping === 'ok', '20. Admin database status diagnostic');

    console.log(`\n========================================`);
    console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log(`========================================`);

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runTests();

