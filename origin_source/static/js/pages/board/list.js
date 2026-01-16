/**
 * Board List Page Script
 * 게시글 목록 페이지 로직
 * 참조: @CLAUDE.md Section 4.1, @docs/be/API.md Section 3.1
 */

(function (window, document) {
  'use strict';

  // ============================================
  // Configuration
  // ============================================
  const CONFIG = {
    PAGE_SIZE: 20,
    WRITE_POST_URL: '/board/write',
    POST_DETAIL_URL: '/board',
    LOGIN_URL: '/page/login',
  };

  // ============================================
  // State Management
  // ============================================
  const state = {
    currentCursor: null, // Cursor 페이지네이션
    hasMore: true,
    isLoading: false,
    retryCount: 0, // 재시도 카운터
    maxRetries: 5, // 최대 5회 재시도
  };

  // ============================================
  // DOM Element Caching
  // ============================================
  const elements = {
    postList: null,
    loadingIndicator: null,
    emptyState: null,
    writeButton: null,
    loadMoreButton: null,
    loadMoreContainer: null,
    profileImage: null,
    profileDropdown: null,
  };

  // ============================================
  // Initialization
  // ============================================
  function init() {
    cacheElements();
    bindEvents();
    loadInitialData();
  }

  function cacheElements() {
    elements.postList = document.querySelector('[data-list="posts"]');
    elements.loadingIndicator = document.querySelector('[data-loading="posts"]');
    elements.emptyState = document.querySelector('[data-empty="posts"]');
    elements.writeButton = document.querySelector('[data-action="write-post"]');
    elements.loadMoreButton = document.querySelector('[data-action="load-more"]');
    elements.loadMoreContainer = document.querySelector('.load-more-container');
    elements.profileImage = document.querySelector('[data-profile="image"]');
    elements.profileDropdown = document.querySelector('[data-dropdown="profile"]');
    // Floating buttons
    elements.floatingButtons = document.querySelector('[data-floating-buttons]');
    elements.scrollTopBtn = document.querySelector('[data-action="scroll-to-top"]');
    elements.floatingWriteBtn = document.querySelector('[data-action="floating-write-post"]');
  }

  // ============================================
  // Event Binding
  // ============================================
  function bindEvents() {
    // 게시글 작성 버튼
    if (elements.writeButton) {
      elements.writeButton.addEventListener('click', handleWriteClick);
    }

    // 무한 스크롤 (Scroll 이벤트)
    window.addEventListener('scroll', debounce(handleScroll, 300));

    // 게시글 카드 클릭 (이벤트 위임)
    if (elements.postList) {
      elements.postList.addEventListener('click', handlePostClick);
    }

    // 프로필 메뉴
    if (elements.profileDropdown) {
      elements.profileDropdown.addEventListener('click', handleProfileMenuClick);
    }

    // Floating buttons
    if (elements.scrollTopBtn) {
      elements.scrollTopBtn.addEventListener('click', handleScrollToTop);
    }
    if (elements.floatingWriteBtn) {
      elements.floatingWriteBtn.addEventListener('click', handleWriteClick);
    }

    // Scroll detection for floating buttons
    window.addEventListener('scroll', debounce(handleFloatingButtonsVisibility, 100));
  }

  // ============================================
  // Initial Data Load
  // ============================================
  async function loadInitialData() {
    // 샘플 게시글 제거 및 스켈레톤 표시
    if (elements.postList) {
      elements.postList.innerHTML = '';
      renderSkeletonCards();
    }

    // 프로필 이미지 로드 (공통 모듈 사용)
    await initAuthHeader();

    // 첫 페이지 게시글 로드
    await loadPosts();
  }

  // ============================================
  // Event Handlers
  // ============================================
  function handleWriteClick(e) {
    e.preventDefault();

    // 로그인 확인
    if (!isAuthenticated()) {
      Toast.error('로그인이 필요합니다.', '인증 필요', 2000, () => {
        window.location.replace(CONFIG.LOGIN_URL);
      });
      return;
    }

    // 게시글 작성 페이지로 이동
    window.location.href = CONFIG.WRITE_POST_URL;
  }

  /**
   * 무한 스크롤 핸들러
   * Viewport 하단 200px 도달 시 자동 로딩
   */
  function handleScroll() {
    // 로딩 중이거나 더 이상 데이터가 없으면 종료
    if (state.isLoading || !state.hasMore) return;

    // Viewport 하단까지 남은 거리 계산
    const scrollHeight = document.documentElement.scrollHeight;
    const scrollTop = window.scrollY || window.pageYOffset;
    const clientHeight = window.innerHeight;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;

    // 하단 200px 도달 시 자동 로딩
    if (distanceToBottom < 200) {
      loadPosts();
    }
  }

  function handlePostClick(e) {
    const card = e.target.closest('.post-card');
    if (!card) return;

    const postId = card.dataset.postId;
    if (postId) {
      window.location.href = `${CONFIG.POST_DETAIL_URL}/${postId}`;
    }
  }

  // handleProfileMenuClick은 auth-header.js 공통 모듈 사용

  // ============================================
  // API Functions
  // ============================================
  /**
   * 게시글 목록 로드 (Cursor 페이지네이션)
   * GET /posts?cursor={cursor}&limit={limit}&sort=latest
   */
  async function loadPosts() {
    if (state.isLoading || !state.hasMore) return;

    setLoading(true);

    try {
      // API 호출 (cursor 방식)
      const params = new URLSearchParams({
        limit: CONFIG.PAGE_SIZE,
        sort: 'latest',
      });

      if (state.currentCursor) {
        params.append('cursor', state.currentCursor);
      }

      const result = await fetchWithAuth(`/posts?${params}`);

      // 응답 구조: { posts: [...], nextCursor: 100, hasMore: true }
      handlePostsLoaded(result);
      state.retryCount = 0; // 성공 시 카운터 리셋
      setLoading(false);
      removeSkeletonCards();
    } catch (error) {
      console.error('Failed to load posts:', error);

      state.retryCount++;
      removeSkeletonCards();

      if (state.retryCount >= state.maxRetries) {
        // 5회 재시도 후 버튼 표시
        setLoading(false);
        showError(`게시글을 불러올 수 없습니다. (${state.retryCount}/${state.maxRetries})`);
        showRetryButton();
      } else {
        // 재시도 가능 - 2초 후 자동 재시도
        // isLoading = true를 유지하여 재시도 중 중복 요청 방지
        showError(
          `게시글을 불러오는데 실패했습니다. (시도 ${state.retryCount}/${state.maxRetries})`
        );

        setTimeout(() => {
          // 재시도: isLoading이 여전히 true이므로 중복 요청 방지됨
          loadPosts();
        }, 2000);
      }
    }
  }

  function handlePostsLoaded(data) {
    const { posts, nextCursor, hasMore } = data;

    // 첫 로드 시 스켈레톤 제거
    if (state.currentCursor === null) {
      removeSkeletonCards();
    }

    // 첫 로드이고 게시글이 없는 경우
    if (posts.length === 0 && state.currentCursor === null) {
      showEmptyState();
      return;
    }

    // 게시글 렌더링
    posts.forEach((post) => {
      renderPost(post);
    });

    // 상태 업데이트
    state.currentCursor = nextCursor;
    state.hasMore = hasMore;

    // 더보기 버튼 표시/숨김
    updateLoadMoreButton();

    // Empty state 숨김
    if (elements.emptyState) {
      elements.emptyState.style.display = 'none';
    }
  }

  // ============================================
  // Render Functions
  // ============================================
  function renderPost(post) {
    const card = createPostCard(post);
    if (elements.postList) {
      elements.postList.appendChild(card);
    }
  }

  /**
   * 게시글 카드 생성
   * @param {Object} post - 게시글 객체
   * @returns {HTMLElement} - 게시글 카드 요소
   */
  function createPostCard(post) {
    const article = document.createElement('article');
    article.className = 'post-card';
    article.dataset.postId = post.postId;

    // 작성자 정보
    const author = post.author || {};
    const authorName = escapeHtml(author.nickname || '알 수 없음');
    const authorImage = author.profileImage || getProfilePlaceholder(author.userId);

    // 통계 정보
    const stats = post.stats || { likeCount: 0, commentCount: 0, viewCount: 0 };

    // 날짜 포맷
    const formattedDate = formatDate(post.createdAt);

    // 이미지 HTML (있는 경우)
    const imageHtml = post.imageUrl
      ? `
      <div class="post-card__image-wrapper">
        <img src="${escapeHtml(post.imageUrl)}" alt="게시글 이미지" class="post-card__image" loading="lazy" onerror="this.style.display='none';">
      </div>
    `
      : '';

    article.innerHTML = `
      <div class="post-card__header">
        <img src="${authorImage}" alt="작성자 프로필" class="post-card__avatar" loading="lazy" onerror="this.src=getProfilePlaceholder(${author.userId});">
        <div class="post-card__author">
          <div class="post-card__author-name">${authorName}</div>
          <div class="post-card__date">${formattedDate}</div>
        </div>
      </div>
      ${imageHtml}
      <h3 class="post-card__title">${escapeHtml(post.title)}</h3>
      <div class="post-card__meta">
        <div class="post-card__stat">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
          <span>${formatNumberCompact(stats.likeCount)}</span>
        </div>
        <div class="post-card__stat">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
          </svg>
          <span>${formatNumberCompact(stats.commentCount)}</span>
        </div>
        <div class="post-card__stat">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
          </svg>
          <span>${formatNumberCompact(stats.viewCount)}</span>
        </div>
      </div>
    `;

    return article;
  }

  // ============================================
  // UI Helper Functions
  // ============================================
  function renderSkeletonCards() {
    if (!elements.postList) return;

    const skeletonCount = 3;
    for (let i = 0; i < skeletonCount; i++) {
      const skeleton = createSkeletonCard();
      elements.postList.appendChild(skeleton);
    }
  }

  function createSkeletonCard() {
    const article = document.createElement('article');
    article.className = 'skeleton-post-card';
    article.setAttribute('data-skeleton', 'true');

    article.innerHTML = `
      <div class="skeleton-post-card__header">
        <div class="skeleton skeleton-post-card__avatar"></div>
        <div class="skeleton-post-card__author">
          <div class="skeleton skeleton-post-card__author-name"></div>
          <div class="skeleton skeleton-post-card__date"></div>
        </div>
      </div>
      <div class="skeleton skeleton-post-card__title"></div>
      <div class="skeleton skeleton-post-card__excerpt"></div>
      <div class="skeleton skeleton-post-card__excerpt"></div>
      <div class="skeleton-post-card__meta">
        <div class="skeleton skeleton-post-card__stat"></div>
        <div class="skeleton skeleton-post-card__stat"></div>
        <div class="skeleton skeleton-post-card__stat"></div>
      </div>
    `;

    return article;
  }

  function removeSkeletonCards() {
    if (!elements.postList) return;

    const skeletons = elements.postList.querySelectorAll('[data-skeleton="true"]');
    skeletons.forEach((skeleton) => skeleton.remove());
  }

  function showRetryButton() {
    const retryContainer = document.getElementById('retry-container');
    const retryButton = document.getElementById('retry-button');

    if (retryContainer) retryContainer.style.display = 'block';
    if (retryButton) {
      retryButton.onclick = () => {
        state.retryCount = 0; // 카운터 리셋
        state.hasMore = true; // 상태 복구
        if (retryContainer) retryContainer.style.display = 'none';
        loadPosts();
      };
    }
  }

  function setLoading(loading) {
    state.isLoading = loading;

    if (elements.loadingIndicator) {
      elements.loadingIndicator.style.display = loading ? 'flex' : 'none';
    }
  }

  function showEmptyState() {
    if (elements.emptyState) {
      elements.emptyState.style.display = 'flex';
    }
    if (elements.postList) {
      elements.postList.style.display = 'none';
    }
  }

  function updateLoadMoreButton() {
    if (elements.loadMoreContainer) {
      elements.loadMoreContainer.style.display = state.hasMore ? 'block' : 'none';
    }
  }

  function showError(message) {
    Toast.error(translateErrorCode(message), '오류');
  }

  // ============================================
  // User Profile
  // ============================================
  // loadUserProfile, handleLogout, debounce는 공통 모듈 사용
  // - initAuthHeader() (auth-header.js)
  // - performLogout() (auth-header.js)
  // - debounce() (utils.js)
  // ============================================

  // ============================================
  // Floating Buttons
  // ============================================
  /**
   * Scroll to top handler
   */
  function handleScrollToTop() {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  /**
   * Show/hide floating buttons based on scroll position
   * Trigger: 300px from top
   */
  function handleFloatingButtonsVisibility() {
    if (!elements.floatingButtons) return;

    const scrollY = window.scrollY;
    const triggerPoint = 300;

    if (scrollY > triggerPoint) {
      elements.floatingButtons.style.display = 'flex';
      // Force reflow for animation
      void elements.floatingButtons.offsetWidth;
      elements.floatingButtons.classList.add('floating-buttons--visible');
    } else {
      elements.floatingButtons.classList.remove('floating-buttons--visible');
      // Hide after animation completes (matches CSS transition duration)
      setTimeout(() => {
        if (!elements.floatingButtons.classList.contains('floating-buttons--visible')) {
          elements.floatingButtons.style.display = 'none';
        }
      }, 400);
    }
  }

  // ============================================
  // DOMContentLoaded Event
  // ============================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window, document);
