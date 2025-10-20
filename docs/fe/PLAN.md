# Spring Boot → Express.js 마이그레이션 계획

## 문서 정보

| 항목 | 내용 |
|------|------|
| 작성일 | 2025-10-20 |
| 버전 | 1.0 |
| 목적 | Spring Boot → Express.js + TypeScript 전환 |
| 기술 스택 | Express.js, TypeScript, Prisma ORM, JWT |

**참조 문서** (마이그레이션 기준):
- **⭐ [API.md](../be/API.md)**: REST API 명세 - 엔드포인트/에러 코드 SSOT
- **⭐ [LLD.md](../be/LLD.md)**: 백엔드 설계 문서 - 구현 패턴 SSOT
- **[DDL.md](../be/DDL.md)**: 데이터베이스 스키마

---

## 0. 마이그레이션 배경

### 0.1 현재 상태 (Spring Boot)
- **Backend**: Spring Boot 3.5.6, Java 24
- **ORM**: JPA (Hibernate)
- **인증**: JWT (localStorage)
- **Database**: MySQL 8.0
- **Storage**: AWS S3
- **Frontend**: Vanilla JS (CSR)

### 0.2 목표 (Express.js)
- **Backend**: Express.js 4.x, TypeScript 5.x
- **ORM**: Prisma 5.x
- **인증**: JWT (HttpOnly Cookie)
- **Database**: MySQL 8.0 (유지)
- **Storage**: AWS S3 (유지)
- **Frontend**: Vanilla JS (유지, 점진적 React 전환 가능)

### 0.3 전환 이유
1. **JavaScript 생태계 통합**: Frontend/Backend 동일 언어
2. **개발 속도**: Node.js 빠른 프로토타이핑, HMR 지원
3. **타입 안정성**: TypeScript로 런타임 에러 감소
4. **확장성**: 마이크로서비스 전환 용이 (추후)
5. **학습 곡선**: JavaScript 개발자 친화적

---

## 1. Phase별 마이그레이션 계획

### Phase 1: 프로젝트 초기화 및 인프라 구축 (1-2일)

**목표**: Express.js 프로젝트 생성, 기본 설정

**작업 항목:**
- [ ] Node.js 프로젝트 초기화
  - [ ] `package.json` 생성 (Express, TypeScript, Prisma)
  - [ ] `tsconfig.json` 설정 (strict mode)
  - [ ] 디렉토리 구조 생성
- [ ] 개발 환경 설정
  - [ ] ESLint, Prettier 설정
  - [ ] Nodemon (개발 서버 자동 재시작)
  - [ ] dotenv (환경 변수 관리)
- [ ] Prisma ORM 설정
  - [ ] `prisma/schema.prisma` 생성
  - [ ] 기존 MySQL DB introspection
  - [ ] Migration 파일 생성

**디렉토리 구조:**
```
community-express/
├── src/
│   ├── config/         # 설정 파일 (DB, S3, JWT)
│   ├── controllers/    # 라우트 핸들러
│   ├── middlewares/    # 인증, 에러 핸들러
│   ├── services/       # 비즈니스 로직
│   ├── repositories/   # Prisma 쿼리 (선택)
│   ├── types/          # TypeScript 타입 정의
│   ├── utils/          # 유틸리티 함수
│   ├── validators/     # 입력 검증 (Zod)
│   └── app.ts          # Express 앱 진입점
├── prisma/
│   └── schema.prisma   # Prisma 스키마
├── tests/              # 테스트 파일
├── .env.example
├── tsconfig.json
└── package.json
```

