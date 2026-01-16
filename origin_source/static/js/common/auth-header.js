/**
 * 헤더 인증 공통 모듈
 * - 사용자 프로필 로드 및 [data-auth] 블록 토글
 * - 프로필 드롭다운 이벤트 위임
 * - 로그아웃 처리
 */

/**
 * 헤더 인증 UI 초기화
 * - 로그인 상태에 따라 [data-auth] 블록 토글
 * - 로그인 시 사용자 프로필 이미지/닉네임 업데이트
 *
 * @returns {Promise<void>}
 */
async function initAuthHeader() {
  const profileMenu = document.querySelector('[data-auth="authenticated"]');
  const guestAuth = document.querySelector('[data-auth="guest"]');

  if (!isAuthenticated()) {
    if (profileMenu) profileMenu.style.display = 'none';
    if (guestAuth) guestAuth.style.display = 'flex';
    return;
  }

  if (profileMenu) profileMenu.style.display = 'flex';
  if (guestAuth) guestAuth.style.display = 'none';

  const userId = getCurrentUserId();
  if (!userId) return;

  try {
    // fetchWithAuth는 이미 JSON 파싱된 data 필드를 반환
    const user = await fetchWithAuth(`/users/${userId}`);

    const profileImage = document.querySelector('[data-profile="image"]');
    const profileNickname = document.querySelector('[data-profile="nickname"]');

    if (profileImage) {
      profileImage.src = user.profileImage || getProfilePlaceholder(userId);
    }
    if (profileNickname && user.nickname) {
      profileNickname.textContent = user.nickname;
    }
  } catch (error) {
    console.error('Failed to load user profile:', error);

    // Network Error인 경우 사용자에게 알림
    if (error.message === 'NETWORK-ERROR') {
      Toast.warning('프로필 정보를 불러올 수 없습니다.', '네트워크 오류', 3000);
    }
  }
}

/**
 * 프로필 드롭다운 메뉴 클릭 이벤트 핸들러
 * - 로그아웃 버튼 클릭 시 로그아웃 처리
 * - 프로필 링크 클릭 시 페이지 이동
 *
 * @param {Event} e - 클릭 이벤트 객체
 */
function handleProfileMenuClick(e) {
  const logoutTarget = e.target.closest('[data-action="logout"]');
  if (logoutTarget) {
    e.preventDefault();
    performLogout();
    return;
  }

  const profileLink = e.target.closest('[data-action="profile-link"], a.profile-menu__item');
  if (profileLink && profileLink.tagName === 'A') {
    e.preventDefault();
    const href = profileLink.getAttribute('href');
    if (href) {
      window.location.href = href;
    }
  }
}

/**
 * 로그아웃 처리
 * - 서버에 로그아웃 요청
 * - 실패 시에도 로그인 페이지로 리디렉션 (클라이언트 토큰 제거)
 *
 * @param {string} redirectUrl - 로그아웃 후 리디렉션할 URL (기본값: 로그인 페이지)
 * @returns {Promise<void>}
 */
async function performLogout(redirectUrl = '/pages/user/login.html') {
  try {
    await logout();
  } catch (error) {
    console.error('Logout failed:', error);
  } finally {
    window.location.replace(redirectUrl);
  }
}
