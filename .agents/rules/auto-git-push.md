---
trigger: always_on
---

# Otomatik GitHub Push Kuralı

Bu çalışma alanında yapılan tüm kod, stil, yapılandırma ve migration değişiklikleri tamamlandıktan sonra otomatik olarak GitHub'a (`origin/main`) push edilmelidir:

1. `npx oxlint src`, `npx tsc --noEmit` ve `npm run build` kontrollerini çalıştır.
2. `.env`, `dist/`, `dev-dist/` ve `node_modules/` hariç tüm değişiklikleri `git add` ile ekle (otomatik üretilen `dev-dist/` değişikliklerini `git checkout -- dev-dist/` ile geri al).
3. Açıklayıcı bir Türkçe commit mesajıyla `git commit` yap ve `git push origin main` çalıştır.
4. Son yanıtta commit bilgisini ve push sonucunu paylaş.
