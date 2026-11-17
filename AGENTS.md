# Proje Çalışma Alanı Kuralları

## Otomatik GitHub Push Kuralı

Bu depoda yapılan **her kod, yapılandırma, stil veya veritabanı migration değişikliği tamamlandıktan sonra**, kullanıcıdan ek bir onay veya komut beklemeden şu adımları otomatik olarak uygula:

1. **Doğrulama**: `npx oxlint src`, `npx tsc --noEmit` ve `npm run build` komutlarını çalıştırıp hatasız geçtiğini doğrula.
2. **Temiz Stage**: Yalnızca değiştirilen veya yeni eklenen kaynak/konfigürasyon dosyalarını `git add` ile ekle. `.env`, `dist/`, `dev-dist/`, `node_modules/` dosyalarını asla commit içine alma (`dev-dist/` içinde otomatik değişen dosyalar varsa `git checkout -- dev-dist/` ile temizle).
3. **Commit & Push**: Açıklayıcı bir Türkçe commit mesajıyla `git commit` yap ve `git push origin main` komutuyla değişiklikleri GitHub'a gönder.
4. **Raporlama**: Son yanıtında commit hash'ini ve push sonucunu kısaca belirt.
