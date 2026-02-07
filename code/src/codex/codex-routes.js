/**
 * Codex 路由模块
 */
import { CodexCredentialStore } from '../db.js';
import { CodexService, CODEX_MODELS } from './codex-service.js';
import { startCodexOAuth, completeCodexOAuth, refreshCodexToken } from './codex-auth.js';

/**
 * 设置 Codex 路由
 */
export function setupCodexRoutes(app, authMiddleware) {
    // ============ Codex 凭证管理 API ============

    // 获取所有凭证
    app.get('/api/codex/credentials', authMiddleware, async (req, res) => {
        try {
            const store = await CodexCredentialStore.create();
            const credentials = await store.getAll();
            const safeCredentials = credentials.map(c => ({
                ...c,
                accessToken: c.accessToken ? '***' : null,
                refreshToken: c.refreshToken ? '***' : null,
                idToken: c.idToken ? '***' : null
            }));
            res.json({ success: true, data: safeCredentials });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // 获取单个凭证
    app.get('/api/codex/credentials/:id', authMiddleware, async (req, res) => {
        try {
            const store = await CodexCredentialStore.create();
            const credential = await store.getById(parseInt(req.params.id));
            if (!credential) {
                return res.status(404).json({ success: false, error: '凭证不存在' });
            }
            res.json({
                success: true,
                data: {
                    ...credential,
                    accessToken: credential.accessToken ? '***' : null,
                    refreshToken: credential.refreshToken ? '***' : null,
                    idToken: credential.idToken ? '***' : null
                }
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // 创建凭证
    app.post('/api/codex/credentials', authMiddleware, async (req, res) => {
        try {
            const { name, refreshToken, email, accountId, note } = req.body;
            if (!name || !refreshToken) {
                return res.status(400).json({ success: false, error: '名称和 refreshToken 是必填项' });
            }
            const store = await CodexCredentialStore.create();
            const existing = await store.getByName(name);
            if (existing) {
                return res.status(400).json({ success: false, error: '凭证名称已存在' });
            }
            const id = await store.create({ name, refreshToken, email: email || null, accountId: accountId || null, note: note || null });
            res.json({ success: true, data: { id }, message: '凭证创建成功' });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // 更新凭证
    app.put('/api/codex/credentials/:id', authMiddleware, async (req, res) => {
        try {
            const store = await CodexCredentialStore.create();
            const credential = await store.getById(parseInt(req.params.id));
            if (!credential) {
                return res.status(404).json({ success: false, error: '凭证不存在' });
            }
            await store.update(parseInt(req.params.id), req.body);
            res.json({ success: true, message: '凭证更新成功' });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // 删除凭证
    app.delete('/api/codex/credentials/:id', authMiddleware, async (req, res) => {
        try {
            const store = await CodexCredentialStore.create();
            await store.delete(parseInt(req.params.id));
            res.json({ success: true, message: '凭证删除成功' });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // 刷新凭证 Token
    app.post('/api/codex/credentials/:id/refresh', authMiddleware, async (req, res) => {
        try {
            const store = await CodexCredentialStore.create();
            const credential = await store.getById(parseInt(req.params.id));
            if (!credential) {
                return res.status(404).json({ success: false, error: '凭证不存在' });
            }
            const newTokens = await refreshCodexToken(credential.refreshToken);
            await store.updateTokens(credential.id, newTokens);
            res.json({ success: true, message: 'Token 刷新成功', data: { email: newTokens.email, expiresAt: newTokens.expiresAt } });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // 测试凭证
    app.post('/api/codex/credentials/:id/test', authMiddleware, async (req, res) => {
        try {
            const service = await CodexService.fromDatabase(parseInt(req.params.id));
            const result = await service.testCredential();
            res.json({ success: result.success, message: result.message });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // 获取凭证使用限制
    app.get('/api/codex/credentials/:id/usage', authMiddleware, async (req, res) => {
        try {
            const service = await CodexService.fromDatabase(parseInt(req.params.id));
            const usage = await service.getUsageLimits();
            res.json({ success: true, data: usage });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // 获取统计信息
    app.get('/api/codex/statistics', authMiddleware, async (req, res) => {
        try {
            const store = await CodexCredentialStore.create();
            const stats = await store.getStatistics();
            res.json({ success: true, data: stats });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // ============ OAuth 认证 ============

    app.post('/api/codex/oauth/start', authMiddleware, async (req, res) => {
        try {
            const result = await startCodexOAuth();
            res.json(result);
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.get('/api/codex/oauth/callback', async (req, res) => {
        try {
            const { code, state } = req.query;
            if (!code || !state) {
                return res.status(400).json({ success: false, error: '缺少 code 或 state 参数' });
            }
            const credentials = await completeCodexOAuth(code, state);
            const store = await CodexCredentialStore.create();
            const name = credentials.email || `codex-${Date.now()}`;
            let existing = await store.getByEmail(credentials.email);
            if (existing) {
                await store.updateTokens(existing.id, credentials);
                res.json({ success: true, message: '凭证已更新', data: { id: existing.id, email: credentials.email } });
            } else {
                const id = await store.create({
                    name, email: credentials.email, accountId: credentials.accountId,
                    accessToken: credentials.accessToken, refreshToken: credentials.refreshToken,
                    idToken: credentials.idToken, expiresAt: credentials.expiresAt
                });
                res.json({ success: true, message: '凭证已保存', data: { id, email: credentials.email } });
            }
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // ============ Codex 模型列表 ============

    app.get('/api/codex/models', (req, res) => {
        res.json({
            success: true,
            data: CODEX_MODELS.map(id => ({ id, object: 'model', created: Math.floor(Date.now() / 1000), owned_by: 'openai' }))
        });
    });

    // ============ Codex OpenAI 兼容聊天端点 ============

    app.post('/codex/v1/chat/completions', async (req, res) => {
        const startTime = Date.now();
        const requestId = 'chatcmpl-' + Date.now() + Math.random().toString(36).substring(2, 8);

        try {
            if (!req.body || typeof req.body !== 'object') {
                return res.status(400).json({ error: { message: '请求体无效', type: 'invalid_request_error' } });
            }

            const { model, messages, stream } = req.body;
            const targetModel = model || 'gpt-5';
            if (!CODEX_MODELS.includes(targetModel)) {
        return res.status(400).json({ error: { message: `不支持的模型: ${targetModel}`, type: 'invalid_request_error' } });
            }

            const service = await CodexService.fromRandomActive();

            let systemPrompt = '';
            const convertedMessages = [];
            for (const msg of messages) {
                if (msg.role === 'system') {
                    systemPrompt += (systemPrompt ? '\n' : '') + (typeof msg.content === 'string' ? msg.content : msg.content.map(c => c.text || '').join(''));
                } else if (msg.role === 'user' || msg.role === 'assistant') {
                    let content = msg.content;
                    if (Array.isArray(content)) content = content.map(c => c.type === 'text' ? c.text : '').join('');
                    convertedMessages.push({ role: msg.role, content });
                }
            }

            if (stream) {
                res.setHeader('Content-Type', 'text/event-stream');
                res.setHeader('Cache-Control', 'no-cache');
                res.setHeader('Connection', 'keep-alive');

                try {
                    for await (const event of service.chatStream(targetModel, convertedMessages, { system: systemPrompt })) {
                        if (event.type === 'content' && event.data) {
                            res.write(`data: ${JSON.stringify({
                                id: requestId, object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model: targetModel,
                                choices: [{ index: 0, delta: { content: event.data }, finish_reason: null }]
                            })}\n\n`);
                        }
                    }
                    res.write(`data: ${JSON.stringify({
                        id: requestId, object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model: targetModel,
                        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }]
                    })}\n\n`);
                    res.write('data: [DONE]\n\n');
                    res.end();
                } catch (streamError) {
                    res.write(`data: ${JSON.stringify({ error: { message: streamError.message, type: 'server_error' } })}\n\n`);
                    res.end();
                }
            } else {
                const response = await service.chat(targetModel, convertedMessages, { system: systemPrompt });
                const inputTokens = Math.ceil(JSON.stringify(messages).length / 4);
                const outputTokens = Math.ceil(response.length / 4);
                res.json({
                    id: requestId, object: 'chat.completion', created: Math.floor(Date.now() / 1000), model: targetModel,
                    choices: [{ index: 0, message: { role: 'assistant', content: response }, finish_reason: 'stop' }],
                    usage: { prompt_tokens: inputTokens, completion_tokens: outputTokens, total_tokens: inputTokens + outputTokens }
                });
            }
        } catch (error) {
            res.status(500).json({ error: { message: error.message, type: 'server_error' } });
        }
    });

    app.get('/codex/v1/models', (req, res) => {
        res.json({
            object: 'list',
            data: CODEX_MODELS.map(id => ({ id, object: 'model', created: Math.floor(Date.now() / 1000), owned_by: 'openai' }))
        });
    });

    // ============ Codex 原生 API 端点 ============
    // 完整支持工具调用 (function_call / function_call_output)

    app.post('/codex/responses', async (req, res) => {
        const startTime = Date.now();
        const responseId = 'resp_' + Date.now() + Math.random().toString(36).substring(2, 8);

        try {
            if (!req.body || typeof req.body !== 'object') {
                return res.status(400).json({ error: { message: '请求体无效', type: 'invalid_request_error' } });
            }

            const { model, input, instructions, tools, tool_choice, reasoning } = req.body;
            const targetModel = model || 'gpt-5';
            if (!CODEX_MODELS.includes(targetModel)) {
                return res.status(400).json({ error: { message: `不支持的模型: ${targetModel}`, type: 'invalid_request_error' } });
            }

            const service = await CodexService.fromRandomActive();

            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            // 解析 input（支持 function_call / function_call_output）
            const messages = Array.isArray(input) ? input : [];
            const outputItemId = 'item_' + Date.now();
            let fullText = '';
            let functionCallIndex = 0;
            const pendingToolCalls = [];

            const options = {
                system: instructions,
                tools: tools,
                toolChoice: tool_choice,
                reasoningEffort: reasoning?.effort || 'high',
                cwd: extractEnvValue(input, 'cwd'),
                sandboxMode: extractEnvValue(input, 'sandbox_mode'),
                approvalPolicy: extractEnvValue(input, 'approval_policy'),
                networkAccess: extractEnvValue(input, 'network_access'),
                parallelToolCalls: req.body.parallel_tool_calls
            };

            res.write(`data: ${JSON.stringify({
                type: 'response.created',
                response: { id: responseId, object: 'response', created_at: Math.floor(startTime / 1000), model: targetModel, status: 'in_progress' }
            })}\n\n`);

            try {
                for await (const event of service.chatStream(targetModel, messages, options)) {
                    if (event.type === 'content' && event.data) {
                        fullText += event.data;
                        res.write(`data: ${JSON.stringify({
                            type: 'response.output_text.delta', item_id: outputItemId, output_index: 0, content_index: 0, delta: event.data
                        })}\n\n`);
                    }

                    if (event.type === 'reasoning' && event.data) {
                        res.write(`data: ${JSON.stringify({
                            type: 'response.reasoning_summary_text.delta', item_id: outputItemId, output_index: 0, delta: event.data
                        })}\n\n`);
                    }

                    if (event.type === 'tool_call_done' && event.data) {
                        const tc = event.data;
                        pendingToolCalls.push(tc);
                        res.write(`data: ${JSON.stringify({
                            type: 'response.output_item.done', output_index: functionCallIndex,
                            item: { type: 'function_call', call_id: tc.call_id, name: tc.name, arguments: tc.arguments }
                        })}\n\n`);
                        functionCallIndex++;
                    }

                    if (event.type === 'response.output_item.done' && event.data?.item?.type === 'function_call') {
                        const item = event.data.item;
                        if (!pendingToolCalls.find(t => t.call_id === item.call_id)) {
                            pendingToolCalls.push({ call_id: item.call_id, name: item.name, arguments: item.arguments });
                            res.write(`data: ${JSON.stringify({
                                type: 'response.output_item.done', output_index: functionCallIndex,
                                item: { type: 'function_call', call_id: item.call_id, name: item.name, arguments: item.arguments }
                            })}\n\n`);
                            functionCallIndex++;
                        }
                    }
                }

                if (fullText) {
                    res.write(`data: ${JSON.stringify({
                        type: 'response.output_text.done', item_id: outputItemId, output_index: 0, content_index: 0, text: fullText
                    })}\n\n`);
                    res.write(`data: ${JSON.stringify({
                        type: 'response.output_item.done', output_index: pendingToolCalls.length,
                        item: { id: outputItemId, type: 'message', role: 'assistant', content: [{ type: 'output_text', text: fullText }] }
                    })}\n\n`);
                }

                const outputItems = pendingToolCalls.map(tc => ({ type: 'function_call', call_id: tc.call_id, name: tc.name, arguments: tc.arguments }));
                if (fullText) {
                    outputItems.push({ id: outputItemId, type: 'message', role: 'assistant', content: [{ type: 'output_text', text: fullText }] });
                }

                res.write(`data: ${JSON.stringify({
                    type: 'response.completed',
                    response: {
                        id: responseId, object: 'response', created_at: Math.floor(startTime / 1000), model: targetModel, status: 'completed',
                        output: outputItems,
                        usage: { input_tokens: Math.ceil(JSON.stringify(messages).length / 4), output_tokens: Math.ceil(fullText.length / 4), total_tokens: Math.ceil((JSON.stringify(messages).length + fullText.length) / 4) }
                    }
                })}\n\n`);

                res.end();
            } catch (streamError) {
                console.error(`[Codex] /codex/responses 流式错误:`, streamError.message);
                res.write(`data: ${JSON.stringify({ type: 'error', error: { message: streamError.message, type: 'server_error' } })}\n\n`);
                res.end();
            }
        } catch (error) {
            console.error(`[Codex] /codex/responses 错误:`, error.message);
            if (!res.headersSent) {
                res.status(500).json({ error: { message: error.message, type: 'server_error' } });
            } else {
                res.end();
            }
        }
    });

    console.log('[Codex] 路由已设置');
}

// 从 input 中提取环境变量值
function extractEnvValue(input, key) {
    if (!Array.isArray(input)) return undefined;
    for (const item of input) {
        if (item.type === 'message' && item.role === 'user' && Array.isArray(item.content)) {
            for (const c of item.content) {
                if (c.type === 'input_text' && c.text?.includes('<environment_context>')) {
                    const regex = new RegExp(`<${key}>([^<]+)</${key}>`);
                    const match = c.text.match(regex);
                    if (match) return match[1];
                }
            }
        }
    }
    return undefined;
}
