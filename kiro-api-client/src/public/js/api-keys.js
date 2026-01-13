// ============ API 密钥页面 JS ============

let apiKeys = [];
let createKeyModal;
let limitsModal;

document.addEventListener('DOMContentLoaded', async () => {
    createKeyModal = document.getElementById('create-key-modal');
    limitsModal = document.getElementById('limits-modal');

    document.getElementById('sidebar-container').innerHTML = getSidebarHTML();
    initSidebar('api-keys');

    if (!await checkAuth()) return;

    loadApiKeys();
    setupEventListeners();
    updateSidebarStats();
});

function setupEventListeners() {
    document.getElementById('create-key-btn').addEventListener('click', openCreateModal);
    document.getElementById('modal-close').addEventListener('click', closeCreateModal);
    document.getElementById('modal-cancel').addEventListener('click', closeCreateModal);
    document.getElementById('modal-submit').addEventListener('click', createApiKey);
    createKeyModal.addEventListener('click', function(e) {
        if (e.target === createKeyModal) closeCreateModal();
    });

    // 限制配置模态框事件
    document.getElementById('limits-modal-close').addEventListener('click', closeLimitsModal);
    document.getElementById('limits-modal-cancel').addEventListener('click', closeLimitsModal);
    document.getElementById('limits-modal-submit').addEventListener('click', saveLimits);
    limitsModal.addEventListener('click', function(e) {
        if (e.target === limitsModal) closeLimitsModal();
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeCreateModal();
            closeLimitsModal();
        }
    });
}

async function loadApiKeys() {
    try {
        const res = await fetch('/api/keys', {
            headers: { 'Authorization': 'Bearer ' + authToken }
        });
        const result = await res.json();
        apiKeys = result.success ? result.data : [];
        renderApiKeys();
    } catch (err) {
        console.error('Load API keys error:', err);
        showToast('加载 API 密钥失败', 'error');
    }
}

function renderApiKeys() {
    const list = document.getElementById('api-keys-list');
    const emptyState = document.getElementById('empty-state');
    const countEl = document.getElementById('api-keys-count');

    countEl.textContent = '共 ' + apiKeys.length + ' 个密钥';

    if (apiKeys.length === 0) {
        list.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
    list.innerHTML = apiKeys.map(function(key) {
        const statusClass = key.isActive ? 'success' : 'error';
        const statusText = key.isActive ? '启用' : '禁用';
        const keyDisplay = key.keyValue || key.keyPrefix || '***';

        // 构建限制显示
        let limitsDisplay = '<span class="usage-loading">-</span>';

        return '<tr>' +
            '<td class="api-key-name-cell">' + key.name + '</td>' +
            '<td>' +
            '<div class="api-key-value-cell">' +
            '<span class="api-key-value">' + keyDisplay + '</span>' +
            '<button class="api-key-copy-btn" onclick="copyApiKey(\'' + keyDisplay + '\')">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">' +
            '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>' +
            '<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>' +
            '</svg> 复制</button>' +
            '</div>' +
            '</td>' +
            '<td><span class="logs-status-badge ' + statusClass + '">' + statusText + '</span></td>' +
            '<td class="api-key-limits" data-key-id="' + key.id + '">' + limitsDisplay + '</td>' +
            '<td>' + formatDateTime(key.createdAt) + '</td>' +
            '<td>' + (key.lastUsedAt ? formatDateTime(key.lastUsedAt) : '从未使用') + '</td>' +
            '<td>' +
            '<div class="api-key-actions-cell">' +
            '<button class="btn btn-secondary btn-sm" onclick="openLimitsModal(' + key.id + ')" title="配置限制">限制</button>' +
            '<button class="btn btn-secondary btn-sm" onclick="toggleApiKey(' + key.id + ')">' + (key.isActive ? '禁用' : '启用') + '</button>' +
            '<button class="btn btn-danger btn-sm" onclick="deleteApiKey(' + key.id + ')">删除</button>' +
            '</div>' +
            '</td>' +
            '</tr>';
    }).join('');

    // 加载用量统计
    apiKeys.forEach(function(key) {
        loadKeyLimitsStatus(key.id);
    });
}

async function loadKeyUsage(keyId) {
    try {
        const res = await fetch('/api/keys/' + keyId + '/usage', {
            headers: { 'Authorization': 'Bearer ' + authToken }
        });
        const result = await res.json();
        if (result.success && result.data) {
            const row = document.querySelector('tr:has(button[onclick*="toggleApiKey(' + keyId + ')"])');
            if (row) {
                const usageCell = row.querySelector('.api-key-usage');
                if (usageCell) {
                    usageCell.innerHTML = '<div class="usage-stats-mini">' +
                        '<div class="usage-stat-item">' + (result.data.totalRequests || 0) + ' 请求</div>' +
                        '</div>';
                }
            }
        }
    } catch (err) {
        console.error('Load key usage error:', err);
    }
}

function openCreateModal() {
    document.getElementById('key-name').value = '';
    document.getElementById('custom-key').value = '';
    createKeyModal.classList.add('active');
}

function closeCreateModal() {
    createKeyModal.classList.remove('active');
}

async function createApiKey() {
    const name = document.getElementById('key-name').value.trim();
    const customKey = document.getElementById('custom-key').value.trim();

    if (!name) {
        showToast('请输入密钥名称', 'error');
        return;
    }

    try {
        const res = await fetch('/api/keys', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + authToken
            },
            body: JSON.stringify({ name: name, customKey: customKey || undefined })
        });

        const result = await res.json();
        if (result.success) {
            showToast('API 密钥创建成功', 'success');
            if (result.data.key) {
                alert('请保存您的 API 密钥（只显示一次）:\n\n' + result.data.key);
            }
            closeCreateModal();
            loadApiKeys();
        } else {
            showToast(result.error || '创建失败', 'error');
        }
    } catch (err) {
        showToast('创建失败: ' + err.message, 'error');
    }
}

