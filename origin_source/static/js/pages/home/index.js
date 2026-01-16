/**
 * Home Page Script
 * 소개 페이지 로직
 */

(function (window, document) {
  'use strict';

  // DOM 요소 캐싱
  const elements = {
    profileImage: null,
    profileNickname: null,
    profileDropdown: null,
  };

  /**
   * 초기화
   */
  async function init() {
    cacheElements();
    bindEvents();
    await updateHeaderAuth();
    loadStats();
  }

  /**
   * DOM 요소 캐싱
   */
  function cacheElements() {
    elements.profileImage = document.querySelector('[data-profile="image"]');
    elements.profileNickname = document.querySelector('[data-profile="nickname"]');
    elements.profileDropdown = document.querySelector('[data-dropdown="profile"]');
  }

  /**
   * 이벤트 바인딩
   */
  function bindEvents() {
    // 프로필 메뉴 클릭 (로그아웃)
    if (elements.profileDropdown) {
      elements.profileDropdown.addEventListener('click', handleProfileMenuClick);
    }
  }

  /**
   * 헤더 인증 상태 업데이트
   * initAuthHeader()로 대체 (auth-header.js 공통 모듈)
   */
  async function updateHeaderAuth() {
    await initAuthHeader();
  }

  // loadUserProfile은 auth-header.js의 initAuthHeader() 사용

  // handleProfileMenuClick은 auth-header.js 공통 모듈 사용

  // handleLogout은 auth-header.js의 performLogout() 사용

  /**
   * 통계 데이터 로드
   */
  async function loadStats() {
    try {
      const stats = await fetchStats();
      updateStatsDisplay(stats);
    } catch (error) {
      console.error('Failed to load stats:', error);
      updateStatsDisplay({
        posts: 150,
        members: 89,
        comments: 420,
      });
    }
  }

  /**
   * 통계 API 호출
   * API_BASE_URL, API_PREFIX는 config.js에서 환경별 동적 설정됨
   */
  async function fetchStats() {
    try {
      const API_BASE_URL = window.APP_CONFIG?.API_BASE_URL || '';
      const API_PREFIX = window.APP_CONFIG?.API_PREFIX || '';
      const response = await fetch(`${API_BASE_URL}${API_PREFIX}/stats`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        // 백엔드 응답 형식에 맞춰 변환
        return {
          posts: data.data.totalPosts,
          members: data.data.totalUsers,
          comments: data.data.totalComments,
        };
      }

      throw new Error('Failed to fetch stats');
    } catch (error) {
      // Network Error 감지 (TypeError "Failed to fetch")
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        const networkError = new Error('NETWORK-ERROR');
        networkError.originalError = error;
        throw networkError;
      }
      throw error;
    }
  }

  /**
   * 통계 표시 업데이트
   */
  function updateStatsDisplay(stats) {
    const elements = {
      posts: document.querySelector('[data-stat="posts"]'),
      members: document.querySelector('[data-stat="members"]'),
      comments: document.querySelector('[data-stat="comments"]'),
    };

    animateNumber(elements.posts, stats.posts || 0);
    animateNumber(elements.members, stats.members || 0);
    animateNumber(elements.comments, stats.comments || 0);
  }

  /**
   * 숫자 카운트업 애니메이션
   */
  function animateNumber(element, target) {
    if (!element) return;

    const duration = 2000;
    const start = 0;
    const startTime = performance.now();

    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const current = Math.floor(start + (target - start) * progress);
      element.textContent = current.toLocaleString();

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }

    requestAnimationFrame(update);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window, document);
