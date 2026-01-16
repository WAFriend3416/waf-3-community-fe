/**
 * Board Write Page Script
 * 게시글 작성 페이지 로직
 * 참조: @CLAUDE.md Section 4.3, @docs/be/API.md Section 3.3, 4.1
 */

(function (window, document) {
  'use strict';

  // ============================================
  // Configuration
  // ============================================
  const CONFIG = {
    MAX_TITLE_LENGTH: 27,
    MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
    ALLOWED_FILE_TYPES: ['image/jpeg', 'image/png', 'image/gif'],
    LIST_URL: '/board',
    DETAIL_URL: '/board',
    LOGIN_URL: '/page/login',
  };

  // ============================================
  // State Management
  // ============================================
  const state = {
    uploadedImageId: null,
    uploadedImageUrl: null,
    selectedFile: null,
    isSubmitting: false,
  };

  // ============================================
  // DOM Element Caching
  // ============================================
  const elements = {
    form: null,
    titleInput: null,
    contentTextarea: null,
    imageInput: null,
    previewImage: null,
    placeholder: null,
    backButton: null,
    cancelButton: null,
    submitButton: null,
    profileDropdown: null,
    profileImage: null,

    // Error elements
    titleError: null,
    contentError: null,
    imageError: null,
  };

  // ============================================
  // Initialization
  // ============================================
  async function init() {
    cacheElements();
    cleanupInlineStyles(); // 인라인 스타일 정리
    bindEvents();
    await initAuthHeader(); // 프로필 로드 (auth-header.js 공통 모듈)
    enableUnsavedChangesWarning(() => {
      const hasContent =
        (elements.titleInput?.value.trim() || '') !== '' ||
        (elements.contentTextarea?.value.trim() || '') !== '';
      return hasContent;
    }); // 브라우저 뒤로가기 처리 (navigation.js 공통 모듈)
  }

  function cacheElements() {
    elements.form = document.querySelector('[data-form="write-post"]');
    elements.titleInput = document.querySelector('[data-field="title"]');
    elements.contentTextarea = document.querySelector('[data-field="content"]');
    elements.imageInput = document.querySelector('[data-field="image"]');
    elements.previewImage = document.querySelector('[data-image="preview"]');
    elements.placeholder = document.querySelector('[data-placeholder="image"]');
    elements.backButton = document.querySelector('[data-action="go-back"]');
    elements.cancelButton = document.querySelector('[data-action="cancel"]');
    elements.submitButton = document.querySelector('[data-action="submit"]');
    elements.profileDropdown = document.querySelector('[data-dropdown="profile"]');
    elements.profileImage = document.querySelector('[data-profile="image"]');

    // Error elements
    elements.titleError = document.querySelector('[data-error="title"]');
    elements.contentError = document.querySelector('[data-error="content"]');
    elements.imageError = document.querySelector('[data-error="image"]');
  }

  /**
   * 오류 요소의 인라인 스타일 제거 (CSS가 제어하도록)
   * 이전 실행으로 남아있을 수 있는 display 스타일 정리
   */
  function cleanupInlineStyles() {
    const errorElements = [elements.titleError, elements.contentError, elements.imageError];
    errorElements.forEach((el) => {
      if (el) {
        el.style.display = ''; // 인라인 스타일 제거
        el.textContent = ''; // 텍스트 초기화
      }
    });
  }

  // ============================================
  // Event Binding
  // ============================================
  function bindEvents() {
    // Form submit
    if (elements.form) {
      elements.form.addEventListener('submit', handleSubmit);
    }

    // Image input change
    if (elements.imageInput) {
      elements.imageInput.addEventListener('change', handleImageChange);
    }

    // Back button
    if (elements.backButton) {
      elements.backButton.addEventListener('click', handleBack);
    }

    // Cancel button
    if (elements.cancelButton) {
      elements.cancelButton.addEventListener('click', handleCancel);
    }

    // Profile menu navigation
    // Real-time validation
    if (elements.titleInput) {
      elements.titleInput.addEventListener('input', validateTitle);
      elements.titleInput.addEventListener('blur', handleTitleBlur);
      elements.titleInput.addEventListener('keydown', handleTitleKeyDown);
    }

    // Profile menu
    if (elements.profileDropdown) {
      elements.profileDropdown.addEventListener('click', handleProfileMenuClick);
    }
  }

  // ============================================
  // Profile Load
  // ============================================
  // loadUserProfile은 auth-header.js의 initAuthHeader() 사용

  // ============================================
  // Event Handlers
  // ============================================
  // handleProfileMenuClick은 auth-header.js 공통 모듈 사용

  async function handleSubmit(e) {
    e.preventDefault();

    if (state.isSubmitting) return;

    // 검증
    if (!validateForm()) {
      return;
    }

    state.isSubmitting = true;
    setSubmitButtonState(true);

    try {
      // 1단계: 이미지 업로드 (있는 경우)
      if (state.selectedFile && !state.uploadedImageId) {
        try {
          const imageResult = await uploadImage(state.selectedFile);
          state.uploadedImageId = imageResult.imageId; // camelCase 수정
          state.uploadedImageUrl = imageResult.imageUrl; // camelCase 수정
        } catch (error) {
          console.error('Image upload failed:', error);
          const translatedMessage = translateErrorCode(error.message);
          showImageError(translatedMessage || '이미지 업로드에 실패했습니다.');
          state.isSubmitting = false;
          setSubmitButtonState(false);
          return;
        }
      }

      // 2단계: 게시글 작성
      const title = elements.titleInput.value.trim();
      const content = elements.contentTextarea.value.trim();

      const post = await fetchWithAuth('/posts', {
        method: 'POST',
        body: JSON.stringify({
          title,
          content,
          imageId: state.uploadedImageId || null, // camelCase로 통일
        }),
      });

      // 성공 - 토스트 메시지 후 상세 페이지로 이동
      disableUnsavedChangesWarning(); // beforeunload 경고 비활성화
      Toast.success('게시글이 작성되었습니다.', '작성 완료', 2000, () => {
        window.location.replace(`${CONFIG.DETAIL_URL}/${post.postId}`);
      });
    } catch (error) {
      console.error('Failed to create post:', error);
      const errorMessage = translateErrorCode(error.message) || '게시글 작성에 실패했습니다.';
      Toast.error(errorMessage, '오류');
      state.isSubmitting = false;
      setSubmitButtonState(false);
    }
  }

  function handleImageChange(e) {
    const file = e.target.files[0];
    if (!file) {
      clearImagePreview();
      return;
    }

    // 파일 검증
    if (!validateImage(file)) {
      e.target.value = '';
      return;
    }

    // 이미지 미리보기
    state.selectedFile = file;
    showImagePreview(file);
    clearImageError();
  }

  async function handleBack(e) {
    e.preventDefault();
    const confirmed = await confirmModal(
      '작성 중인 내용 확인',
      '저장하지 않은 내용이 사라집니다. 나가시겠습니까?'
    );
    if (confirmed) {
      disableUnsavedChangesWarning(); // beforeunload 경고 비활성화
      window.location.replace(CONFIG.LIST_URL); // replace()로 history 중복 방지
    }
  }

  async function handleCancel(e) {
    e.preventDefault();
    const confirmed = await confirmModal(
      '작성 중인 내용 확인',
      '저장하지 않은 내용이 사라집니다. 취소하시겠습니까?'
    );
    if (confirmed) {
      disableUnsavedChangesWarning(); // beforeunload 경고 비활성화
      window.location.replace(CONFIG.LIST_URL); // replace()로 history 중복 방지
    }
  }

  // setupBackNavigation은 navigation.js의 enableUnsavedChangesWarning() 사용

  function handleTitleBlur() {
    if (!elements.titleInput) return;
    const title = elements.titleInput.value.trim();
    if (!title) return;
    focusContentTextarea();
  }

  function handleTitleKeyDown(e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();

    if (!elements.titleInput) return;
    const title = elements.titleInput.value.trim();
    if (!title) return;

    focusContentTextarea();
  }

  function focusContentTextarea() {
    if (!elements.contentTextarea) return;

    window.requestAnimationFrame(() => {
      try {
        elements.contentTextarea.focus({ preventScroll: true });
      } catch (error) {
        elements.contentTextarea.focus();
      }

      elements.contentTextarea.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  }

  // handleLogout은 auth-header.js의 performLogout() 사용

  // ============================================
  // Validation Functions
  // ============================================
  function validateForm() {
    let isValid = true;

    // 제목 검증
    if (!validateTitle()) {
      isValid = false;
    }

    // 내용 검증
    if (!validateContent()) {
      isValid = false;
    }

    return isValid;
  }

  function validateTitle() {
    const title = elements.titleInput.value.trim();

    if (!title) {
      showTitleError('제목을 입력해주세요.');
      return false;
    }

    if (title.length > CONFIG.MAX_TITLE_LENGTH) {
      showTitleError(`제목은 ${CONFIG.MAX_TITLE_LENGTH}자 이하로 입력해주세요.`);
      return false;
    }

    clearTitleError();
    return true;
  }

  function validateContent() {
    const content = elements.contentTextarea.value.trim();

    if (!content) {
      showContentError('내용을 입력해주세요.');
      return false;
    }

    clearContentError();
    return true;
  }

  // validateImage는 validation.js의 getImageFileError() 사용
  function validateImage(file) {
    const error = getImageFileError(file);
    if (error) {
      showImageError(error);
      return false;
    }
    return true;
  }

  // ============================================
  // Image Preview
  // ============================================
  function showImagePreview(file) {
    const reader = new FileReader();

    reader.onload = function (e) {
      if (elements.previewImage) {
        elements.previewImage.src = e.target.result;
        elements.previewImage.style.display = 'block';
      }
      if (elements.placeholder) {
        elements.placeholder.style.display = 'none';
      }
    };

    reader.readAsDataURL(file);
  }

  function clearImagePreview() {
    state.selectedFile = null;
    state.uploadedImageId = null;
    state.uploadedImageUrl = null;

    if (elements.previewImage) {
      elements.previewImage.src = '';
      elements.previewImage.style.display = 'none';
    }
    if (elements.placeholder) {
      elements.placeholder.style.display = 'flex';
    }
  }

  // ============================================
  // Error Display
  // ============================================
  function showTitleError(message) {
    if (elements.titleError) {
      elements.titleError.textContent = message;
      // CSS의 :not(:empty) 선택자가 자동으로 visibility 제어
    }
    if (elements.titleInput) {
      elements.titleInput.classList.add('input-field__input--error');
    }
  }

  function clearTitleError() {
    if (elements.titleError) {
      elements.titleError.textContent = '';
      // CSS의 :not(:empty) 선택자가 자동으로 visibility 제어
    }
    if (elements.titleInput) {
      elements.titleInput.classList.remove('input-field__input--error');
    }
  }

  function showContentError(message) {
    if (elements.contentError) {
      elements.contentError.textContent = message;
      // CSS의 :not(:empty) 선택자가 자동으로 visibility 제어
    }
    if (elements.contentTextarea) {
      elements.contentTextarea.classList.add('input-field__textarea--error');
    }
  }

  function clearContentError() {
    if (elements.contentError) {
      elements.contentError.textContent = '';
      // CSS의 :not(:empty) 선택자가 자동으로 visibility 제어
    }
    if (elements.contentTextarea) {
      elements.contentTextarea.classList.remove('input-field__textarea--error');
    }
  }

  function showImageError(message) {
    if (elements.imageError) {
      elements.imageError.textContent = translateErrorCode(message);
      // CSS의 :not(:empty) 선택자가 자동으로 visibility 제어
    }
  }

  function clearImageError() {
    if (elements.imageError) {
      elements.imageError.textContent = '';
      // CSS의 :not(:empty) 선택자가 자동으로 visibility 제어
    }
  }

  // ============================================
  // UI Helper
  // ============================================
  function setSubmitButtonState(isSubmitting) {
    if (elements.submitButton) {
      elements.submitButton.disabled = isSubmitting;
      if (isSubmitting) {
        elements.submitButton.classList.add('btn--loading');
      } else {
        elements.submitButton.classList.remove('btn--loading');
      }
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
