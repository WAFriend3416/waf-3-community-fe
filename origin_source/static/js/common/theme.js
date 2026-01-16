/**
 * Theme Toggle Module
 * 다크/라이트 테마 전환 기능
 */

const ThemeManager = (function () {
  const STORAGE_KEY = 'theme';
  const DARK = 'dark';
  const LIGHT = 'light';

  /**
   * 저장된 테마 또는 시스템 preference 반환
   */
  function getPreferredTheme() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;

    // 시스템 preference 확인
    if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      return LIGHT;
    }
    return DARK;
  }

  /**
   * 테마 적용
   */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
    updateToggleIcon(theme);
  }

  /**
   * 토글 아이콘 업데이트
   */
  function updateToggleIcon(theme) {
    const toggleBtn = document.querySelector('[data-action="toggle-theme"]');
    if (!toggleBtn) return;

    const sunIcon = toggleBtn.querySelector('.theme-icon--sun');
    const moonIcon = toggleBtn.querySelector('.theme-icon--moon');

    if (sunIcon && moonIcon) {
      if (theme === LIGHT) {
        sunIcon.style.display = 'none';
        moonIcon.style.display = 'block';
      } else {
        sunIcon.style.display = 'block';
        moonIcon.style.display = 'none';
      }
    }
  }

  /**
   * 테마 토글
   */
  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || DARK;
    const next = current === DARK ? LIGHT : DARK;
    applyTheme(next);
  }

  /**
   * 초기화
   */
  function init() {
    // 페이지 로드 시 테마 적용
    const theme = getPreferredTheme();
    applyTheme(theme);

    // 토글 버튼 이벤트 바인딩
    document.addEventListener('click', function (e) {
      const toggleBtn = e.target.closest('[data-action="toggle-theme"]');
      if (toggleBtn) {
        e.preventDefault();
        toggleTheme();
      }
    });

    // 시스템 preference 변경 감지
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', function (e) {
      if (!localStorage.getItem(STORAGE_KEY)) {
        applyTheme(e.matches ? LIGHT : DARK);
      }
    });
  }

  return {
    init: init,
    toggle: toggleTheme,
    apply: applyTheme,
    get: getPreferredTheme,
  };
})();

// DOM 로드 시 초기화
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', ThemeManager.init);
} else {
  ThemeManager.init();
}
