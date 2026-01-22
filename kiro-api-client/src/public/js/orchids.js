/**
 * Orchids Account Manager - Professional UI/UX
 * Enhanced JavaScript for account management
 */

// ============================================
// State Management
// ============================================

const OrchidsState = {
    credentials: [],
    selectedIds: new Set(),
    searchQuery: '',
    currentView: 'grid',
    contextMenuTarget: null,
    detailTarget: null,
    importTab: 'json',
    isLoading: false
};

// ============================================
// DOM Elements Cache
// ============================================

const DOM = {
    // Containers
    cardsGrid: null,
    listView: null,
    emptyState: null,
    loadingState: null,

    // Modals
    addModal: null,
    batchImportModal: null,
    detailModal: null,

    // Context Menu
    contextMenu: null,

    // Stats
    statTotal: null,
    statValid: null,
    statExpiring: null,
    statError: null,

    // Form Elements
    searchInput: null,
    selectAll: null,
    displayedCount: null,
    selectedCount: null,
    batchDeleteBtn: null
};

// ============================================
// Initialization
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    initDOMReferences();
    initSidebarAndAuth();
    setupEventListeners();
    await loadCredentials();
});

function initDOMReferences() {
    // Containers
    DOM.cardsGrid = document.getElementById('cards-grid');
    DOM.listView = document.getElementById('list-view');
    DOM.emptyState = document.getElementById('empty-state');
    DOM.loadingState = document.getElementById('loading-state');

    // Modals
    DOM.addModal = document.getElementById('add-modal');
    DOM.batchImportModal = document.getElementById('batch-import-modal');
    DOM.detailModal = document.getElementById('detail-modal');

    // Context Menu
    DOM.contextMenu = document.getElementById('context-menu');

    // Stats
    DOM.statTotal = document.getElementById('stat-total');
    DOM.statValid = document.getElementById('stat-valid');
    DOM.statExpiring = document.getElementById('stat-expiring');
    DOM.statError = document.getElementById('stat-error');

    // Form Elements
    DOM.searchInput = document.getElementById('search-input');
    DOM.selectAll = document.getElementById('select-all');
    DOM.displayedCount = document.getElementById('displayed-count');
    DOM.selectedCount = document.getElementById('selected-count');
    DOM.batchDeleteBtn = document.getElementById('batch-delete-btn');
}

function initSidebarAndAuth() {
    const sidebarContainer = document.getElementById('sidebar-container');
    if (sidebarContainer && typeof getSidebarHTML === 'function') {
        sidebarContainer.innerHTML = getSidebarHTML();
        initSidebar('orchids');
    }
}

// ============================================
// Event Listeners
// ============================================

