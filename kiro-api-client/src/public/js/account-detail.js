// ============ 账号详情页面 JS ============

let currentCredential = null;
let accountId = null;
let tokenVisible = { access: false, refresh: false };

// 页面初始化
document.addEventListener('DOMContentLoaded', async () => {
    // 检查认证
    if (!await checkAuth()) return;

    // 注入侧边栏
    const sidebarContainer = document.getElementById('sidebar-container');
    if (sidebarContainer) {
        sidebarContainer.innerHTML = getSidebarHTML();
        initSidebar('accounts');
        updateSidebarStats();
    }

    // 获取 URL 参数中的账号 ID
    const urlParams = new URLSearchParams(window.location.search);
    accountId = urlParams.get('id');

    if (!accountId) {
        showToast('未指定账号 ID', 'error');
        setTimeout(() => goBack(), 1500);
        return;
    }

    // 加载账号详情
    await loadAccountDetail();
});

// 返回列表
function goBack() {
    window.location.href = '/pages/accounts.html';
}

// 加载账号详情
async function loadAccountDetail() {
    try {
        const res = await fetch(`/api/credentials/${accountId}?full=true`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const result = await res.json();

        if (!result.success) {
            showToast(result.error || '加载失败', 'error');
            setTimeout(() => goBack(), 1500);
            return;
        }

        currentCredential = result.data;
        renderAccountDetail();

    } catch (error) {
        showToast('加载账号详情失败: ' + error.message, 'error');
        setTimeout(() => goBack(), 1500);
    }
}

// 渲染账号详情
function renderAccountDetail() {
    const cred = currentCredential;

    // 隐藏加载状态，显示内容
    document.getElementById('loading-state').style.display = 'none';
    document.getElementById('detail-content').style.display = 'block';

    // 更新页面标题
    document.getElementById('account-subtitle').textContent = cred.email || cred.name || '账号详情';

    // 基本信息
    document.getElementById('detail-name').textContent = cred.name || '-';
    document.getElementById('detail-email').textContent = cred.email || '-';

    // 提供商
    const providerEl = document.getElementById('detail-provider');
    const provider = cred.provider || 'Unknown';
    providerEl.innerHTML = `<span class="pder-badge ${provider.toLowerCase()}">${provider}</span>`;

    // 认证方式
    const authMethodMap = {
        'social': 'Social (Google/GitHub)',
        'builder-id': 'AWS Builder ID',
        'IdC': 'IAM Identity Center'
    };
    document.getElementById('detail-auth-method').textContent = authMethodMap[cred.authMethod] || cred.authMethod || '-';

    // 区域
    document.getElementById('detail-region').textContent = cred.region || 'us-east-1';

    // 状态
    const statusEl = document.getElementById('detail-status');
    const statusClass = cred.status === 'error' ? 'error' : cred.status === 'warning' ? 'warning' : 'normal';
    const statusText = statusClass === 'normal' ? '正常' : statusClass === 'warning' ? '警告' : '异常';
    statusEl.innerHTML = `<span class="status-badge ${statusClass}">${statusText}</span>`;
    if (cred.isActive) {
        statusEl.innerHTML += ` <span class="status-badge active">活跃</span>`;
    }

    // 时间
    document.getElementById('detail-created').textContent = formatDateTime(cred.createdAt);
    document.getElementById('detail-expires').textContent = formatExpireTime(cred.expiresAt);

    // Token 信息（默认隐藏）
    document.getElementById('detail-accken').textContent = maskToken(cred.accessToken);
    document.getElementById('detail-access-token').dataset.token = cred.accessToken || '';

    document.getElementById('detail-refresh-token').textContent = maskToken(cred.refreshToken);
    document.getElementById('detail-refresh-token').dataset.token = cred.refreshToken || '';

    // Profile ARN（仅 Social Auth 显示）
    if (cred.profileArn) {
        document.getElementById('profile-arn-section').style.display = 'block';
        document.getElementById('detail-profile-arn').textContent = cred.profileArn;
    }
}

// 格式化过期时间
function formatExpireTime(dateStr) {
    if (!dateStr) re
    const date = new Date(dateStr);
    const now = new Date();
    const diff = date - now;

    if (diff < 0) {
        return `已过期 (${formatDateTime(dateStr)})`;
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours < 1) {
        return `${minutes} 分钟后过期`;
    } else if (hours < 24) {
        return `${hours} 小时 ${minutes} 分钟后过期`;
    } else {
        const days = Math.floor(hours / 24);
        return `${days} 天后过期 (${formatDateTime(dateStr)})`;
    }
}

// 遮蔽 Token
function maskToken(token) {
    if (!token) return '-';
    if (token.length <= 20) return '••••••••••••••••';
    return token.substring(0, 10) + '••••••••••••••••' + token.substring(token.length - 10);
}

// 切换 Token 显示
function toggleToken(type) {
    tokenVisible[type] = !tokenVisible[type];
    const el = document.getElementById(`detail-${type}-token`);
    const token = el.dataset.token;

    if (tokenVisible[type]) {
        el.textContent = token || '-';
    } else {
        el.textContent = maskToken(token);
    }
}

// 复制 Token
function copyToken(type) {
    const el = document.getElementById(`detail-${type}-token`);
    const ken = el.dataset.token;
    if (token) {
        copyToClipboard(token);
    } else {
        showToast('Token 为空', 'warning');
    }
}

// 复制 Profile ARN
function copyProfileArn() {
    const arn = document.getElementById('detail-profile-arn').textContent;
    if (arn && arn !== '-') {
        copyToClipboard(arn);
    }
}

// 刷新 Token
async function refreshToken() {
    showToast('正在刷新 Token...', 'warning');

    try {
        const res = await fetch(`/api/credentials/${accountId}/refresh`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const result = await res.json();

        if (result.success) {
            showToast('Token 刷新成功', 'success');
            await loadAccountDetail();
        } else {
            showToast('Token 刷新失败: ' + (result.error || '未知错误'), 'error');
        }
    } catch (error) {
        showToast('Token 刷新失败: ' + error.message, 'error');
    }
}

// 测试连接
async function testConnection() {
    showToast('正在测试连接...', 'warning');

    try {
        const res = await fetch(`/api/credentials/${accountId}/test`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const result = await res.json();

        if (result.success) {
            showToast('连接测试成功', 'success');
        } else {
            showToast('连接测试失败: ' + (result.error || '未知错误'), 'error');
        }
    } catch (error) {
        showToast('连接测试失败: ' + error.message, 'error');
    }
}

// 刷新用量
async function refreshUsage() {
    const usageContent = document.getElementById('usage-content');
    usageContent.innerHTML = '<p style="color: var(--text-muted);">加载中...</p>';

    try {
        const res = await fetch(`/api/credentials/${accountId}/usage`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const result = await res.json();

        if (result.success && result.data) {
            renderUsage(result.data);
        } else {
            usageContent.innerHTML = `<p style="color: var(--accent-danger);">获取用量失败: ${result.error || '未知错误'}</p>`;
        }
    } catch (error) {
        usageContent.innerHTML = `<p style="color: var(--accent-danger);">获取用量失败: ${error.message}</p>`;
    }
}

// 渲染用量信息
function renderUsage(usage) {
    const usageContent = document.getElementById('usage-content');

    if (!usage.usageBreakdownList || usage.usageBreakdownList.length === 0) {
        usageContent.innerHTML = '<p style="color: var(--text-muted);">暂无用量数据</p>';
        return;
    }

    let html = '';

    usage.usageBreakdownList.forEach(breakdown => {
        const displayName = breakdown.displayNamePlural || breakdown.displayName || 'Credits';
        let usedCount = 0;
        let totalCount = 0;
        let isFreeTrialActive = false;

        if (breakdown.freeTrialInfo && breakdown.freeTrialInfo.freeTrialStatus === 'ACTIVE') {
            isFreeTrialActive = true;
            usedCo breakdown.freeTrialInfo.currentUsageWithPrecision || breakdown.freeTrialInfo.currentUsage || 0;
            totalCount = breakdown.freeTrialInfo.usageLimitWithPrecision || breakdown.freeTrialInfo.usageLimit || 500;
        } else {
            usedCount = breakdown.currentUsageWithPrecision || breakdown.currentUsage || 0;
            totalCount = breakdown.usageLimitWithPrecision || breakdown.usageLimit || 50;
        }

        const usagePercent = totalCount > 0 ? Math.round((usedCount / totalCount) * 100) : 0;
        const barClass = usagePercent > 80 ? 'danger' : usagePercent > 50 ? 'warning' : '';

        let resetText = '';
        if (breakdown.nextDateReset) {
            const resetDate = new Date(breakdown.nextDateReset * 1000);
            resetText = `重置时间: ${formatDateTime(resetDate.toISOString())}`;
        }

        const trialBadge = isFreeTrialActive ? '<span style="background: var(--accent-success-bg); color: var(--accent-success); padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-left: 8px;">试用中</span>' : '';

        html += `
            <div class="usage-section">
                <div style="display: flex; align-items: center; justify-content: space-between;">
           <span style="font-weight: 500; color: var(--text-primary);">${displayName}${trialBadge}</span>
                    <span style="font-size: 14px; font-weight: 600; color: var(--text-primary);">${usagePercent}%</span>
                </div>
                <div class="usage-bar-container">
                    <div class="usage-bar">
                        <div class="usage-bar-fill ${barClass}" style="width: ${Math.min(usagePercent, 100)}%"></div>
                    </div>
                    <div class="usage-stats">
                        <span>已用 ${usedCount.toFixed(2)} / ${totalCount}</span>
                        <span>${resetText || '剩余 ' + (totalCount - usedCount).toFixed(2)}</span>
                    </div>
                </div>
            </div>
        `;
    });

    usageContent.innerHTML = html;
}

// 开始对话
function startChat() {
    window.location.href = `/pages/chat.html?account=${accountId}`;
}

// 删除账号
async function deleteAccount() {
    if (!confirm('确定要删除此账号吗？此操作不可恢复。')) {
        return;
    }

    try {
        const res = await fetch(`/api/credentials/${accountId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const result = await res.json();

        if (result.success) {
            showToast('账号已删除', 'success');
            setTimeout(() => goBack(), 1000);
        } else {
            showToast('删除失败: ' + (result.error || '未知错误'), 'error');
        }
    } catch (error) {
        showToast('删除失败: ' + error.message, 'error');
    }
}
