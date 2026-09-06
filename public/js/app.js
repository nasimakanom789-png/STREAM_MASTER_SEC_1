
    // ===== STATE MANAGEMENT =====
    let SESSION = {
      role: null,
      adminKey: null,
      username: null,
      password: null
    };

    let mainUIDsList = [];
    let subUIDsList = [];
    let fetcherUIDsList = [];
    let creditAuditLog = [];
    let activeSubCredits = 0;
    let activeFetcherPermDays = 0;

    let pendingDeleteUID = null;
    let pendingDeleteTier = 'main';
    let pendingQuickCreditUser = null;

    const saveSession = () => {
      try { localStorage.setItem('stream_uid_session_v6', JSON.stringify(SESSION)); } catch (e) {}
    };

    const loadSession = () => {
      try {
        const raw = localStorage.getItem('stream_uid_session_v6');
        if (raw) SESSION = JSON.parse(raw);
      } catch (e) {}
    };

    const clearSession = () => {
      SESSION = { role: null, adminKey: null, username: null, password: null };
      localStorage.removeItem('stream_uid_session_v6');
    };

    const saveLocalAuditLog = () => {
      try { localStorage.setItem('stream_credit_log_v6', JSON.stringify(creditAuditLog)); } catch (e) {}
    };

    const loadLocalAuditLog = () => {
      try {
        const raw = localStorage.getItem('stream_credit_log_v6');
        if (raw) creditAuditLog = JSON.parse(raw);
      } catch (e) {}
    };

    // ===== 3. UI UTILITIES & TOASTS =====
    function notifyToast(message, type = 'ok') {
      const toastEl = document.getElementById('global-toast');
      const iconEl = document.getElementById('toast-icon');
      const msgEl = document.getElementById('toast-message');

      iconEl.textContent = type === 'ok' ? '✓' : '✕';
      msgEl.textContent = message;
      toastEl.style.borderLeftColor = type === 'ok' ? '#2dd4bf' : '#fb4b4b';
      toastEl.classList.add('show');

      setTimeout(() => {
        toastEl.classList.remove('show');
      }, 3500);
    }

    function showInlineMsg(elemId, text, type = 'ok') {
      const el = document.getElementById(elemId);
      if (!el) return;
      el.innerHTML = `<span style="color:${type === 'ok' ? '#2dd4bf' : '#fb4b4b'};">${text}</span>`;
      setTimeout(() => { el.innerHTML = ''; }, 4000);
    }

    function calculateDaysLeft(isoStr) {
      if (!isoStr) return null;
      const diffMs = new Date(isoStr) - Date.now();
      const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      return days < 0 ? 0 : days;
    }

    function renderDaysBadge(days) {
      if (days === null) return '';
      if (days <= 0) return '<span class="days-badge days-crit">EXPIRED</span>';
      if (days <= 3) return `<span class="days-badge days-crit">${days}d Left</span>`;
      if (days <= 7) return `<span class="days-badge days-warn">${days}d Left</span>`;
      return `<span class="days-badge days-safe">${days}d Left</span>`;
    }

    function formatHumanDate(isoStr) {
      if (!isoStr) return '<span style="color:var(--ink-700);">—</span>';
      return new Date(isoStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    function openAppModal(id) {
      document.getElementById(id).classList.add('open');
    }

    function closeAppModal(id) {
      document.getElementById(id).classList.remove('open');
    }

    function togglePassView(inputId, btn) {
      const input = document.getElementById(inputId);
      if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = 'hide';
      } else {
        input.type = 'password';
        btn.textContent = 'show';
      }
    }

    // ===== 4. ONE SINGLE UNIFIED AUTO-DETECTING LOGIN =====
    let LOGIN_DESTINATION = 'default';
    let CURRENT_LOGIN_TIER = 'master';

    function selectLoginTier(tier) {
      CURRENT_LOGIN_TIER = tier;
      document.querySelectorAll('.tier-strip .tier-btn').forEach(btn => btn.classList.remove('active'));
      const activeBtn = document.getElementById('tier-btn-' + tier);
      if (activeBtn) activeBtn.classList.add('active');

      const idInp = document.getElementById('unified-identifier-inp');
      const passInp = document.getElementById('unified-password-inp');
      const btnText = document.getElementById('btn-login-text');
      if (!idInp || !passInp) return;

      if (tier === 'master') {
        LOGIN_DESTINATION = 'default';
        idInp.value = 'RRRPANEL';
        passInp.value = '';
        idInp.placeholder = 'Master Secret Key (e.g. RRRPANEL)';
        passInp.placeholder = 'Optional for Master Key';
        if (btnText) btnText.textContent = 'Access Control Panel';
        notifyToast('Master Key loaded: RRRPANEL');
      } else if (tier === 'reseller') {
        LOGIN_DESTINATION = 'default';
        idInp.value = 'apex_streamer';
        passInp.value = 'reseller123';
        idInp.placeholder = 'Reseller Username (e.g. apex_streamer)';
        passInp.placeholder = 'Reseller Password';
        if (btnText) btnText.textContent = 'Access Control Panel';
        notifyToast('Reseller account loaded: apex_streamer / reseller123');
      } else if (tier === 'fetcher') {
        LOGIN_DESTINATION = 'default';
        idInp.value = 'fetcher_demo';
        passInp.value = 'fetcher123';
        idInp.placeholder = 'Fetcher Username (e.g. fetcher_demo)';
        passInp.placeholder = 'Fetcher Password';
        if (btnText) btnText.textContent = 'Access Control Panel';
        notifyToast('Fetcher account loaded: fetcher_demo / fetcher123');
      } else if (tier === 'api-user') {
        LOGIN_DESTINATION = 'default';
        idInp.value = '';
        passInp.value = '';
        idInp.placeholder = 'API Operator Username';
        passInp.placeholder = 'API Operator Password';
        if (btnText) btnText.textContent = 'Access API Console';
        notifyToast('API User mode: Enter your operator credentials');
      }
      idInp.focus();
    }

    ['unified-identifier-inp', 'unified-password-inp'].forEach(id => {
      document.getElementById(id)?.addEventListener('keyup', e => {
        if (e.key === 'Enter') executeUnifiedLogin();
      });
    });

    async function executeUnifiedLogin() {
      const identifier = document.getElementById('unified-identifier-inp').value.trim();
      const password = document.getElementById('unified-password-inp').value.trim();
      const alertEl = document.getElementById('alert-unified');
      const btn = document.getElementById('btn-unified-login');

      if (!identifier && !password) {
        alertEl.style.display = 'block';
        alertEl.className = 'auth-alert err';
        alertEl.textContent = 'Please enter your username or Master Secret Key';
        return;
      }

      btn.disabled = true;
      btn.innerHTML = '<span>Verifying Credentials...</span>';
      alertEl.style.display = 'none';

      try {
        const res = await fetch('/unified/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier, password, tier: CURRENT_LOGIN_TIER })
        });
        const data = await res.json();

        if (res.ok && data.status === 'success') {
          if (data.role === 'main_admin') {
            SESSION = { role: 'main_admin', adminKey: data.admin_key || identifier || password, username: null, password: null };
            saveSession();
            notifyToast('Master Admin access granted');
            launchWorkspaceView('main_admin');
          } else if (data.role === 'sub_admin') {
            SESSION = { role: 'sub_admin', adminKey: null, username: data.username || identifier, password: password };
            saveSession();
            notifyToast(`Welcome, Reseller ${SESSION.username}`);
            launchWorkspaceView('sub_admin');
          } else if (data.role === 'fetcher') {
            SESSION = { role: 'fetcher', adminKey: null, username: data.username || identifier, password: password };
            saveSession();
            notifyToast(`Welcome, Fetcher ${SESSION.username}`);
            launchWorkspaceView('fetcher');
          } else if (data.role === 'api_user') {
            SESSION = { role: 'api_user', adminKey: null, username: data.username || identifier, password: password };
            saveSession();
            notifyToast(`Welcome, API Operator ${SESSION.username}`);
            launchWorkspaceView('api_user');
          }
        } else {
          alertEl.style.display = 'block';
          alertEl.className = 'auth-alert err';
          alertEl.textContent = '✗ ' + (data.message || 'Invalid username, password, or Master Key');
        }
      } catch (err) {
        alertEl.style.display = 'block';
        alertEl.className = 'auth-alert err';
        alertEl.textContent = '✗ Connection error: Could not reach the server';
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>Access Control Panel</span>';
      }
    }

    // ===== 5. WORKSPACE LAUNCHER & ROLE ROUTING =====
    function launchWorkspaceView(role) {
      document.getElementById('auth-gate').style.display = 'none';
      document.getElementById('app-workspace').style.display = 'block';

      const masterPanel = document.getElementById('master-admin-panel');
      const subPanel = document.getElementById('subadmin-panel');
      const fetcherPanel = document.getElementById('fetcher-panel');

      const navResellers = document.getElementById('nav-btn-resellers');
      const navFetchers = document.getElementById('nav-btn-fetchers');
      const navCredit = document.getElementById('nav-btn-credit');
      const navSettings = document.getElementById('nav-btn-settings');
      const navUidsBtn = document.getElementById('nav-btn-uids');

      const userDisplayName = document.getElementById('user-display-name');
      const userDisplayRole = document.getElementById('user-display-role');
      const userAvatarIcon = document.getElementById('user-avatar-icon');
      const userCreditsTag = document.getElementById('user-display-credits');

      if (role === 'main_admin') {
        masterPanel.classList.add('active');
        subPanel.classList.remove('active');
        fetcherPanel.classList.remove('active');

        if (navUidsBtn) navUidsBtn.style.display = 'flex';
        navResellers.style.display = 'flex';
        navFetchers.style.display = 'flex';
        navCredit.style.display = 'flex';
        if (navSettings) navSettings.style.display = 'flex';
        const navApiUsers = document.getElementById('nav-btn-api-users');
        if (navApiUsers) navApiUsers.style.display = 'flex';
        const navApi = document.getElementById('nav-btn-api');
        if (navApi) navApi.style.display = 'flex';

        userDisplayName.textContent = 'ADMINISTRATOR';
        userDisplayRole.textContent = 'MASTER ADMIN';
        userAvatarIcon.textContent = 'A';
        userCreditsTag.style.display = 'none';

        if (LOGIN_DESTINATION === 'api') {
          navigateTab('api');
        } else {
          navigateTab('uids');
        }
        mainFetchUIDs();
        loadResellersAction();
        loadFetchersAction();
        loadLocalAuditLog();
        renderCreditLogView();
      } else if (role === 'sub_admin') {
        subPanel.classList.add('active');
        masterPanel.classList.remove('active');
        fetcherPanel.classList.remove('active');

        navResellers.style.display = 'none';
        navFetchers.style.display = 'none';
        navCredit.style.display = 'none';
        navSettings.style.display = 'none';
        const navApi = document.getElementById('nav-btn-api');
        if (navApi) navApi.style.display = 'none';
        const navApiUsers = document.getElementById('nav-btn-api-users');
        if (navApiUsers) navApiUsers.style.display = 'none';

        userDisplayName.textContent = SESSION.username.toUpperCase();
        userDisplayRole.textContent = 'RESELLER';
        userAvatarIcon.textContent = (SESSION.username[0] || 'R').toUpperCase();
        userCreditsTag.style.display = 'block';

        subFetchCredits();
        subFetchUIDs();
      } else if (role === 'fetcher') {
        fetcherPanel.classList.add('active');
        masterPanel.classList.remove('active');
        subPanel.classList.remove('active');

        navResellers.style.display = 'none';
        navFetchers.style.display = 'none';
        navCredit.style.display = 'none';
        if (navSettings) navSettings.style.display = 'none';
        const navApiFetcher = document.getElementById('nav-btn-api');
        if (navApiFetcher) navApiFetcher.style.display = 'none';
        const navApiUsersFetcher = document.getElementById('nav-btn-api-users');
        if (navApiUsersFetcher) navApiUsersFetcher.style.display = 'none';

        userDisplayName.textContent = SESSION.username.toUpperCase();
        userDisplayRole.textContent = 'FETCHER';
        userAvatarIcon.textContent = (SESSION.username[0] || 'F').toUpperCase();
        userCreditsTag.style.display = 'block';

        fetcherFetchPermission();
        fetcherFetchUIDs();
      } else if (role === 'api_user') {
        // API User sees ONLY the API Console panel (inside master-admin-panel)
        masterPanel.classList.add('active');
        subPanel.classList.remove('active');
        fetcherPanel.classList.remove('active');

        // Hide all nav buttons except API Console
        navResellers.style.display = 'none';
        navFetchers.style.display = 'none';
        navCredit.style.display = 'none';
        if (navSettings) navSettings.style.display = 'none';
        const navUids = document.getElementById('nav-btn-uids');
        if (navUids) navUids.style.display = 'none';
        const navApiUsers = document.getElementById('nav-btn-api-users');
        if (navApiUsers) navApiUsers.style.display = 'none';
        const navApiBtn = document.getElementById('nav-btn-api');
        if (navApiBtn) navApiBtn.style.display = 'flex';

        userDisplayName.textContent = SESSION.username.toUpperCase();
        userDisplayRole.textContent = 'API OPERATOR';
        userAvatarIcon.textContent = (SESSION.username[0] || 'U').toUpperCase();
        userCreditsTag.style.display = 'none';

        navigateTab('api');
        loadApiConsoleData();
      }
    }

    function navigateTab(tabName) {
      document.querySelectorAll('.nav-btn[id^="nav-btn-"]').forEach(btn => btn.classList.remove('active'));
      const activeNav = document.getElementById('nav-btn-' + tabName);
      if (activeNav) activeNav.classList.add('active');

      document.querySelectorAll('#master-admin-panel .panel-view-tab').forEach(tab => tab.classList.remove('active'));
      const activeView = document.getElementById('view-tab-' + tabName);
      if (activeView) activeView.classList.add('active');

      if (tabName === 'resellers') loadResellersAction();
      if (tabName === 'fetchers') loadFetchersAction();
      if (tabName === 'credit') { loadResellersAction(); renderCreditLogView(); }
      if (tabName === 'api') loadApiConsoleData();
      if (tabName === 'api-users') loadApiUsersAction();
    }

    function executeLogout() {
      clearSession();
      document.getElementById('app-workspace').style.display = 'none';
      document.getElementById('auth-gate').style.display = 'flex';
      notifyToast('Logged out successfully');
    }

    // ===== 6. TABLE ROW BUILDER =====
    function buildUIDTableRow(item, tier) {
      const uid = item.uid || item.id || item.user_id || '?';
      const name = item.name || item.username || item.player || 'Player';
      const days = item.days !== undefined ? item.days : '—';
      const expiresAt = item.expires_at || item.expiry || item.expire || null;

      const remainingDays = calculateDaysLeft(expiresAt);
      let statusBadge = '<span class="status-badge badge-green">Active</span>';

      if (remainingDays !== null) {
        if (remainingDays <= 0) statusBadge = '<span class="status-badge badge-red">Expired</span>';
        else if (remainingDays <= 7) statusBadge = '<span class="status-badge badge-amber">Expiring</span>';
      }

      return `
        <tr>
          <td>
            <span class="mono-uid">${uid}</span>
            <button class="copy-pill-btn" onclick="navigator.clipboard.writeText('${uid}'); notifyToast('UID copied to clipboard');">Copy</button>
          </td>
          <td style="font-weight:600; color:var(--ink-100);">${name}</td>
          <td style="font-family:var(--f-mono); font-size:11.5px; color:var(--ink-500);">${days}d</td>
          <td>${statusBadge}</td>
          <td style="font-family:var(--f-mono); font-size:11.5px; color:var(--ink-500);">${formatHumanDate(expiresAt)}</td>
          <td>${renderDaysBadge(remainingDays)}</td>
          <td>
            <button class="btn-sm-action btn-sm-red" onclick="triggerDeleteModal('${uid}', '${tier}')">Revoke</button>
          </td>
        </tr>
      `;
    }

    function updateStatsCards(uids, totalId, activeId, expiredId, soonId) {
      let activeCount = 0, expiredCount = 0, soonCount = 0;
      uids.forEach(u => {
        const exp = u.expires_at || u.expiry || u.expire || null;
        if (exp) {
          const d = calculateDaysLeft(exp);
          if (d <= 0) expiredCount++;
          else if (d <= 7) soonCount++;
          else activeCount++;
        } else {
          activeCount++;
        }
      });

      const elTotal = document.getElementById(totalId);
      const elActive = document.getElementById(activeId);
      const elExpired = document.getElementById(expiredId);
      const elSoon = soonId ? document.getElementById(soonId) : null;

      if (elTotal) elTotal.textContent = uids.length;
      if (elActive) elActive.textContent = activeCount;
      if (elExpired) elExpired.textContent = expiredCount;
      if (elSoon) elSoon.textContent = soonCount;
    }

    // ===== 7. MASTER ADMIN LOGIC =====
    async function mainFetchUIDs() {
      const tbody = document.getElementById('m-tbody-uids');
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--ink-500); padding:36px;">Refreshing UID Vault...</td></tr>';

      try {
        const res = await fetch('/admin/list?admin_key=' + encodeURIComponent(SESSION.adminKey));
        const data = await res.json();

        if (res.ok) {
          mainUIDsList = data.licenses || [];
          renderMainUIDsTable(mainUIDsList);
          updateStatsCards(mainUIDsList, 'm-stat-total', 'm-stat-active', 'm-stat-expired', 'm-stat-expiring');
        } else {
          tbody.innerHTML = `<tr><td colspan="7" style="color:#fb4b4b; text-align:center; padding:30px;">Error: ${data.message}</td></tr>`;
        }
      } catch (err) {
        tbody.innerHTML = '<tr><td colspan="7" style="color:#fb4b4b; text-align:center; padding:30px;">Failed to connect to backend</td></tr>';
      }
    }

    function renderMainUIDsTable(uids) {
      const tbody = document.getElementById('m-tbody-uids');
      if (!uids.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--ink-700); padding:40px;">No UIDs found</td></tr>';
        return;
      }
      tbody.innerHTML = uids.map(u => buildUIDTableRow(u, 'main')).join('');
    }

    document.getElementById('m-search-box')?.addEventListener('input', e => {
      const q = e.target.value.toLowerCase();
      const filtered = mainUIDsList.filter(u =>
        (u.uid || '').toLowerCase().includes(q) ||
        (u.name || '').toLowerCase().includes(q)
      );
      renderMainUIDsTable(filtered);
    });

    async function mainCreateUID() {
      const uid = document.getElementById('m-inp-uid').value.trim();
      const name = document.getElementById('m-inp-name').value.trim() || 'Player';
      const days = parseInt(document.getElementById('m-sel-days').value) || 30;

      if (!uid) {
        notifyToast('UID is required', 'err');
        showInlineMsg('msg-m-create', '✗ UID is required', 'err');
        return;
      }

      try {
        const res = await fetch('/admin/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ admin_key: SESSION.adminKey, uid, name, days })
        });
        const data = await res.json();

        if (res.ok) {
          notifyToast(`UID ${uid} activated`);
          showInlineMsg('msg-m-create', `✓ UID ${uid} activated successfully`, 'ok');
          document.getElementById('m-inp-uid').value = '';
          document.getElementById('m-inp-name').value = '';
          mainFetchUIDs();
        } else {
          notifyToast(data.message || 'Create failed', 'err');
          showInlineMsg('msg-m-create', '✗ ' + (data.message || 'API error'), 'err');
        }
      } catch (err) {
        showInlineMsg('msg-m-create', '✗ Connection error', 'err');
      }
    }

    async function mainCreateUID24() {
      const uid = document.getElementById('m-inp-uid').value.trim();
      const name = document.getElementById('m-inp-name').value.trim() || 'Player';

      if (!uid) {
        notifyToast('UID is required', 'err');
        showInlineMsg('msg-m-create', '✗ UID is required', 'err');
        return;
      }

      try {
        const res = await fetch('/admin/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ admin_key: SESSION.adminKey, uid, name, days: 1, hours: 24, duration_hours: 24 })
        });
        const data = await res.json();

        if (res.ok) {
          notifyToast(`24-Hour UID ${uid} activated`);
          showInlineMsg('msg-m-create', `✓ 24-Hour UID activated`, 'ok');
          document.getElementById('m-inp-uid').value = '';
          document.getElementById('m-inp-name').value = '';
          mainFetchUIDs();
        } else {
          notifyToast(data.message || 'Create failed', 'err');
        }
      } catch (err) {
        showInlineMsg('msg-m-create', '✗ Connection error', 'err');
      }
    }

    async function mainRenewUID() {
      const uid = document.getElementById('m-inp-renew-uid').value.trim();
      const days = parseInt(document.getElementById('m-sel-renew-days').value) || 30;

      if (!uid) {
        notifyToast('Please enter a UID to renew', 'err');
        return;
      }

      try {
        const res = await fetch('/admin/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ admin_key: SESSION.adminKey, uid, days })
        });
        const data = await res.json();

        if (res.ok) {
          notifyToast(`Renewed ${uid} by +${days} days`);
          showInlineMsg('msg-m-manage', `✓ UID extended +${days} days`, 'ok');
          document.getElementById('m-inp-renew-uid').value = '';
          mainFetchUIDs();
        } else {
          notifyToast(data.message || 'Renewal failed', 'err');
        }
      } catch (err) {
        showInlineMsg('msg-m-manage', '✗ Connection error', 'err');
      }
    }

    function mainTriggerRemove() {
      const uid = document.getElementById('m-inp-rm-uid').value.trim();
      if (!uid) {
        notifyToast('Please enter a UID to remove', 'err');
        return;
      }
      triggerDeleteModal(uid, 'main');
    }

    // ===== 8. RESELLER & CREDIT MANAGEMENT LOGIC =====
    async function createResellerAction() {
      const u = document.getElementById('res-new-user').value.trim();
      const p = document.getElementById('res-new-pass').value.trim();
      const note = document.getElementById('res-new-note').value.trim();
      const initialCredits = parseInt(document.getElementById('res-new-credits').value) || 0;

      if (!u || !p) {
        notifyToast('Username and Password required', 'err');
        showInlineMsg('msg-res-create', '✗ Username & Password required', 'err');
        return;
      }

      try {
        const res = await fetch('/admin/create-subadmin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ admin_key: SESSION.adminKey, username: u, password: p, note, credits: initialCredits })
        });
        const data = await res.json();

        if (res.ok) {
          notifyToast(`Reseller '${u}' created`);
          showInlineMsg('msg-res-create', `✓ Reseller account '${u}' created`, 'ok');
          document.getElementById('res-new-user').value = '';
          document.getElementById('res-new-pass').value = '';
          document.getElementById('res-new-note').value = '';
          document.getElementById('res-new-credits').value = '0';
          loadResellersAction();
        } else {
          showInlineMsg('msg-res-create', '✗ ' + (data.message || 'Error creating reseller'), 'err');
        }
      } catch (err) {
        showInlineMsg('msg-res-create', '✗ Connection error', 'err');
      }
    }

    async function loadResellersAction() {
      const tbody = document.getElementById('m-tbody-resellers');
      if (!tbody) return;
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--ink-500); padding:24px;">Loading Resellers...</td></tr>';

      try {
        const res = await fetch('/admin/list-subadmins?admin_key=' + encodeURIComponent(SESSION.adminKey));
        const data = await res.json();

        if (res.ok && data.subadmins) {
          const list = data.subadmins;
          if (!list.length) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--ink-700); padding:24px;">No Resellers found</td></tr>';
            return;
          }

          tbody.innerHTML = list.map(s => `
            <tr>
              <td><span class="status-badge badge-green">${s.username}</span></td>
              <td style="color:var(--ink-500); font-size:11.5px;">${s.note || '—'}</td>
              <td><span class="status-badge badge-blue">${s.credits || 0} Credits</span></td>
              <td>
                <button class="btn-sm-action btn-sm-blue" style="margin-right:6px;" onclick="openQuickCreditDialog('${s.username}')">+ Credit</button>
                <button class="btn-sm-action btn-sm-red" onclick="deleteResellerAction('${s.username}')">Delete</button>
              </td>
            </tr>
          `).join('');

          const totalCredits = list.reduce((acc, curr) => acc + (curr.credits || 0), 0);
          document.getElementById('cs-stat-resellers').textContent = list.length;
          document.getElementById('cs-stat-credits').textContent = totalCredits;

          populateResellerDropdowns(list);
        }
      } catch (err) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#fb4b4b;">Connection error</td></tr>';
      }
    }

    function populateResellerDropdowns(list) {
      const sel = document.getElementById('res-credit-sel');
      if (!sel) return;
      sel.innerHTML = '<option value="">— Select Reseller —</option>';
      list.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.username;
        opt.textContent = `${s.username} (${s.credits || 0})`;
        sel.appendChild(opt);
      });
    }

    function syncCreditSel() {
      const val = document.getElementById('res-credit-sel').value;
      if (val) document.getElementById('res-credit-user-inp').value = val;
    }

    function setCreditInput(val) {
      document.getElementById('res-credit-amount-inp').value = val;
    }

    async function giveCreditsAction() {
      const selVal = document.getElementById('res-credit-sel').value;
      const username = document.getElementById('res-credit-user-inp').value.trim() || selVal;
      const amount = parseInt(document.getElementById('res-credit-amount-inp').value);

      if (!username) {
        notifyToast('Please select or input a reseller', 'err');
        return;
      }
      if (!amount || amount < 1) {
        notifyToast('Please enter a valid credit amount', 'err');
        return;
      }

      try {
        const res = await fetch('/admin/give-credits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ admin_key: SESSION.adminKey, username, amount })
        });
        const data = await res.json();

        if (res.ok) {
          notifyToast(`+${amount} Credits added to ${username}`);
          showInlineMsg('msg-res-credit', `✓ Added +${amount} credits to ${username}`, 'ok');
          recordAuditLog(username, amount, data.new_credits || '?', 'Admin Manual Top-Up');
          loadResellersAction();
          renderCreditLogView();
        } else {
          showInlineMsg('msg-res-credit', '✗ ' + (data.message || 'Credit transfer failed'), 'err');
        }
      } catch (err) {
        showInlineMsg('msg-res-credit', '✗ Connection error', 'err');
      }
    }

    async function deleteResellerAction(uname) {
      if (!confirm(`Are you sure you want to delete reseller '${uname}'?`)) return;
      try {
        const res = await fetch('/admin/delete-subadmin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ admin_key: SESSION.adminKey, username: uname })
        });
        if (res.ok) {
          notifyToast(`Reseller '${uname}' deleted`);
          loadResellersAction();
        } else {
          const d = await res.json();
          notifyToast(d.message || 'Delete failed', 'err');
        }
      } catch (err) {
        notifyToast('Connection error', 'err');
      }
    }

    // ===== 9. FETCHER MANAGEMENT LOGIC (MASTER ADMIN SIDE) =====
    async function createFetcherAction() {
      const u = document.getElementById('fet-new-user').value.trim();
      const p = document.getElementById('fet-new-pass').value.trim();
      const note = document.getElementById('fet-new-note').value.trim();
      const days = parseInt(document.getElementById('fet-new-days').value) || 30;

      if (!u || !p) {
        notifyToast('Username and Password required', 'err');
        showInlineMsg('msg-fet-create', '✗ Fill username & password', 'err');
        return;
      }

      try {
        const res = await fetch('/admin/create-fetcher', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ admin_key: SESSION.adminKey, username: u, password: p, note, permission_days: days })
        });
        const data = await res.json();

        if (res.ok) {
          notifyToast(`Fetcher '${u}' created (${days}d permission)`);
          showInlineMsg('msg-fet-create', `✓ Fetcher '${u}' created`, 'ok');
          document.getElementById('fet-new-user').value = '';
          document.getElementById('fet-new-pass').value = '';
          document.getElementById('fet-new-note').value = '';
          loadFetchersAction();
        } else {
          showInlineMsg('msg-fet-create', '✗ ' + (data.message || 'Error creating fetcher'), 'err');
        }
      } catch (err) {
        showInlineMsg('msg-fet-create', '✗ Connection error', 'err');
      }
    }

    async function loadFetchersAction() {
      const tbody = document.getElementById('m-tbody-fetchers');
      if (!tbody) return;
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--ink-500); padding:24px;">Loading Fetchers...</td></tr>';

      try {
        const res = await fetch('/admin/list-fetchers?admin_key=' + encodeURIComponent(SESSION.adminKey));
        const data = await res.json();

        if (res.ok && data.fetchers) {
          const list = data.fetchers;
          if (!list.length) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--ink-700); padding:24px;">No Fetchers found</td></tr>';
            return;
          }

          tbody.innerHTML = list.map(f => `
            <tr>
              <td><span class="status-badge badge-purple">${f.username}</span></td>
              <td style="color:var(--ink-500); font-size:11.5px;">${f.note || '—'}</td>
              <td><span class="status-badge badge-blue">${f.permission_days || 0} Days / UID</span></td>
              <td>
                <button class="btn-sm-action btn-sm-purple" style="margin-right:6px;" onclick="selectFetcherForUpdate('${f.username}', ${f.permission_days || 30})">Select</button>
                <button class="btn-sm-action btn-sm-red" onclick="deleteFetcherAction('${f.username}')">Delete</button>
              </td>
            </tr>
          `).join('');

          populateFetcherDropdowns(list);
        }
      } catch (err) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#fb4b4b;">Connection error</td></tr>';
      }
    }

    function populateFetcherDropdowns(list) {
      const sel = document.getElementById('fet-update-sel');
      if (!sel) return;
      sel.innerHTML = '<option value="">— Select Fetcher —</option>';
      list.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.username;
        opt.textContent = `${f.username} (${f.permission_days || 0}d)`;
        sel.appendChild(opt);
      });
    }

    function selectFetcherForUpdate(uname, days) {
      document.getElementById('fet-update-user-inp').value = uname;
      document.getElementById('fet-update-sel').value = uname;
      document.getElementById('fet-update-days').value = days;
    }

    function syncFetcherSel() {
      const val = document.getElementById('fet-update-sel').value;
      if (val) document.getElementById('fet-update-user-inp').value = val;
    }

    async function updateFetcherPermAction() {
      const selVal = document.getElementById('fet-update-sel').value;
      const username = document.getElementById('fet-update-user-inp').value.trim() || selVal;
      const days = parseInt(document.getElementById('fet-update-days').value);

      if (!username) {
        notifyToast('Please select or input a fetcher', 'err');
        return;
      }
      if (!days || days < 1) {
        notifyToast('Please enter a valid day count', 'err');
        return;
      }

      try {
        const res = await fetch('/admin/update-fetcher-permission', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ admin_key: SESSION.adminKey, username, permission_days: days })
        });
        const data = await res.json();

        if (res.ok) {
          notifyToast(`Updated ${username} permission to ${days} days`);
          showInlineMsg('msg-fet-update', `✓ Permission updated to ${days} days`, 'ok');
          loadFetchersAction();
        } else {
          showInlineMsg('msg-fet-update', '✗ ' + (data.message || 'Update failed'), 'err');
        }
      } catch (err) {
        showInlineMsg('msg-fet-update', '✗ Connection error', 'err');
      }
    }

    async function deleteFetcherAction(uname) {
      if (!confirm(`Are you sure you want to delete fetcher '${uname}'?`)) return;
      try {
        const res = await fetch('/admin/delete-fetcher', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ admin_key: SESSION.adminKey, username: uname })
        });
        if (res.ok) {
          notifyToast(`Fetcher '${uname}' deleted`);
          loadFetchersAction();
        } else {
          const d = await res.json();
          notifyToast(d.message || 'Delete failed', 'err');
        }
      } catch (err) {
        notifyToast('Connection error', 'err');
      }
    }

    // ===== 10. CREDIT AUDIT LOG =====
    function recordAuditLog(username, change, balAfter, reason) {
      creditAuditLog.unshift({
        username,
        change: '+' + change,
        balAfter,
        reason: reason || 'Manual Admin Credit',
        date: new Date().toLocaleString('en-GB')
      });
      if (creditAuditLog.length > 200) creditAuditLog = creditAuditLog.slice(0, 200);
      saveLocalAuditLog();
    }

    function renderCreditLogView() {
      const tbody = document.getElementById('m-tbody-credit-log');
      if (!tbody) return;
      if (!creditAuditLog.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--ink-700); padding:30px;">No credit transactions recorded yet.</td></tr>';
        return;
      }

      tbody.innerHTML = creditAuditLog.map(l => `
        <tr>
          <td><span class="status-badge badge-green">${l.username}</span></td>
          <td><span style="color:var(--teal); font-family:var(--f-mono); font-weight:700;">${l.change}</span></td>
          <td><span class="status-badge badge-blue">${l.balAfter}</span></td>
          <td style="color:var(--ink-500); font-size:11.5px;">${l.reason}</td>
          <td style="color:var(--ink-700); font-size:10.5px; font-family:var(--f-mono);">${l.date}</td>
        </tr>
      `).join('');

      document.getElementById('cs-stat-logs').textContent = creditAuditLog.length;
    }

    // ===== 11. SETTINGS & DIAGNOSTICS =====
    async function changeMasterKeyAction() {
      const oldKey = document.getElementById('set-old-key').value.trim();
      const newKey = document.getElementById('set-new-key').value.trim();
      const newKeyConf = document.getElementById('set-new-key-conf').value.trim();

      if (!oldKey || !newKey || !newKeyConf) {
        showInlineMsg('msg-set-key', '✗ All fields are required', 'err');
        return;
      }
      if (newKey !== newKeyConf) {
        showInlineMsg('msg-set-key', '✗ New passwords do not match', 'err');
        return;
      }
      if (newKey.length < 6) {
        showInlineMsg('msg-set-key', '✗ Key must be at least 6 characters', 'err');
        return;
      }

      try {
        const res = await fetch('/admin/change-key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ admin_key: oldKey, new_key: newKey })
        });
        const data = await res.json();

        if (res.ok) {
          notifyToast('Master key updated successfully');
          showInlineMsg('msg-set-key', '✓ Master Key changed successfully', 'ok');
          SESSION.adminKey = newKey;
          saveSession();
          document.getElementById('set-old-key').value = '';
          document.getElementById('set-new-key').value = '';
          document.getElementById('set-new-key-conf').value = '';
        } else {
          showInlineMsg('msg-set-key', '✗ ' + (data.message || 'Key update failed'), 'err');
        }
      } catch (err) {
        showInlineMsg('msg-set-key', '✗ Connection error', 'err');
      }
    }

    async function runDbDiagnostic() {
      try {
        const res = await fetch('/admin/db-status?admin_key=' + encodeURIComponent(SESSION.adminKey));
        const data = await res.json();

        if (res.ok) {
          showInlineMsg('msg-diag', '✓ MongoDB & Server API responding normally (200 OK)', 'ok');
          document.getElementById('diag-db-status').textContent = '● Online OK';
        } else {
          showInlineMsg('msg-diag', '✗ ' + (data.message || 'Diagnostic failed'), 'err');
        }
      } catch (err) {
        showInlineMsg('msg-diag', '✗ Server connection failed', 'err');
      }
    }

    // ===== 12. RESELLER PANEL LOGIC =====
    async function subFetchCredits() {
      try {
        const res = await fetch('/subadmin/credits?username=' + encodeURIComponent(SESSION.username) + '&password=' + encodeURIComponent(SESSION.password));
        const data = await res.json();
        if (res.ok) {
          activeSubCredits = data.credits || 0;
          document.getElementById('sub-hero-credits').textContent = activeSubCredits;
          document.getElementById('user-display-credits').textContent = `${activeSubCredits} Credits`;
          document.getElementById('sub-credit-warning').style.display = activeSubCredits < 1 ? 'block' : 'none';
        }
      } catch (e) {}
    }

    async function subFetchUIDs() {
      const tbody = document.getElementById('s-tbody-uids');
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--ink-500); padding:30px;">Loading your UID Vault...</td></tr>';

      try {
        const res = await fetch('/subadmin/list?username=' + encodeURIComponent(SESSION.username) + '&password=' + encodeURIComponent(SESSION.password));
        const data = await res.json();

        if (res.ok) {
          subUIDsList = data.licenses || [];
          renderSubUIDsTable(subUIDsList);
          updateStatsCards(subUIDsList, 's-stat-total', 's-stat-active', 's-stat-expired', null);
        } else {
          tbody.innerHTML = `<tr><td colspan="7" style="color:#fb4b4b; text-align:center;">Error: ${data.message}</td></tr>`;
        }
      } catch (err) {
        tbody.innerHTML = '<tr><td colspan="7" style="color:#fb4b4b; text-align:center;">Connection error</td></tr>';
      }
    }

    function renderSubUIDsTable(uids) {
      const tbody = document.getElementById('s-tbody-uids');
      if (!uids.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--ink-700); padding:40px;">No UIDs found in your vault</td></tr>';
        return;
      }
      tbody.innerHTML = uids.map(u => buildUIDTableRow(u, 'sub')).join('');
    }

    document.getElementById('s-search-box')?.addEventListener('input', e => {
      const q = e.target.value.toLowerCase();
      const filtered = subUIDsList.filter(u =>
        (u.uid || '').toLowerCase().includes(q) ||
        (u.name || '').toLowerCase().includes(q)
      );
      renderSubUIDsTable(filtered);
    });

    async function subAddUIDAction() {
      await subFetchCredits();
      if (activeSubCredits < 1) {
        notifyToast('No credits remaining. Contact Master Admin.', 'err');
        showInlineMsg('msg-s-add', '✗ Insufficient credits', 'err');
        return;
      }

      const uid = document.getElementById('s-inp-uid').value.trim();
      const name = document.getElementById('s-inp-name').value.trim() || 'Player';
      const days = parseInt(document.getElementById('s-sel-days').value) || 30;

      if (!uid) {
        notifyToast('UID is required', 'err');
        return;
      }

      try {
        const res = await fetch('/subadmin/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: SESSION.username, password: SESSION.password, uid, name, days })
        });
        const data = await res.json();

        if (res.ok) {
          notifyToast(`UID ${uid} added (1 credit deducted)`);
          showInlineMsg('msg-s-add', `✓ UID activated (1 credit used)`, 'ok');
          document.getElementById('s-inp-uid').value = '';
          document.getElementById('s-inp-name').value = '';
          subFetchUIDs();
          subFetchCredits();
        } else {
          notifyToast(data.message || 'Add UID failed', 'err');
          showInlineMsg('msg-s-add', '✗ ' + (data.message || 'Error'), 'err');
        }
      } catch (err) {
        showInlineMsg('msg-s-add', '✗ Connection error', 'err');
      }
    }

    async function subAddUID24Action() {
      await subFetchCredits();
      if (activeSubCredits < 1) {
        notifyToast('No credits remaining. Contact Master Admin.', 'err');
        return;
      }

      const uid = document.getElementById('s-inp-uid').value.trim();
      const name = document.getElementById('s-inp-name').value.trim() || 'Player';

      if (!uid) {
        notifyToast('UID is required', 'err');
        return;
      }

      try {
        const res = await fetch('/subadmin/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: SESSION.username, password: SESSION.password, uid, name, days: 1, hours: 24, duration_hours: 24 })
        });
        const data = await res.json();

        if (res.ok) {
          notifyToast(`24-Hour UID added (1 credit used)`);
          showInlineMsg('msg-s-add', `✓ 24-Hour UID added`, 'ok');
          document.getElementById('s-inp-uid').value = '';
          document.getElementById('s-inp-name').value = '';
          subFetchUIDs();
          subFetchCredits();
        } else {
          notifyToast(data.message || 'Add UID failed', 'err');
        }
      } catch (err) {
        showInlineMsg('msg-s-add', '✗ Connection error', 'err');
      }
    }

    async function subRenewUIDAction() {
      const uid = document.getElementById('s-inp-renew-uid').value.trim();
      const days = parseInt(document.getElementById('s-sel-renew-days').value) || 30;

      if (!uid) {
        notifyToast('Please enter a UID to renew', 'err');
        return;
      }

      try {
        const res = await fetch('/subadmin/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: SESSION.username, password: SESSION.password, uid, days })
        });
        const data = await res.json();

        if (res.ok) {
          notifyToast(`Renewed ${uid} +${days} days`);
          showInlineMsg('msg-s-manage', `✓ UID extended +${days} days`, 'ok');
          document.getElementById('s-inp-renew-uid').value = '';
          subFetchUIDs();
        } else {
          notifyToast(data.message || 'Renewal failed', 'err');
        }
      } catch (err) {
        showInlineMsg('msg-s-manage', '✗ Connection error', 'err');
      }
    }

    function subTriggerRemove() {
      const uid = document.getElementById('s-inp-rm-uid').value.trim();
      if (!uid) {
        notifyToast('Please enter a UID to remove', 'err');
        return;
      }
      triggerDeleteModal(uid, 'sub');
    }

    // ===== 13. FETCHER PANEL LOGIC =====
    async function fetcherFetchPermission() {
      try {
        const res = await fetch('/fetcher/permission?username=' + encodeURIComponent(SESSION.username) + '&password=' + encodeURIComponent(SESSION.password));
        const data = await res.json();
        if (res.ok) {
          activeFetcherPermDays = data.permission_days || data.days || 0;
          document.getElementById('f-hero-perm').textContent = activeFetcherPermDays;
          document.getElementById('f-desc-days').textContent = activeFetcherPermDays;
          document.getElementById('f-desc-renew-days').textContent = activeFetcherPermDays;
          document.getElementById('user-display-credits').textContent = `${activeFetcherPermDays} Days Perm`;
        }
      } catch (e) {}
    }

    async function fetcherFetchUIDs() {
      const tbody = document.getElementById('f-tbody-uids');
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--ink-500); padding:30px;">Loading your UID Vault...</td></tr>';

      try {
        const res = await fetch('/fetcher/list?username=' + encodeURIComponent(SESSION.username) + '&password=' + encodeURIComponent(SESSION.password));
        const data = await res.json();

        if (res.ok) {
          fetcherUIDsList = data.licenses || [];
          renderFetcherUIDsTable(fetcherUIDsList);
          updateStatsCards(fetcherUIDsList, 'f-stat-total', 'f-stat-active', 'f-stat-expired', null);
        } else {
          tbody.innerHTML = `<tr><td colspan="7" style="color:#fb4b4b; text-align:center;">Error: ${data.message}</td></tr>`;
        }
      } catch (err) {
        tbody.innerHTML = '<tr><td colspan="7" style="color:#fb4b4b; text-align:center;">Connection error</td></tr>';
      }
    }

    function renderFetcherUIDsTable(uids) {
      const tbody = document.getElementById('f-tbody-uids');
      if (!uids.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--ink-700); padding:40px;">No UIDs found</td></tr>';
        return;
      }
      tbody.innerHTML = uids.map(u => buildUIDTableRow(u, 'fetcher')).join('');
    }

    document.getElementById('f-search-box')?.addEventListener('input', e => {
      const q = e.target.value.toLowerCase();
      const filtered = fetcherUIDsList.filter(u =>
        (u.uid || '').toLowerCase().includes(q) ||
        (u.name || '').toLowerCase().includes(q)
      );
      renderFetcherUIDsTable(filtered);
    });

    async function fetcherAddUIDAction() {
      await fetcherFetchPermission();
      if (!activeFetcherPermDays || activeFetcherPermDays < 1) {
        notifyToast('No permission duration configured. Contact Master Admin.', 'err');
        return;
      }

      const uid = document.getElementById('f-inp-uid').value.trim();
      const name = document.getElementById('f-inp-name').value.trim() || 'Player';

      if (!uid) {
        notifyToast('UID is required', 'err');
        return;
      }

      try {
        const res = await fetch('/fetcher/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: SESSION.username, password: SESSION.password, uid, name, days: activeFetcherPermDays })
        });
        const data = await res.json();

        if (res.ok) {
          notifyToast(`UID ${uid} added (${activeFetcherPermDays} days)`);
          showInlineMsg('msg-f-add', `✓ UID activated (${activeFetcherPermDays}d)`, 'ok');
          document.getElementById('f-inp-uid').value = '';
          document.getElementById('f-inp-name').value = '';
          fetcherFetchUIDs();
        } else {
          notifyToast(data.message || 'Add UID failed', 'err');
          showInlineMsg('msg-f-add', '✗ ' + (data.message || 'Error'), 'err');
        }
      } catch (err) {
        showInlineMsg('msg-f-add', '✗ Connection error', 'err');
      }
    }

    async function fetcherRenewUIDAction() {
      await fetcherFetchPermission();
      const uid = document.getElementById('f-inp-renew-uid').value.trim();

      if (!uid) {
        notifyToast('Please enter a UID to renew', 'err');
        return;
      }

      try {
        const res = await fetch('/fetcher/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: SESSION.username, password: SESSION.password, uid, days: activeFetcherPermDays })
        });
        const data = await res.json();

        if (res.ok) {
          notifyToast(`Renewed ${uid} +${activeFetcherPermDays} days`);
          showInlineMsg('msg-f-manage', `✓ UID extended +${activeFetcherPermDays}d`, 'ok');
          document.getElementById('f-inp-renew-uid').value = '';
          fetcherFetchUIDs();
        } else {
          notifyToast(data.message || 'Renewal failed', 'err');
        }
      } catch (err) {
        showInlineMsg('msg-f-manage', '✗ Connection error', 'err');
      }
    }

    function fetcherTriggerRemove() {
      const uid = document.getElementById('f-inp-rm-uid').value.trim();
      if (!uid) {
        notifyToast('Please enter a UID to remove', 'err');
        return;
      }
      triggerDeleteModal(uid, 'fetcher');
    }

    // ===== 14. DELETE CONFIRMATION MODAL =====
    function triggerDeleteModal(uid, tier) {
      pendingDeleteUID = uid;
      pendingDeleteTier = tier;

      document.getElementById('modal-delete-text').innerHTML = `
        Are you sure you want to revoke and delete UID <b style="font-family:var(--f-mono); color:#ff8a8a;">${uid}</b>?<br>
        <span style="font-size:11px; color:var(--ink-700);">This action will immediately remove license access.</span>
      `;
      openAppModal('modal-delete-dialog');
    }

    async function executeModalDeleteConfirm() {
      if (!pendingDeleteUID) return closeAppModal('modal-delete-dialog');

      const uid = pendingDeleteUID;
      const tier = pendingDeleteTier;
      closeAppModal('modal-delete-dialog');

      try {
        let res;
        if (tier === 'main') {
          res = await fetch('/admin/revoke', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ admin_key: SESSION.adminKey, uid })
          });
        } else if (tier === 'fetcher') {
          res = await fetch('/fetcher/revoke', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: SESSION.username, password: SESSION.password, uid })
          });
        } else {
          res = await fetch('/subadmin/revoke', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: SESSION.username, password: SESSION.password, uid })
          });
        }

        const data = await res.json();
        if (res.ok && data.status === 'success') {
          notifyToast(`UID ${uid} permanently revoked`);

          if (tier === 'main') {
            mainUIDsList = mainUIDsList.filter(u => (u.uid || u.id || '') !== uid);
            renderMainUIDsTable(mainUIDsList);
            updateStatsCards(mainUIDsList, 'm-stat-total', 'm-stat-active', 'm-stat-expired', 'm-stat-expiring');
            setTimeout(mainFetchUIDs, 500);
          } else if (tier === 'fetcher') {
            fetcherUIDsList = fetcherUIDsList.filter(u => (u.uid || u.id || '') !== uid);
            renderFetcherUIDsTable(fetcherUIDsList);
            updateStatsCards(fetcherUIDsList, 'f-stat-total', 'f-stat-active', 'f-stat-expired', null);
            setTimeout(fetcherFetchUIDs, 500);
          } else {
            subUIDsList = subUIDsList.filter(u => (u.uid || u.id || '') !== uid);
            renderSubUIDsTable(subUIDsList);
            updateStatsCards(subUIDsList, 's-stat-total', 's-stat-active', 's-stat-expired', null);
            setTimeout(subFetchUIDs, 500);
          }
        } else {
          notifyToast(data.message || 'Revoke operation failed', 'err');
        }
      } catch (err) {
        notifyToast('Connection error during revocation', 'err');
      }

      pendingDeleteUID = null;
    }

    // ===== 15. QUICK CREDIT MODAL =====
    function openQuickCreditDialog(uname) {
      pendingQuickCreditUser = uname;
      document.getElementById('modal-credit-desc').innerHTML = `
        Add instant credits to reseller: <b style="color:var(--blue);">${uname}</b>
      `;
      document.getElementById('modal-credit-inp').value = 100;
      document.getElementById('msg-modal-credit').innerHTML = '';
      openAppModal('modal-quick-credit');
    }

    async function executeQuickCreditConfirm() {
      const amount = parseInt(document.getElementById('modal-credit-inp').value);
      if (!pendingQuickCreditUser || !amount || amount < 1) {
        showInlineMsg('msg-modal-credit', '✗ Enter valid credit amount', 'err');
        return;
      }

      try {
        const res = await fetch('/admin/give-credits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ admin_key: SESSION.adminKey, username: pendingQuickCreditUser, amount })
        });
        const data = await res.json();

        if (res.ok) {
          notifyToast(`+${amount} Credits given to ${pendingQuickCreditUser}`);
          showInlineMsg('msg-modal-credit', `✓ +${amount} credits added`, 'ok');
          recordAuditLog(pendingQuickCreditUser, amount, data.new_credits || '?', 'Quick List Top-Up');
          loadResellersAction();
          renderCreditLogView();
          setTimeout(() => closeAppModal('modal-quick-credit'), 900);
        } else {
          showInlineMsg('msg-modal-credit', '✗ ' + (data.message || 'Transfer failed'), 'err');
        }
      } catch (err) {
        showInlineMsg('msg-modal-credit', '✗ Connection error', 'err');
      }
    }

    // ===== 16. CHIP SELECTOR INITIALIZATION =====
    function initChips(containerId, selectId, dayOptions) {
      const container = document.getElementById(containerId);
      const select = document.getElementById(selectId);
      if (!container || !select) return;

      container.innerHTML = '';
      dayOptions.forEach(d => {
        const chip = document.createElement('span');
        chip.className = 'duration-chip' + (parseInt(select.value) === d ? ' active' : '');
        chip.textContent = d + 'd';

        chip.onclick = () => {
          select.value = d;
          container.querySelectorAll('.duration-chip').forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
        };
        container.appendChild(chip);
      });
    }

    // ===== 17. APPLICATION BOOTSTRAP =====
    window.addEventListener('DOMContentLoaded', async () => {
      initChips('m-chips-container', 'm-sel-days', [1, 7, 15, 30, 60, 90, 365]);
      initChips('m-renew-chips-container', 'm-sel-renew-days', [7, 15, 30, 60]);
      initChips('fet-chips-container', 'fet-new-days', [1, 7, 15, 30, 60, 90, 365]);

      loadSession();
      loadLocalAuditLog();

      if (SESSION.role === 'main_admin' && SESSION.adminKey) {
        try {
          const res = await fetch('/admin/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ admin_key: SESSION.adminKey })
          });
          if (res.ok) {
            launchWorkspaceView('main_admin');
            return;
          }
        } catch (e) {}
        clearSession();
      }

      if (SESSION.role === 'sub_admin' && SESSION.username && SESSION.password) {
        try {
          const res = await fetch('/subadmin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: SESSION.username, password: SESSION.password })
          });
          if (res.ok) {
            launchWorkspaceView('sub_admin');
            return;
          }
        } catch (e) {}
        clearSession();
      }

      if (SESSION.role === 'fetcher' && SESSION.username && SESSION.password) {
        try {
          const res = await fetch('/fetcher/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: SESSION.username, password: SESSION.password })
          });
          if (res.ok) {
            launchWorkspaceView('fetcher');
            return;
          }
        } catch (e) {}
        clearSession();
      }

      if (SESSION.role === 'api_user' && SESSION.username && SESSION.password) {
        try {
          const res = await fetch('/unified/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: SESSION.username, password: SESSION.password, tier: 'api-user' })
          });
          const data = await res.json();
          if (res.ok && data.role === 'api_user') {
            launchWorkspaceView('api_user');
            return;
          }
        } catch (e) {}
        clearSession();
      }
    });

    // ===== 14. LICENSE API CONSOLE (PROXY GATEWAY) =====
    let apiAllLicenses = [];
    let apiCurrentFilter = 'all';

    function logApiTerminal(data, label = 'API Response') {
      const inspector = document.getElementById('api-json-inspector');
      const statusText = document.getElementById('api-terminal-status');
      if (inspector) inspector.innerText = JSON.stringify(data, null, 2);
      if (statusText) statusText.innerText = label + ' • ' + new Date().toLocaleTimeString();
    }

    async function loadApiConsoleData() {
      const tbody = document.getElementById('api-tbody-licenses');
      if (tbody && apiAllLicenses.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--ink-500); padding:30px;">Connecting to License API Gateway...</td></tr>';
      }

      try {
        const res = await fetch('/api/licenses');
        const data = await res.json();
        logApiTerminal(data, 'GET /api/licenses');

        if (data.success && Array.isArray(data.licenses)) {
          apiAllLicenses = data.licenses;
          updateApiCounters();
          renderApiLicensesTable();
          const pill = document.getElementById('api-status-text');
          if (pill) pill.innerText = `Connected (${data.total_count || apiAllLicenses.length} Keys)`;
        } else {
          notifyToast(data.message || 'Failed to load licenses from API');
        }
      } catch (err) {
        notifyToast('Network error: Could not reach license proxy');
      }
    }

    function updateApiCounters() {
      const unused = apiAllLicenses.filter(l => l.status === 'Unused').length;
      const used = apiAllLicenses.filter(l => l.status === 'Used').length;
      const banned = apiAllLicenses.filter(l => l.status === 'Banned').length;

      const elTotal = document.getElementById('api-stat-total');
      const elUnused = document.getElementById('api-stat-unused');
      const elUsed = document.getElementById('api-stat-used');
      const elBanned = document.getElementById('api-stat-banned');

      if (elTotal) elTotal.innerText = apiAllLicenses.length;
      if (elUnused) elUnused.innerText = unused;
      if (elUsed) elUsed.innerText = used;
      if (elBanned) elBanned.innerText = banned;

      const cAll = document.getElementById('api-cnt-all');
      const cUnused = document.getElementById('api-cnt-unused');
      const cUsed = document.getElementById('api-cnt-used');
      const cBanned = document.getElementById('api-cnt-banned');

      if (cAll) cAll.innerText = apiAllLicenses.length;
      if (cUnused) cUnused.innerText = unused;
      if (cUsed) cUsed.innerText = used;
      if (cBanned) cBanned.innerText = banned;
    }

    function setApiFilter(filter) {
      apiCurrentFilter = filter;
      document.querySelectorAll('#view-tab-api .chip-btn').forEach(btn => btn.classList.remove('active'));
      const activeBtn = document.getElementById('api-chip-' + filter.toLowerCase());
      if (activeBtn) activeBtn.classList.add('active');
      renderApiLicensesTable();
    }

    function handleApiSearch() {
      renderApiLicensesTable();
    }

    function renderApiLicensesTable() {
      const tbody = document.getElementById('api-tbody-licenses');
      if (!tbody) return;

      const searchBox = document.getElementById('api-search-box');
      const query = (searchBox ? searchBox.value : '').trim().toLowerCase();

      let filtered = apiAllLicenses.filter(l => {
        if (apiCurrentFilter !== 'all' && l.status !== apiCurrentFilter) return false;
        if (!query) return true;
        const k = (l.key || '').toLowerCase();
        const n = (l.note || '').toLowerCase();
        const h = (l.hwid || '').toLowerCase();
        const u = (l.assignedTo || l.usedBy || '').toLowerCase();
        return k.includes(query) || n.includes(query) || h.includes(query) || u.includes(query);
      });

      if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:36px; color:var(--ink-500);">No licenses found matching search / filter criteria.</td></tr>';
        return;
      }

      tbody.innerHTML = filtered.map(l => {
        const isBanned = l.status === 'Banned';
        let statusBadge = '<span class="status-badge badge-green">Unused</span>';
        if (l.status === 'Used') statusBadge = '<span class="status-badge badge-blue">Used</span>';
        else if (l.status === 'Banned') statusBadge = '<span class="status-badge badge-red">Banned</span>';

        const hwidVal = (!l.hwid || l.hwid === 'None') 
          ? '<span style="color:var(--ink-700);">None</span>' 
          : `<span style="font-family:var(--f-mono); font-size:11px; color:var(--amber);" title="${l.hwid}">${l.hwid.slice(0, 16)}...</span>`;

        return `
          <tr>
            <td>
              <div style="display:flex; align-items:center; gap:6px;">
                <span style="font-family:var(--f-mono); font-weight:700; color:var(--ink-100); background:rgba(255,255,255,0.06); padding:3px 8px; border-radius:var(--r-sm);">${l.key}</span>
                <button class="action-btn-sm" onclick="apiCopyKey('${l.key}')" title="Copy Key">❐</button>
              </div>
            </td>
            <td>${statusBadge}</td>
            <td><span style="font-family:var(--f-mono); font-size:12px;">${l.duration || '—'}</span></td>
            <td>${hwidVal}</td>
            <td><span style="font-family:var(--f-mono); font-size:12px; color:var(--ink-300);">${l.assignedTo || l.usedBy || '—'}</span></td>
            <td>
              <div style="font-size:12px; color:var(--ink-300);">${l.note || '—'}</div>
              <div style="font-size:10px; color:var(--ink-500); font-family:var(--f-mono);">${l.createdBy || ''}</div>
            </td>
            <td>
              <button class="action-btn-sm" onclick="apiSelectKey('${l.key}')">Select</button>
              <button class="action-btn-sm" onclick="apiQuickResetHwid('${l.key}')">Reset HWID</button>
              <button class="action-btn-sm ${isBanned ? '' : 'btn-ban'}" onclick="apiQuickToggleBan('${l.key}', ${isBanned})">
                ${isBanned ? 'Unban' : 'Ban'}
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }

    function apiCopyKey(key) {
      navigator.clipboard.writeText(key);
      notifyToast('Copied license key: ' + key);
    }

    function apiSelectKey(key) {
      const inp = document.getElementById('api-op-key');
      if (inp) {
        inp.value = key;
        inp.focus();
      }
      apiExecuteInspectKey();
    }

    async function apiExecuteCreateKey() {
      const duration = document.getElementById('api-gen-duration').value;
      const count = parseInt(document.getElementById('api-gen-count').value, 10) || 1;
      const note = document.getElementById('api-gen-note').value;
      const msgBox = document.getElementById('msg-api-gen');
      const btn = document.getElementById('btn-api-generate');

      btn.disabled = true;
      btn.innerHTML = '<span>Creating Key(s)...</span>';
      if (msgBox) msgBox.style.display = 'none';

      try {
        const res = await fetch('/api/licenses/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ duration, count, note })
        });
        const data = await res.json();
        logApiTerminal(data, 'POST /api/licenses/create');

        if (data.success && data.licenses?.length > 0) {
          const newKey = data.licenses[0].key;
          notifyToast(`Created key: ${newKey}`);
          if (msgBox) {
            msgBox.className = 'inline-msg-box success';
            msgBox.style.display = 'block';
            msgBox.innerHTML = `✓ Generated ${data.licenses.length} key(s)! Key: <b>${newKey}</b> <button class="action-btn-sm" onclick="apiCopyKey('${newKey}')" style="margin-left:6px;">Copy</button>`;
          }
          const opInp = document.getElementById('api-op-key');
          if (opInp) opInp.value = newKey;
          await loadApiConsoleData();
        } else {
          if (msgBox) {
            msgBox.className = 'inline-msg-box error';
            msgBox.style.display = 'block';
            msgBox.textContent = '✗ ' + (data.message || 'Failed to create license key');
          }
        }
      } catch (err) {
        notifyToast('Network error while creating license key');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>Generate License Key</span>';
      }
    }

    async function apiExecuteInspectKey() {
      const key = (document.getElementById('api-op-key')?.value || '').trim();
      const msgBox = document.getElementById('msg-api-op');
      if (!key) {
        notifyToast('Please enter a license key to inspect');
        return;
      }

      try {
        const res = await fetch(`/api/licenses/${encodeURIComponent(key)}`);
        const data = await res.json();
        logApiTerminal(data, `GET /api/licenses/${key}`);

        if (data.success && data.license) {
          notifyToast(`License: ${data.license.key} (${data.license.status})`);
          if (msgBox) {
            msgBox.className = 'inline-msg-box success';
            msgBox.style.display = 'block';
            msgBox.innerHTML = `✓ Status: <b>${data.license.status}</b> | Duration: ${data.license.duration || 'N/A'} | HWID: ${data.license.hwid || 'None'}`;
          }
        } else {
          if (msgBox) {
            msgBox.className = 'inline-msg-box error';
            msgBox.style.display = 'block';
            msgBox.textContent = '✗ ' + (data.message || 'License key not found');
          }
        }
      } catch (e) {
        notifyToast('Error querying license key');
      }
    }

    async function apiExecuteResetHwid() {
      const key = (document.getElementById('api-op-key')?.value || '').trim();
      if (!key) {
        notifyToast('Please enter a license key');
        return;
      }
      await apiQuickResetHwid(key);
    }

    async function apiQuickResetHwid(key) {
      try {
        const res = await fetch('/api/licenses/reset-hwid', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key })
        });
        const data = await res.json();
        logApiTerminal(data, 'POST /api/licenses/reset-hwid');

        if (data.success) {
          notifyToast(`HWID reset successful for: ${key}`);
          await loadApiConsoleData();
        } else {
          notifyToast(data.message || 'HWID reset failed');
        }
      } catch (e) {
        notifyToast('Network error while resetting HWID');
      }
    }

    async function apiExecuteBanToggle() {
      const key = (document.getElementById('api-op-key')?.value || '').trim();
      const reason = (document.getElementById('api-op-reason')?.value || '').trim() || 'Terms violation';
      if (!key) {
        notifyToast('Please enter a license key');
        return;
      }

      const found = apiAllLicenses.find(l => l.key === key);
      const isBanned = found ? found.status === 'Banned' : false;
      await apiQuickToggleBan(key, isBanned, reason);
    }

    // ===== 18. API CONSOLE USERS MANAGEMENT (MASTER ADMIN) =====
    let apiUsersList = [];

    async function loadApiUsersAction() {
      const tbody = document.getElementById('m-tbody-api-users');
      if (!tbody) return;
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--ink-500); padding:24px;">Loading API Operators...</td></tr>';

      try {
        const res = await fetch('/admin/list-api-users?admin_key=' + encodeURIComponent(SESSION.adminKey));
        const data = await res.json();

        if (res.ok && data.api_users) {
          apiUsersList = data.api_users;
          renderApiUsersTable(apiUsersList);
          const elTotal = document.getElementById('u-stat-total');
          const elActive = document.getElementById('u-stat-active');
          if (elTotal) elTotal.textContent = apiUsersList.length;
          if (elActive) elActive.textContent = apiUsersList.length;
        } else {
          tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#fb4b4b; padding:24px;">Error: ${data.message || 'Failed to load'}</td></tr>`;
        }
      } catch (err) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#fb4b4b; padding:24px;">Connection error</td></tr>';
      }
    }

    function renderApiUsersTable(list) {
      const tbody = document.getElementById('m-tbody-api-users');
      if (!tbody) return;
      if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--ink-700); padding:30px;">No API Console operators found</td></tr>';
        return;
      }
      tbody.innerHTML = list.map(u => `
        <tr>
          <td><span class="status-badge badge-green">${u.username}</span></td>
          <td><span style="font-family:var(--f-mono); font-size:11px; color:var(--ink-500);">${u.password || '••••••'}</span></td>
          <td><span class="status-badge badge-blue">API Operator</span></td>
          <td style="color:var(--ink-500); font-size:11.5px;">${u.note || '—'}</td>
          <td style="color:var(--ink-700); font-size:11px; font-family:var(--f-mono);">${u.created_at ? new Date(u.created_at).toLocaleDateString('en-GB') : '—'}</td>
          <td>
            <button class="btn-sm-action btn-sm-red" onclick="deleteApiUserDirectAction('${u.username}')">Delete</button>
          </td>
        </tr>
      `).join('');
    }

    function filterApiUsersTable() {
      const q = (document.getElementById('u-search-box')?.value || '').toLowerCase();
      const filtered = apiUsersList.filter(u =>
        (u.username || '').toLowerCase().includes(q) ||
        (u.note || '').toLowerCase().includes(q)
      );
      renderApiUsersTable(filtered);
    }

    async function mainCreateApiUserAction() {
      const username = document.getElementById('u-inp-username').value.trim();
      const password = document.getElementById('u-inp-password').value.trim();
      const note = document.getElementById('u-inp-note').value.trim();

      if (!username || !password) {
        notifyToast('Username and Password are required', 'err');
        showInlineMsg('msg-u-create', '✗ Username & Password required', 'err');
        return;
      }

      try {
        const res = await fetch('/admin/create-api-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ admin_key: SESSION.adminKey, username, password, note })
        });
        const data = await res.json();

        if (res.ok) {
          notifyToast(`API Operator '${username}' created`);
          showInlineMsg('msg-u-create', `✓ API Operator '${username}' created successfully`, 'ok');
          document.getElementById('u-inp-username').value = '';
          document.getElementById('u-inp-password').value = '';
          document.getElementById('u-inp-note').value = '';
          loadApiUsersAction();
        } else {
          showInlineMsg('msg-u-create', '✗ ' + (data.message || 'Error creating operator'), 'err');
        }
      } catch (err) {
        showInlineMsg('msg-u-create', '✗ Connection error', 'err');
      }
    }

    async function mainDeleteApiUserAction() {
      const username = document.getElementById('u-inp-del-user').value.trim();
      if (!username) {
        notifyToast('Please enter a username to delete', 'err');
        showInlineMsg('msg-u-delete', '✗ Username is required', 'err');
        return;
      }
      await deleteApiUserDirectAction(username);
      document.getElementById('u-inp-del-user').value = '';
    }

    async function deleteApiUserDirectAction(username) {
      if (!confirm(`Delete API Operator '${username}'? This will revoke their access immediately.`)) return;
      try {
        const res = await fetch('/admin/delete-api-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ admin_key: SESSION.adminKey, username })
        });
        if (res.ok) {
          notifyToast(`API Operator '${username}' deleted`);
          showInlineMsg('msg-u-delete', `✓ Operator '${username}' removed`, 'ok');
          loadApiUsersAction();
        } else {
          const d = await res.json();
          notifyToast(d.message || 'Delete failed', 'err');
        }
      } catch (err) {
        notifyToast('Connection error', 'err');
      }
    }

    async function apiQuickToggleBan(key, isBanned, reason = 'Terms violation') {
      const endpoint = isBanned ? '/api/licenses/unban' : '/api/licenses/ban';
      const body = isBanned ? { key } : { key, reason };

      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        const data = await res.json();
        logApiTerminal(data, `POST ${endpoint}`);

        if (data.success) {
          notifyToast(isBanned ? `Key unbanned: ${key}` : `Key banned: ${key}`);
          await loadApiConsoleData();
        } else {
          notifyToast(data.message || 'Ban/Unban action failed');
        }
      } catch (e) {
        notifyToast('Network error during ban action');
      }
    }

  

