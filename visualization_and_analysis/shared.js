let allData = {};
let allModels = [];
const selectedCategories = [];
let selectedModels = new Set();
let queryModelData = {};

function initializeModelView() {
    setupModelSelector();
    loadAllJSON();
}

function setupModelSelector() {
    const searchBox = document.getElementById('modelSearch');

    searchBox.addEventListener('input', () => {
        const searchTerm = searchBox.value.toLowerCase();
        renderModelGrid(searchTerm);
    });
}

function renderModelGrid(searchTerm = '') {
    const modelGrid = document.getElementById('modelGrid');
    modelGrid.innerHTML = '';

    // Sort by Score
    const sortedModels = [...allModels].sort((a, b) => {
        // Get score values for each model
        const scoreA = allData[a]?.score || 0;
        const scoreB = allData[b]?.score || 0;
        // Sort by score in descending order
        return scoreB - scoreA;
    });

    const modelsToShow = searchTerm
        ? sortedModels.filter(model => model.toLowerCase().includes(searchTerm.toLowerCase()))
        : sortedModels;

    modelsToShow.forEach(model => {
        const modelItem = document.createElement('div');
        modelItem.className = 'model-item';
        if (selectedModels.has(model)) {
            modelItem.classList.add('selected');
        }
        modelItem.textContent = model;
        modelItem.title = model;

        modelItem.addEventListener('click', () => {
            if (selectedModels.has(model)) {
                selectedModels.delete(model);
                modelItem.classList.remove('selected');

                // Remove from selected categories
                const idx = selectedCategories.indexOf(model);
                if (idx > -1) {
                    selectedCategories.splice(idx, 1);
                }
            } else {
                selectedModels.add(model);
                modelItem.classList.add('selected');

                // Add to selected categories
                if (!selectedCategories.includes(model)) {
                    selectedCategories.push(model);
                }
            }

            renderSelectedTrees();
        });

        modelGrid.appendChild(modelItem);
    });
}

// Progress bar utilities
function createProgressBar(containerId, message = 'Loading...') {
    const container = document.getElementById(containerId);
    if (!container) return null;

    const progressWrapper = document.createElement('div');
    progressWrapper.className = 'progress-wrapper';
    progressWrapper.innerHTML = `
        <div class="progress-message">${message}</div>
        <div class="progress-bar-container">
            <div class="progress-bar">
                <div class="progress-fill" style="width: 0%"></div>
            </div>
            <div class="progress-text">0%</div>
        </div>
        <div class="progress-details"></div>
    `;

    container.appendChild(progressWrapper);
    return progressWrapper;
}

function updateProgressBar(progressWrapper, percentage, details = '') {
    if (!progressWrapper) return;

    const fill = progressWrapper.querySelector('.progress-fill');
    const text = progressWrapper.querySelector('.progress-text');
    const detailsEl = progressWrapper.querySelector('.progress-details');

    if (fill) fill.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
    if (text) text.textContent = `${Math.round(percentage)}%`;
    if (detailsEl) detailsEl.textContent = details;
}

function removeProgressBar(progressWrapper) {
    if (progressWrapper && progressWrapper.parentNode) {
        progressWrapper.parentNode.removeChild(progressWrapper);
    }
}

function showError(containerId, title, message, showLocalDeployTip = true) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-container';
    errorDiv.innerHTML = `
        <div class="error-icon">⚠️</div>
        <div class="error-title">${title}</div>
        <div class="error-message">${message}</div>
        ${showLocalDeployTip ? `
        <div class="error-tip">
            <strong>💡 Tip:</strong> If you're experiencing loading issues, consider running this application locally:
            <br><br>
            <code>python -m http.server 8000</code>
            <br><br>
            Then visit <code>http://localhost:8000</code> in your browser.
        </div>
        ` : ''}
        <button class="retry-button" onclick="location.reload()">🔄 Retry</button>
    `;

    container.appendChild(errorDiv);
}

