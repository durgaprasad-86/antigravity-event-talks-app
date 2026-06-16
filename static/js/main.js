/**
 * ==========================================================================
 * CLIENT-SIDE JAVASCRIPT: BIGQUERY RELEASE NOTES EXPLORER
 * ==========================================================================
 */

// Global State
let state = {
    releases: [],
    filteredReleases: [],
    activeCategory: 'all', // 'all', 'Feature', 'Changed', 'Fixed'
    searchQuery: '',
    fetchedAt: null,
    source: null
};

// DOM Elements
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search-btn');
const categoryFilters = document.getElementById('category-filters');
const refreshBtn = document.getElementById('refresh-btn');
const refreshSpinner = document.getElementById('refresh-spinner');
const cacheStatus = document.getElementById('cache-status');
const lastUpdatedTime = document.getElementById('last-updated-time');
const skeletonLoader = document.getElementById('skeleton-loader');
const errorState = document.getElementById('error-state');
const errorMessage = document.getElementById('error-message');
const emptyState = document.getElementById('empty-state');
const releasesContainer = document.getElementById('releases-container');
const retryBtn = document.getElementById('retry-btn');
const resetFiltersBtn = document.getElementById('reset-filters-btn');

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    // Initial Fetch
    fetchReleases(false);
    
    // Set up Event Listeners
    setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
    // Search input changes
    searchInput.addEventListener('input', debounce((e) => {
        state.searchQuery = e.target.value.trim().toLowerCase();
        toggleClearSearchButton();
        applyFiltersAndSearch();
    }, 150));
    
    // Clear search button
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        state.searchQuery = '';
        toggleClearSearchButton();
        applyFiltersAndSearch();
        searchInput.focus();
    });
    
    // Category pills filter
    categoryFilters.addEventListener('click', (e) => {
        const btn = e.target.closest('.pill');
        if (!btn) return;
        
        // Remove active class from all pills
        categoryFilters.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        
        state.activeCategory = btn.dataset.category;
        applyFiltersAndSearch();
    });
    
    // Refresh button
    refreshBtn.addEventListener('click', () => {
        fetchReleases(true);
    });
    
    // Retry button (on error state)
    retryBtn.addEventListener('click', () => {
        fetchReleases(true);
    });
    
    // Reset filters button (on empty state)
    resetFiltersBtn.addEventListener('click', () => {
        resetAllFilters();
    });
    
    // Tweet share button click (via delegation)
    releasesContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.tweet-share-btn');
        if (!btn) return;
        
        const block = btn.closest('.update-block');
        const htmlContentEl = block.querySelector('.update-html');
        
        let textContent = '';
        
        // Get user text selection
        const selection = window.getSelection();
        const selectedText = selection ? selection.toString().trim() : '';
        
        // Use selection if it started or ended inside this update block
        if (selectedText && htmlContentEl && (htmlContentEl.contains(selection.anchorNode) || htmlContentEl.contains(selection.focusNode))) {
            textContent = selectedText;
        } else {
            textContent = htmlContentEl ? htmlContentEl.textContent.trim() : '';
        }
        
        const title = btn.dataset.title || '';
        const category = btn.dataset.category || '';
        const link = btn.dataset.link || '';
        
        handleTweetShare(title, category, textContent, link);
    });
}

// Reset all search & filter parameters
function resetAllFilters() {
    searchInput.value = '';
    state.searchQuery = '';
    state.activeCategory = 'all';
    
    categoryFilters.querySelectorAll('.pill').forEach(p => {
        p.classList.remove('active');
        if (p.dataset.category === 'all') {
            p.classList.add('active');
        }
    });
    
    toggleClearSearchButton();
    applyFiltersAndSearch();
}

// Show/Hide search clear button
function toggleClearSearchButton() {
    if (state.searchQuery) {
        clearSearchBtn.style.display = 'flex';
    } else {
        clearSearchBtn.style.display = 'none';
    }
}

// Debounce helper to optimize search triggers
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Helper to determine relative time
function getRelativeTime(isoString) {
    if (!isoString) return '';
    try {
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        if (isNaN(date.getTime())) return '';
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) {
            const weeks = Math.floor(diffDays / 7);
            return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
        }
        
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) {
        return '';
    }
}

// Helper to map category names to CSS badge classes
function getBadgeClass(category) {
    const cat = category.toLowerCase();
    if (cat.includes('feature')) return 'badge-feature';
    if (cat.includes('change')) return 'badge-changed';
    if (cat.includes('fix') || cat.includes('resolve')) return 'badge-fixed';
    if (cat.includes('deprecat')) return 'badge-deprecated';
    return 'badge-general';
}

