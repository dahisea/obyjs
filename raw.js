!function() {
    // ============ 全局配置 ============
    const DEBUG_MODE = false;
    
    const log = (...args) => DEBUG_MODE && console.log(...args);
    const logError = (...args) => DEBUG_MODE && console.error(...args);
    
    // ============ 状态变量 ============
    let lastValidHash = '';
    let cachedSearchInfo = null;
    let currentAbortController = null;
    
    // API端点配置
    const API_NODES = {
        primary: [
            { name: "NODE_ALI", url: "https://web-static-origin.e.yu.ac.cn/gftls", method: "POST" },
            { name: "NODE_TCT", url: "https://web-static-origin.dahi.edu.cn.dahi.e.yu.ac.cn/gftls", method: "POST" },
            { name: "NODE_AWSP", url: "https://dev-volcengine-auth.netlify.app/gftls", method: "POST" },
            { name: "NODE_CFWK", url: "https://volcengine-cf-gateway.dahi.edu.eu.org/gftls/info.json", method: "GET" },
            { name: "NODE_AWSS", url: "https://api-edge-sakiko-dispatch-network-aws-nf-cdn.dahi.edu.eu.org/gftls", method: "POST" }
        ],
        backup: [
            { name: "NODE_A", url: "https://tencent.api-edge-sakiko-dispatch-network-aws-cdn.dahi.edu.eu.org/318895e9-64a7-4441-9ee4-625cae200f9b", method: "GET" },
            { name: "NODE_B", url: "https://api-edge-sakiko-dispatch-network-aws-cdn.dahi.edu.eu.org/318895e9-64a7-4441-9ee4-625cae200f9b", method: "GET" }
        ]
    };

    // SHA256 哈希函数
    async function sha256(message) {
        const msgBuffer = new TextEncoder().encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // 生成鉴权参数
    async function generateAuthParams() {
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const hash = await sha256(timestamp.substring(0, 8));
        return { ss: hash.substring(0, 9) };
    }

    // Hash 参数管理
    const hashManager = {
        isValid(hash) {
            return hash && hash !== '#' && hash !== '#?' && hash !== '#google_vignette';
        },
        
        parse(hash) {
            const queryString = hash?.startsWith('#?') ? hash.substring(2) : '';
            return Object.fromEntries(new URLSearchParams(queryString));
        },
        
        get() {
            const hash = window.location.hash;
            
            if (!this.isValid(hash)) {
                return this.isValid(lastValidHash) ? this.parse(lastValidHash) : {};
            }
            
            lastValidHash = hash;
            const params = this.parse(hash);
            if (params.q) cachedSearchInfo = params;
            
            return params;
        },
        
        set(params) {
            const cleanParams = Object.fromEntries(
                Object.entries(params).filter(([_, v]) => v)
            );
            const query = new URLSearchParams(cleanParams).toString();
            const url = new URL(window.location);
            url.hash = query ? `#?${query}` : '#';
            window.history.pushState({}, '', url);
        }
    };

    // 页面标题管理
    function updatePageTitle() {
        const params = hashManager.get();
        const { q: query, site } = params;
        const defaultTitle = "GFork 檢索";
        const isHashLost = !hashManager.isValid(window.location.hash) && hashManager.isValid(lastValidHash);
        
        let title = query 
            ? `${query} - ${defaultTitle}${site ? `（${site}）` : ''}`
            : defaultTitle;
        
        if (isHashLost) title += "：搜索参数已丢失";
        document.title = title;
    }

    // API 请求构建
    async function buildApiRequest(node) {
        const params = { ...hashManager.get() };
        delete params.locale;
        
        const { ss } = await generateAuthParams();
        
        if (node.method === "POST") {
            const body = new URLSearchParams(params).toString();
            return {
                url: `${node.url}/${ss}`,
                options: {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body,
                    mode: 'cors'
                }
            };
        }
        
        params.ss = ss;
        const query = new URLSearchParams(params).toString();
        return {
            url: query ? `${node.url}?${query}` : node.url,
            options: {
                method: 'GET',
                headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
                mode: 'cors'
            }
        };
    }

    // UI 组件
    const UI = {
        createLoadingAnimation() {
            return `
                <div class="loading-container" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; min-height: 400px;">
                    <div class="loading-spinner" style="display: flex; flex-direction: column; align-items: center; gap: 20px;">
                        <span class="material-icons" style="font-size: 48px; animation: spin 1s linear infinite; color: #4285f4;">autorenew</span>
                        <div class="loading-tip" style="text-align: center; color: #666; line-height: 1.6;">
                            少女祈祷中…正等待加载脚本。<br>
                            注意：所有结果均来源于网络搜索，可靠性未知，请注意甄别代码以及相关内容，谨防欺诈。
                        </div>
                    </div>
                </div>
                <style>
                    @keyframes spin {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
                    }
                </style>
            `;
        },

        formatDateTime(date) {
            if (!date) return "未知";
            return date.toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            }).replace(/\//g, '-');
        },

        createResultItem(item) {
            const userName = item.users?.[0]?.name || "未知作者";
            const userId = item.users?.[0]?.id || "";
            const userUrl = userId ? `https://gfork.zh-tw.eu.org/zh-hans/users/${userId}` : "#";
            const scriptUrl = `https://gfork.zh-tw.eu.org/zh-hans/scripts/${item.id}`;
            let installUrl = item.code_url?.replace('https://update.greasyfork.org/scripts/', '/d#/') || "#";

            const createdDate = item.created_at ? new Date(item.created_at) : null;
            const updatedDate = item.code_updated_at ? new Date(item.code_updated_at) : null;

            return `
                <li class="result-item">
                    <article>
                        <h2>
                            <a class="script-link" href="${scriptUrl}" target="_blank">${item.name || "未命名"}</a>
                            <span class="badge badge-js" title="用户脚本">JS</span>
                            <span class="name-description-separator">-</span>
                            <span class="script-description description">${item.description || "暂无描述"}</span>
                        </h2>
                        <div class="script-meta-block">
                            <dl class="inline-script-stats">
                                <dt class="script-list-author"><span>作者</span></dt>
                                <dd class="script-list-author"><a href="${userUrl}">${userName}</a></dd>
                                <dt class="script-list-daily-installs"><span>日安装量</span></dt>
                                <dd class="script-list-daily-installs"><span>${item.daily_installs || 0}</span></dd>
                                <dt class="script-list-total-installs"><span>总安装量</span></dt>
                                <dd class="script-list-total-installs"><span>${item.total_installs || 0}</span></dd>
                                <dt class="script-list-ratings"><span>评分</span></dt>
                                <dd class="script-list-ratings" data-rating-score="${item.fan_score || 0}">
                                    <span>
                                        <span class="good-rating-count" title="评级为好评或已加入到收藏的人数">${item.good_ratings || 0}</span>
                                        <span class="ok-rating-count" title="评级为一般的人数">${item.ok_ratings || 0}</span>
                                        <span class="bad-rating-count" title="评级为差评的人数">${item.bad_ratings || 0}</span>
                                    </span>
                                </dd>
                                <dt class="script-list-created-date"><span>创建于</span></dt>
                                <dd class="script-list-created-date"><span>${this.formatDateTime(createdDate)}</span></dd>
                                <dt class="script-list-updated-date"><span>更新于</span></dt>
                                <dd class="script-list-updated-date"><span>${this.formatDateTime(updatedDate)}</span></dd>
                                <a href="${installUrl}" target="_blank">立即安装此脚本</a>
                            </dl>
                        </div>
                    </article>
                </li>
            `;
        },

        updateApiStatus(apis, show = false) {
            const footer = document.querySelector('footer');
            if (!footer) return;

            let status = document.getElementById('api-status');
            
            if (!show) {
                status?.remove();
                return;
            }

            if (!status) {
                status = document.createElement('div');
                status.id = 'api-status';
                status.className = 'api-status';
                footer.appendChild(status);
            }

            const icons = { success: 'check_circle', pending: 'autorenew', error: 'error' };
            const apiList = apis.map(api => `
                <div class="api-item ${api.status || 'pending'}">
                    <span class="material-icons">${icons[api.status] || 'autorenew'}</span>
                    <span>${api.name}</span>
                </div>
            `).join('');

            status.innerHTML = `
                <div>备用节点状态：</div>
                <div class="api-list">${apiList}</div>
            `;
        }
    };

    // 响应处理
    async function extractResponseData(response) {
        const encoding = response.headers.get('X-Content-Encoding');
        
        if (encoding === 'base64') {
            const base64Text = await response.text();
            const binaryStr = atob(base64Text);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
                bytes[i] = binaryStr.charCodeAt(i);
            }
            const decoded = new TextDecoder('utf-8').decode(bytes);
            return JSON.parse(decoded);
        }
        
        return await response.json();
    }

    // 单个节点请求函数
    async function fetchFromNode(node, signal, timeout = 5000) {
        try {
            const request = await buildApiRequest(node);
            request.options.signal = signal;
            
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), timeout)
            );
            
            const fetchPromise = fetch(request.url, request.options);
            const response = await Promise.race([fetchPromise, timeoutPromise]);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await extractResponseData(response);
            log(`✓ ${node.name} 成功`);
            return { success: true, data, node };
        } catch (error) {
            if (error.name !== 'AbortError') {
                logError(`✗ ${node.name} 失败:`, error.message);
            }
            return { success: false, error, node };
        }
    }

    // 并发请求一组节点，返回第一个成功的结果
    async function raceNodes(nodes, signal) {
        return new Promise((resolve) => {
            let resolved = false;
            let completedCount = 0;
            const failedNodes = [];

            nodes.forEach(async (node) => {
                const result = await fetchFromNode(node, signal);
                
                if (resolved) return;
                
                completedCount++;
                
                if (result.success) {
                    resolved = true;
                    resolve({ success: true, data: result.data, node: result.node });
                } else {
                    failedNodes.push(result.node.name);
                    
                    // 所有节点都失败
                    if (completedCount === nodes.length) {
                        resolved = true;
                        resolve({ 
                            success: false, 
                            failedNodes,
                            message: `所有节点请求失败: ${failedNodes.join(', ')}`
                        });
                    }
                }
            });
        });
    }

    // 主要加载逻辑：先尝试所有主节点，失败后再尝试备用节点
    async function loadResults() {
        if (window.location.hash === '#google_vignette') return;

        updatePageTitle();
        const container = document.getElementById("script-results");
        if (!container) return;
        
        const params = hashManager.get();
        if (!params.q && !params.site && !params.page) {
            container.innerHTML = '<div class="error" style="padding: 20px; text-align: center; color: #ff6b6b;">警告：当前未搜索任何内容</div>';
            updatePagination(true);
            return;
        }
        
        // 取消之前的请求
        currentAbortController?.abort();
        currentAbortController = new AbortController();
        
        container.innerHTML = UI.createLoadingAnimation();

        log('开始并发请求所有主节点...');
        
        // 第一阶段：并发请求所有主节点
        const primaryResult = await raceNodes(API_NODES.primary, currentAbortController.signal);
        
        if (primaryResult.success) {
            log(`✓ 使用主节点: ${primaryResult.node.name}`);
            processResults(primaryResult.data);
            return;
        }
        
        // 第二阶段：所有主节点失败，尝试备用节点
        log('所有主节点失败，尝试备用节点...');
        logError(primaryResult.message);
        
        const backupResult = await raceNodes(API_NODES.backup, currentAbortController.signal);
        
        if (backupResult.success) {
            log(`✓ 使用备用节点: ${backupResult.node.name}`);
            processResults(backupResult.data);
        } else {
            logError('所有备用节点也失败了');
            logError(backupResult.message);
            container.innerHTML = `
                <div class="error" style="padding: 40px; text-align: center;">
                    <h3 style="color: #ff6b6b; margin-bottom: 16px;">所有API请求失败</h3>
                    <p style="color: #666; margin-bottom: 12px;">主节点: ${primaryResult.failedNodes.join(', ')}</p>
                    <p style="color: #666; margin-bottom: 20px;">备用节点: ${backupResult.failedNodes.join(', ')}</p>
                    <p style="color: #999;">请检查网络连接或稍后重试</p>
                </div>
            `;
        }
    }

    // 处理结果
    function processResults(data) {
        if (data.redirect && data.target_url) {
            alert(data.message || "检测到非中文区域，将跳转到 Greasyfork Official Site");
            window.location.href = data.target_url;
            return;
        }
        
        const container = document.getElementById("script-results");
        if (!container) return;

        if (!data?.length) {
            container.innerHTML = '<div class="loading">未找到匹配內容</div>';
            updatePagination(true);
            return;
        }

        const items = data.map((item, i) => UI.createResultItem(item)).join('');
        
        container.innerHTML = `<ul>${items}</ul>`;
        
        updatePagination(false);
    }

    // 分页更新
    function updatePagination(noResults = false) {
        const params = hashManager.get();
        const currentPage = parseInt(params.page || "1");
        const pagination = document.getElementById("pagination");
        if (!pagination) return;
        
        const createLink = (page, text, hidden = false) => {
            const p = { ...params, page: page.toString() };
            const query = new URLSearchParams(p).toString();
            const style = hidden ? 'style="visibility:hidden"' : '';
            return `<a href="#?${query}" ${style}>${text}</a>`;
        };
        
        pagination.innerHTML = `
            ${createLink(1, '回到第一页', currentPage === 1)}
            ${createLink(Math.max(currentPage - 1, 1), '上一页', currentPage === 1)}
            <span class="current">${currentPage}</span>
            ${createLink(currentPage + 1, '下一页', noResults && currentPage > 1)}
        `;
    }

    // 语言筛选初始化
    function initializeLanguageFilter() {
        const params = hashManager.get();
        const filter = params.filter_locale || "0";
        const container = document.getElementById("language-filter");
        if (!container) return;
        
        const options = [
            { value: "0", text: "展示所有语言内容" },
            { value: "1", text: "仅展示中文内容" }
        ];
        
        container.innerHTML = `
            语言筛选：
            <ul>
                ${options.map(opt => `
                    <li class="list-option ${filter === opt.value ? 'list-current' : ''}">
                        <a href="#" data-filter="${opt.value}">${opt.text}</a>
                    </li>
                `).join('')}
            </ul>
        `;
        
        container.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', e => {
                e.preventDefault();
                const params = hashManager.get();
                params.filter_locale = link.dataset.filter;
                hashManager.set(params);
                
                container.querySelectorAll('.list-option').forEach(opt => 
                    opt.classList.remove('list-current')
                );
                link.parentElement.classList.add('list-current');
                
                loadResults();
            });
        });
    }

    // 初始化页面
    function initializePage() {
        const params = hashManager.get();
        
        const searchInput = document.querySelector('.sidebar-search input[name="q"]');
        if (searchInput) searchInput.value = params.q || '';
        
        const sortOptions = [
            { value: "", text: "相关程度" },
            { value: "daily_installs", text: "日安装量" },
            { value: "total_installs", text: "总安装量" },
            { value: "ratings", text: "得分" },
            { value: "created", text: "创建日期" },
            { value: "updated", text: "更新日期" },
            { value: "name", text: "名称" }
        ];
        
        const sortList = document.getElementById("sort-options-list");
        if (sortList) {
            sortList.innerHTML = sortOptions.map(opt => {
                const isCurrent = opt.value === (params.sort || '');
                return `
                    <li class="list-option ${isCurrent ? 'list-current' : ''}">
                        <a href="#" data-sort="${opt.value}">${opt.text}</a>
                    </li>
                `;
            }).join('');
            
            sortList.querySelectorAll('a').forEach(link => {
                link.addEventListener('click', e => {
                    e.preventDefault();
                    const params = hashManager.get();
                    params.sort = link.dataset.sort;
                    hashManager.set(params);
                    
                    sortList.querySelectorAll('.list-option').forEach(opt =>
                        opt.classList.toggle('list-current', opt.contains(link))
                    );
                    
                    loadResults();
                });
            });
        }
        
        initializeLanguageFilter();
    }

    // 表单处理
    function initializeFormHandlers() {
        const searchForm = document.getElementById("search-form");
        searchForm?.addEventListener("submit", e => {
            e.preventDefault();
            const input = document.getElementById("search-submit");
            if (!input) return;
            
            const query = input.value.trim();
            hashManager.set({ q: query });
            loadResults();
        });

        const sidebarSearch = document.querySelector(".sidebar-search");
        sidebarSearch?.addEventListener("submit", e => {
            e.preventDefault();
            const input = sidebarSearch.querySelector('input[name="q"]');
            if (!input) return;
            
            const params = hashManager.get();
            hashManager.set({
                q: input.value.trim(),
                sort: params.sort || '',
                filter_locale: params.filter_locale || '0',
                ...(params.site && { site: params.site })
            });
            
            loadResults();
        });
    }

    // 事件监听
    window.addEventListener("popstate", () => {
        if (window.location.hash === '#google_vignette') return;
        initializeLanguageFilter();
        updatePageTitle();
        loadResults();
    });

    window.addEventListener("hashchange", e => {
        updatePageTitle();
        const current = window.location.hash;
        
        if (current === '#google_vignette') return;
        if (hashManager.isValid(current)) lastValidHash = current;
    });

    // 初始化
    function init() {
        const hash = window.location.hash;
        if (hashManager.isValid(hash)) lastValidHash = hash;
        
        initializeFormHandlers();
        initializePage();
        loadResults();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}();