**의존성 (package.json):**
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "@prisma/client": "^5.7.0",
    "bcrypt": "^5.1.1",
    "jsonwebtoken": "^9.0.2",
    "cookie-parser": "^1.4.6",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "dotenv": "^16.3.1",
    "zod": "^3.22.4",
    "aws-sdk": "^2.1498.0"
  },
  "devDependencies": {
    "typescript": "^5.3.3",
    "@types/express": "^4.17.21",
    "@types/node": "^20.10.5",
    "@types/bcrypt": "^5.0.2",
    "@types/jsonwebtoken": "^9.0.5",
    "prisma": "^5.7.0",
    "nodemon": "^3.0.2",
    "ts-node": "^10.9.2",
    "eslint": "^8.56.0",
    "prettier": "^3.1.1"
  }
}
```

**완료 조건:**
- Express 서버 실행 (http://localhost:3000)
- Prisma Client 생성 확인 (`npx prisma generate`)
- TypeScript 컴파일 성공 (`npm run build`)

---

### Phase 2: 데이터베이스 마이그레이션 (1일)

**목표**: Prisma 스키마 정의, 기존 DB 연결

**작업 항목:**
- [ ] Prisma 스키마 작성 (기존 DDL.md 참조)
  - [ ] User 모델
  - [ ] Post, Comment, PostLike 모델
  - [ ] Image, UserToken 모델
  - [ ] PostStats 모델
  - [ ] 관계 설정 (1:N, M:N)
- [ ] Migration 실행
  - [ ] `npx prisma migrate dev`
  - [ ] 기존 데이터 보존 확인
- [ ] Prisma Client 생성
  - [ ] `npx prisma generate`
  - [ ] Type 안전성 확인

**Prisma 스키마 예시 (User 모델):**
```prisma
// prisma/schema.prisma
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  userId        BigInt    @id @default(autoincrement()) @map("user_id")
  email         String    @unique @db.VarChar(255)
  passwordHash  String    @map("password_hash") @db.VarChar(255)
  nickname      String    @unique @db.VarChar(30)
  role          UserRole  @default(USER)
  userStatus    UserStatus @default(ACTIVE) @map("user_status")
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  // 관계
  posts         Post[]
  comments      Comment[]
  postLikes     PostLike[]
  userTokens    UserToken[]
  profileImage  Image?    @relation(fields: [imageId], references: [imageId])
  imageId       BigInt?   @map("image_id")

  @@index([userStatus])
  @@map("users")
}

enum UserRole {
  USER
  ADMIN
}

enum UserStatus {
  ACTIVE
  INACTIVE
  DELETED
}

model Post {
  postId      BigInt      @id @default(autoincrement()) @map("post_id")
  postTitle   String      @map("post_title") @db.VarChar(100)
  postContent String      @map("post_content") @db.LongText
  postStatus  PostStatus  @default(ACTIVE) @map("post_status")
  createdAt   DateTime    @default(now()) @map("created_at")
  updatedAt   DateTime    @updatedAt @map("updated_at")

  // 관계
  user        User        @relation(fields: [userId], references: [userId])
  userId      BigInt      @map("user_id")
  comments    Comment[]
  postLikes   PostLike[]
  stats       PostStats?
  images      PostImage[]

  @@index([createdAt(sort: Desc)])
  @@index([userId, createdAt(sort: Desc)])
  @@map("posts")
}

enum PostStatus {
  ACTIVE
  DELETED
  DRAFT
}

// ... 나머지 모델 생략 (Comment, PostLike, Image 등)
```

**완료 조건:**
- Prisma 스키마 전체 모델 정의 완료
- Migration 성공 (기존 데이터 보존)
- `npx prisma studio` 실행 (GUI 확인)

---

### Phase 3: 인증 시스템 구현 (2-3일)

**목표**: JWT 인증, 회원가입/로그인/로그아웃

**작업 항목:**
- [ ] JWT 유틸리티 구현
  - [ ] `generateAccessToken()` (30분)
  - [ ] `generateRefreshToken()` (7일)
  - [ ] `verifyToken()`
  - [ ] HttpOnly 쿠키 설정
- [ ] 미들웨어 구현
  - [ ] `authenticateJWT` (토큰 검증)
  - [ ] `authorizeRoles` (권한 검증)
  - [ ] `rateLimiter` (Rate Limiting)
- [ ] 인증 라우트 구현
  - [ ] POST /auth/login
  - [ ] POST /auth/logout
  - [ ] POST /auth/refresh_token
  - [ ] POST /users/signup
- [ ] 비밀번호 검증
  - [ ] `PasswordValidator` (정규식)
  - [ ] bcrypt 해싱

**JWT 유틸리티 예시:**
```typescript
// src/utils/jwt.ts
import jwt from 'jsonwebtoken';
import { Response } from 'express';