// Helper to map category names to Lucide icons
function getCategoryIconName(category) {
    const cat = category.toLowerCase();
    if (cat.includes('feature')) return 'sparkles';
    if (cat.includes('change')) return 'refresh-cw';
    if (cat.includes('fix') || cat.includes('resolve')) return 'check-circle';
    if (cat.includes('deprecat')) return 'alert-triangle';
    return 'info';
}

/**
 * Segment the HTML content string of an entry into typed change blocks
 * using the browser's native DOMParser.
 */
function segmentReleaseContent(contentHtml) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(contentHtml, 'text/html');
    const blocks = [];
    
    let currentCategory = null;
    let currentHtmlElements = [];
    
    const children = Array.from(doc.body.children);
    
    if (children.length === 0) {
        // Ignore fallback if it represents deprecations
        if (contentHtml.toLowerCase().includes('deprecat')) {
            return [];
        }
        return [{ 
            category: 'General', 
            html: contentHtml 
        }];
    }
    
    const saveBlock = () => {
        if (currentHtmlElements.length > 0) {
            const categoryName = currentCategory || 'General';
            // Ignore Deprecated updates
            if (!categoryName.toLowerCase().includes('deprecat')) {
                const blockHtml = currentHtmlElements.map(el => el.outerHTML).join('');
                blocks.push({
                    category: categoryName,
                    html: blockHtml
                });
            }
            currentHtmlElements = [];
        }
    };
    
    for (const child of children) {
        if (child.tagName === 'H3') {
            saveBlock();
            currentCategory = child.textContent.trim();
        } else {
            currentHtmlElements.push(child);
        }
    }
    saveBlock();
    
    // If no headings found, package all content as general (unless it contains deprecations)
    if (blocks.length === 0 && doc.body.innerHTML.trim()) {
        const textContent = doc.body.textContent || '';
        if (!textContent.toLowerCase().includes('deprecat')) {
            blocks.push({
                category: 'General',
                html: doc.body.innerHTML
            });
        }
    }
    
    return blocks;
}

// Fetch release notes from backend Flask server
async function fetchReleases(forceRefresh = false) {
    // Show loading spinner rotation & skeleton loader
    refreshSpinner.classList.add('spin');
    refreshBtn.disabled = true;
    
    errorState.style.display = 'none';
    emptyState.style.display = 'none';
    releasesContainer.style.display = 'none';
    skeletonLoader.style.display = 'flex';
    
    const url = `/api/releases${forceRefresh ? '?refresh=true' : ''}`;
    
    try {
        const response = await fetch(url);
        const result = await response.json();
        
        if (result.success) {
            state.releases = result.releases.map(release => {
                // Segment content HTML client-side
                const blocks = segmentReleaseContent(release.content);
                return {
                    ...release,
                    blocks: blocks
                };
            });
            
            state.source = result.source;
            state.fetchedAt = result.fetched_at;
            
            updateStatusIndicators();
            applyFiltersAndSearch();
        } else {
            showError(result.error || 'Failed to parse feed data.');
        }
    } catch (err) {
        showError(err.message || 'Network error occurred while fetching release notes.');
    } finally {
        // Stop loading spinner rotation
        refreshSpinner.classList.remove('spin');
        refreshBtn.disabled = false;
    }
}

// Update Cache Status and Timestamp
function updateStatusIndicators() {
    // Update Badge text
    let statusText = 'Live Source';
    if (state.source === 'cache') {
        statusText = 'Cached';
    } else if (state.source.includes('stale')) {
        statusText = 'Stale (Offline)';
    }
    cacheStatus.textContent = statusText;
    cacheStatus.className = `status-badge ${state.source === 'cache' ? 'cached' : 'live'}`;
    
    // Update Time text
    if (state.fetchedAt) {
        const dateObj = new Date(state.fetchedAt);
        const formattedTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        lastUpdatedTime.textContent = `Updated: ${formattedTime}`;
    }
}

// Display error messages
function showError(message) {
    skeletonLoader.style.display = 'none';
    releasesContainer.style.display = 'none';
    emptyState.style.display = 'none';
    
    errorMessage.textContent = message;
    errorState.style.display = 'block';
}