function setupEventListeners() {
    // Header Actions
    document.getElementById('add-account-btn')?.addEventListener('click', openAddModal);
    document.getElementById('batch-import-btn')?.addEventListener('click', openBatchImportModal);
    document.getElementById('empty-add-btn')?.addEventListener('click', openAddModal);

    // Add Modal
    document.getElementById('modal-close')?.addEventListener('click', closeAddModal);
    document.getElementById('modal-cancel')?.addEventListener('click', closeAddModal);
    document.getElementById('modal-submit')?.addEventListener('click', handleAddAccount);
    document.getElementById('paste-jwt-btn')?.addEventListener('click', handlePasteJwt);
    DOM.addModal?.addEventListener('click', (e) => {
        if (e.target === DOM.addModal) closeAddModal();
    });

    // Batch Import Modal
    document.getElementById('batch-modal-close')?.addEventListener('click', closeBatchImportModal);
    document.getElementById('batch-modal-cancel')?.addEventListener('click', closeBatchImportModal);
    document.getElementById('batch-modal-submit')?.addEventListener('click', handleBatchImport);
    DOM.batchImportModal?.addEventListener('click', (e) => {
        if (e.target === DOM.batchImportModal) closeBatchImportModal();
    });

    // Import Tabs
    document.querySelectorAll('.import-tab').forEach(tab => {
        tab.addEventListener('click', () => switchImportTab(tab.dataset.tab));
    });

    // Detail Modal
    document.getElementById('detail-modal-close')?.addEventListener('click', closeDetailModal);
    document.getElementById('detail-modal-cancel')?.addEventListener('click', closeDetailModal);
    document.getElementById('detail-test-btn')?.addEventListener('click', () => {
        if (OrchidsState.detailTarget) testCredential(OrchidsState.detailTarget.id);
    });
    document.getElementById('detail-delete-btn')?.addEventListener('click', () => {
        if (OrchidsState.detailTarget) {
            closeDetailModal();
            deleteCredential(OrchidsState.detailTarget.id);
        }
    });
    DOM.detailModal?.addEventListener('click', (e) => {
        if (e.target === DOM.detailModal) closeDetailModal();
    });

    // Search
    DOM.searchInput?.addEventListener('input', (e) => {
        OrchidsState.searchQuery = e.target.value.toLowerCase();
        renderView();
    });

    // Keyboard Shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);

    // Select All
    DOM.selectAll?.addEventListener('change', handleSelectAll);

    // Batch Actions
    document.getElementById('batch-test-btn')?.addEventListener('click', handleBatchTest);
    DOM.batchDeleteBtn?.addEventListener('click', handleBatchDelete);

    // View Toggle
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => switchView(btn.dataset.view));
    });

    // Context Menu
    document.addEventListener('click', hideContextMenu);
    DOM.contextMenu?.addEventListener('click', handleContextMenuAction);
}

function handleKeyboardShortcuts(e) {
    // Cmd/Ctrl + K for search
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        DOM.searchInput?.focus();
    }

    // Escape to close modals
    if (e.key === 'Escape') {
        closeAddModal();
        closeBatchImportModal();
        closeDetailModal();
        hideContextMenu();
    }
}

// ============================================
// Data Loading
// ============================================