async function loadAllJSON() {
    const loadingContainer = document.getElementById('loading');
    const progressBar = createProgressBar('loading', 'Loading model data...');

    try {
        // Check if we're running on GitHub Pages or locally
        const isGitHubPages = window.location.hostname.includes('github.io') ||
                             window.location.hostname.includes('Anonymous-SCAN.github.io');

        let filesData;

        if (isGitHubPages) {
            updateProgressBar(progressBar, 10, 'Fetching file list from GitHub API...');

            // GitHub Pages implementation
            const owner = 'Anonymous-SCAN';
            const repo = 'SCAN';
            const path = 'visualization_and_analysis/processed_data';

            // Fetch directory listing via GitHub API
            const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
            const response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error(`GitHub API error (${response.status}): ${response.statusText}. The repository might be private or the path doesn't exist.`);
            }
            const files = await response.json();

            updateProgressBar(progressBar, 25, `Found ${files.length} files, filtering JSON files...`);

            // Filter JSON files and fetch their contents
            const jsonFiles = files.filter(file => file.name.endsWith('.json'));

            if (jsonFiles.length === 0) {
                throw new Error('No JSON files found in the specified directory.');
            }

            updateProgressBar(progressBar, 30, `Loading ${jsonFiles.length} JSON files...`);

            filesData = await Promise.all(
                jsonFiles.map(async (file, index) => {
                    try {
                        const resp = await fetch(file.download_url);
                        if (!resp.ok) throw new Error(`Failed to load ${file.name}: ${resp.statusText}`);
                        const data = await resp.json();

                        const progress = 30 + (index + 1) / jsonFiles.length * 60;
                        updateProgressBar(progressBar, progress, `Loaded ${file.name} (${index + 1}/${jsonFiles.length})`);

                        return { name: file.name.replace(/\.json$/i, ''), data };
                    } catch (err) {
                        console.error(`Error loading ${file.name}:`, err);
                        throw new Error(`Failed to load ${file.name}: ${err.message}`);
                    }
                })
            );
        } else {
            updateProgressBar(progressBar, 10, 'Fetching local directory listing...');

            // Local implementation
            const listResponse = await fetch('processed_data/');
            if (!listResponse.ok) {
                throw new Error(`Failed to access processed_data directory (${listResponse.status}): ${listResponse.statusText}. Make sure the directory exists and is accessible.`);
            }

            const listText = await listResponse.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(listText, 'text/html');
            const links = Array.from(doc.querySelectorAll('a'))
                .map(a => a.getAttribute('href'))
                .filter(href => href && href.endsWith('.json'));

            if (links.length === 0) {
                throw new Error('No JSON files found in the processed_data directory.');
            }

            updateProgressBar(progressBar, 25, `Found ${links.length} JSON files, loading...`);

            filesData = await Promise.all(links.map(async (file, index) => {
                try {
                    const resp = await fetch(`processed_data/${file}`);
                    if (!resp.ok) throw new Error(`Failed to load ${file}: ${resp.statusText}`);
                    const data = await resp.json();

                    const progress = 25 + (index + 1) / links.length * 65;
                    updateProgressBar(progressBar, progress, `Loaded ${file} (${index + 1}/${links.length})`);

                    return { name: file.replace(/\.json$/i, ''), data };
                } catch (err) {
                    console.error(`Error loading ${file}:`, err);
                    throw new Error(`Failed to load ${file}: ${err.message}`);
                }
            }));
        }

        updateProgressBar(progressBar, 95, 'Processing model data...');

        // Populate global data structures (same for both implementations)
        filesData.forEach(({ name, data }) => {
            allData[name] = data;
        });
        allModels = Object.keys(allData);

        if (allModels.length === 0) {
            throw new Error('No valid model data found in the loaded files.');
        }

        updateProgressBar(progressBar, 100, `Successfully loaded ${allModels.length} models!`);

        // Small delay to show completion
        setTimeout(() => {
            removeProgressBar(progressBar);

            // Hide loading indicator, show viewer
            document.getElementById('loading').classList.add('hidden');
            document.getElementById('viewer').classList.remove('hidden');

            // Initial render of model grid
            renderModelGrid();

            // Default-select top 4 models by score
            const sorted = [...allModels].sort((a, b) => {
                const sa = allData[a]?.score || 0;
                const sb = allData[b]?.score || 0;
                return sb - sa;
            });
            const topModels = sorted.slice(0, 4);
            topModels.forEach(model => {
                selectedModels.add(model);
                if (!selectedCategories.includes(model)) {
                    selectedCategories.push(model);
                }
            });

            // Re-render with selections
            renderModelGrid();
            renderSelectedTrees();
        }, 500);

    } catch (error) {
        console.error('Failed to load model data:', error);
        removeProgressBar(progressBar);
        document.getElementById('loading').classList.add('hidden');

        showError('loading',
            'Failed to Load Model Data',
            error.message || 'An unknown error occurred while loading the data.',
            true
        );
    }
}