interface JwtPayload {
  userId: number;
  email: string;
  role: string;
}

export const generateAccessToken = (user: JwtPayload): string => {
  return jwt.sign(
    { userId: user.userId, email: user.email, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: '30m' }
  );
};

export const generateRefreshToken = (user: JwtPayload): string => {
  return jwt.sign(
    { userId: user.userId },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: '7d' }
  );
};

export const setTokenCookies = (res: Response, accessToken: string, refreshToken: string) => {
  res.cookie('access_token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 60 * 1000  // 30분
  });

  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000  // 7일
  });
};

export const verifyToken = (token: string): JwtPayload => {
  return jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
};
```

**인증 미들웨어 예시:**
```typescript
// src/middlewares/auth.ts
import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';

export interface AuthRequest extends Request {
  user?: {
    userId: number;
    email: string;
    role: string;
  };
}

export const authenticateJWT = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // 1순위: 쿠키에서 토큰 추출
    const token = req.cookies.access_token;

    if (!token) {
      return res.status(401).json({ message: 'AUTH-002', error: 'No token provided' });
    }

    // 토큰 검증
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'AUTH-003', error: 'Invalid or expired token' });
  }
};

export const authorizeRoles = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'USER-007', error: 'Insufficient permissions' });
    }
    next();
  };
};
```

**로그인 컨트롤러 예시:**
```typescript
// src/controllers/auth.controller.ts
import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { generateAccessToken, generateRefreshToken, setTokenCookies } from '../utils/jwt';

const prisma = new PrismaClient();

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // 1. 사용자 조회
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    });

    if (!user || user.userStatus !== 'ACTIVE') {
      return res.status(401).json({ message: 'AUTH-001', error: 'Invalid credentials' });
    }

    // 2. 비밀번호 검증
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ message: 'AUTH-001', error: 'Invalid credentials' });
    }

    // 3. JWT 생성 및 쿠키 설정
    const accessToken = generateAccessToken({
      userId: Number(user.userId),
      email: user.email,
      role: user.role
    });

    const refreshToken = generateRefreshToken({
      userId: Number(user.userId),
      email: user.email,
      role: user.role
    });

    // Refresh Token DB 저장
    await prisma.userToken.create({
      data: {
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        userId: user.userId
      }
    });

    setTokenCookies(res, accessToken, refreshToken);

    // 4. 사용자 정보 반환 (토큰 제외)
    res.json({
      message: 'login_success',
      data: {
        userId: user.userId,
        email: user.email,
        nickname: user.nickname
      }
    });
  } catch (error) {
    console.error('[Auth] Login error:', error);
    res.status(500).json({ message: 'COMMON-999', error: 'Internal server error' });
  }
};
```

**완료 조건:**
- POST /auth/login 작동 (쿠키 설정 확인)
- POST /users/signup 작동 (bcrypt 해싱)
- 인증 미들웨어 작동 (401/403 응답)
- Postman/Thunder Client 테스트 통과

---

### Phase 4: 게시글 API 구현 (2-3일)

**목표**: 게시글 CRUD, 페이지네이션, 좋아요

**작업 항목:**
- [ ] 게시글 라우트 구현
  - [ ] GET /posts (목록 - Cursor 페이지네이션)
  - [ ] GET /posts/:id (상세)
  - [ ] POST /posts (작성)
  - [ ] PATCH /posts/:id (수정)
  - [ ] DELETE /posts/:id (삭제)
- [ ] 좋아요 라우트
  - [ ] POST /posts/:id/like
  - [ ] DELETE /posts/:id/like
- [ ] 입력 검증 (Zod)
- [ ] 조회수 증가 (Optimistic Update 패턴)
- [ ] N+1 문제 해결 (Prisma include)

**Cursor 페이지네이션 예시:**
```typescript
// src/controllers/post.controller.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getPosts = async (req: Request, res: Response) => {
  try {
    const cursor = req.query.cursor ? BigInt(req.query.cursor as string) : undefined;
    const limit = parseInt(req.query.limit as string) || 10;
    const sort = req.query.sort as string || 'latest';

    // limit + 1 패턴
    const posts = await prisma.post.findMany({
      where: {
        postStatus: 'ACTIVE',
        ...(cursor && { postId: { lt: cursor } })
      },
      include: {
        user: {
          select: { userId: true, nickname: true, profileImage: true }
        },
        stats: true,
        _count: { select: { comments: true } }
      },
      orderBy: { postId: 'desc' },
      take: limit + 1
    });

    const hasMore = posts.length > limit;
    if (hasMore) posts.pop();

    const nextCursor = hasMore && posts.length > 0
      ? posts[posts.length - 1].postId
      : null;

    res.json({
      message: 'get_posts_success',
      data: {
        posts: posts.map(post => ({
          postId: post.postId.toString(),
          title: post.postTitle,
          content: post.postContent,
          author: {
            userId: post.user.userId.toString(),
            nickname: post.user.nickname
          },
          stats: {
            viewCount: post.stats?.viewCount || 0,
            likeCount: post.stats?.likeCount || 0,
            commentCount: post._count.comments
          },
          createdAt: post.createdAt
        })),
        nextCursor: nextCursor?.toString(),
        hasMore
      }
    });
  } catch (error) {
    console.error('[Post] Get posts error:', error);
    res.status(500).json({ message: 'COMMON-999', error: 'Internal server error' });
  }
};
```

**Zod 검증 예시:**
```typescript
// src/validators/post.validator.ts
import { z } from 'zod';