async function loadCredentials() {
    showLoading(true);

    try {
        if (typeof checkAuth === 'function' && !await checkAuth()) {
            return;
        }

        const response = await fetch('/api/orchids/credentials', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        });

        if (!response.ok) {
            if (response.status === 401 && typeof logout === 'function') {
                logout();
                return;
            }
            throw new Error('加载失败');
        }

        const data = await response.json();
        OrchidsState.credentials = data.data || [];
        renderView();
        updateStats();
    } catch (error) {
        showToast('加载凭证失败: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// ============================================
// Rendering
// ============================================

function renderView() {
    const filtered = getFilteredCredentials();
    DOM.displayedCount.textContent = filtered.length;

    if (filtered.length === 0) {
        DOM.cardsGrid.style.display = 'none';
        DOM.listView.style.display = 'none';
        DOM.emptyState.style.display = 'flex';
        return;
    }

    DOM.emptyState.style.display = 'none';

    if (OrchidsState.currentView === 'grid') {
        DOM.cardsGrid.style.display = 'grid';
        DOM.listView.style.display = 'none';
        renderGridView(filtered);
    } else {
        DOM.cardsGrid.style.display = 'none';
        DOM.listView.style.display = 'block';
        renderListView(filtered);
    }

    updateBatchDeleteBtn();
}

function renderGridView(credentials) {
    DOM.cardsGrid.innerHTML = credentials.map(cred => createCardHTML(cred)).join('');
    bindCardEvents(credentials);
}

function renderListView(credentials) {
    DOM.listView.innerHTML = `
        <div class="orchids-list-header">
            <div></div>
            <div>账号</div>
            <div>User ID</div>
            <div>状态</div>
            <div>过期时间</div>
            <div>操作</div>
        </div>
        ${credentials.map(cred => createListItemHTML(cred)).join('')}
    `;
    bindCardEvents(credentials);
}

function createCardHTML(cred) {
    const status = getCredentialStatus(cred);
    const initial = getInitial(cred.name || cred.email);

    return `
        <div class="orchids-card ${cred.isActive ? 'active' : ''} ${OrchidsState.selectedIds.has(cred.id) ? 'selected' : ''}"
             data-id="${cred.id}">
            <div class="orchids-card-header">
                <input type="checkbox" class="checkbox-custom orchids-card-checkbox"
                       ${OrchidsState.selectedIds.has(cred.id) ? 'checked' : ''}>
                <div class="orchids-card-avatar">
                    ${initial}
                    <span class="orchids-card-avatar-status ${status.class}"></span>
                </div>
                <div class="orchids-card-info">
                    <div class="orchids-card-name">
                        <span>${escapeHtml(cred.name)}</span>
                    </div>
                    ${cred.email ? `<div class="orchids-card-email">${escapeHtml(cred.email)}</div>` : ''}
                </div>
                <div class="orchids-card-badges">
                    ${cred.isActive ? `
                        <span class="orchids-badge active">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="20 6 9 17 4 12"/>
                            </svg>
                            活跃
                        </span>
                    ` : ''}
                    <span class="orchids-badge ${status.class}">${status.text}</span>
                </div>
            </div>
            <div class="orchids-card-body">
                <div class="orchids-card-details">
                    ${cred.userId ? `
                        <div class="orchids-detail-item">
                            <span class="orchids-detail-label">User ID</span>
                            <span class="orchids-detail-value mono">${escapeHtml(cred.userId.substring(0, 16))}...</span>
                        </div>
                    ` : ''}
                    <div class="orchids-detail-item">
                        <span class="orchids-detail-label">过期时间</span>
                        <span class="orchids-detail-value ${status.class}">${cred.expiresAt ? formatDate(new Date(cred.expiresAt)) : '-'}</span>
                    </div>
                    ${cred.errorCount > 0 ? `
                        <div class="orchids-detail-item">
                            <span class="orchids-detail-label">错误次数</span>
                            <span class="orchids-detail-value error">${cred.errorCount}</span>
                        </div>
                    ` : ''}
                    <div class="orchids-detail-item">
                        <span class="orchids-detail-label">创建时间</span>
                        <span class="orchids-detail-value">${formatDate(new Date(cred.createdAt))}</span>
                    </div>
                </div>
            </div>
            <div class="orchids-card-footer">
                <div class="orchids-card-time">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                    </svg>
                    ${getTimeAgo(cred.createdAt)}
                </div>
                <div class="orchids-card-actions">
                    <button class="orchids-action-btn primary" data-action="detail" title="查看详情">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="12" y1="16" x2="12" y2="12"/>
                            <line x1="12" y1="8" x2="12.01" y2="8"/>
                        </svg>
                    </button>
                    <button class="orchids-action-btn" data-action="test" title="测试连接">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                        </svg>
                    </button>
                    <button class="orchids-action-btn danger" data-action="delete" title="删除">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    `;
}

function createListItemHTML(cred) {
    const status = getCredentialStatus(cred);
    const initial = getInitial(cred.name || cred.email);

    return `
        <div class="orchids-list-item ${OrchidsState.selectedIds.has(cred.id) ? 'selected' : ''}" data-id="${cred.id}">
            <div>
                <input type="checkbox" class="checkbox-custom orchids-card-checkbox"
                       ${OrchidsState.selectedIds.has(cred.id) ? 'checked' : ''}>
            </div>
            <div class="orchids-list-name">
                <div class="orchids-list-avatar">${initial}</div>
                <div class="orchids-list-info">
                    <div class="orchids-list-title">${escapeHtml(cred.name)}</div>
                    ${cred.email ? `<div class="orchids-list-subtitle">${escapeHtml(cred.email)}</div>` : ''}
                </div>
            </div>
            <div class="orchids-list-cell mono">${cred.userId ? cred.userId.substring(0, 12) + '...' : '-'}</div>
            <div class="orchids-list-cell">
                <span class="orchids-badge ${status.class}">${status.text}</span>
            </div>
            <div class="orchids-list-cell">${cred.expiresAt ? formatDate(new Date(cred.expiresAt)) : '-'}</div>
            <div class="orchids-list-actions">
                <button class="orchids-action-btn" data-action="test" title="测试">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                    </svg>
                </button>
                <button class="orchids-action-btn danger" data-action="delete" title="删除">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
            </div>
        </div>
    `;
}

// ============================================
// Event Binding
// ============================================

function bindCardEvents(credentials) {
    credentials.forEach(cred => {
        const card = document.querySelector(`[data-id="${cred.id}"]`);
        if (!card) return;

        // Checkbox
        const checkbox = card.querySelector('.orchids-card-checkbox');
        if (checkbox) {
            checkbox.addEventListener('change', (e) => {
                e.stopPropagation();
                toggleSelection(cred.id, e.target.checked);
            });
        }

        // Context Menu
        card.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showContextMenu(e, cred);
        });

        // Action Buttons
        card.querySelectorAll('.orchids-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                handleCardAction(action, cred);
            });
        });

        // Card Click for Detail
        card.addEventListener('click', (e) => {
            if (e.target.closest('.orchids-action-btn') || e.target.closest('.orchids-card-checkbox')) return;
            openDetailModal(cred);
        });
    });
}

