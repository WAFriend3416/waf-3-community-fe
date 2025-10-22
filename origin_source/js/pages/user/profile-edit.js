/**
 * Profile Edit Page Script
 * 프로필 수정 페이지 로직
 * 참조: @docs/be/API.md Section 2.2, 2.3, 2.5
 */

(function(window, document) {
  'use strict';

  const CONFIG = {
    MAX_NICKNAME_LENGTH: 10,
    MAX_FILE_SIZE: 5 * 1024 * 1024,
    ALLOWED_FILE_TYPES: ['image/jpeg', 'image/png', 'image/gif'],
    LIST_URL: '/pages/board/list.html'
  };

  const state = {
    userId: null,
    selectedFile: null,
    isSubmitting: false  // 중복 제출 방지 플래그
  };

  const elements = {
    form: null,
    profileImage: null,
    profileImageInput: null,
    nicknameInput: null,
    nicknameError: null,
    saveButton: null,
    withdrawButton: null
  };

  async function init() {
    try {
      const userId = getCurrentUserId();

      // userId 검증 (null, undefined만 체크)
      if (!userId) {
        console.error('Failed to get userId');
        Toast.warning('로그인이 필요합니다.', '인증 필요');
        window.location.href = '/pages/user/login.html';
        return;
      }

      state.userId = userId;

      cacheElements();
      bindEvents();
      loadUserData();
    } catch (error) {
      console.error('Initialization failed:', error);
      Toast.warning('로그인이 필요합니다.', '인증 필요');
      window.location.href = '/pages/user/login.html';
    }
  }

  function cacheElements() {
    elements.form = document.querySelector('[data-form="profile-edit"]');
    elements.profileImage = document.querySelector('[data-image="profile"]');
    elements.profileImageInput = document.querySelector('[data-field="profileImage"]');
    elements.nicknameInput = document.querySelector('[data-field="nickname"]');
    elements.nicknameError = document.querySelector('[data-error="nickname"]');
    elements.saveButton = document.querySelector('[data-action="save"]');
    elements.withdrawButton = document.querySelector('[data-action="withdraw"]');
  }

  function bindEvents() {
    if (elements.form) {
      elements.form.addEventListener('submit', handleSubmit);
    }
    if (elements.profileImageInput) {
      elements.profileImageInput.addEventListener('change', handleImageChange);
    }
    if (elements.withdrawButton) {
      elements.withdrawButton.addEventListener('click', handleWithdraw);
    }
    document.querySelector('[data-action="go-back"]')?.addEventListener('click', e => {
      e.preventDefault();
      window.history.back();
    });

    // 실시간 검증 (blur 이벤트)
    if (elements.nicknameInput) {
      elements.nicknameInput.addEventListener('blur', () => validateField('nickname'));
    }

    // 입력 시 에러 메시지 제거
    if (elements.nicknameInput) {
      elements.nicknameInput.addEventListener('input', () => clearNicknameError());
    }
  }

  async function loadUserData() {
    try {
      const user = await fetchWithAuth(`/users/${state.userId}`);
      elements.nicknameInput.value = user.nickname;
      if (user.profileImage) {
        elements.profileImage.src = user.profileImage;
        elements.profileImage.style.display = 'block';
      }
    } catch (error) {
      console.error('Failed to load user data:', error);
      Toast.error('사용자 정보를 불러오는데 실패했습니다.', '오류');
    }
  }

  function validateField(field) {
    if (field === 'nickname') {
      const nickname = sanitizeInput(elements.nicknameInput.value);
      const rawNickname = elements.nicknameInput.value;

      if (!nickname) {
        showNicknameError('닉네임을 입력해주세요.');
        return false;
      }
      if (hasExcessiveWhitespace(rawNickname)) {
        showNicknameError('닉네임에 공백이 너무 많습니다.');
        return false;
      }
      if (hasRepeatingCharacters(nickname, 3)) {
        showNicknameError('같은 문자를 너무 많이 반복할 수 없습니다.');
        return false;
      }
      if (nickname.length > CONFIG.MAX_NICKNAME_LENGTH) {
        showNicknameError(`닉네임은 ${CONFIG.MAX_NICKNAME_LENGTH}자 이하로 입력해주세요.`);
        return false;
      }
      clearNicknameError();
      return true;
    }
    return true;
  }

  async function handleSubmit(e) {
    e.preventDefault();

    // 중복 제출 방지
    if (state.isSubmitting) {
      return;
    }

    const nickname = sanitizeInput(elements.nicknameInput.value);
    const rawNickname = elements.nicknameInput.value;

    // 검증
    if (!validateField('nickname')) {
      return;
    }

    state.isSubmitting = true;
    elements.saveButton.disabled = true;
    elements.saveButton.textContent = '저장 중...';

    try {
      const formData = new FormData();
      formData.append('nickname', nickname);
      if (state.selectedFile) {
        formData.append('profileImage', state.selectedFile);  // camelCase로 통일
      }

      // API 호출 (multipart/form-data이므로 fetch 직접 사용)
      const response = await fetch(`${API_BASE_URL}/users/${state.userId}`, {
        method: 'PATCH',
        credentials: 'include',  // HttpOnly Cookie 자동 전송
        body: formData  // Content-Type 자동 설정 (multipart/form-data)
      });

      const data = await response.json();

      if (response.ok) {
        Toast.success('프로필이 수정되었습니다.', '수정 완료', () => {
          window.location.reload();
        });
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
      Toast.error(translateErrorCode(error.message) || '프로필 수정에 실패했습니다.', '오류');
      state.isSubmitting = false;
      elements.saveButton.disabled = false;
      elements.saveButton.textContent = '저장';
    }
  }

  function showNicknameError(message) {
    if (elements.nicknameError) {
      elements.nicknameError.textContent = message;
      elements.nicknameError.style.display = 'block';
    }
    if (elements.nicknameInput) {
      elements.nicknameInput.classList.add('input-field__input--error');
    }
  }

  function clearNicknameError() {
    if (elements.nicknameError) {
      elements.nicknameError.textContent = '';
      elements.nicknameError.style.display = 'none';
    }
    if (elements.nicknameInput) {
      elements.nicknameInput.classList.remove('input-field__input--error');
    }
  }

  function handleImageChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > CONFIG.MAX_FILE_SIZE) {
      Toast.error('이미지 파일 크기는 5MB 이하여야 합니다.', '파일 크기 초과');
      e.target.value = '';
      return;
    }

    if (!CONFIG.ALLOWED_FILE_TYPES.includes(file.type)) {
      Toast.error('JPG, PNG, GIF 파일만 업로드 가능합니다.', '잘못된 파일 형식');
      e.target.value = '';
      return;
    }

    state.selectedFile = file;

    const reader = new FileReader();
    reader.onload = e => {
      elements.profileImage.src = e.target.result;
      elements.profileImage.style.display = 'block';
    };
    reader.readAsDataURL(file);
  }

  async function handleWithdraw() {
    if (!confirm('정말 탈퇴하시겠습니까? 모든 데이터가 삭제됩니다.')) return;
    if (!confirm('탈퇴 후에는 복구할 수 없습니다. 계속하시겠습니까?')) return;

    try {
      await fetchWithAuth(`/users/${state.userId}`, {
        method: 'PUT'
      });

      Toast.success('회원탈퇴가 완료되었습니다.', '탈퇴 완료', () => {
        logout();
        window.location.href = '/pages/user/login.html';
      });
    } catch (error) {
      console.error('Failed to withdraw:', error);
      Toast.error('회원탈퇴에 실패했습니다.', '오류');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(window, document);