export const createPostSchema = z.object({
  body: z.object({
    title: z.string()
      .min(1, 'Title required')
      .max(27, 'Title max 27 characters'),
    content: z.string()
      .min(1, 'Content required'),
    imageId: z.number().optional()
  })
});

// 미들웨어로 사용
export const validateCreatePost = (req: Request, res: Response, next: NextFunction) => {
  try {
    createPostSchema.parse({ body: req.body });
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: 'COMMON-001',
        errors: error.errors
      });
    }
    next(error);
  }
};
```

**완료 조건:**
- 게시글 CRUD 5개 엔드포인트 작동
- Cursor 페이지네이션 무한 스크롤 지원
- Zod 검증 작동 (400 에러)
- N+1 방지 (Prisma include)

---

### Phase 5: 댓글 & 이미지 API 구현 (2일)

**목표**: 댓글 CRUD, S3 이미지 업로드

**작업 항목:**
- [ ] 댓글 라우트 구현
  - [ ] GET /posts/:id/comments
  - [ ] POST /posts/:id/comments
  - [ ] PATCH /comments/:id
  - [ ] DELETE /comments/:id
- [ ] 이미지 업로드
  - [ ] POST /images (Multer + S3)
  - [ ] TTL 관리 (expires_at)
- [ ] S3 설정
  - [ ] AWS SDK v3 사용
  - [ ] presigned URL 생성 (선택)

**S3 업로드 예시:**
```typescript
// src/utils/s3.ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  }
});

export const uploadToS3 = async (file: Express.Multer.File): Promise<string> => {
  const key = `images/${uuidv4()}-${file.originalname}`;

  await s3Client.send(new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype
  }));

  return `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
};
```

**Multer 미들웨어:**
```typescript
// src/middlewares/upload.ts
import multer from 'multer';

const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024  // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('IMAGE-003: Invalid file type'));
    }
  }
});
```

**완료 조건:**
- 댓글 CRUD 4개 엔드포인트 작동
- S3 이미지 업로드 성공
- Multer 파일 크기/타입 검증

