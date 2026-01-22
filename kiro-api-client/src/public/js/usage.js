// ============ 用量统计页面 JS ============

let apiKeys = [];
let currentKeyId = null;

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('sidebar-container').innerHTML = getSidebarHTML();
    initSidebar('usage');

    if (!await checkAuth()) return;

    // 检查 URL 参数
    const urlParams = new URLSearchParams(window.location.search);
    const keyId = urlParams.get('keyId');
    if (keyId) {
        currentKeyId = parseInt(keyId);
    }

    await loadApiKeys();
    loadUsageStats();
    setupEventListeners();
    updateSidebarStats();
});

function setupEventListeners() {
    document.getElementById('usage-search-btn').addEventListener('click', loadUsageStats);
    document.getElementById('usage-reset-btn').addEventListener('click', resetFilters);

    document.getElementById('usage-filter-key').addEventListener('change', function() {
        currentKeyId = this.value ? parseInt(this.value) : null;
        loadUsageStats();
    });
}

async function loadApiKeys() {
    try {
        const res = await fetch('/api/keys', {
            headers: { 'Authorization': 'Bearer ' + authToken }
        });
        const result = await res.json();
        if (result.success) {
            apiKeys = result.data || [];
            renderKeyOptions();
        }
    } catch (err) {
        console.error('Load API keys error:', err);
    }
}

function renderKeyOptions() {
    const select = document.getElementById('usage-filter-key');
    select.innerHTML = '<option value="">全部密钥</option>';

    apiKeys.forEach(function(key) {
        const option = document.createElement('option');
        option.value = key.id;
        option.textContent = key.name + ' (' + key.keyPrefix + ')';
        if (currentKeyId && key.id === currentKeyId) {
            option.selected = true;
        }
        select.appendChild(option);
    });
}

async function loadUsageStats() {
    const startDate = document.getElementById('usage-filter-start').value;
    const endDate = document.getElementById('usage-filter-end').value;

    let url = '/api/logs-stats/cost?';
    if (startDate) url += 'startDate=' + startDate + '&';
    if (endDate) url += 'endDate=' + endDate + '&';

    // 如果选择了特定 Key，使用单独的 API
    if (currentKeyId) {
        url = '/api/keys/' + currentKeyId + '/cost?';
        if (startDate) url += 'startDate=' + startDate + '&';
        if (endDate) url += 'endDate=' + endDate + '&';
    }

    try {
        const res = await fetch(url, {
            headers: { 'Authorization': 'Bearer ' + authToken }
        });
        const result = await res.json();

        if (result.success && result.data) {
            renderStats(result.data);
        } else {
            showToast(result.error || '加载统计失败', 'error');
        }
    } catch (err) {
        console.error('Load usage stats error:', err);
        showToast('加载统计失败', 'error');
    }
}

function renderStats(data) {
    const summary = data.summary || {};
    const modelStats = data.byModel || data.models || [];
    const keyStats = data.byApiKey || [];

    // 更新汇总卡片
    document.getElementById('summary-requests').textContent = formatNumber(summary.totalRequests || 0);
    document.getElementById('summary-input-tokens').textContent = formatNumber(summary.totalInputTokens || 0);
    document.getElementById('summary-output-tokens').textContent = formatNumber(summary.totalOutputTokens || 0);
    document.getElementById('summary-cost').textContent = '$' + (summary.totalCost || 0).toFixed(4);

    // 渲染模型统计表格
    renderModelStats(modelStats);

    // 渲染 API Key 统计表格（仅在查看全部时显示）
    if (!currentKeyId) {
        renderKeyStats(keyStats);
        document.querySelector('.usage-section:last-child').style.display = 'block';
    } else {
        document.querySelector('.usage-section:last-child').style.display = 'none';
    }
}

function renderModelStats(stats) {
    const list = document.getElementById('model-stats-list');

    if (!stats || stats.length === 0) {
        list.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">暂无数据</td></tr>';
        return;
    }

    list.innerHTML = stats.map(function(stat) {
        return '<tr>' +
            '<td class="model-name-cell">' + formatModelName(stat.model) + '</td>' +
            '<td>' + formatNumber(stat.requestCount) + '</td>' +
            '<td>' + formatNumber(stat.inputTokens) + '</td>' +
            '<td>' + formatNumber(stat.outputTokens) + '</td>' +
            '<td class="cost-cell">$' + (stat.inputCost || 0).toFixed(4) + '</td>' +
            '<td class="cost-cell">$' + (stat.outputCost || 0).toFixed(4) + '</td>' +
            '<td class="cost-cell total">$' + (stat.totalCost || 0).toFixed(4) + '</td>' +
            '</tr>';
    }).join('');
}

function renderKeyStats(stats) {
    const list = document.getElementById('key-stats-list');

    if (!stats || stats.length === 0) {
        list.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">暂无数据</td></tr>';
        return;
    }

    list.innerHTML = stats.map(function(stat) {
        return '<tr>' +
            '<td><span class="key-prefix-cell">' + (stat.apiKeyPrefix || '-') + '</span></td>' +
            '<td>' + (stat.apiKeyName || '-') + '</td>' +
            '<td>' + formatNumber(stat.requestCount) + '</td>' +
            '<td>' + formatNumber(stat.inputTokens) + '</td>' +
            '<td>' + formatNumber(stat.outputTokens) + '</td>' +
            '<td class="cost-cell total">$' + (stat.totalCost || 0).toFixed(4) + '</td>' +
            '<td>' +
            '<button class="btn btn-secondary btn-sm" onclick="viewKeyUsage(' + stat.apiKeyId + ')">查看详情</button> ' +
            '<button class="btn btn-secondary btn-sm" onclick="viewKeyLogs(' + stat.apiKeyId + ')">查看日志</button>' +
            '</td>' +
            '</tr>';
    }).join('');
}

function viewKeyUsage(keyId) {
    document.getElementById('usage-filter-key').value = keyId;
    currentKeyId = keyId;
    loadUsageStats();
}

function viewKeyLogs(keyId) {
    // 跳转到日志页面并带上 API Key 筛选参数
    const key = apiKeys.find(k => k.id === keyId);
    if (key) {
        window.location.href = '/pages/logs.html?apiKey=' + encodeURIComponent(key.keyPrefix);
    }
}

function resetFilters() {
    document.getElementById('usage-filter-key').value = '';
    document.getElementById('usage-filter-start').value = '';
    document.getElementById('usage-filter-end').value = '';
    currentKeyId = null;

    // 清除 URL 参数
    window.history.replaceState({}, '', window.location.pathname);

    loadUsageStats();
}

function formatModelName(model) {
    if (!model) return '-';
    const modelMap = {
        'claude-opus-4-5-20251101': 'Claude Opus 4.5',
        'claude-opus-4.5': 'Claude Opus 4.5',
        'claude-sonnet-4-20250514': 'Claude Sonnet 4',
        'claude-sonnet-4-5-20250929': 'Claude Sonnet 4.5',
        'claude-3-7-sonnet-20250219': 'Claude 3.7 Sonnet',
        'claude-3-5-sonnet-20241022': 'Claude 3.5 Sonnet',
        'claude-3-5-haiku-20241022': 'Claude 3.5 Haiku',
        'claude-haiku-4-5': 'Claude Haiku 4.5',
        'claude-3-opus-20240229': 'Claude 3 Opus',
        'claude-3-sonnet-20240229': 'Claude 3 Sonnet',
        'claude-3-haiku-20240307': 'Claude 3 Haiku'
    };
    return modelMap[model] || model;
}

function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(2) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(2) + 'K';
    }
    return num.toString();
}
