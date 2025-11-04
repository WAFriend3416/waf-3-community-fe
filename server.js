const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// origin_source/static 디렉토리만 정적 파일로 서빙 (디렉토리 리스팅 비활성화)
app.use(express.static(path.join(__dirname, 'origin_source/static'), {
  index: false,      // 디렉토리 리스팅 비활성화
  dotfiles: 'ignore' // 숨김 파일 무시
}));

// ========================================
// Clean URL Routing (간소화된 URL)
// ========================================

// 홈 페이지
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'origin_source/static/pages/home/index.html'));
});

// 사용자 페이지
app.get('/page/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'origin_source/static/pages/user/login.html'));
});

app.get('/page/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'origin_source/static/pages/user/register.html'));
});

app.get('/page/profile', (req, res) => {
  res.sendFile(path.join(__dirname, 'origin_source/static/pages/user/profile-edit.html'));
});

app.get('/page/password', (req, res) => {
  res.sendFile(path.join(__dirname, 'origin_source/static/pages/user/password-change.html'));
});

// 게시글 페이지
app.get('/board', (req, res) => {
  res.sendFile(path.join(__dirname, 'origin_source/static/pages/board/list.html'));
});

app.get('/board/write', (req, res) => {
  res.sendFile(path.join(__dirname, 'origin_source/static/pages/board/write.html'));
});

app.get('/board/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'origin_source/static/pages/board/detail.html'));
});

app.get('/board/:id/edit', (req, res) => {
  res.sendFile(path.join(__dirname, 'origin_source/static/pages/board/edit.html'));
});

// 404 처리
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'origin_source/static/pages/errors/404.html'));
});

// 서버 시작
app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log('✅ KTB 커뮤니티 프론트엔드 서버 실행 중');
  console.log('='.repeat(50));
  console.log(`🌐 로컬 주소:     http://localhost:${PORT}`);
  console.log(`📁 정적 파일:     origin_source/static/`);
  console.log(`🔗 백엔드 API:    http://localhost:8080 (Spring Boot)`);
  console.log(`📄 로그인 페이지: http://localhost:${PORT}/pages/user/login.html`);
  console.log('='.repeat(50));
});
