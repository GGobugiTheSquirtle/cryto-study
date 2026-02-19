# manual-quiz (GitHub Pages)

이 폴더는 정적 사이트입니다.
- `index.html`
- `app.js`
- `styles.css`
- `questions.json`

## 로컬 확인
```bash
cd docs/manual-quiz
python -m http.server 8080
```
브라우저: `http://localhost:8080`

## questions.json 재생성
```bash
python 06_STRATEGY_REVIEW_GPT/scripts/build_manual_trader_quiz.py
```

## GitHub Pages 단독 리포로 배포 (권장)
아래는 `GGobugiTheSquirtle/cryto-study`(오타 없는지 확인) 리포를 사용하는 예시입니다.

```bash
mkdir ..\\cryto-study-pages
cd ..\\cryto-study-pages
git init
git checkout -b main
xcopy /E /I /Y "..\\퀀트 리서트 v2\\docs\\manual-quiz" "."
git add .
git commit -m "feat: add manual trader quiz pages"
git remote add origin https://github.com/GGobugiTheSquirtle/cryto-study.git
git push -u origin main
```

GitHub 리포 설정:
- `Settings > Pages`
- Source: `Deploy from a branch`
- Branch: `main` / Folder: `/ (root)`

주소:
- `https://ggobugithesquirtle.github.io/cryto-study/`

## 이미 메인 리포에 커밋된 폴더라도 분리 가능
이미 다른 리포에서 추적 중이어도 분리 가능합니다.

1. 기존 리포에서 추적 해제(파일은 유지)
```bash
git rm -r --cached docs/manual-quiz
```
2. `.gitignore`에 `docs/manual-quiz/` 추가
3. 별도 리포에 다시 `git init` 후 push

`git rm --cached`는 로컬 파일 삭제가 아니라 "추적만 해제"입니다.