function handleCardAction(action, cred) {
    switch (action) {
        case 'detail':
            openDetailModal(cred);
            break;
        case 'test':
            testCredential(cred.id);
            break;
        case 'delete':
            deleteCredential(cred.id);
            break;
        case 'activate':
            activateCredential(cred.id);
            break;
        case 'copy':
            copyToken(cred);
            break;
    }
}

// ============================================
// Selection Management
// ============================================

function toggleSelection(id, selected) {
    if (selected) {
        OrchidsState.selectedIds.add(id);
    } else {
        OrchidsState.selectedIds.delete(id);
    }
    updateBatchDeleteBtn();
    updateSelectAllCheckbox();
}

function handleSelectAll(e) {
    const filtered = getFilteredCredentials();
    if (e.target.checked) {
        filtered.forEach(c => OrchidsState.selectedIds.add(c.id));
    } else {
        OrchidsState.selectedIds.clear();
    }
    renderView();
}

function updateSelectAllCheckbox() {
    const filtered = getFilteredCredentials();
    if (DOM.selectAll) {
        DOM.selectAll.checked = filtered.length > 0 && filtered.every(c => OrchidsState.selectedIds.has(c.id));
        DOM.selectAll.indeterminate = OrchidsState.selectedIds.size > 0 && !DOM.selectAll.checked;
    }
}

function updateBatchDeleteBtn() {
    if (DOM.batchDeleteBtn) {
        DOM.batchDeleteBtn.style.display = OrchidsState.selectedIds.size > 0 ? 'inline-flex' : 'none';
    }
    if (DOM.selectedCount) {
        DOM.selectedCount.textContent = OrchidsState.selectedIds.size;
    }
}

// ============================================
// View Switching
// ============================================

function switchView(view) {
    OrchidsState.currentView = view;
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });
    renderView();
}

// ============================================
// Modal Functions
// ============================================

function openAddModal() {
    document.getElementById('account-name').value = '';
    document.getElementById('account-email').value = '';
    document.getElementById('client-jwt').value = '';
    DOM.addModal?.classList.add('active');
}

function closeAddModal() {
    DOM.addModal?.classList.remove('active');
}

function openBatchImportModal() {
    document.getElementById('batch-import-json').value = '';
    document.getElementById('batch-import-text').value = '';
    switchImportTab('json');
    DOM.batchImportModal?.classList.add('active');
}

function closeBatchImportModal() {
    DOM.batchImportModal?.classList.remove('active');
}

function switchImportTab(tab) {
    OrchidsState.importTab = tab;
    document.querySelectorAll('.import-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tab);
    });
    document.querySelectorAll('.import-panel').forEach(p => {
        p.classList.toggle('active', p.id === `${tab}-panel`);
    });
}

