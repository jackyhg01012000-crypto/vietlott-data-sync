# vietlott-data-sync

Đồng bộ kết quả xổ số Vietlott mới nhất 2 lần mỗi giờ bằng GitHub Actions, xuất ra file JSON
ổn định để client (app di động, web...) gọi trực tiếp thay vì tự cào HTML từ vietlott.vn.

Được tách ra riêng cho [VietlottApp](https://github.com/REPLACE_ME/VietlottApp) để việc cào dữ
liệu chạy tập trung ở một chỗ (dễ giám sát, dễ sửa khi vietlott.vn đổi giao diện) thay vì chạy
trên từng thiết bị người dùng.

## Dữ liệu

Mỗi sản phẩm có 2 file dưới `data/<product>/`, cùng schema:

```json
{
  "product": "power_655",
  "updatedAt": "2026-07-19T15:08:09.253Z",
  "results": [
    { "drawId": "01373", "date": "2026-07-18", "numbers": [22,41,45,48,54,55], "bonusNumber": 16, "jackpot": null }
  ]
}
```

- **`latest.json`** - tối đa 300 kỳ gần nhất. Nhỏ, rẻ để poll định kỳ, dùng cho sync
  thường xuyên khi app đã có dữ liệu local.
- **`full.json`** - **không giới hạn**, toàn bộ lịch sử đã cào được kể từ khi repo này bắt đầu
  chạy (không bị cắt bớt như `latest.json`). App nên dùng file này để bulk-load lần đầu (khi
  local DB rỗng), cùng với [vietvudanh/vietlott-data](https://github.com/vietvudanh/vietlott-data)
  làm nền lịch sử trước đó. Lưu ý: vietvudanh không còn được cập nhật đều cho `keno` (dừng ở
  2023-03-21) và `bingo18` (dừng ở 2025-06-08) - khoảng trống giữa ngày đó và ngày repo này bắt
  đầu chạy là gap đã biết, chấp nhận không backfill (xem lịch sử trao đổi/quyết định trong repo
  VietlottApp nếu cần bối cảnh).

Truy cập qua raw GitHub, ví dụ:
```
https://raw.githubusercontent.com/<user>/vietlott-data-sync/main/data/power_655/latest.json
https://raw.githubusercontent.com/<user>/vietlott-data-sync/main/data/power_655/full.json
```

Sản phẩm hỗ trợ: `power_655`, `power_645`, `power_535`, `3d`, `3d_pro`, `keno`, `bingo18`.

## Chạy thủ công

```bash
npm install
npm run scrape
```

## Cloudflare 403 on CI

vietlott.vn đứng sau Cloudflare. Từ IP dân cư Việt Nam request đi thẳng qua bình thường,
nhưng từ runner GitHub Actions (dải IP datacenter của Azure) Cloudflare trả về **403** cho
mọi sản phẩm - không phải challenge page, chặn thẳng. Đây là lý do workflow `sync` fail liên
tục dù code cào hoàn toàn đúng (chạy `npm run scrape` ở máy local vẫn 7/7 OK).

**Đã đo, không phải phỏng đoán.** Workflow `diagnose` thử 8 chiến lược fetch ngay trên
runner GitHub (run 29991793601, 2026-07-23) - **0/8 qua được**:

| Chiến lược | Kết quả |
|---|---|
| baseline (header tối thiểu) | 403 challenge page |
| bộ header Chrome đầy đủ | 403 |
| header Chrome + JA3 fingerprint của Chrome | 403 |
| Node native fetch (undici) | 403 |
| header Chrome + `Referer` same-origin | 403 |
| ép IPv4 | 403 |
| proxy công cộng allorigins / codetabs | 522 (chính chúng cũng bị chặn) |

Kết luận: Cloudflare chặn theo **danh tiếng IP/ASN**, không theo fingerprint. Không có cách
nào sửa ở tầng code để runner GitHub đi qua được. `src/fetcher.js` vẫn giữ bộ header Chrome
+ TLS fingerprint (vô hại, có ích khi đi qua proxy), nhưng nó **không** giải quyết được vấn
đề này.

Muốn workflow chạy lại được thì bắt buộc phải có egress từ phía Việt Nam:

- **Self-hosted runner** đặt ở VN - đáng tin cậy nhất, miễn phí, đổi lại máy phải bật.
  Đổi `runs-on: ubuntu-latest` thành `runs-on: self-hosted` trong `sync.yml`.
- **Proxy có egress VN** - set repo secret `SCRAPE_PROXY_URL`
  (`https://user:pass@host:port`), `src/scrape.js` tự động route qua đó. Bỏ trống = đi thẳng.
- **VPS VN chạy cron riêng**, `git push` thẳng lên repo, bỏ hẳn GitHub Actions cho việc cào.

Chạy lại phép đo bất cứ lúc nào: Actions → **Diagnose Cloudflare block** → Run workflow.

## Khi vietlott.vn đổi giao diện

Nếu 1 sản phẩm liên tục báo "parsed 0 results" trong log của workflow, khả năng cao là slug
URL hoặc CSS selector trong `src/products.js` / `src/parse.js` đã không còn khớp - kiểm tra
lại cấu trúc HTML thực tế của trang kết quả tương ứng trước tiên.