async function toggleApiKey(id) {
    try {
        const res = await fetch('/api/keys/' + id + '/toggle', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + authToken }
        });
        const result = await res.json();
        if (result.success) {
            showToast('状态已更新', 'success');
            loadApiKeys();
        } else {
            showToast(result.error || '操作失败', 'error');
        }
    } catch (err) {
        showToast('操作失败: ' + err.message, 'error');
    }
}

async function deleteApiKey(id) {
    if (!confirm('确定要删除此 API 密钥吗？')) return;

    try {
        await fetch('/api/keys/' + id, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + authToken }
        });
        showToast('API 密钥已删除', 'success');
        loadApiKeys();
    } catch (err) {
        showToast('删除失败: ' + err.message, 'error');
    }
}

function copyApiKey(key) {
    copyToClipboard(key);
}

// ============ 限制配置相关函数 ============

async function loadKeyLimitsStatus(keyId) {
    try {
        const res = await fetch('/api/keys/' + keyId + '/limits-status', {
            headers: { 'Authorization': 'Bearer ' + authToken }
        });
        const result = await res.json();
        if (result.success && result.data) {
            const cell = document.querySelector('.api-key-limits[data-key-id="' + keyId + '"]');
            if (cell) {
                const { limits, usage } = result.data;
                let html = '<div class="limits-mini">';

                // 显示今日用量
                if (limits.dailyLimit > 0) {
                    const percent = Math.min(100, (usage.daily / limits.dailyLimit) * 100);
                    html += '<div class="limit-item" title="今日: ' + usage.daily + '/' + limits.dailyLimit + '">' +
                        '<span class="limit-label">日</span>' +
                        '<span class="limit-value ' + (percent >= 90 ? 'warning' : '') + '">' + usage.daily + '/' + limits.dailyLimit + '</span>' +
                        '</div>';
                }

                // 显示本月用量
                if (limits.monthlyLimit > 0) {
                    const percent = Math.min(100, (usage.monthly / limits.monthlyLimit) * 100);
                    html += '<div class="limit-item" title="本月: ' + usage.monthly + '/' + limits.monthlyLimit + '">' +
                        '<span class="limit-label">月</span>' +
                        '<span class="limit-value ' + (percent >= 90 ? 'warning' : '') + '">' + usage.monthly + '/' + limits.monthlyLimit + '</span>' +
                        '</div>';
                }

                // 显示并发限制
                if (limits.concurrentLimit > 0) {
                    html += '<div class="limit-item" title="并发: ' + usage.currentConcurrent + '/' + limits.concurrentLimit + '">' +
                        '<span class="limit-label">并发</span>' +
                        '<span class="limit-value">' + usage.currentConcurrent + '/' + limits.concurrentLimit + '</span>' +
                        '</div>';
                }

                // 如果没有任何限制，显示总请求数
                if (limits.dailyLimit === 0 && limits.monthlyLimit === 0 && limits.concurrentLimit === 0) {
                    html += '<div class="limit-item">' +
                        '<span class="limit-value">' + usage.total + ' 请求</span>' +
                        '</div>';
                }

                html += '</div>';
                cell.innerHTML = html;
            }
        }
    } catch (err) {
        console.error('Load key limits status error:', err);
    }
}