async function loadAllQueryModelData() {
    const progressBar = createProgressBar('loading', 'Loading query model data...');

    try {
        // Check if we're running on GitHub Pages or locally
        const isGitHubPages = window.location.hostname.includes('github.io') ||
                             window.location.hostname.includes('Anonymous-SCAN.github.io');

        let filesData;

        if (isGitHubPages) {
            updateProgressBar(progressBar, 10, 'Accessing GitHub repository...');

            // GitHub Pages implementation
            const owner = 'Anonymous-SCAN';
            const repo = 'SCAN';
            const path = 'visualization_and_analysis/processed_data';

            // Fetch directory listing via GitHub API
            const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
            const response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error(`GitHub API error (${response.status}): ${response.statusText}`);
            }
            const files = await response.json();

            updateProgressBar(progressBar, 25, 'Processing file list...');

            // Filter JSON files
            const jsonFiles = files.filter(file => file.name.endsWith('.json'));

            if (jsonFiles.length === 0) {
                throw new Error('No JSON files found in the repository.');
            }

            updateProgressBar(progressBar, 30, `Loading ${jsonFiles.length} files...`);

            // Load each JSON file
            filesData = await Promise.all(jsonFiles.map(async (file, index) => {
                try {
                    const resp = await fetch(file.download_url);
                    if (!resp.ok) throw new Error(`Failed to load ${file.name}: ${resp.statusText}`);
                    const data = await resp.json();

                    const progress = 30 + (index + 1) / jsonFiles.length * 65;
                    updateProgressBar(progressBar, progress, `Loaded ${file.name} (${index + 1}/${jsonFiles.length})`);

                    return { name: file.name.replace(/\.json$/i, ''), data };
                } catch (err) {
                    console.error(`Error loading ${file.name}:`, err);
                    return null;
                }
            }));
        } else {
            updateProgressBar(progressBar, 10, 'Accessing local files...');

            // Local implementation
            const listResponse = await fetch('processed_data/');
            if (!listResponse.ok) {
                throw new Error(`Cannot access processed_data directory (${listResponse.status}): ${listResponse.statusText}`);
            }
            const listText = await listResponse.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(listText, 'text/html');

            // Get all links that might be JSON files
            const links = Array.from(doc.querySelectorAll('a'))
                .map(a => a.getAttribute('href'))
                .filter(href => href && typeof href === 'string' && href.toLowerCase().endsWith('.json'));

            if (links.length === 0) {
                throw new Error('No JSON files found in the processed_data directory.');
            }

            updateProgressBar(progressBar, 25, `Found ${links.length} files, loading...`);

            // Load each JSON file
            filesData = await Promise.all(links.map(async (file, index) => {
                try {
                    const resp = await fetch(`processed_data/${file}`);
                    const data = await resp.json();

                    const progress = 25 + (index + 1) / links.length * 70;
                    updateProgressBar(progressBar, progress, `Loaded ${file} (${index + 1}/${links.length})`);

                    return { name: file.replace(/\.json$/i, ''), data };
                } catch (err) {
                    console.error(`Error loading ${file}:`, err);
                    return null;
                }
            }));
        }

        updateProgressBar(progressBar, 95, 'Finalizing data...');

        // Add valid data to queryModelData (same for both implementations)
        let validCount = 0;
        filesData.forEach(item => {
            if (item) {
                queryModelData[item.name] = item.data;
                validCount++;
            }
        });

        if (validCount === 0) {
            throw new Error('No valid model data could be loaded.');
        }

        updateProgressBar(progressBar, 100, `Successfully loaded ${validCount} model files!`);

        setTimeout(() => {
            removeProgressBar(progressBar);
            console.log(`Loaded ${validCount} model files`);
        }, 300);

        return queryModelData;
    } catch (error) {
        console.error("Failed to load model data:", error);
        removeProgressBar(progressBar);
        throw error;
    }
}