---

### Phase 6: 에러 핸들링 & 미들웨어 (1일)

**목표**: 글로벌 에러 핸들러, CORS, Rate Limiting

**작업 항목:**
- [ ] 글로벌 에러 핸들러
  - [ ] BusinessException 클래스
  - [ ] ErrorCode enum
- [ ] CORS 설정
- [ ] Rate Limiting (express-rate-limit)
- [ ] Helmet (보안 헤더)
- [ ] Morgan (로깅)

**에러 핸들러 예시:**
```typescript
// src/middlewares/errorHandler.ts
import { Request, Response, NextFunction } from 'express';

export class BusinessException extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message: string
  ) {
    super(message);
  }
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof BusinessException) {
    return res.status(err.statusCode).json({
      message: err.code,
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }

  console.error('[Error]', err);
  res.status(500).json({
    message: 'COMMON-999',
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  });
};
```

**Rate Limiting 예시:**
```typescript
// src/middlewares/rateLimiter.ts
import rateLimit from 'express-rate-limit';

export const authLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1분
  max: 5,               // 5회
  message: { message: 'COMMON-004', error: 'Too many requests' }
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: { message: 'COMMON-004', error: 'Too many requests' }
});
```

**완료 조건:**
- 글로벌 에러 핸들러 작동
- CORS 설정 확인 (프론트엔드에서 호출)
- Rate Limiting 작동 (429 응답)

---

### Phase 7: 테스트 & 배포 준비 (2-3일)

**목표**: Jest 테스트, Docker, 환경 분리

**작업 항목:**
- [ ] 단위 테스트 (Jest)
  - [ ] 서비스 로직 테스트
  - [ ] 유틸리티 함수 테스트
- [ ] 통합 테스트 (Supertest)
  - [ ] API 엔드포인트 테스트
- [ ] Docker 설정
  - [ ] Dockerfile
  - [ ] docker-compose.yml (MySQL, Redis)
- [ ] 환경 분리
  - [ ] .env.development
  - [ ] .env.production
- [ ] CI/CD (선택)
  - [ ] GitHub Actions

**Jest 설정 예시:**
```typescript
// tests/auth.test.ts
import request from 'supertest';
import app from '../src/app';

describe('POST /auth/login', () => {
  it('should login successfully', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'Test1234!' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('login_success');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('should fail with invalid credentials', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'wrong@example.com', password: 'wrong' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('AUTH-001');
  });
});
```

**Dockerfile 예시:**
```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

**완료 조건:**
- Jest 테스트 커버리지 60%+
- Docker 빌드 성공
- 운영 환경 배포 준비

---

## 2. Frontend 변경 사항

### 2.1 API 베이스 URL 변경

**기존:**
```javascript
const API_BASE_URL = '';  // Spring Boot (동일 도메인)
```

**변경:**
```javascript
const API_BASE_URL = 'http://localhost:3000';  // Express.js
```

### 2.2 CORS 설정 필요

**Express.js:**
```typescript
import cors from 'cors';