async function openLimitsModal(keyId) {
    try {
        // 获取密钥详情
        const res = await fetch('/api/keys/' + keyId, {
            headers: { 'Authorization': 'Bearer ' + authToken }
        });
        const result = await res.json();
        if (!result.success) {
            showToast(result.error || '获取密钥信息失败', 'error');
            return;
        }

        const key = result.data;
        document.getElementById('limits-key-id').value = keyId;
        document.getElementById('limits-key-name').textContent = key.name;
        document.getElementById('daily-limit').value = key.dailyLimit || 0;
        document.getElementById('monthly-limit').value = key.monthlyLimit || 0;
        document.getElementById('total-limit').value = key.totalLimit || 0;
        document.getElementById('concurrent-limit').value = key.concurrentLimit || 0;
        // 金额限制
        document.getElementById('daily-cost-limit').value = key.dailyCostLimit || 0;
        document.getElementById('monthly-cost-limit').value = key.monthlyCostLimit || 0;
        document.getElementById('total-cost-limit').value = key.totalCostLimit || 0;
        // 有效期
        document.getElementById('expires-in-days').value = key.expiresInDays || 0;

        // 加载当前用量状态
        loadLimitsStatusInModal(keyId);

        limitsModal.classList.add('active');
    } catch (err) {
        showToast('获取密钥信息失败: ' + err.message, 'error');
    }
}

async function loadLimitsStatusInModal(keyId) {
    try {
        const res = await fetch('/api/keys/' + keyId + '/limits-status', {
            headers: { 'Authorization': 'Bearer ' + authToken }
        });
        const result = await res.json();
        if (result.success && result.data) {
            const { usage, remaining } = result.data;
            const statusDiv = document.getElementById('limits-status');
            const gridDiv = document.getElementById('usage-grid');

            let html = '<div class="usage-item"><span class="usage-label">今日请求</span><span class="usage-value">' + usage.daily + '</span></div>' +
                '<div class="usage-item"><span class="usage-label">本月请求</span><span class="usage-value">' + usage.monthly + '</span></div>' +
                '<div class="usage-item"><span class="usage-label">总请求</span><span class="usage-value">' + usage.total + '</span></div>' +
                '<div class="usage-item"><span class="usage-label">今日费用</span><span class="usage-value">$' + (usage.dailyCost || 0).toFixed(4) + '</span></div>' +
                '<div class="usage-item"><span class="usage-label">本月费用</span><span class="usage-value">$' + (usage.monthlyCost || 0).toFixed(4) + '</span></div>' +
                '<div class="usage-item"><span class="usage-label">总费用</span><span class="usage-value">$' + (usage.totalCost || 0).toFixed(4) + '</span></div>';

            if (remaining.days !== null) {
                html += '<div class="usage-item"><span class="usage-label">剩余天数</span><span class="usage-value">' + remaining.days + ' 天</span></div>';
            }

            gridDiv.innerHTML = html;
            statusDiv.style.display = 'block';
        }
    } catch (err) {
        console.error('Load limits status error:', err);
    }
}

function closeLimitsModal() {
    limitsModal.classList.remove('active');
    document.getElementById('limits-status').style.display = 'none';
}

async function saveLimits() {
    const keyId = document.getElementById('limits-key-id').value;
    const dailyLimit = parseInt(document.getElementById('daily-limit').value) || 0;
    const monthlyLimit = parseInt(document.getElementById('monthly-limit').value) || 0;
    const totalLimit = parseInt(document.getElementById('total-limit').value) || 0;
    const concurrentLimit = parseInt(document.getElementById('concurrent-limit').value) || 0;
    // 金额限制
    const dailyCostLimit = parseFloat(document.getElementById('daily-cost-limit').value) || 0;
    const monthlyCostLimit = parseFloat(document.getElementById('monthly-cost-limit').value) || 0;
    const totalCostLimit = parseFloat(document.getElementById('total-cost-limit').value) || 0;
    // 有效期
    const expiresInDays = parseInt(document.getElementById('expires-in-days').value) || 0;

    try {
        const res = await fetch('/api/keys/' + keyId + '/limits', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + authToken
            },
            body: JSON.stringify({
                dailyLimit,
                monthlyLimit,
                totalLimit,
                concurrentLimit,
                dailyCostLimit,
                monthlyCostLimit,
                totalCostLimit,
                expiresInDays
            })
        });

        const result = await res.json();
        if (result.success) {
            showToast('限制配置已保存', 'success');
            closeLimitsModal();
            loadApiKeys();
        } else {
            showToast(result.error || '保存失败', 'error');
        }
    } catch (err) {
        showToast('保存失败: ' + err.message, 'error');
    }
}