function openDetailModal(cred) {
    OrchidsState.detailTarget = cred;
    const status = getCredentialStatus(cred);

    document.getElementById('detail-modal-title').textContent = cred.name;
    document.getElementById('detail-modal-subtitle').textContent = cred.email || '无邮箱';

    const body = document.getElementById('detail-modal-body');
    body.innerHTML = `
        <div class="detail-sections">
            <div class="detail-section">
                <div class="detail-section-title">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="16" x2="12" y2="12"/>
                        <line x1="12" y1="8" x2="12.01" y2="8"/>
                    </svg>
                    基本信息
                </div>
                <div class="detail-grid">
                    <div class="detail-item">
                        <span class="detail-label">账号名称</span>
                        <span class="detail-value">${escapeHtml(cred.name)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">邮箱地址</span>
                        <span class="detail-value">${cred.email ? escapeHtml(cred.email) : '-'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">状态</span>
                        <span class="status-indicator ${status.class}">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                ${status.class === 'valid' ? '<polyline points="20 6 9 17 4 12"/>' :
                                  status.class === 'expiring' ? '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>' :
                                  '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>'}
                            </svg>
                            ${status.text}
                        </span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">活跃状态</span>
                        <span class="detail-value ${cred.isActive ? 'success' : ''}">${cred.isActive ? '当前活跃' : '未激活'}</span>
                    </div>
                </div>
            </div>

            <div class="detail-section">
                <div class="detail-section-title">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    凭证信息
                </div>
                <div class="detail-grid">
                    <div class="detail-item">
                        <span class="detail-label">User ID</span>
                        <span class="detail-value mono">${cred.userId || '-'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Session ID</span>
                        <span class="detail-value mono">${cred.clerkSessionId || '-'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">过期时间</span>
                        <span class="detail-value ${status.class}">${cred.expiresAt ? formatDate(new Date(cred.expiresAt)) : '-'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">错误次数</span>
                        <span class="detail-value ${cred.errorCount > 0 ? 'error' : ''}">${cred.errorCount || 0}</span>
                    </div>
                    ${cred.lastError ? `
                        <div class="detail-item full-width">
                            <span class="detail-label">最后错误</span>
                            <span class="detail-value error">${escapeHtml(cred.lastError)}</span>
                        </div>
                    ` : ''}
                </div>
            </div>

            <div class="detail-section">
                <div class="detail-section-title">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                    </svg>
                    时间信息
                </div>
                <div class="detail-grid">
                    <div class="detail-item">
                        <span class="detail-label">创建时间</span>
                        <span class="detail-value">${formatDate(new Date(cred.createdAt))}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">更新时间</span>
                        <span class="detail-value">${cred.updatedAt ? formatDate(new Date(cred.updatedAt)) : '-'}</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    DOM.detailModal?.classList.add('active');
}

function closeDetailModal() {
    DOM.detailModal?.classList.remove('active');
    OrchidsState.detailTarget = null;
}

// ============================================
// Context Menu
// ============================================

function showContextMenu(e, cred) {
    OrchidsState.contextMenuTarget = cred;
    DOM.contextMenu.style.display = 'block';
    DOM.contextMenu.style.left = `${e.pageX}px`;
    DOM.contextMenu.style.top = `${e.pageY}px`;

    // Adjust position if menu goes off screen
    const rect = DOM.contextMenu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
        DOM.contextMenu.style.left = `${e.pageX - rect.width}px`;
    }
    if (rect.bottom > window.innerHeight) {
        DOM.contextMenu.style.top = `${e.pageY - rect.height}px`;
    }
}

function hideContextMenu() {
    if (DOM.contextMenu) {
        DOM.contextMenu.style.display = 'none';
    }
    OrchidsState.contextMenuTarget = null;
}

function handleContextMenuAction(e) {
    const item = e.target.closest('.context-menu-item');
    if (!item || !OrchidsState.contextMenuTarget) return;

    const action = item.dataset.action;
    handleCardAction(action, OrchidsState.contextMenuTarget);
    hideContextMenu();
}

// ============================================
// API Operations
// ============================================

async function handleAddAccount() {
    const name = document.getElementById('account-name').value.trim();
    const email = document.getElementById('account-email').value.trim();
    const clientJwt = document.getElementById('client-jwt').value.trim();

    if (!name || !clientJwt) {
        showToast('请填写账号名称和 Client JWT', 'error');
        return;
    }

    try {
        const response = await fetch('/api/orchids/credentials', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: JSON.stringify({ name, email, clientJwt })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || '添加失败');
        }

        showToast('账号添加成功', 'success');
        closeAddModal();
        await loadCredentials();
    } catch (error) {
        showToast('添加失败: ' + error.message, 'error');
    }
}

async function handlePasteJwt() {
    try {
        const text = await navigator.clipboard.readText();
        document.getElementById('client-jwt').value = text;
        showToast('已粘贴', 'success');
    } catch (error) {
        showToast('无法访问剪贴板', 'error');
    }
}

async function handleBatchImport() {
    let accounts;

    try {
        if (OrchidsState.importTab === 'json') {
            const jsonText = document.getElementById('batch-import-json').value.trim();
            if (!jsonText) {
                showToast('请输入 JSON 数据', 'error');
                return;
            }
            accounts = JSON.parse(jsonText);
        } else {
            const textData = document.getElementById('batch-import-text').value.trim();
            if (!textData) {
                showToast('请输入账号数据', 'error');
                return;
            }
            accounts = parseTextImport(textData);
        }

        if (!Array.isArray(accounts) || accounts.length === 0) {
            showToast('数据格式错误或为空', 'error');
            return;
        }
    } catch (error) {
        showToast('数据解析失败: ' + error.message, 'error');
        return;
    }

    try {
        showToast('正在导入...', 'info');

        const response = await fetch('/api/orchids/credentials/batch-import', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: JSON.stringify({ accounts })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || '导入失败');
        }

        const result = data.data;
        showToast(`导入完成: 成功 ${result.success} 个，失败 ${result.failed} 个`,
                  result.failed > 0 ? 'warning' : 'success');

        closeBatchImportModal();
        await loadCredentials();
    } catch (error) {
        showToast('导入失败: ' + error.message, 'error');
    }
}

function parseTextImport(text) {
    return text.split('\n')
        .map(line => line.trim())
        .filter(line => line)
        .map(line => {
            const parts = line.split(/\s+/);
            if (parts.length >= 2) {
                return { email: parts[0], clientJwt: parts[1] };
            } else if (parts.length === 1) {
                return { clientJwt: parts[0] };
            }
            return null;
        })
        .filter(Boolean);
}

async function testCredential(id) {
    const card = document.querySelector(`[data-id="${id}"]`);
    card?.classList.add('testing');

    try {
        showToast('正在测试...', 'info');

        const response = await fetch(`/api/orchids/credentials/${id}/test`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || '测试失败');
        }

        if (data.valid) {
            showToast('Token 有效', 'success');
        } else {
            showToast('Token 无效: ' + (data.error || '未知错误'), 'error');
        }

        await loadCredentials();
    } catch (error) {
        showToast('测试失败: ' + error.message, 'error');
    } finally {
        card?.classList.remove('testing');
    }
}

async function deleteCredential(id) {
    if (!confirm('确定要删除此账号吗？此操作不可恢复。')) return;

    try {
        const response = await fetch(`/api/orchids/credentials/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || '删除失败');
        }

        showToast('删除成功', 'success');
        OrchidsState.selectedIds.delete(id);
        await loadCredentials();
    } catch (error) {
        showToast('删除失败: ' + error.message, 'error');
    }
}

