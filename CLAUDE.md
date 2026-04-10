# Ergsn 프로젝트

## 배포

이 프로젝트의 배포 대상은 다음 저장소입니다:

- **Remote**: `https://github.com/ceodon/ergsn.git`
- **Branch**: `main`

"배포해줘" 요청이 오면 변경사항을 커밋하고 위 저장소의 `main` 브랜치로 푸시합니다.

### 커밋 정보

- `user.name`: `ceodon`
- `user.email`: `ceodon@gmail.com`

### 인증

푸시는 HTTPS + Personal Access Token을 사용합니다. 토큰은 저장소에 저장하지 않고,
푸시할 때마다 사용자에게 요청합니다. 사용 후 폐기(Revoke)를 안내할 것.

### 제외 항목

`.claude/` 디렉터리는 커밋하지 않습니다.
