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

Đã xử lý ở `src/fetcher.js`: gửi đủ bộ header của Chrome (`sec-fetch-*`, `sec-ch-ua`,
`Accept` kiểu document) và ép cipher/curve theo thứ tự của Chrome để JA3 fingerprint không
lộ ra là Node. Nếu Cloudflare chặn theo danh tiếng ASN chứ không theo fingerprint thì cách
này không đủ.

Để biết chắc cách nào qua được, chạy workflow **Diagnose Cloudflare block** thủ công
(Actions → Diagnose Cloudflare block → Run workflow). Nó thử 8 chiến lược fetch ngay trên
runner rồi in bảng tổng kết cái nào trả về HTML dùng được.

Nếu không chiến lược nào qua, cần egress từ phía Việt Nam:

- **Self-hosted runner** đặt ở VN - đáng tin cậy nhất, miễn phí, đổi lại máy phải bật.
- **Proxy có egress VN** - set repo secret `SCRAPE_PROXY_URL`
  (`https://user:pass@host:port`), `src/scrape.js` tự động route qua đó. Bỏ trống = đi thẳng.

## Khi vietlott.vn đổi giao diện

Nếu 1 sản phẩm liên tục báo "parsed 0 results" trong log của workflow, khả năng cao là slug
URL hoặc CSS selector trong `src/products.js` / `src/parse.js` đã không còn khớp - kiểm tra
lại cấu trúc HTML thực tế của trang kết quả tương ứng trước tiên.