// Process search criteria and tabs selection
function applyFiltersAndSearch() {
    const catFilter = state.activeCategory;
    const query = state.searchQuery;
    
    state.filteredReleases = state.releases
        .map(release => {
            // Filter blocks matching active category
            let filteredBlocks = release.blocks;
            if (catFilter !== 'all') {
                filteredBlocks = release.blocks.filter(block => 
                    block.category.toLowerCase().includes(catFilter.toLowerCase())
                );
            }
            
            // Search query matches
            if (query) {
                // Check if title (date) matches query
                const titleMatches = release.title.toLowerCase().includes(query);
                
                // Filter blocks that match query
                filteredBlocks = filteredBlocks.filter(block => {
                    const categoryMatches = block.category.toLowerCase().includes(query);
                    
                    // Strip HTML tags for clean text search
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = block.html;
                    const textContent = tempDiv.textContent.toLowerCase();
                    
                    return titleMatches || categoryMatches || textContent.includes(query);
                });
            }
            
            return {
                ...release,
                matchingBlocks: filteredBlocks
            };
        })
        // Filter out releases that have no matching blocks
        .filter(release => release.matchingBlocks.length > 0);
        
    renderReleases();
}

// Render filtered releases list to DOM
function renderReleases() {
    skeletonLoader.style.display = 'none';
    
    if (state.filteredReleases.length === 0) {
        releasesContainer.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }
    
    emptyState.style.display = 'none';
    releasesContainer.innerHTML = '';
    
    state.filteredReleases.forEach((release, index) => {
        const relativeTime = getRelativeTime(release.updated);
        
        const card = document.createElement('article');
        card.className = 'release-card';
        card.style.animationDelay = `${index * 50}ms`; // Staggered entry animation
        
        // Assemble Card HTML
        let blocksHtml = '';
        release.matchingBlocks.forEach(block => {
            const badgeClass = getBadgeClass(block.category);
            const iconName = getCategoryIconName(block.category);
            
            blocksHtml += `
                <div class="update-block">
                    <div class="update-block-header">
                        <span class="update-badge ${badgeClass}">
                            <i data-lucide="${iconName}"></i> ${block.category}
                        </span>
                        <button class="tweet-share-btn" data-title="${release.title}" data-category="${block.category}" data-link="${release.link}" title="Tweet about this update">
                            <i data-lucide="twitter"></i> Tweet
                        </button>
                    </div>
                    <div class="update-html">
                        ${block.html}
                    </div>
                </div>
            `;
        });
        
        card.innerHTML = `
            <div class="card-header">
                <div class="date-section">
                    <h2 class="card-title">${release.title}</h2>
                    ${relativeTime ? `<span class="relative-time">${relativeTime}</span>` : ''}
                </div>
                ${release.link ? `
                    <a href="${release.link}" target="_blank" rel="noopener noreferrer" class="card-external-link" title="Open official GCP docs release note page">
                        <i data-lucide="external-link"></i>
                    </a>
                ` : ''}
            </div>
            <div class="card-body">
                ${blocksHtml}
            </div>
        `;
        
        releasesContainer.appendChild(card);
    });
    
    // Instantiates SVG icons inside dynamically created HTML
    lucide.createIcons();
    releasesContainer.style.display = 'flex';
}

/**
 * Clean HTML formatting and compose a tweet intent window for a specific release note block.
 */
function handleTweetShare(title, category, textContent, link) {
    // Normalize and clean white spaces
    const cleanText = textContent.replace(/\s+/g, ' ').trim();
    
    // Format prefix and suffix
    const prefix = `BigQuery ${category} (${title}): `;
    const suffix = ` #BigQuery #GCP`;
    
    // Twitter automatically shortens links to 23 chars. Add 1 for separator space
    const urlLength = link ? 24 : 0;
    
    // Max length allowed for the quote string. Max Tweet length is 280
    const maxTextLength = 280 - prefix.length - suffix.length - urlLength - 4; // -4 for quotes and ellipsis
    
    let tweetBody = cleanText;
    if (tweetBody.length > maxTextLength) {
        tweetBody = tweetBody.substring(0, maxTextLength).trim() + '...';
    }
    
    // Compose tweet payload
    const tweetText = `${prefix}"${tweetBody}"${suffix}`;
    
    // Build the twitter share intent link
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}${link ? `&url=${encodeURIComponent(link)}` : ''}`;
    
    // Open standard Twitter share dialog
    const width = 550;
    const height = 400;
    const left = (window.innerWidth - width) / 2;
    const top = (window.innerHeight - height) / 2;
    
    window.open(
        twitterUrl,
        'twitter-share',
        `width=${width},height=${height},top=${top},left=${left},toolbar=0,status=0,menubar=0,scrollbars=1`
    );
}