function renderSelectedTrees() {
    const container = document.getElementById('treesContainer');
    container.innerHTML = '';

    selectedCategories.forEach(name => {
        const wrapper = document.createElement('div');
        wrapper.className = 'tree-wrapper';
        wrapper.dataset.name = name;

        const header = document.createElement('div');
        header.className = 'tree-header';

        const title = document.createElement('h2');
        title.textContent = name;
        header.appendChild(title);

        const removeBtn = document.createElement('div');
        removeBtn.className = 'remove-btn';
        removeBtn.textContent = '×';
        removeBtn.title = 'Remove this model';
        removeBtn.addEventListener('click', () => {
            selectedModels.delete(name);
            const idx = selectedCategories.indexOf(name);
            if (idx > -1) {
                selectedCategories.splice(idx, 1);
            }
            renderSelectedTrees();
            renderModelGrid();
        });

        const treeCont = document.createElement('div');
        treeCont.className = 'tree-container';
        treeCont.dataset.modelName = name;
        treeCont.appendChild(createBlockNode(name, allData[name], 0, true));

        // Add scroll event listener
        treeCont.addEventListener('scroll', synchronizeScroll);

        wrapper.appendChild(removeBtn);
        wrapper.appendChild(header);
        wrapper.appendChild(treeCont);
        container.appendChild(wrapper);
    });
}

let isScrolling = false;
function synchronizeScroll(event) {
    if (isScrolling) return;

    isScrolling = true;
    const sourceElement = event.target;
    const scrollTop = sourceElement.scrollTop;
    const sourceName = sourceElement.dataset.modelName;

    document.querySelectorAll('.tree-container').forEach(container => {
        if (container.dataset.modelName !== sourceName) {
            container.scrollTop = scrollTop;
        }
    });

    // Allow scrolling again after a short delay
    setTimeout(() => {
        isScrolling = false;
    }, 10);
}

const skipKeys = ['ques_ids', 'ranking'];

function createBlockNode(name, data, depth, isRoot = false) {
    const size = Number.isInteger(data.data_size) ? data.data_size : (data.data_size ? Math.round(data.data_size) : 0);
    const score = typeof data.score === 'number' ? data.score : 0;
    const keys = Object.keys(data).filter(k => !skipKeys.includes(k) && k !== 'data_size' && k !== 'score');

    const nodeDiv = document.createElement('div');
    nodeDiv.className = `node depth-${depth % 6} ${isRoot ? 'root-node' : ''}`;
    if (!keys.length) nodeDiv.classList.add('leaf-node');

    const blockDiv = document.createElement('div');
    blockDiv.className = 'node-block';
    blockDiv.dataset.name = name;

    const left = document.createElement('div');
    left.className = 'node-left';
    const nameEl = document.createElement('div');
    nameEl.className = 'node-name';
    nameEl.textContent = name;
    left.appendChild(nameEl);
    blockDiv.appendChild(left);

    const right = document.createElement('div');
    right.className = 'node-right';
    const info = document.createElement('div');
    info.className = 'node-info';
    const sizeEl = document.createElement('div');
    sizeEl.className = 'node-size';
    sizeEl.textContent = `Size: ${size}`;
    const scoreEl = document.createElement('div');
    scoreEl.className = 'node-score';
    scoreEl.textContent = `Score: ${score.toFixed(2)}`;
    info.appendChild(sizeEl);
    info.appendChild(scoreEl);
    right.appendChild(info);

    if (keys.length) {
        const toggle = document.createElement('div');
        toggle.className = 'toggle-btn';
        toggle.textContent = isRoot ? '-' : '+';
        toggle.addEventListener('click', e => {
            e.stopPropagation();
            const newState = !blockDiv.classList.contains('expanded');
            document.querySelectorAll(`.node-block[data-name="${name}"]`).forEach(b => {
                if (newState) b.classList.add('expanded');
                else b.classList.remove('expanded');
                const t = b.parentNode.querySelector('.toggle-btn');
                if (t) t.textContent = newState ? '-' : '+';
            });
        });
        right.appendChild(toggle);
    }
    blockDiv.appendChild(right);
    nodeDiv.appendChild(blockDiv);

    if (keys.length) {
        const childrenDiv = document.createElement('div');
        childrenDiv.className = 'node-children';
        keys.forEach(key => childrenDiv.appendChild(createBlockNode(key, data[key], depth + 1)));
        nodeDiv.appendChild(childrenDiv);
        if (isRoot) blockDiv.classList.add('expanded');
    }
    return nodeDiv;
}


