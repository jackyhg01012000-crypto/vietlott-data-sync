# vietlott-data-sync

Đồng bộ kết quả xổ số Vietlott mới nhất mỗi 15 phút bằng GitHub Actions, xuất ra file JSON
ổn định để client (app di động, web...) gọi trực tiếp thay vì tự cào HTML từ vietlott.vn.

Được tách ra riêng cho [VietlottApp](https://github.com/REPLACE_ME/VietlottApp) để việc cào dữ
liệu chạy tập trung ở một chỗ (dễ giám sát, dễ sửa khi vietlott.vn đổi giao diện) thay vì chạy
trên từng thiết bị người dùng.

## Dữ liệu

Mỗi sản phẩm có 1 file tại `data/<product>/latest.json`:

```json
{
  "product": "power_655",
  "updatedAt": "2026-07-19T15:08:09.253Z",
  "results": [
    { "drawId": "01373", "date": "2026-07-18", "numbers": [22,41,45,48,54,55], "bonusNumber": 16, "jackpot": null }
  ]
}
```

File này chỉ giữ tối đa 300 kỳ quay gần nhất (đủ để dedup/backfill giữa các lần app mở lên).
Lịch sử đầy đủ vẫn nên lấy từ nguồn khác (vd. [vietvudanh/vietlott-data](https://github.com/vietvudanh/vietlott-data)).

Truy cập qua raw GitHub, ví dụ:
```
https://raw.githubusercontent.com/<user>/vietlott-data-sync/main/data/power_655/latest.json
```

Sản phẩm hỗ trợ: `power_655`, `power_645`, `power_535`, `3d`, `3d_pro`, `keno`, `bingo18`.

## Chạy thủ công

```bash
npm install
npm run scrape
```

## Khi vietlott.vn đổi giao diện

Nếu 1 sản phẩm liên tục báo "parsed 0 results" trong log của workflow, khả năng cao là slug
URL hoặc CSS selector trong `src/products.js` / `src/parse.js` đã không còn khớp - kiểm tra
lại cấu trúc HTML thực tế của trang kết quả tương ứng trước tiên.