app.use(cors({
  origin: 'http://localhost:8080',  // Frontend URL
  credentials: true  // 쿠키 전송 허용
}));
```

### 2.3 API 응답 구조 유지

**Spring Boot:**
```json
{
  "message": "login_success",
  "data": { ... },
  "timestamp": "2025-10-20T10:00:00"
}
```

**Express.js (동일):**
```json
{
  "message": "login_success",
  "data": { ... },
  "timestamp": "2025-10-20T10:00:00"
}
```

**✅ Frontend 코드 변경 최소화**

---

## 3. 마이그레이션 전략

### 3.1 점진적 전환 (추천)

**방식**: API별 순차 전환

**순서:**
1. Phase 3: 인증 API 전환 (로그인/회원가입)
2. Phase 4: 게시글 API 전환
3. Phase 5: 댓글/이미지 API 전환
4. Spring Boot 종료

**장점:**
- 위험 분산
- 언제든지 롤백 가능
- 각 Phase 검증 후 다음 진행

**단점:**
- 전환 기간 중 2개 서버 운영

---

### 3.2 완전 재작성 (대안)

**방식**: Express.js 전체 구현 후 일괄 전환

**장점:**
- 일관성 (모든 API 동일 패턴)
- 기존 코드 의존성 없음

**단점:**
- 높은 위험 (전체 기능 동시 테스트)
- 긴 개발 기간

---

## 4. 기술 스택 비교

| 항목 | Spring Boot | Express.js |
|------|-------------|------------|
| **언어** | Java 24 | TypeScript 5.x |
| **ORM** | JPA (Hibernate) | Prisma |
| **빌드 도구** | Gradle | npm/pnpm |
| **개발 서버** | Spring Boot DevTools | Nodemon |
| **테스트** | JUnit, Mockito | Jest, Supertest |
| **패키지 관리** | Maven Central | npm |
| **타입 안정성** | ✅ 컴파일 타임 | ✅ 컴파일 타임 |
| **학습 곡선** | 높음 | 낮음 |
| **성능** | 높음 (JVM) | 중간 (V8) |
| **확장성** | 높음 | 높음 |

---

## 5. 예상 소요 기간

| Phase | 작업 | 예상 기간 | 누적 진행률 |
|-------|------|-----------|-------------|
| Phase 1 | 프로젝트 초기화 | 1-2일 | 14.3% |
| Phase 2 | 데이터베이스 마이그레이션 | 1일 | 28.6% |
| Phase 3 | 인증 시스템 | 2-3일 | 50.0% |
| Phase 4 | 게시글 API | 2-3일 | 71.4% |
| Phase 5 | 댓글 & 이미지 API | 2일 | 85.7% |
| Phase 6 | 에러 핸들링 & 미들웨어 | 1일 | 92.9% |
| Phase 7 | 테스트 & 배포 | 2-3일 | 100% |
| **총계** | **Express.js 마이그레이션** | **11-15일** | **100%** |

---

## 6. 리스크 평가

| 리스크 | 확률 | 영향도 | 완화 방안 |
|--------|------|--------|-----------|
| **Prisma 마이그레이션 실패** | 중 | 높음 | 기존 DB 백업, introspection 활용 |
| **타입 안정성 부족** | 낮음 | 중간 | TypeScript strict mode, Zod 검증 |
| **성능 저하** | 중 | 중간 | 벤치마크, 캐싱 (Redis) 도입 |
| **JWT 쿠키 CSRF** | 낮음 | 높음 | SameSite=Lax, CSRF 토큰 |
| **의존성 보안 취약점** | 중 | 중간 | npm audit, Dependabot |

---

## 7. 향후 확장 전략

### 7.1 React 전환 (선택)

**Phase 8+ (선택사항):**
- Vanilla JS → React 18 + TypeScript
- Next.js SSR (SEO 유지)
- TanStack Query (데이터 fetching)

### 7.2 Redis 캐싱

**Phase 9+ (선택사항):**
- 세션 저장소 (선택)
- API 응답 캐싱
- Rate Limiting 저장소

### 7.3 GraphQL (선택)

**Phase 10+ (선택사항):**
- Apollo Server
- Type-safe 쿼리
- N+1 문제 자동 해결

---

## 8. 참조 문서

| 문서 | 용도 |
|------|------|
| **@docs/be/API.md** | 기존 API 명세 (21개 엔드포인트) |
| **@docs/be/DDL.md** | MySQL 스키마 (Prisma 변환 참조) |
| **@docs/be/LLD.md** | 비즈니스 로직 참조 |
| **Prisma Docs** | https://www.prisma.io/docs |
| **Express.js Docs** | https://expressjs.com |

---

## 변경 이력

| 날짜 | 버전 | 변경 내용 |
|------|------|-----------|
| 2025-10-20 | 1.0 | 초기 작성 (Spring Boot → Express.js 마이그레이션 계획) |