async function activateCredential(id) {
    try {
        const response = await fetch(`/api/orchids/credentials/${id}/activate`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || '激活失败');
        }

        showToast('已设为活跃账号', 'success');
        await loadCredentials();
    } catch (error) {
        showToast('激活失败: ' + error.message, 'error');
    }
}

async function copyToken(cred) {
    try {
        await navigator.clipboard.writeText(cred.clientJwt);
        showToast('Token 已复制到剪贴板', 'success');
    } catch (error) {
        showToast('复制失败', 'error');
    }
}

async function handleBatchTest() {
    const ids = OrchidsState.selectedIds.size > 0
        ? Array.from(OrchidsState.selectedIds)
        : OrchidsState.credentials.map(c => c.id);

    if (ids.length === 0) {
        showToast('没有可测试的账号', 'warning');
        return;
    }

    showToast(`正在测试 ${ids.length} 个账号...`, 'info');

    let successCount = 0;
    let failCount = 0;

    for (const id of ids) {
        try {
            const response = await fetch(`/api/orchids/credentials/${id}/test`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            const data = await response.json();
            if (data.valid) {
                successCount++;
            } else {
                failCount++;
            }
        } catch {
            failCount++;
        }
    }

    showToast(`测试完成: ${successCount} 个有效，${failCount} 个无效`, failCount > 0 ? 'warning' : 'success');
    await loadCredentials();
}

async function handleBatchDelete() {
    if (OrchidsState.selectedIds.size === 0) return;

    if (!confirm(`确定要删除选中的 ${OrchidsState.selectedIds.size} 个账号吗？此操作不可恢复。`)) return;

    let successCount = 0;
    let failCount = 0;

    for (const id of OrchidsState.selectedIds) {
        try {
            const response = await fetch(`/api/orchids/credentials/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
            });

            if (response.ok) {
                successCount++;
            } else {
                failCount++;
            }
        } catch {
            failCount++;
        }
    }

    OrchidsState.selectedIds.clear();
    showToast(`删除完成: 成功 ${successCount} 个，失败 ${failCount} 个`,
              failCount > 0 ? 'warning' : 'success');
    await loadCredentials();
}

// ============================================
// Utility Functions
// ============================================

function getFilteredCredentials() {
    return OrchidsState.credentials.filter(c => {
        if (!OrchidsState.searchQuery) return true;
        const query = OrchidsState.searchQuery.toLowerCase();
        return (c.name && c.name.toLowerCase().includes(query)) ||
               (c.email && c.email.toLowerCase().includes(query)) ||
               (c.userId && c.userId.toLowerCase().includes(query));
    });
}

function getCredentialStatus(cred) {
    const now = new Date();
    const expiresAt = cred.expiresAt ? new Date(cred.expiresAt) : null;

    if (cred.errorCount > 0) {
        return { class: 'error', text: '错误' };
    }
    if (expiresAt && expiresAt < now) {
        return { class: 'expired', text: '已过期' };
    }
    if (expiresAt && (expiresAt - now) < 10 * 60 * 1000) {
        return { class: 'expiring', text: '即将过期' };
    }
    return { class: 'valid', text: '正常' };
}

function updateStats() {
    const now = new Date();
    const total = OrchidsState.credentials.length;
    const valid = OrchidsState.credentials.filter(c => {
        const expiresAt = c.expiresAt ? new Date(c.expiresAt) : null;
        return c.errorCount === 0 && (!expiresAt || expiresAt > now);
    }).length;
    const expiring = OrchidsState.credentials.filter(c => {
        const expiresAt = c.expiresAt ? new Date(c.expiresAt) : null;
        return expiresAt && expiresAt > now && (expiresAt - now) < 10 * 60 * 1000;
    }).length;
    const error = OrchidsState.credentials.filter(c => c.errorCount > 0).length;

    if (DOM.statTotal) DOM.statTotal.textContent = total;
    if (DOM.statValid) DOM.statValid.textContent = valid;
    if (DOM.statExpiring) DOM.statExpiring.textContent = expiring;
    if (DOM.statError) DOM.statError.textContent = error;
}

function showLoading(show) {
    OrchidsState.isLoading = show;
    if (DOM.loadingState) {
        DOM.loadingState.style.display = show ? 'flex' : 'none';
    }
    if (DOM.cardsGrid && show) {
        DOM.cardsGrid.style.display = 'none';
    }
    if (DOM.listView && show) {
        DOM.listView.style.display = 'none';
    }
}

function getInitial(str) {
    if (!str) return '?';
    return str.charAt(0).toUpperCase();
}

function getTimeAgo(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes} 分钟前`;
    if (hours < 24) return `${hours} 小时前`;
    if (days < 30) return `${days} 天前`;
    return formatDate(date);
}

function formatDate(date) {
    if (!date || isNaN(date.getTime())) return '-';
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
