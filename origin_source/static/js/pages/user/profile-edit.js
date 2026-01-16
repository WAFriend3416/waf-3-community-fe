/**
 * Profile Edit Page Script
 * 프로필 수정 페이지 로직
 * 참조: @docs/be/API.md Section 2.2, 2.3, 2.5
 */

(function (window, document) {
  'use strict';

  const CONFIG = {
    MAX_NICKNAME_LENGTH: 10,
    MAX_FILE_SIZE: 5 * 1024 * 1024,
    ALLOWED_FILE_TYPES: ['image/jpeg', 'image/png', 'image/gif'],
    LIST_URL: '/board',
  };

  // API_BASE_URL은 server.js에서 window.APP_CONFIG로 주입됨
  const API_BASE_URL = window.APP_CONFIG?.API_BASE_URL || '';

  const state = {
    userId: null,
    selectedFile: null,
    removeExistingImage: false, // 이미지 제거 플래그
    isSubmitting: false, // 중복 제출 방지 플래그
    hasChanges: false, // 변경사항 추적
    initialData: {
      // 초기 데이터 저장
      nickname: '',
      profileImageSrc: '',
    },
  };

  const elements = {
    form: null,
    profileImage: null,
    profileImageInput: null,
    removeImageButton: null,
    nicknameInput: null,
    nicknameError: null,
    saveButton: null,
    withdrawButton: null,
  };

  function init() {
    try {
      const userId = getCurrentUserId();

      // userId 검증 (null, undefined만 체크)
      if (!userId) {
        console.error('Failed to get userId');
        Toast.error('로그인이 필요합니다.', '인증 필요', 3000, () => {
          window.location.href = '/page/login';
        });
        return;
      }

      state.userId = userId;

      cacheElements();
      cleanupInlineStyles(); // 인라인 스타일 정리
      bindEvents();
      enableUnsavedChangesWarning(() => state.hasChanges); // 브라우저 뒤로가기 처리
      loadUserData();
    } catch (error) {
      console.error('Initialization failed:', error);
      Toast.error('로그인이 필요합니다.', '인증 필요', 3000, () => {
        window.location.href = '/page/login';
      });
    }
  }

  function cacheElements() {
    elements.form = document.querySelector('[data-form="profile-edit"]');
    elements.profileImage = document.querySelector('[data-image="profile"]');
    elements.profileImageInput = document.querySelector('[data-field="profileImage"]');
    elements.removeImageButton = document.querySelector('[data-action="remove-image"]');
    elements.nicknameInput = document.querySelector('[data-field="nickname"]');
    elements.nicknameError = document.querySelector('[data-error="nickname"]');
    elements.saveButton = document.querySelector('[data-action="save"]');
    elements.withdrawButton = document.querySelector('[data-action="withdraw"]');
  }

  /**
   * 오류 요소의 인라인 스타일 제거 (CSS가 제어하도록)
   * 이전 실행으로 남아있을 수 있는 display 스타일 정리
   */
  function cleanupInlineStyles() {
    if (elements.nicknameError) {
      elements.nicknameError.style.display = ''; // 인라인 스타일 제거
      elements.nicknameError.textContent = ''; // 텍스트 초기화
    }
  }

  function bindEvents() {
    if (elements.form) {
      elements.form.addEventListener('submit', handleSubmit);
    }
    if (elements.profileImageInput) {
      elements.profileImageInput.addEventListener('change', handleImageChange);
    }
    if (elements.removeImageButton) {
      elements.removeImageButton.addEventListener('click', handleRemoveImage);
    }
    if (elements.withdrawButton) {
      elements.withdrawButton.addEventListener('click', handleWithdraw);
    }
    document.querySelector('[data-action="go-back"]')?.addEventListener('click', async (e) => {
      e.preventDefault();
      await handleGoBack();
    });

    // 실시간 검증 (blur 이벤트)
    if (elements.nicknameInput) {
      elements.nicknameInput.addEventListener('blur', () => validateField('nickname'));
    }

    // 입력 시 에러 메시지 제거 + 변경 감지
    if (elements.nicknameInput) {
      elements.nicknameInput.addEventListener('input', () => {
        clearNicknameError();
        checkForChanges(); // 변경 감지
      });
    }
  }

  async function loadUserData() {
    try {
      const user = await fetchWithAuth(`/users/${state.userId}`);

      if (elements.nicknameInput && user.nickname) {
        elements.nicknameInput.value = user.nickname;
        state.initialData.nickname = user.nickname; // 초기 값 저장
      }
      if (elements.profileImage && user.profileImage) {
        elements.profileImage.src = user.profileImage;
        elements.profileImage.style.display = 'block';
        state.initialData.profileImageSrc = user.profileImage; // 초기 값 저장
        // 이미지가 있으면 제거 버튼 표시
        if (elements.removeImageButton) {
          elements.removeImageButton.style.display = 'block';
        }
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

  function checkForChanges() {
    const currentNickname = elements.nicknameInput ? elements.nicknameInput.value : '';
    const hasNicknameChange = currentNickname !== state.initialData.nickname;
    const hasImageChange = state.selectedFile !== null || state.removeExistingImage;

    state.hasChanges = hasNicknameChange || hasImageChange;
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
      // 1단계: 새 이미지 업로드 (선택)
      let imageId = null;
      if (state.selectedFile) {
        try {
          const imageResult = await uploadImage(state.selectedFile);
          imageId = imageResult.imageId;
        } catch (error) {
          console.error('Image upload failed:', error);
          const translatedMessage = translateErrorCode(error.message);
          Toast.error(translatedMessage || '이미지 업로드에 실패했습니다.', '오류');
          state.isSubmitting = false;
          elements.saveButton.disabled = false;
          elements.saveButton.textContent = '저장';
          return;
        }
      }

      // 2단계: 프로필 수정 (JSON)
      const requestBody = { nickname };
      if (state.removeExistingImage) {
        requestBody.removeImage = true;
      } else if (imageId) {
        requestBody.imageId = imageId;
      }

      // fetchWithAuth 사용 (401 자동 재시도 포함)
      let response;
      try {
        response = await fetchWithAuth(`/users/${state.userId}`, {
          method: 'PATCH',
          body: JSON.stringify(requestBody),
        });

        // fetchWithAuth는 성공 시 data.data 반환, 204는 { success: true }
        disableUnsavedChangesWarning(); // beforeunload 경고 비활성화
        Toast.success('프로필이 수정되었습니다.', '수정 완료', 3000, () => {
          window.location.reload();
        });
      } catch (error) {
        // fetchWithAuth 내부에서 401 처리 실패 시 여기로 옴
        if (error.message === 'Authentication failed') {
          Toast.error('인증이 만료되었습니다. 다시 로그인해주세요.', '인증 만료');
          setTimeout(() => {
            window.location.href = '/page/login';
          }, 2000);
          return;
        }
        throw error;
      }
    } catch (error) {
      console.error('[Profile Edit] Failed to update profile:', error);

      // NETWORK-ERROR: 네트워크 연결 실패
      if (error.message === 'NETWORK-ERROR') {
        const translatedMessage = translateErrorCode(error.message);
        Toast.error(translatedMessage, '네트워크 오류', 3000);
      } else {
        const errorMessage = translateErrorCode(error.message) || '프로필 수정에 실패했습니다.';
        Toast.error(errorMessage, '오류');
      }

      state.isSubmitting = false;
      elements.saveButton.disabled = false;
      elements.saveButton.textContent = '저장';
    }
  }

  function showNicknameError(message) {
    if (elements.nicknameError) {
      elements.nicknameError.textContent = message;
      // CSS의 :not(:empty) 선택자가 자동으로 visibility 제어
    }
    if (elements.nicknameInput) {
      elements.nicknameInput.classList.add('input-field__input--error');
    }
  }

  function clearNicknameError() {
    if (elements.nicknameError) {
      elements.nicknameError.textContent = '';
      // CSS의 :not(:empty) 선택자가 자동으로 visibility 제어
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
      Toast.error('JPG, PNG, GIF 파일만 업로드 가능합니다.', '파일 형식 오류');
      e.target.value = '';
      return;
    }

    state.selectedFile = file;
    state.removeExistingImage = false; // 새 이미지 선택 시 제거 플래그 해제
    checkForChanges(); // 변경 감지

    const reader = new FileReader();
    reader.onload = (e) => {
      elements.profileImage.src = e.target.result;
      elements.profileImage.style.display = 'block';
      if (elements.removeImageButton) {
        elements.removeImageButton.style.display = 'block';
      }
    };
    reader.readAsDataURL(file);
  }

  function handleRemoveImage() {
    state.selectedFile = null;
    state.removeExistingImage = true;

    // 사용자별 고유 플레이스홀더로 변경
    elements.profileImage.src = getProfilePlaceholder(state.userId);
    elements.profileImage.style.display = 'block';
    if (elements.removeImageButton) {
      elements.removeImageButton.style.display = 'none';
    }
    elements.profileImageInput.value = '';

    checkForChanges(); // 변경 감지
  }

  async function handleGoBack() {
    if (state.hasChanges) {
      const confirmed = await confirmModal(
        '변경사항 확인',
        '저장하지 않은 변경사항이 있습니다. 페이지를 나가시겠습니까?'
      );
      if (!confirmed) return;
      // 사용자가 확인했으므로 beforeunload 경고 방지
      state.hasChanges = false;
    }
    window.location.href = CONFIG.LIST_URL;
  }

  // setupBackNavigation은 navigation.js의 enableUnsavedChangesWarning() 사용

  async function handleWithdraw() {
    const confirmed1 = await confirmModal(
      '회원 탈퇴',
      '정말 탈퇴하시겠습니까? 모든 데이터가 삭제됩니다.',
      { isDanger: true }
    );
    if (!confirmed1) return;

    const confirmed2 = await confirmModal(
      '최종 확인',
      '탈퇴 후에는 복구할 수 없습니다. 계속하시겠습니까?',
      { isDanger: true }
    );
    if (!confirmed2) return;

    try {
      // 디버깅 로그
      console.log('회원 탈퇴 요청:', {
        url: `/users/${state.userId}`,
        userId: state.userId,
        hasAccessToken: !!getAccessToken(),
        method: 'PUT',
      });

      await fetchWithAuth(`/users/${state.userId}`, {
        method: 'PUT',
      });

      Toast.success('회원탈퇴가 완료되었습니다.', '탈퇴 완료', 3000, () => {
        logout();
        window.location.href = '/page/login';
      });
    } catch (error) {
      console.error('Failed to withdraw:', error);

      // NETWORK-ERROR: 네트워크 연결 실패
      if (error.message === 'NETWORK-ERROR') {
        const translatedMessage = translateErrorCode(error.message);
        Toast.error(translatedMessage, '네트워크 오류', 3000);
      } else {
        const translatedMessage = translateErrorCode(error.message);
        Toast.error(translatedMessage || '회원탈퇴에 실패했습니다.', '오류');
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window, document);
