/**
 * Home Page Script
 * 소개 페이지 로직
 */

(function(window, document) {
    'use strict';

    // DOM 요소 캐싱
    const elements = {
        profileImage: null,
        profileNickname: null,
        profileDropdown: null
    };

    /**
     * 초기화
     */
    function init() {
        cacheElements();
        bindEvents();
        updateHeaderAuth();
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
     * localStorage의 access_token 확인하여 버튼 표시
     */
    async function updateHeaderAuth() {
        const guestAuth = document.querySelector('[data-auth="guest"]');
        const authenticatedAuth = document.querySelector('[data-auth="authenticated"]');

        if (!guestAuth || !authenticatedAuth) return;

        // isAuthenticated() from api.js
        if (isAuthenticated()) {
            // 로그인 상태
            guestAuth.style.display = 'none';
            authenticatedAuth.style.display = 'flex';

            // 프로필 정보 로드
            await loadUserProfile();
        } else {
            // 비로그인 상태
            guestAuth.style.display = 'flex';
            authenticatedAuth.style.display = 'none';
        }
    }

    /**
     * 사용자 프로필 정보 로드
     */
    async function loadUserProfile() {
        try {
            const userId = getCurrentUserId();
            if (!userId) {
                console.warn('[Home] No userId found, skipping profile load');
                return;
            }

            // fetchWithAuth는 이미 data.data를 반환함
            const user = await fetchWithAuth(`/users/${userId}`);

            // 프로필 이미지 설정
            if (elements.profileImage && user.profileImage) {
                elements.profileImage.src = user.profileImage;
            }

            // 프로필 닉네임 설정
            if (elements.profileNickname && user.nickname) {
                elements.profileNickname.textContent = user.nickname;
            }
        } catch (error) {
            console.error('[Home] Failed to load user profile:', error);
        }
    }

    /**
     * 프로필 메뉴 클릭 핸들러
     */
    function handleProfileMenuClick(e) {
        // 로그아웃 버튼 클릭
        const logoutTarget = e.target.closest('[data-action="logout"]');
        if (logoutTarget) {
            e.preventDefault();
            handleLogout();
            return;
        }

        // 프로필 링크 클릭
        const profileLink = e.target.closest('[data-action="profile-link"]');
        if (profileLink) {
            e.preventDefault();
            const href = profileLink.getAttribute('href');
            if (href) {
                window.location.href = href;
            }
        }
    }

    /**
     * 로그아웃 처리
     */
    async function handleLogout() {
        try {
            await fetchWithAuth('/auth/logout', { method: 'POST' });
            removeAccessToken();
            window.location.href = '/pages/user/login.html';
        } catch (error) {
            console.error('Logout failed:', error);
            // 로그아웃 실패해도 로그인 페이지로 이동
            removeAccessToken();
            window.location.href = '/pages/user/login.html';
        }
    }

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
                comments: 420
            });
        }
    }

    /**
     * 통계 API 호출
     */
    async function fetchStats() {
        const response = await fetch('http://localhost:8080/stats', {
            credentials: 'include'
        });

        if (response.ok) {
            const data = await response.json();
            // 백엔드 응답 형식에 맞춰 변환
            return {
                posts: data.data.totalPosts,
                members: data.data.totalUsers,
                comments: data.data.totalComments
            };
        }

        throw new Error('Failed to fetch stats');
    }

    /**
     * 통계 표시 업데이트
     */
    function updateStatsDisplay(stats) {
        const elements = {
            posts: document.querySelector('[data-stat="posts"]'),
            members: document.querySelector('[data-stat="members"]'),
            comments: document.querySelector('[data-stat="comments"]')
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