/**
 * Board Detail Page Script
 * 게시글 상세 페이지 로직
 * 참조: @CLAUDE.md Section 4.2, @docs/be/API.md Section 3.2, 5, 6
 */

(function (window, document) {
  'use strict';

  // ============================================
  // Configuration
  // ============================================
  const CONFIG = {
    EDIT_POST_URL: '/board', // /board/:id/edit로 리다이렉트됨
    LIST_URL: '/board',
    LOGIN_URL: '/page/login',
  };

  // ============================================
  // State Management
  // ============================================
  const state = {
    postId: null,
    post: null,
    comments: [],
    commentTotal: 0, // 전체 댓글 수 (pagination.total_count)
    isLiked: false,
    currentUserId: null,
    editingCommentId: null,
    isSubmittingComment: false, // 댓글 제출 중 플래그 (중복 방지)
  };

  // ============================================
  // DOM Element Caching
  // ============================================
  const elements = {
    // Post elements
    postTitle: null,
    postAuthorImage: null,
    postAuthorName: null,
    postDate: null,
    postImage: null,
    postContent: null,
    postLikes: null,
    postViews: null,
    postComments: null,
    postActions: null,
    likeButton: null,

    // Comment elements
    commentForm: null,
    commentTextarea: null,
    commentCounter: null,
    commentsList: null,
    commentsEmpty: null,

    // Modal elements
    deleteModal: null,

    // Buttons
    backButton: null,
    editPostButton: null,
    deletePostButton: null,
    profileDropdown: null,
    profileImage: null,
  };

  // ============================================
  // Initialization
  // ============================================
  async function init() {
    // URL 경로에서 postId 추출 (/board/:id 형식)
    const pathParts = window.location.pathname.split('/');
    state.postId = pathParts[pathParts.length - 1];

    if (!state.postId || isNaN(state.postId)) {
      Toast.error('게시글을 찾을 수 없습니다.', '오류', 2000, () => {
        window.location.replace(CONFIG.LIST_URL);
      });
      return;
    }

    // 현재 사용자 ID
    state.currentUserId = getCurrentUserId();

    cacheElements();
    bindEvents();
    await loadInitialData();
  }

  function cacheElements() {
    // Post elements
    elements.postTitle = document.querySelector('[data-post="title"]');
    elements.postAuthorImage = document.querySelector('[data-post="authorImage"]');
    elements.postAuthorName = document.querySelector('[data-post="authorName"]');
    elements.postDate = document.querySelector('[data-post="date"]');
    elements.postImage = document.querySelector('[data-post="image"]');
    elements.postContent = document.querySelector('[data-post="content"]');
    elements.postLikes = document.querySelector('[data-post="likes"]');
    elements.postViews = document.querySelector('[data-post="views"]');
    elements.postComments = document.querySelector('[data-post="comments"]');
    elements.postActions = document.querySelector('[data-post="actions"]');
    elements.likeButton = document.querySelector('[data-action="toggle-like"]');

    // Comment elements
    elements.commentForm = document.querySelector('[data-form="comment"]');
    elements.commentTextarea = document.querySelector('[data-field="comment"]');
    elements.commentCounter = document.querySelector('[data-counter="comment"]');
    elements.commentsList = document.querySelector('[data-list="comments"]');
    elements.commentsEmpty = document.querySelector('[data-empty="comments"]');

    // Modal elements
    elements.deleteModal = document.querySelector('[data-modal="delete-post"]');

    // Buttons
    elements.backButton = document.querySelector('[data-action="go-back"]');
    elements.editPostButton = document.querySelector('[data-action="edit-post"]');
    elements.deletePostButton = document.querySelector('[data-action="delete-post"]');
    elements.profileDropdown = document.querySelector('[data-dropdown="profile"]');
    elements.profileImage = document.querySelector('[data-profile="image"]');
  }

  // ============================================
  // Event Binding
  // ============================================
  function bindEvents() {
    // Back button
    if (elements.backButton) {
      elements.backButton.addEventListener('click', handleBack);
    }

    // Like button (Throttle: 1초 간격으로만 동작)
    if (elements.likeButton) {
      elements.likeButton.addEventListener('click', throttle(handleLikeToggle, 1000));
    }

    // Post actions
    if (elements.editPostButton) {
      elements.editPostButton.addEventListener('click', handleEditPost);
    }
    if (elements.deletePostButton) {
      elements.deletePostButton.addEventListener('click', handleDeletePost);
    }

    // Comment form
    if (elements.commentForm) {
      elements.commentForm.addEventListener('submit', handleCommentSubmit);

      // Comment cancel button
      const cancelButton = elements.commentForm.querySelector('[data-action="cancel-comment"]');
      if (cancelButton) {
        cancelButton.addEventListener('click', handleCancelEdit);
      }
    }

    // Comment textarea - 글자수 카운터
    if (elements.commentTextarea) {
      elements.commentTextarea.addEventListener('input', updateCommentCounter);
    }

    // Comment actions (event delegation)
    if (elements.commentsList) {
      elements.commentsList.addEventListener('click', handleCommentAction);
    }

    // Modal actions
    if (elements.deleteModal) {
      const closeButtons = elements.deleteModal.querySelectorAll('[data-action="close-modal"]');
      closeButtons.forEach((btn) => {
        btn.addEventListener('click', closeDeleteModal);
      });

      const confirmButton = elements.deleteModal.querySelector('[data-action="confirm-delete"]');
      if (confirmButton) {
        confirmButton.addEventListener('click', confirmDeletePost);
      }

      // Overlay click to close
      elements.deleteModal.addEventListener('click', (e) => {
        if (e.target === elements.deleteModal) {
          closeDeleteModal();
        }
      });
    }

    // Profile menu
    if (elements.profileDropdown) {
      elements.profileDropdown.addEventListener('click', handleProfileMenuClick);
    }
  }

  // ============================================
  // Initial Data Load
  // ============================================
  async function loadInitialData() {
    // postId 검증 (빠른 새로고침 대비)
    if (!state.postId) {
      Toast.error('게시글을 찾을 수 없습니다.', '오류', 2000, () => {
        window.location.replace(CONFIG.LIST_URL);
      });
      return;
    }

    await loadPost();
    await loadComments();
    await initAuthHeader(); // 프로필 로드 (auth-header.js 공통 모듈)
  }

  // ============================================
  // Event Handlers
  // ============================================
  function handleBack(e) {
    e.preventDefault();
    window.history.back();
  }

  async function handleLikeToggle(e) {
    e.preventDefault();

    // 로그인 확인
    if (!isAuthenticated()) {
      await loginRequiredModal('좋아요');
      return;
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 문제 4: 좋아요 숫자 파싱 오류 수정
    // DOM에서 파싱하지 않고 state.post.stats.likeCount 사용
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    // 현재 값 백업 (에러 시 롤백용)
    const originalCount = state.post?.stats?.likeCount || 0;
    const originalLiked = state.isLiked;

    try {
      if (state.isLiked) {
        // Optimistic Update: UI 즉시 업데이트
        state.isLiked = false;
        const newCount = originalCount - 1;
        if (state.post && state.post.stats) {
          state.post.stats.likeCount = newCount;
        }
        updateLikeButton(false);
        updateLikeCount(newCount);

        // 좋아요 취소 API 호출
        await fetchWithAuth(`/posts/${state.postId}/like`, {
          method: 'DELETE',
        });
      } else {
        // Optimistic Update: UI 즉시 업데이트
        state.isLiked = true;
        const newCount = originalCount + 1;
        if (state.post && state.post.stats) {
          state.post.stats.likeCount = newCount;
        }
        updateLikeButton(true);
        updateLikeCount(newCount);

        // 좋아요 추가 API 호출
        await fetchWithAuth(`/posts/${state.postId}/like`, {
          method: 'POST',
        });
      }
    } catch (error) {
      console.error('Failed to toggle like:', error);

      // NETWORK-ERROR: 네트워크 연결 실패
      if (error.message === 'NETWORK-ERROR') {
        const translatedMessage = translateErrorCode(error.message);
        showError(translatedMessage);
        // UI 롤백
        state.isLiked = originalLiked;
        if (state.post && state.post.stats) {
          state.post.stats.likeCount = originalCount;
        }
        updateLikeButton(originalLiked);
        updateLikeCount(originalCount);
        return;
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // LIKE-001 에러 처리: 이미 좋아요가 눌려있으면 취소 시도
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const errorCode = error.message?.match(/([A-Z]+-\d+)/)?.[1];

      if (errorCode === 'LIKE-001') {
        // 이미 좋아요가 눌려있는 상태 → 취소 시도
        console.warn('LIKE-001 detected: Already liked, attempting to unlike...');

        try {
          // 상태를 true로 변경 (이미 좋아요 눌린 상태)
          state.isLiked = true;
          updateLikeButton(true);

          // 좋아요 취소 API 호출
          await fetchWithAuth(`/posts/${state.postId}/like`, {
            method: 'DELETE',
          });

          // 취소 성공 → UI 업데이트 (조용히 처리)
          state.isLiked = false;
          const newCount = originalCount; // 이미 +1 했다가 롤백되었으므로 원래 개수 유지
          if (state.post && state.post.stats) {
            state.post.stats.likeCount = newCount;
          }
          updateLikeButton(false);
          updateLikeCount(newCount);
          return;
        } catch (unlikeError) {
          console.error('Failed to unlike after LIKE-001:', unlikeError);
          // 취소도 실패 → 원래 상태로 복원
          state.isLiked = originalLiked;
          if (state.post && state.post.stats) {
            state.post.stats.likeCount = originalCount;
          }
          updateLikeButton(originalLiked);
          updateLikeCount(originalCount);
          showError('좋아요 처리에 실패했습니다.');
          return;
        }
      }

      // 기타 에러 → Rollback
      state.isLiked = originalLiked;
      if (state.post && state.post.stats) {
        state.post.stats.likeCount = originalCount;
      }
      updateLikeButton(originalLiked);
      updateLikeCount(originalCount);
      const translatedMessage = translateErrorCode(error.message);
      showError(translatedMessage || '좋아요 처리에 실패했습니다.');
    }
  }

  function handleEditPost(e) {
    e.preventDefault();
    window.location.replace(`${CONFIG.EDIT_POST_URL}/${state.postId}/edit`); // replace()로 히스토리 중복 방지
  }

  function handleDeletePost(e) {
    if (e) e.preventDefault();
    openDeleteModal();
  }

  async function handleCommentSubmit(e) {
    e.preventDefault();

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 문제 2: 댓글 폼 다중 제출 방지
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (state.isSubmittingComment) {
      return; // 이미 제출 중이면 무시
    }

    // 로그인 확인
    if (!isAuthenticated()) {
      await loginRequiredModal('댓글 작성');
      return;
    }

    const content = elements.commentTextarea.value.trim();

    // 클라이언트 검증 (validation.js 활용)
    if (!isValidComment(content)) {
      const errorMsg = !content ? '댓글 내용을 입력해주세요.' : '댓글은 200자 이하로 입력해주세요.';
      Toast.error(errorMsg, '입력 오류');
      return;
    }

    // 제출 시작: 버튼 비활성화
    state.isSubmittingComment = true;
    const submitButton = elements.commentForm.querySelector('[data-action="submit-comment"]');
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.classList.add('btn--loading');
    }

    try {
      if (state.editingCommentId) {
        // 댓글 수정
        const updatedComment = await fetchWithAuth(
          `/posts/${state.postId}/comments/${state.editingCommentId}`,
          {
            method: 'PATCH',
            body: JSON.stringify({ comment: content }),
          }
        );

        // UI 업데이트
        updateCommentInList(updatedComment);
        resetCommentForm();
      } else {
        // 댓글 작성
        const newComment = await fetchWithAuth(`/posts/${state.postId}/comments`, {
          method: 'POST',
          body: JSON.stringify({ comment: content }),
        });

        // UI 업데이트
        prependComment(newComment);
        updateCommentCount(state.commentTotal);
      }

      // 폼 초기화 (작성 모드만)
      if (!state.editingCommentId) {
        elements.commentTextarea.value = '';
        updateCommentCounter(); // 글자수 카운터 리셋
      }
    } catch (error) {
      console.error('Failed to submit comment:', error);

      // NETWORK-ERROR: 네트워크 연결 실패
      if (error.message === 'NETWORK-ERROR') {
        const translatedMessage = translateErrorCode(error.message);
        Toast.error(translatedMessage, '네트워크 오류', 3000);
        resetCommentForm();
      } else {
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 문제 1: 댓글 수정 중 404/COMMENT-001/COMMENT-003 에러 처리
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        const errorCode = error.message.match(/([A-Z]+-\d+)/)?.[1];

        if (errorCode === 'COMMENT-001' || errorCode === 'COMMENT-003') {
          // 댓글이 이미 삭제된 경우
          Toast.error('이미 삭제된 댓글입니다.', '오류');
          if (state.editingCommentId) {
            removeCommentFromList(state.editingCommentId);
          }
          resetCommentForm();
        } else {
          // 일반 에러
          const translatedMessage = translateErrorCode(error.message);
          showError(translatedMessage || '댓글 작성에 실패했습니다.');
          resetCommentForm();
        }
      }
    } finally {
      // 제출 완료: 버튼 활성화
      state.isSubmittingComment = false;
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.classList.remove('btn--loading');
      }
    }
  }

  function handleCommentAction(e) {
    const editButton = e.target.closest('[data-action="edit-comment"]');
    const deleteButton = e.target.closest('[data-action="delete-comment"]');

    if (editButton) {
      handleEditComment(e, editButton);
    } else if (deleteButton) {
      handleDeleteComment(e, deleteButton);
    }
  }

  function handleEditComment(e, button) {
    e.preventDefault();

    const commentItem = button.closest('[data-comment-id]');
    if (!commentItem) return;

    const commentId = commentItem.dataset.commentId;
    const comment = state.comments.find((c) => c.commentId === parseInt(commentId));

    if (!comment) return;

    // 댓글 내용을 textarea에 채우기
    elements.commentTextarea.value = comment.content;
    elements.commentTextarea.focus();

    // 글자수 카운터 업데이트
    updateCommentCounter();

    // 수정 모드 활성화
    state.editingCommentId = comment.commentId;

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 문제 3: 댓글 수정 취소 버튼 표시
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const submitButton = elements.commentForm.querySelector('[data-action="submit-comment"]');
    if (submitButton) {
      submitButton.textContent = '댓글 수정';
    }

    const cancelButton = elements.commentForm.querySelector('[data-action="cancel-comment"]');
    if (cancelButton) {
      cancelButton.style.display = 'inline-block';
    }
  }

  async function handleDeleteComment(e, button) {
    e.preventDefault();

    const confirmed = await confirmModal('댓글 삭제', '정말 삭제하시겠습니까?', { isDanger: true });
    if (!confirmed) return;

    const commentItem = button.closest('[data-comment-id]');
    if (!commentItem) return;

    const commentId = commentItem.dataset.commentId;

    try {
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 문제 1: 댓글 삭제 전 수정 모드 리셋
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      if (state.editingCommentId === parseInt(commentId)) {
        resetCommentForm();
      }

      await fetchWithAuth(`/posts/${state.postId}/comments/${commentId}`, {
        method: 'DELETE',
      });

      // UI 업데이트
      removeCommentFromList(commentId);
      updateCommentCount(state.commentTotal);
    } catch (error) {
      console.error('Failed to delete comment:', error);

      // NETWORK-ERROR: 네트워크 연결 실패
      if (error.message === 'NETWORK-ERROR') {
        const translatedMessage = translateErrorCode(error.message);
        Toast.error(translatedMessage, '네트워크 오류', 3000);
      } else {
        // 404/COMMENT-001/COMMENT-003 에러 처리
        const errorCode = error.message.match(/([A-Z]+-\d+)/)?.[1];

        if (errorCode === 'COMMENT-001' || errorCode === 'COMMENT-003') {
          Toast.error('이미 삭제된 댓글입니다.', '오류');
          removeCommentFromList(commentId);
          if (state.editingCommentId === parseInt(commentId)) {
            resetCommentForm();
          }
        } else {
          const translatedMessage = translateErrorCode(error.message);
          showError(translatedMessage || '댓글 삭제에 실패했습니다.');
        }
      }
    }
  }

  // handleProfileMenuClick은 auth-header.js 공통 모듈 사용

  // handleLogout은 auth-header.js의 performLogout() 사용

  /**
   * 댓글 글자수 카운터 업데이트
   * 실시간으로 입력한 글자수를 표시하고 200자 초과 시 경고 스타일 적용
   */
  function updateCommentCounter() {
    if (!elements.commentTextarea || !elements.commentCounter) return;

    const length = elements.commentTextarea.value.length;
    elements.commentCounter.textContent = length;

    // 글자수에 따라 스타일 변경
    const counterElement = elements.commentCounter.parentElement;
    if (length > 200) {
      counterElement.classList.add('comment-form__counter--error');
      counterElement.classList.remove('comment-form__counter--warning');
    } else if (length > 180) {
      counterElement.classList.add('comment-form__counter--warning');
      counterElement.classList.remove('comment-form__counter--error');
    } else {
      counterElement.classList.remove(
        'comment-form__counter--warning',
        'comment-form__counter--error'
      );
    }
  }

  /**
   * 댓글 폼 리셋
   * - 수정 모드 해제
   * - textarea 초기화
   * - 글자수 카운터 리셋
   * - 버튼 텍스트 "댓글 등록"으로 변경
   * - 취소 버튼 숨김
   */
  function resetCommentForm() {
    state.editingCommentId = null;

    if (elements.commentTextarea) {
      elements.commentTextarea.value = '';
    }

    // 글자수 카운터 리셋
    updateCommentCounter();

    const submitButton = elements.commentForm?.querySelector('[data-action="submit-comment"]');
    if (submitButton) {
      submitButton.textContent = '댓글 등록';
    }

    const cancelButton = elements.commentForm?.querySelector('[data-action="cancel-comment"]');
    if (cancelButton) {
      cancelButton.style.display = 'none';
    }
  }

  /**
   * 댓글 수정 취소
   */
  function handleCancelEdit(e) {
    if (e) e.preventDefault();
    resetCommentForm();
  }

  // ============================================
  // API Functions
  // ============================================
  /**
   * 게시글 상세 로드
   * GET /posts/{postId}
   */
  async function loadPost() {
    try {
      const post = await fetchWithAuth(`/posts/${state.postId}`);
      state.post = post;

      // 게시글 렌더링
      renderPost(post);

      // 본인 게시글이면 수정/삭제 버튼 표시, 좋아요 버튼 숨김
      if (state.currentUserId && post.author.userId === state.currentUserId) {
        if (elements.postActions) {
          elements.postActions.style.display = 'flex';
        }
        // 본인 글에는 좋아요 불가
        if (elements.likeButton) {
          elements.likeButton.style.display = 'none';
        }
      }
    } catch (error) {
      console.error('Failed to load post:', error);
      Toast.error('게시글을 찾을 수 없습니다.', '오류', 2000, () => {
        window.location.replace(CONFIG.LIST_URL);
      });
    }
  }

  /**
   * 댓글 목록 로드
   * GET /posts/{postId}/comments?offset=0&limit=100
   */
  async function loadComments() {
    try {
      const params = new URLSearchParams({ offset: 0, limit: 100 });
      const result = await fetchWithAuth(`/posts/${state.postId}/comments?${params}`);

      state.comments = result.comments || [];

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 문제 5: 댓글 개수 동기화 (pagination.total_count 사용)
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      state.commentTotal = result.pagination?.total_count || 0;

      // 샘플 댓글 제거
      if (elements.commentsList) {
        elements.commentsList.innerHTML = '';
      }

      // 댓글 렌더링
      if (state.comments.length === 0) {
        showEmptyComments();
      } else {
        state.comments.forEach((comment) => {
          renderComment(comment);
        });
      }
    } catch (error) {
      console.error('Failed to load comments:', error);

      // 404 에러: 게시글이 삭제되었을 가능성
      if (error.message.includes('POST-001') || error.message.includes('404')) {
        console.warn('Post not found, redirecting to list');
        Toast.error('게시글을 찾을 수 없습니다.', '오류', 2000, () => {
          window.location.replace(CONFIG.LIST_URL);
        });
        return;
      }

      // 기타 에러: 댓글만 빈 상태로 표시
      showEmptyComments();
    }
  }

  /**
   * 게시글 삭제 확인
   */
  async function confirmDeletePost() {
    try {
      await fetchWithAuth(`/posts/${state.postId}`, {
        method: 'DELETE',
      });

      closeDeleteModal();
      Toast.success('게시글이 삭제되었습니다.', '삭제 완료', 2000, () => {
        window.location.replace(CONFIG.LIST_URL);
      });
    } catch (error) {
      console.error('Failed to delete post:', error);

      // NETWORK-ERROR: 네트워크 연결 실패
      if (error.message === 'NETWORK-ERROR') {
        const translatedMessage = translateErrorCode(error.message);
        showError(translatedMessage);
      } else {
        const translatedMessage = translateErrorCode(error.message);
        showError(translatedMessage || '게시글 삭제에 실패했습니다.');
      }

      closeDeleteModal();
    }
  }

  // ============================================
  // Render Functions
  // ============================================
  function renderPost(post) {
    // 제목
    if (elements.postTitle) {
      elements.postTitle.textContent = post.title;
    }

    // 작성자 정보
    const author = post.author || {};
    if (elements.postAuthorImage) {
      elements.postAuthorImage.src = author.profileImage || getProfilePlaceholder(author.userId);
      elements.postAuthorImage.alt = author.nickname || '알 수 없음';
    }
    if (elements.postAuthorName) {
      elements.postAuthorName.textContent = author.nickname || '알 수 없음';
    }

    // 작성 시간
    if (elements.postDate) {
      elements.postDate.textContent = formatDate(post.createdAt);
    }

    // 이미지 (있는 경우)
    if (elements.postImage) {
      if (post.images && post.images.length > 0) {
        elements.postImage.src = post.images[0];
        elements.postImage.style.display = 'block';
      } else {
        elements.postImage.style.display = 'none';
      }
    }

    // 본문
    if (elements.postContent) {
      elements.postContent.textContent = post.content;
    }

    // 통계
    const stats = post.stats || { likeCount: 0, commentCount: 0, viewCount: 0 };
    updateLikeCount(stats.likeCount);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Optimistic Update: 조회수는 서버 응답값 + 1 표시
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //
    // [이유]
    // 서버는 JPQL UPDATE로 조회수를 증가시키지만 (DB에는 +1 반영)
    // 영속성 컨텍스트를 우회하므로 응답에는 증가 전 값이 담깁니다.
    // 클라이언트가 +1 보정하여 사용자에게 정확한 값을 표시합니다.
    //
    // [예시]
    // - DB 조회수: 100
    // - 서버 처리: UPDATE (101) → 응답 { viewCount: 100 } (stale)
    // - UI 표시: 100 + 1 = 101 ✅
    //
    // [주의사항]
    // - 다중 탭 동시 접속 시 네트워크 지연으로 일시적 불일치 가능
    //   예) 탭2 먼저 도착(102) → 탭1 늦게 도착(101) → 탭1에 101 표시
    // - F5 새로고침 시 정확한 값으로 자연스럽게 동기화
    //
    // [참조]
    // - PostService.java:195-199 (백엔드 구현)
    // - docs/be/API.md Section 3.2 (API 명세 및 Rollback 가이드)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    updateViewCount((stats.viewCount || 0) + 1);

    updateCommentCount(stats.commentCount);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 문제 6: 초기 좋아요 상태 로드 누락
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //
    // [백엔드 수정 가이드]
    // 1. PostResponse.java에 필드 추가:
    //    private Boolean isLikedByCurrentUser;
    //
    // 2. PostService.getPostDetail() 수정:
    //    - SecurityContextHolder에서 현재 userId 추출
    //    - postLikeRepository.existsByPostIdAndUserId(postId, userId) 조회
    //    - PostResponse 생성 시:
    //      .isLikedByCurrentUser(isLiked)
    //
    // 3. API 명세 업데이트:
    //    - docs/be/API.md Section 3.2 응답 예시에 isLikedByCurrentUser 추가
    // 백엔드에서 현재 사용자의 좋아요 여부 반환 (isLikedByCurrentUser)
    // - 로그인 상태: true/false
    // - 비로그인 상태: null (기본값 false 처리)
    state.isLiked = post.isLikedByCurrentUser || false;
    updateLikeButton(state.isLiked);
  }

  function renderComment(comment) {
    const commentItem = createCommentElement(comment);
    if (elements.commentsList) {
      elements.commentsList.appendChild(commentItem);
    }

    // Empty state 숨김
    if (elements.commentsEmpty) {
      elements.commentsEmpty.style.display = 'none';
    }
  }

  function createCommentElement(comment) {
    const div = document.createElement('div');
    div.className = 'comment-item';
    div.dataset.commentId = comment.commentId;

    const author = comment.author || {};
    const authorName = escapeHtml(author.nickname || '알 수 없음');
    const authorImage = author.profileImage || getProfilePlaceholder(author.userId);
    const formattedDate = formatDate(comment.createdAt);

    // 본인 댓글이면 수정/삭제 버튼 표시
    const isOwner = state.currentUserId && author.userId === state.currentUserId;
    const actionsHtml = isOwner
      ? `
      <div class="comment-item__actions" data-author-actions>
        <button class="comment-item__action" data-action="edit-comment">수정</button>
        <button class="comment-item__action comment-item__action--delete" data-action="delete-comment">삭제</button>
      </div>
    `
      : '';

    div.innerHTML = `
      <div class="comment-item__header">
        <img src="${authorImage}" alt="${authorName} 프로필" class="comment-item__avatar" loading="lazy" onerror="this.src=getProfilePlaceholder(${author.userId});">
        <div class="comment-item__info">
          <div class="comment-item__author">${authorName}</div>
          <div class="comment-item__date">${formattedDate}</div>
        </div>
        ${actionsHtml}
      </div>
      <div class="comment-item__content">${escapeHtml(comment.content)}</div>
    `;

    return div;
  }

  // ============================================
  // UI Update Functions
  // ============================================
  function updateLikeButton(isLiked) {
    if (!elements.likeButton) return;

    const svg = elements.likeButton.querySelector('svg path');
    if (svg) {
      if (isLiked) {
        svg.setAttribute('fill', 'currentColor');
        elements.likeButton.classList.add('post-detail__stat--liked');
      } else {
        svg.setAttribute('fill', 'none');
        elements.likeButton.classList.remove('post-detail__stat--liked');
      }
    }
  }

  function updateLikeCount(count) {
    if (elements.postLikes) {
      elements.postLikes.textContent = formatNumberCompact(count);
    }
  }

  function updateViewCount(count) {
    if (elements.postViews) {
      elements.postViews.textContent = formatNumberCompact(count);
    }
  }

  function updateCommentCount(count) {
    if (elements.postComments) {
      elements.postComments.textContent = formatNumberCompact(count);
    }
  }

  function prependComment(comment) {
    state.comments.unshift(comment);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 문제 5: 댓글 작성 시 총 댓글 수 증가
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    state.commentTotal++;

    const commentItem = createCommentElement(comment);
    if (elements.commentsList) {
      elements.commentsList.insertBefore(commentItem, elements.commentsList.firstChild);
    }

    // Empty state 숨김
    if (elements.commentsEmpty) {
      elements.commentsEmpty.style.display = 'none';
    }
  }

  function updateCommentInList(updatedComment) {
    const index = state.comments.findIndex((c) => c.commentId === updatedComment.commentId);
    if (index !== -1) {
      state.comments[index] = updatedComment;
    }

    // DOM 업데이트
    const commentItem = document.querySelector(`[data-comment-id="${updatedComment.commentId}"]`);
    if (commentItem) {
      const contentElement = commentItem.querySelector('.comment-item__content');
      if (contentElement) {
        contentElement.textContent = updatedComment.content;
      }
    }
  }

  function removeCommentFromList(commentId) {
    const index = state.comments.findIndex((c) => c.commentId === parseInt(commentId));
    if (index !== -1) {
      state.comments.splice(index, 1);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 문제 5: 댓글 삭제 시 총 댓글 수 감소
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    state.commentTotal = Math.max(0, state.commentTotal - 1);

    // DOM 업데이트
    const commentItem = document.querySelector(`[data-comment-id="${commentId}"]`);
    if (commentItem) {
      commentItem.remove();
    }

    // 댓글이 없으면 Empty state 표시
    if (state.comments.length === 0) {
      showEmptyComments();
    }
  }

  function showEmptyComments() {
    if (elements.commentsEmpty) {
      elements.commentsEmpty.style.display = 'block';
    }
    if (elements.commentsList) {
      elements.commentsList.innerHTML = '';
    }
  }

  // ============================================
  // Modal Functions
  // ============================================
  function openDeleteModal() {
    if (elements.deleteModal) {
      document.body.classList.add('modal-open');
      setTimeout(() => {
        elements.deleteModal.classList.add('is-active');
      }, 10);
    }
  }

  function closeDeleteModal() {
    if (elements.deleteModal) {
      elements.deleteModal.classList.remove('is-active');
      setTimeout(() => {
        if (!document.querySelector('.modal-overlay.is-active')) {
          document.body.classList.remove('modal-open');
        }
      }, 300);
    }
  }

  // ============================================
  // User Profile
  // ============================================
  // loadUserProfile은 auth-header.js의 initAuthHeader() 사용

  // ============================================
  // DOMContentLoaded Event
  // ============================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window, document);