// shared.js 新增代码
let selectedNodes = new Set();

function initializeQueryView() {
    selectedNodes.clear();
    loadCategoryTree();
}

function loadCategoryTree() {
    const progressBar = createProgressBar('categoryTree', 'Loading category tree...');
    updateProgressBar(progressBar, 20, 'Fetching cata_tree.json...');

    fetch('cata_tree.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to load category tree (${response.status}): ${response.statusText}. Make sure cata_tree.json exists in the root directory.`);
            }
            updateProgressBar(progressBar, 60, 'Processing tree data...');
            return response.json();
        })
        .then(data => {
            updateProgressBar(progressBar, 90, 'Building tree structure...');
            setTimeout(() => {
                removeProgressBar(progressBar);
                buildCategoryTree(data);
            }, 200);
        })
        .catch(error => {
            removeProgressBar(progressBar);
            handleTreeError(error);
        });
}

function buildCategoryTree(treeData) {
    const container = document.getElementById('categoryTree');
    container.innerHTML = '';
    const rootNode = createTreeNode(treeData, [], container);
    container.appendChild(rootNode);
}

function createTreeNode(nodeData, currentPath, parentElement) {
    const node = document.createElement('div');
    node.className = 'tree-node';

    // 节点头部
    const nodeHeader = document.createElement('div');
    nodeHeader.className = 'tree-node-header';
    nodeHeader.textContent = nodeData.name;

    // 路径处理
    const path = [...currentPath, nodeData.key].join('.');

    // 点击事件
    nodeHeader.addEventListener('click', (e) => {
        e.stopPropagation();
        nodeHeader.classList.toggle('selected');
        updateSelection(path, nodeHeader.classList.contains('selected'));
        renderRankings();
    });

    node.appendChild(nodeHeader);

    // 递归子节点
    if (nodeData.children) {
        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'tree-node-children';
        nodeData.children.forEach(child => {
            childrenContainer.appendChild(createTreeNode(child, [...currentPath, nodeData.key], node));
        });
        node.appendChild(childrenContainer);
    }

    return node;
}

function updateSelection(path, isSelected) {
    isSelected ? selectedNodes.add(path) : selectedNodes.delete(path);
}

function renderRankings() {
    const container = document.getElementById('rankingsTable');
    container.innerHTML = '';

    if (selectedNodes.size === 0) {
        container.innerHTML = '<div class="no-selection">Please select categories from the tree above to view rankings.</div>';
        return;
    }

    Array.from(selectedNodes).forEach(path => {
        // 创建列容器
        const column = document.createElement('div');
        column.className = 'ranking-column';

        // 列标题
        const header = document.createElement('div');
        header.className = 'ranking-header';
        header.textContent = path.split('.').pop();
        column.appendChild(header);

        // 获取并排序数据
        const rankings = allModels.map(model => ({
            model,
            ranking: getNestedValue(allData[model], path)?.ranking || Infinity
        })).sort((a, b) => a.ranking - b.ranking);

        // 填充排名数据
        const list = document.createElement('div');
        list.className = 'ranking-list';
        rankings.forEach((item, index) => {
            const entry = document.createElement('div');
            entry.className = 'ranking-entry';
            entry.innerHTML = `
                <div class="rank">${index + 1}.</div>
                <div class="model-name">${item.model}</div>
                <div class="ranking-value">${Number.isFinite(item.ranking) ? item.ranking : 'N/A'}</div>
            `;
            list.appendChild(entry);
        });

        column.appendChild(list);
        container.appendChild(column);
    });
}

function getNestedValue(obj, path) {
    return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

function handleTreeError(error) {
    const container = document.getElementById('categoryTree');
    showError('categoryTree',
        'Failed to Load Category Tree',
        error.message || 'An unknown error occurred while loading the category tree.',
        true
    );
}