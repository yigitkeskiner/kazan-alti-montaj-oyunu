# Kazan Altı Montaj Oyunu

Kazan tesisatındaki temel ekipmanları, gerçek şema üzerinde sürükle-bırak yöntemiyle öğretmek için hazırlanmış statik web oyunu.

## Yerelde çalıştırma

```bash
python3 -m http.server 8080
```

Ardından `http://localhost:8080` adresini açın.

## Yayınlama

`main` dalına yapılan her gönderim, `.github/workflows/deploy-pages.yml` iş akışıyla GitHub Pages'e otomatik olarak yayınlanır. GitHub deposunda **Settings → Pages → Source** alanının **GitHub Actions** olarak seçilmesi yeterlidir.
