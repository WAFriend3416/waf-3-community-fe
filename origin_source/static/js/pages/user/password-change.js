/**
 * Password Change Page Script
 * 비밀번호 변경 페이지 로직
 * 참조: @docs/be/API.md Section 2.4
 */

(function (window, document) {
  'use strict';

  const CONFIG = {
    LIST_URL: '/board',
  };

  const state = {
    userId: null,
    isSubmitting: false, // 중복 제출 방지 플래그
    hasChanges: false, // 변경사항 추적
  };

  const elements = {
    form: null,
    currentPasswordInput: null,
    newPasswordInput: null,
    newPasswordConfirmInput: null,
    currentPasswordError: null,
    newPasswordError: null,
    newPasswordConfirmError: null,
    saveButton: null,
    // Password toggle (비밀번호 표시/숨김)
    currentPasswordToggle: null,
    newPasswordToggle: null,
    newPasswordConfirmToggle: null,
  };

  function init() {
    try {
      const userId = getCurrentUserId();

      // userId 검증 (null, undefined만 체크)
      if (!userId) {
        console.error('Failed to get userId');
        Toast.warning('로그인이 필요합니다.', '인증 필요', 3000, () => {
          window.location.href = '/page/login';
        });
        return;
      }

      state.userId = userId;

      cacheElements();
      cleanupInlineStyles(); // 인라인 스타일 정리
      bindEvents();
      enableUnsavedChangesWarning(() => state.hasChanges); // 브라우저 뒤로가기 처리
    } catch (error) {
      console.error('Initialization failed:', error);
      Toast.warning('로그인이 필요합니다.', '인증 필요', 3000, () => {
        window.location.href = '/page/login';
      });
    }
  }

  function cacheElements() {
    elements.form = document.querySelector('[data-form="password-change"]');
    elements.currentPasswordInput = document.querySelector('[data-field="currentPassword"]');
    elements.newPasswordInput = document.querySelector('[data-field="newPassword"]');
    elements.newPasswordConfirmInput = document.querySelector('[data-field="newPasswordConfirm"]');
    elements.currentPasswordError = document.querySelector('[data-error="currentPassword"]');
    elements.newPasswordError = document.querySelector('[data-error="newPassword"]');
    elements.newPasswordConfirmError = document.querySelector('[data-error="newPasswordConfirm"]');
    elements.saveButton = document.querySelector('[data-action="save"]');

    // Password toggle
    elements.currentPasswordToggle = document.querySelector(
      '[data-action="toggle-current-password"]'
    );
    elements.newPasswordToggle = document.querySelector('[data-action="toggle-new-password"]');
    elements.newPasswordConfirmToggle = document.querySelector(
      '[data-action="toggle-new-password-confirm"]'
    );
  }

  /**
   * 오류 요소의 인라인 스타일 제거 (CSS가 제어하도록)
   * 이전 실행으로 남아있을 수 있는 display 스타일 정리
   */
  function cleanupInlineStyles() {
    const errorElements = [
      elements.currentPasswordError,
      elements.newPasswordError,
      elements.newPasswordConfirmError,
    ];
    errorElements.forEach((el) => {
      if (el) {
        el.style.display = ''; // 인라인 스타일 제거
        el.textContent = ''; // 텍스트 초기화
      }
    });
  }

  function bindEvents() {
    if (elements.form) {
      elements.form.addEventListener('submit', handleSubmit);
    }
    document.querySelector('[data-action="go-back"]')?.addEventListener('click', async (e) => {
      e.preventDefault();
      await handleGoBack();
    });

    // 실시간 검증 (blur 이벤트)
    if (elements.currentPasswordInput) {
      elements.currentPasswordInput.addEventListener('blur', () =>
        validateField('currentPassword')
      );
    }
    if (elements.newPasswordInput) {
      elements.newPasswordInput.addEventListener('blur', () => validateField('newPassword'));
    }
    if (elements.newPasswordConfirmInput) {
      elements.newPasswordConfirmInput.addEventListener('blur', () =>
        validateField('newPasswordConfirm')
      );
    }

    // 비밀번호 토글 버튼
    if (elements.currentPasswordToggle) {
      elements.currentPasswordToggle.addEventListener('click', () =>
        togglePasswordVisibility('currentPassword')
      );
    }
    if (elements.newPasswordToggle) {
      elements.newPasswordToggle.addEventListener('click', () =>
        togglePasswordVisibility('newPassword')
      );
    }
    if (elements.newPasswordConfirmToggle) {
      elements.newPasswordConfirmToggle.addEventListener('click', () =>
        togglePasswordVisibility('newPasswordConfirm')
      );
    }

    // 입력 시 에러 메시지 제거 + 변경 감지
    if (elements.currentPasswordInput) {
      elements.currentPasswordInput.addEventListener('input', () => {
        clearCurrentPasswordError();
        state.hasChanges = true;
      });
    }
    if (elements.newPasswordInput) {
      elements.newPasswordInput.addEventListener('input', () => {
        clearNewPasswordError();
        state.hasChanges = true;
      });
    }
    if (elements.newPasswordConfirmInput) {
      elements.newPasswordConfirmInput.addEventListener('input', () => {
        clearNewPasswordConfirmError();
        state.hasChanges = true;
      });
    }
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

  async function handleSubmit(e) {
    e.preventDefault();

    // 중복 제출 방지
    if (state.isSubmitting) {
      return;
    }

    const currentPassword = elements.currentPasswordInput.value;
    const newPassword = elements.newPasswordInput.value;
    const newPasswordConfirm = elements.newPasswordConfirmInput.value;

    // 검증
    if (!validateForm(currentPassword, newPassword, newPasswordConfirm)) {
      return;
    }

    state.isSubmitting = true;
    elements.saveButton.disabled = true;
    elements.saveButton.textContent = '변경 중...';

    try {
      await fetchWithAuth(`/users/${state.userId}/password`, {
        method: 'PATCH',
        body: JSON.stringify({
          newPassword: newPassword,
          newPasswordConfirm: newPasswordConfirm,
        }),
      });

      // beforeunload 경고 비활성화
      disableUnsavedChangesWarning();

      Toast.success(
        '비밀번호가 변경되었습니다. 다시 로그인해주세요.',
        '변경 완료',
        3000,
        async () => {
          await logout();
          window.location.href = '/page/login';
        }
      );
    } catch (error) {
      console.error('Failed to change password:', error);

      // NETWORK-ERROR: 네트워크 연결 실패
      if (error.message === 'NETWORK-ERROR') {
        const translatedMessage = translateErrorCode(error.message);
        Toast.error(translatedMessage, '네트워크 오류', 3000);
      } else {
        // 에러 코드별 처리
        const errorMessage = error.message;
        if (errorMessage.includes('USER-006')) {
          showCurrentPasswordError('현재 비밀번호가 일치하지 않습니다.');
        } else if (errorMessage.includes('USER-004')) {
          showNewPasswordError('비밀번호 정책을 만족하지 않습니다.');
        } else {
          Toast.error(
            translateErrorCode(errorMessage) || '비밀번호 변경에 실패했습니다.',
            '변경 실패'
          );
        }
      }

      state.isSubmitting = false;
      elements.saveButton.disabled = false;
      elements.saveButton.textContent = '변경';
    }
  }

  function validateField(field) {
    if (field === 'currentPassword') {
      const currentPassword = elements.currentPasswordInput.value;
      if (!currentPassword) {
        showCurrentPasswordError('현재 비밀번호를 입력해주세요.');
        return false;
      }
      clearCurrentPasswordError();
      return true;
    }

    if (field === 'newPassword') {
      const newPassword = elements.newPasswordInput.value;
      if (!newPassword) {
        showNewPasswordError('새 비밀번호를 입력해주세요.');
        return false;
      }
      if (!isValidPassword(newPassword)) {
        showNewPasswordError('8-20자, 영문 대/소문자, 숫자, 특수문자를 포함해야 합니다.');
        return false;
      }
      clearNewPasswordError();
      return true;
    }

    if (field === 'newPasswordConfirm') {
      const newPassword = elements.newPasswordInput.value;
      const newPasswordConfirm = elements.newPasswordConfirmInput.value;
      if (!newPasswordConfirm) {
        showNewPasswordConfirmError('새 비밀번호 확인을 입력해주세요.');
        return false;
      }
      if (newPassword !== newPasswordConfirm) {
        showNewPasswordConfirmError('새 비밀번호가 일치하지 않습니다.');
        return false;
      }
      clearNewPasswordConfirmError();
      return true;
    }

    return true;
  }

  function validateForm(currentPassword, newPassword, newPasswordConfirm) {
    let isValid = true;

    // 현재 비밀번호 확인
    if (!currentPassword) {
      showCurrentPasswordError('현재 비밀번호를 입력해주세요.');
      isValid = false;
    } else {
      clearCurrentPasswordError();
    }

    // 새 비밀번호 정책 확인
    if (!newPassword) {
      showNewPasswordError('새 비밀번호를 입력해주세요.');
      isValid = false;
    } else if (!isValidPassword(newPassword)) {
      showNewPasswordError('8-20자, 영문 대/소문자, 숫자, 특수문자를 포함해야 합니다.');
      isValid = false;
    } else {
      clearNewPasswordError();
    }

    // 새 비밀번호 확인 일치 확인
    if (!newPasswordConfirm) {
      showNewPasswordConfirmError('새 비밀번호 확인을 입력해주세요.');
      isValid = false;
    } else if (newPassword !== newPasswordConfirm) {
      showNewPasswordConfirmError('새 비밀번호가 일치하지 않습니다.');
      isValid = false;
    } else {
      clearNewPasswordConfirmError();
    }

    return isValid;
  }

  function showCurrentPasswordError(message) {
    if (elements.currentPasswordError) {
      elements.currentPasswordError.textContent = message;
      // CSS의 :not(:empty) 선택자가 자동으로 visibility 제어
    }
  }

  function clearCurrentPasswordError() {
    if (elements.currentPasswordError) {
      elements.currentPasswordError.textContent = '';
      // CSS의 :not(:empty) 선택자가 자동으로 visibility 제어
    }
  }

  function showNewPasswordError(message) {
    if (elements.newPasswordError) {
      elements.newPasswordError.textContent = message;
      // CSS의 :not(:empty) 선택자가 자동으로 visibility 제어
    }
  }

  function clearNewPasswordError() {
    if (elements.newPasswordError) {
      elements.newPasswordError.textContent = '';
      // CSS의 :not(:empty) 선택자가 자동으로 visibility 제어
    }
  }

  function showNewPasswordConfirmError(message) {
    if (elements.newPasswordConfirmError) {
      elements.newPasswordConfirmError.textContent = message;
      // CSS의 :not(:empty) 선택자가 자동으로 visibility 제어
    }
  }

  function clearNewPasswordConfirmError() {
    if (elements.newPasswordConfirmError) {
      elements.newPasswordConfirmError.textContent = '';
      // CSS의 :not(:empty) 선택자가 자동으로 visibility 제어
    }
  }

  /**
   * 비밀번호 표시/숨김 토글
   * @param {string} field - 'currentPassword' | 'newPassword' | 'newPasswordConfirm'
   *
   * 새 비밀번호와 새 비밀번호 확인은 동시에 토글됨 (UX 개선)
   * 현재 비밀번호는 독립적으로 토글됨
   */
  function togglePasswordVisibility(field) {
    // 현재 비밀번호는 독립적으로 처리
    if (field === 'currentPassword') {
      const inputElement = elements.currentPasswordInput;
      const toggleButton = elements.currentPasswordToggle;

      if (!inputElement || !toggleButton) return;

      if (inputElement.type === 'password') {
        inputElement.type = 'text';
        toggleButton.setAttribute('aria-label', '비밀번호 숨기기');
        toggleButton.classList.add('password-toggle--visible');
      } else {
        inputElement.type = 'password';
        toggleButton.setAttribute('aria-label', '비밀번호 표시');
        toggleButton.classList.remove('password-toggle--visible');
      }
      return;
    }

    // 새 비밀번호와 새 비밀번호 확인은 동시에 토글
    const inputs = [elements.newPasswordInput, elements.newPasswordConfirmInput];
    const buttons = [elements.newPasswordToggle, elements.newPasswordConfirmToggle];

    if (!elements.newPasswordInput) return;
    const isPasswordVisible = elements.newPasswordInput.type === 'text';

    inputs.forEach((input) => {
      if (input) {
        input.type = isPasswordVisible ? 'password' : 'text';
      }
    });

    buttons.forEach((button) => {
      if (button) {
        if (isPasswordVisible) {
          button.setAttribute('aria-label', '비밀번호 표시');
          button.classList.remove('password-toggle--visible');
        } else {
          button.setAttribute('aria-label', '비밀번호 숨기기');
          button.classList.add('password-toggle--visible');
        }
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window, document);
