/* ============================================================
   ★★★ FILE CẤU HÌNH — NƠI DUY NHẤT BẠN CẦN SỬA THƯỜNG XUYÊN ★★★
   ------------------------------------------------------------
   - Đổi link Google Sheets / Apps Script: sửa các dòng LINK_...
   - Thêm / bớt nhân sự: sửa danh sách DANH_SACH_NHAN_SU
   - Đổi tên phòng: sửa TEN_DON_VI
   KHÔNG cần đụng tới giaodien.css hay xuly.js.
   ============================================================ */

const LINK_CSV         = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRTmIdgavLyCkeO1yUx5CvRdkYLH7cCW8tYlJ1QaSbKSpalHUP9pIexdo1dbiC5skg5d4_4L6pCd4lr/pub?gid=0&single=true&output=csv";
const LINK_CSV_NHIEMVU = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRTmIdgavLyCkeO1yUx5CvRdkYLH7cCW8tYlJ1QaSbKSpalHUP9pIexdo1dbiC5skg5d4_4L6pCd4lr/pub?gid=2130907067&single=true&output=csv";
const LINK_APPS_SCRIPT = "https://script.google.com/macros/s/AKfycbyUcTHBeIsUGGitZUkRxpl3NEcwNzK0nSqgUD4Rg2__IB1q8m9KBVHImZrbY0UFrKRxgA/exec";

const TEN_DON_VI = "Phòng BIM — KC1";
const TRUONG_NHOM = "Phạm Anh Khoa";   /* Leader KC1 */

/* Mã riêng để CHỈNH DEADLINE — GIỮ LẠI cho tương thích, nhưng từ bản này
   việc phân quyền dựa trên ĐĂNG NHẬP (role + leader dự án) bên dưới. */
const MA_LEADER = "KC1-LEADER";

/* ============================================================
   ★ DANH SÁCH NGƯỜI DÙNG — tên + mã PIN + vai trò
   ------------------------------------------------------------
   role: "super_admin" = thấy & sửa mọi thứ.
         "staff"       = chỉ là leader ở dự án được giao.
   ⚠ HÃY ĐỔI CÁC MÃ PIN bên dưới thành mã riêng (mỗi người một mã).
   ⚠ PIN này cũng dùng làm mã ghi lên Google Sheets — xem hướng dẫn
     để khai BÁO các PIN tương ứng trong Apps Script (DANH_SACH_PIN).
   Lưu ý: "Nguyễn Minh Phúc" theo yêu cầu mới (trước đây là "Vũ Minh Phúc")
     — nếu dữ liệu cũ dùng tên khác, sửa lại tên ở đây cho khớp.
   ============================================================ */
const DANH_SACH_NHAN_SU = [
  { ten: "Phạm Anh Khoa",     pin: "25251325", role: "super_admin" },
  { ten: "Huỳnh Minh Đức",    pin: "1234", role: "staff" },
  { ten: "Hồ Công Bảo",       pin: "1998", role: "staff" },
  { ten: "Vũ Minh Phúc",     pin: "16012001", role: "staff" },
  { ten: "Nguyễn Thành Cang", pin: "1111", role: "staff" },
  { ten: "Trần Khắc Trường",  pin: "0000", role: "staff" },
  { ten: "Phan Gia Bảo",      pin: "2410", role: "staff" }
];

/* Danh sách TÊN (dùng cho các ô chọn người trong form) — tự dẫn xuất, đừng sửa tay */
const TEN_NHAN_SU = DANH_SACH_NHAN_SU.map(function(u){ return u.ten; });
