/* ====== Trạng thái toàn cục ====== */
let DU_AN = [];
let NHIEM_VU = [];
let maXacNhanCache = '';
/* Mã xác nhận nhớ trong phiên; tự xóa sau 30 phút KHÔNG hoạt động (hoặc khi tải lại trang) */
let _henXoaMa = null;
function nhoMaTrongPhien(mk){
  maXacNhanCache = mk;
  if(_henXoaMa) clearTimeout(_henXoaMa);
}
function chamHoatDong(){
  if(!maXacNhanCache) return;
  if(_henXoaMa) clearTimeout(_henXoaMa);
  _henXoaMa = setTimeout(()=>{ maXacNhanCache=''; }, 30*60*1000);
}
['pointerdown','keydown'].forEach(ev=>document.addEventListener(ev, chamHoatDong, {passive:true}));
let lanGhiCuoi = 0;
let maDangSua = null;
let uidDangSua = null;
let gocDangSua = null;   /* chụp danh tính việc đang sửa, không phụ thuộc uid (uid bị cấp lại mỗi lần tải) */
let madaKanbanHienTai = null;
let kFilter = { hangmuc: null, nguoi: null };
let chonUids = new Set();      /* thẻ đang chọn — theo uid, giữ qua các lần vẽ lại */
let keoUids = [];              /* các uid đang kéo */
let ctxProjectMa = null;
let ctxTaskUids = [];
let demUid = 0;
const $ = id => document.getElementById(id);

document.title = TEN_DON_VI + ' — Quản lý dự án';
$('tenDonVi').textContent = TEN_DON_VI + (typeof TRUONG_NHOM!=='undefined' && TRUONG_NHOM ? '  ·  Trưởng nhóm: ' + TRUONG_NHOM : '');
$('footDonVi').textContent = TEN_DON_VI;

/* ====== Tiện ích ====== */
function thoatHTML(s){ return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function boDau(s){ return String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().trim(); }
function noiCache(u){ return u + (u.includes('?') ? '&' : '?') + 't=' + Date.now(); }
function lopBadge(loai){
  const k = boDau(loai);
  if(k.includes('cau')) return 'b-cau';
  if(k.includes('duong')) return 'b-duong';
  if(k.includes('ha tang')) return 'b-ham';
  if(k.includes('kien truc') || k.includes('nha')) return 'b-nutgiao';
  return '';
}
function lopTrangThai(tt){
  const k = boDau(tt);
  if(k.includes('hoan thanh') || k.includes('hoan thien') || k.includes('ban giao')) return 'tt-xong';
  if(k.includes('ngung') || k.includes('tam dung') || k.includes('treo') || k.includes('huy')) return 'tt-dung';
  if(k.includes('dang')) return 'tt-chay';
  return 'tt-khac';
}
function docNgay(s){ const m = String(s ?? '').trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/); if(!m) return null; const d = new Date(+m[3], +m[2]-1, +m[1]); return isNaN(d) ? null : d; }
function soNgayConLai(d){ if(!d) return null; const homNay = new Date(); homNay.setHours(0,0,0,0); return Math.round((d - homNay) / 86400000); }
function dangNgung(v){ return !!(v && v.tamngung && String(v.tamngung).trim()); }
function hienNguoi(s){
  const parts = (s||'').split(',').map(x=>x.trim()).filter(Boolean);
  if(!parts.length) return '';
  if(parts.length===1) return thoatHTML(parts[0]);
  const ho = parts.slice(1);
  return '<b>'+thoatHTML(parts[0])+'</b> <span class="ng-ho" title="Hỗ trợ: '+thoatHTML(ho.join(', '))+'">+'+ho.length+' HT</span>';
}
/* Vai trò của 1 người trong việc: 'chinh' (đầu danh sách), 'ho' (sau), hoặc null */
function vaiTroNguoi(v, nguoi){
  if(!nguoi) return null;
  const parts = (v.nguoi||'').split(',').map(x=>x.trim()).filter(Boolean);
  if(!parts.length) return null;
  if(parts[0]===nguoi) return 'chinh';
  return parts.includes(nguoi) ? 'ho' : null;
}
function nguoiChinhCua(v){ return (v.nguoi||'').split(',').map(x=>x.trim()).filter(Boolean)[0] || ''; }
/* So sánh tự nhiên: "2" trước "10", "25" giữa "20"–"30"; hiểu cả số La Mã ở đầu (I, II, IV, IX, X...) */
function laMaSoLaMa(s){ return s.length>0 && /^M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/i.test(s); }
function soLaMaSangSo(s){
  const m = {I:1,V:5,X:10,L:50,C:100,D:500,M:1000}; let t=0; s=s.toUpperCase();
  for(let i=0;i<s.length;i++){ const c=m[s[i]], n=m[s[i+1]]; if(n && c<n) t-=c; else t+=c; }
  return t;
}
function giaTriLaMaDau(s){
  const m = String(s||'').trim().match(/^([IVXLCDM]+)(?=[.)\-\s]|$)/i);
  return (m && laMaSoLaMa(m[1])) ? soLaMaSangSo(m[1]) : null;
}
function soSanhTuNhien(a, b){
  const ra = giaTriLaMaDau(a), rb = giaTriLaMaDau(b);
  if(ra!==null && rb!==null && ra!==rb) return ra - rb;       /* cả hai là số La Mã → so giá trị */
  if((ra!==null) !== (rb!==null)) return ra!==null ? -1 : 1;  /* mục La Mã đứng trước mục chữ thường */
  return String(a||'').localeCompare(String(b||''), 'vi', { numeric:true, sensitivity:'base' });
}
/* ===== Cache tăng tốc (dựng lại mỗi lần vẽ — không giữ qua thao tác nên không bị cũ) ===== */
let _mapDA = new Map();          /* mã -> dự án */
let _segViec = new Map();        /* mã -> [việc] */
let _cacheTD = new Map();        /* mã -> tiến độ % */
let _setCoViec = new Set();      /* mã dự án mà người đăng nhập có việc */
function chuanBiCache(){
  _mapDA = new Map(); _segViec = new Map(); _cacheTD = new Map(); _setCoViec = new Set();
  for(const d of DU_AN) _mapDA.set(d.ma, d);
  const ten = nguoiDangNhap ? nguoiDangNhap.ten : null;
  for(const v of NHIEM_VU){
    if(!_segViec.has(v.mada)) _segViec.set(v.mada, []);
    _segViec.get(v.mada).push(v);
    if(ten && v.nguoi.split(',').map(s=>s.trim()).includes(ten)) _setCoViec.add(v.mada);
  }
  for(const [ma, arr] of _segViec){
    const act = arr.filter(v=>!dangNgung(v));
    _cacheTD.set(ma, act.length ? Math.round(act.reduce((s,v)=>s+pctTrangThai(v.trangthai),0)/act.length) : 0);
  }
}
function timDA(ma){ return _mapDA.get(ma) || DU_AN.find(d=>d.ma===ma) || null; }
function tinhTienDo(mada){
  if(_cacheTD.has(mada)) return _cacheTD.get(mada);
  const viec = NHIEM_VU.filter(v => v.mada === mada && !dangNgung(v));
  if(viec.length === 0) return 0;
  return Math.round(viec.reduce((s,v)=>s+pctTrangThai(v.trangthai),0) / viec.length);
}
function chuanCot(tt){
  const COT = ['Chưa bắt đầu','Đang thực hiện / Chỉnh sửa','Trình duyệt KCS / TT','Hoàn thành'];
  if(COT.includes(tt)) return tt;
  const k = boDau(tt);
  if(k.includes('trinh duyet') || k.includes('cho duyet')) return 'Trình duyệt KCS / TT';
  if(k.includes('lam') || k.includes('thuc hien') || k.includes('chinh sua')) return 'Đang thực hiện / Chỉnh sửa';
  if(k.includes('hoan thanh') || k.includes('xong')) return 'Hoàn thành';
  return 'Chưa bắt đầu';
}
let toastTimer = null;
function baoToast(text, kieu, giuLai){
  const t = $('toast');
  t.textContent = text;
  t.className = (kieu || '') + ' show';
  clearTimeout(toastTimer);
  if(!giuLai) toastTimer = setTimeout(()=>{ t.className = t.className.replace('show','').trim(); }, 3200);
}
function khoaCuon(){ document.body.classList.add('khoa-cuon'); }
function moCuonNeuHetModal(){
  if(!document.querySelector('.modal-overlay:not([hidden])')) document.body.classList.remove('khoa-cuon');
}
function moOverlay(id){ dongCtx(); $(id).hidden = false; khoaCuon(); if(typeof khoaHanForm==='function') khoaHanForm(); }
function dongCtx(){ document.querySelectorAll('.context-menu').forEach(m=>m.classList.remove('show')); }

/* ====== Chuẩn hóa dữ liệu ====== */
function chuanHoaDong(row){
  const o = {}; for(const k in row) o[boDau(k)] = String(row[k] ?? '').trim();
  return {
    ma: o['ma'] || o['ma du an'] || o['ma da'] || '',
    ten: o['ten'] || o['ten du an'] || '',
    loai: o['loai'] || o['loai cong trinh'] || '',
    giaidoan: o['giai doan du an'] || o['giai doan'] || '',
    vaitro: o['vai tro'] || o['vai tro bim'] || '',
    phutrach: o['phu trach'] || o['nguoi phu trach'] || '',
    trangthai: o['trang thai'] || '',
    hannop: o['han nop'] || o['han'] || '',
    link: o['link'] || o['link portal'] || '#',
    leader: o['leader'] || o['leader du an'] || o['leader/quan ly'] || ''
  };
}
function chuanHoaViec(row){
  const o = {}; for(const k in row) o[boDau(k)] = String(row[k] ?? '').trim();
  return {
    uid: ++demUid,
    mada: o['ma du an'] || o['ma da'] || o['mada'] || o['ma'] || o['thuoc du an'] || '',
    phancap: o['phan cap'] || o['phancap'] || o['phan loai chi tiet'] || '',
    hangmuc: o['hang muc'] || o['hangmuc'] || o['phan loai'] || '',
    nhiemvu: o['nhiem vu'] || o['nhiemvu'] || o['noi dung cong viec'] || o['noi dung'] || '',
    nguoi: o['nguoi thuc hien'] || o['nguoi'] || o['nhan su'] || '',
    uutien: o['uu tien'] || o['uutien'] || '',
    han: o['han'] || o['han nop'] || o['deadline'] || '',
    trangthai: o['trang thai'] || 'Chưa bắt đầu',
    ghichu: o['ghi chu'] || o['ghichu'] || '',
    vuongmac: o['vuong mac'] || o['vuongmac'] || o['vuong mac / kho khan'] || '',
    tamngung: o['tam ngung'] || o['tamngung'] || o['tam ngung / hoan'] || '',
    lichsukcs: o['lich su kcs'] || o['lichsukcs'] || o['lich su'] || o['soat xet'] || o['lich su soat xet'] || ''
  };
}

/* ====== Tải dữ liệu (PA2: đọc TRỰC TIẾP qua Apps Script doGet — dữ liệu LIVE, không còn cache CSV) ====== */
/* Chỉ báo đồng bộ NHỎ, đặt ngay dưới nút "Cập nhật dữ liệu" — không đụng tới nội dung đang xem */
function chiBaoDongBo(hien){
  let el = $('dongBoNho');
  if(!el){
    const nut = $('nutLamMoi'); if(!nut) return;
    el = document.createElement('span');
    el.id = 'dongBoNho';
    el.className = 'loading';
    el.style.cssText = 'margin:6px 0 0;display:flex;align-items:center;justify-content:flex-end;gap:8px;font-size:11px;width:100%';
    el.innerHTML = 'Đang đồng bộ <span class="bar" style="width:70px;height:3px;margin:0"></span>';
    nut.insertAdjacentElement('afterend', el);   /* xuống dòng dưới nút trong .hd-sync */
  }
  el.style.display = hien ? 'flex' : 'none';
}
async function taiDuLieu(){
  if(!LINK_APPS_SCRIPT || LINK_APPS_SCRIPT.includes('DÁN_LINK')) return;
  const lanDau = DU_AN.length === 0;   /* lần đầu chưa có gì để hiện → loader toàn trang */
  if(lanDau) $('khuNoiDung').innerHTML = '<div class="loading">ĐANG ĐỒNG BỘ TRỰC TIẾP TỪ GOOGLE SHEETS<div class="bar"></div></div>';
  else chiBaoDongBo(true);             /* các lần sau: chỉ spinner nhỏ, giữ nguyên màn hình */
  try{
    /* 1 request lấy cả dự án + công việc, đọc thẳng từ Sheet sống (không qua link /pub bị cache) */
    const res = await fetch(noiCache(LINK_APPS_SCRIPT));
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const kq = await res.json();
    if(!kq || !kq.ok) throw new Error((kq && kq.loi) || 'Apps Script không trả dữ liệu');
    DU_AN    = (kq.duan    || []).map(chuanHoaDong).filter(d => d.ten || d.ma);
    NHIEM_VU = (kq.nhiemvu || []).map(chuanHoaViec).filter(v => v.mada && (v.nhiemvu || v.phancap || v.nguoi));
    if(DU_AN.length === 0) throw new Error('Không có dự án — kiểm tra tên tab và tiêu đề cột hàng 1');
    chonUids.clear();
    if(lanDau) $('khuNoiDung').innerHTML = '';
    $('lanDongBo').textContent = 'Đồng bộ lúc ' + new Date().toLocaleTimeString('vi-VN') + ' · ' + new Date().toLocaleDateString('vi-VN');
    dungBoLoc(); veDanhSach();
    if(!$('modalKanban').hidden) veKanban();
    if($('modalSoDo') && !$('modalSoDo').hidden) veSoDo();
    veViewPhu();
    if(!taiDuLieu._daTuChuyen){
      taiDuLieu._daTuChuyen = true;
      if(nguoiCuaToi) doiView('toi');   /* thành viên: vào thẳng việc của mình */
    }
  }catch(err){
    if(lanDau) $('khuNoiDung').innerHTML = '<div class="notice"><h2>⚠ Không tải được dữ liệu</h2><p>Chi tiết: <code>' + thoatHTML(err.message) + '</code></p><p>Kiểm tra: Apps Script đã <b>Triển khai bản MỚI</b> · "Ai có quyền truy cập" = <b>Bất kỳ ai</b> · đúng tên 2 tab. Rồi bấm ⟳ thử lại.</p></div>';
    else baoToast('✖ Cập nhật lỗi: ' + err.message + ' — giữ nguyên dữ liệu đang xem', 'err');
  }finally{
    chiBaoDongBo(false);
  }
}
function dungBoLoc(){
  const them = (sel, arr) => {
    const v = sel.value; sel.length = 1;
    [...new Set(arr.filter(Boolean))].sort().forEach(x => sel.add(new Option(x)));
    sel.value = v;
  };
  them($('locLoai'), DU_AN.map(d=>d.loai));
  them($('locGiaiDoan'), DU_AN.map(d=>d.giaidoan));
  them($('locTrangThai'), DU_AN.map(d=>d.trangthai));
  $('thanhCongCu').hidden = false; $('daiSoLieu').hidden = false;
}

/* ====== Vẽ danh sách dự án ====== */
function dongMeta(nhan, giaTri){
  const co = giaTri && giaTri !== '-';
  return '<span class="m-lbl">' + nhan + '</span><span class="m-val' + (co ? '' : ' trong') + '">' + (co ? thoatHTML(giaTri) : '—') + '</span>';
}
function veDanhSach(){
  chuanBiCache();
  const kw = boDau($('oTimKiem').value), l = $('locLoai').value, g = $('locGiaiDoan').value, t = $('locTrangThai').value, sx = $('sapXep').value;
  let ds = DU_AN.filter(d =>
    xemDuocDuAn(d.ma) &&
    (!kw || boDau(d.ten+' '+d.ma+' '+d.phutrach).includes(kw)) &&
    (!l || d.loai===l) && (!g || d.giaidoan===g) && (!t || d.trangthai===t)
  );
  ds.sort((a,b)=>{
    if(sx==='tiendo-asc') return tinhTienDo(a.ma) - tinhTienDo(b.ma);
    if(sx==='tiendo-desc') return tinhTienDo(b.ma) - tinhTienDo(a.ma);
    const na = docNgay(a.hannop), nb = docNgay(b.hannop);
    return (na?na.getTime():Infinity) - (nb?nb.getTime():Infinity);
  });

  $('stTong').textContent = ds.length;
  $('stTrienKhai').textContent = ds.filter(d => lopTrangThai(d.trangthai) === 'tt-chay').length;
  $('stTamNgung').textContent = ds.filter(d => lopTrangThai(d.trangthai) === 'tt-dung').length;
  const tong = ds.reduce((s,d)=>s+tinhTienDo(d.ma),0);
  $('stTienDo').textContent = (ds.length ? Math.round(tong/ds.length) : 0) + '%';
  $('stSapHan').textContent = ds.filter(d=>{ const n = soNgayConLai(docNgay(d.hannop)); return n !== null && n <= 15; }).length;
  $('thongBaoTrong').hidden = ds.length > 0;

  $('luoiDuAn').innerHTML = ds.map(d=>{
    const pct = tinhTienDo(d.ma);
    const cl = soNgayConLai(docNgay(d.hannop));
    const sv = NHIEM_VU.filter(v => v.mada === d.ma).length;
    let hn = '<div class="deadline">Hạn nộp: —</div>';
    if(cl !== null){
      if(cl < 0)        hn = '<div class="deadline qua-han">▲ QUÁ HẠN ' + (-cl) + ' ngày (' + thoatHTML(d.hannop) + ')</div>';
      else if(cl <= 15) hn = '<div class="deadline sap-han">● Còn ' + cl + ' ngày — hạn ' + thoatHTML(d.hannop) + '</div>';
      else              hn = '<div class="deadline con-han">○ Hạn nộp: ' + thoatHTML(d.hannop) + ' (còn ' + cl + ' ngày)</div>';
    } else if(d.hannop && d.hannop !== '-'){
      hn = '<div class="deadline">Hạn nộp: ' + thoatHTML(d.hannop) + '</div>';
    }
    return `
    <article class="card" data-ma="${thoatHTML(d.ma)}">
      <div class="card-top">
        <span class="card-ma">${thoatHTML(d.ma)}</span>
        <span class="badge ${lopBadge(d.loai)}">${thoatHTML(d.loai) || '—'}</span>
      </div>
      <h2>${thoatHTML(d.ten)}</h2>
      <div class="card-meta">
        ${dongMeta('Giai đoạn', d.giaidoan)}
        ${dongMeta('Vai trò', d.vaitro)}
        ${dongMeta('Phụ trách', d.phutrach)}
        ${d.leader ? dongMeta('Leader', d.leader) : ''}
        <span class="m-lbl">Trạng thái</span>
        <span>${d.trangthai ? '<span class="tt-chip ' + lopTrangThai(d.trangthai) + '">' + thoatHTML(d.trangthai) + '</span>' : '<span class="m-val trong">—</span>'}</span>
      </div>
      ${hn}
      <div class="prog">
        <div class="prog-head"><span>Tiến độ (theo việc hoàn thành)</span><span class="pct">${pct}%</span></div>
        <div class="prog-track"><div class="prog-fill" style="width:${pct}%"></div><div class="prog-dash"></div></div>
      </div>
      <div class="tasks-summary">
        <span class="tasks-title">${sv} công việc</span>
        <span style="display:flex;gap:6px">
          <button class="btn-kanban" type="button" data-mosodo="${thoatHTML(d.ma)}">▦ Sơ đồ</button>
          <button class="btn-kanban" type="button" data-mokanban="${thoatHTML(d.ma)}">Bảng việc →</button>
        </span>
      </div>
    </article>`;
  }).join('');
  if(typeof veCanhBao === 'function') veCanhBao();
}

/* ====== KANBAN ====== */
function veKanban(){
  if(!madaKanbanHienTai) return;
  let viecAll = NHIEM_VU.filter(v => v.mada === madaKanbanHienTai);

  /* Sắp xếp */
  const sortMode = $('k-sort-select').value;
  if(sortMode === 'han-asc'){
    viecAll = [...viecAll].sort((a,b)=>{
      const da = docNgay(a.han), db = docNgay(b.han);
      return (da?da.getTime():Infinity) - (db?db.getTime():Infinity);
    });
  } else if(sortMode === 'uutien-desc'){
    const diem = v => { const k = boDau(v); return k.includes('cao') ? 3 : k.includes('thap') ? 1 : 2; };
    viecAll = [...viecAll].sort((a,b)=>diem(b.uutien) - diem(a.uutien));
  }

  /* Chip lọc — data-attribute, an toàn mọi ký tự */
  const dhm = [...new Set(viecAll.map(v => v.hangmuc).filter(Boolean))];
  const dng = [...new Set(viecAll.flatMap(v => v.nguoi.split(',').map(s=>s.trim())).filter(Boolean))];
  const chip = (loai, val, nhan, act) =>
    '<button class="k-chip' + (act ? ' active' : '') + '" data-kf="' + loai + '" data-kv="' + thoatHTML(val ?? '') + '">' + thoatHTML(nhan) + '</button>';
  $('k-filter-hm').innerHTML = '<span class="k-filter-lbl">Hạng mục:</span>'
    + chip('hangmuc','','Tất cả',!kFilter.hangmuc)
    + dhm.map(f=>chip('hangmuc',f,f,kFilter.hangmuc===f)).join('');
  $('k-filter-nguoi').innerHTML = '<span class="k-filter-lbl">Nhân sự:</span>'
    + chip('nguoi','','Tất cả',!kFilter.nguoi)
    + dng.map(f=>chip('nguoi',f,f,kFilter.nguoi===f)).join('');

  document.querySelectorAll('.kanban-col').forEach(col=>{
    const tt = col.dataset.cot;
    const ds = viecAll.filter(v => chuanCot(v.trangthai) === tt)
      .filter(v => (!kFilter.hangmuc || v.hangmuc === kFilter.hangmuc)
                && (!kFilter.nguoi || v.nguoi.split(',').map(s=>s.trim()).includes(kFilter.nguoi)));
    col.querySelector('.k-count').textContent = '(' + ds.length + ')';
    col.querySelector('.k-list').innerHTML = ds.map(v => {
      const pStyle = boDau(v.uutien).includes('cao') ? 'color:var(--red);font-weight:600' : boDau(v.uutien).includes('thap') ? 'color:var(--line)' : 'color:var(--concrete)';
      return `
      <div class="k-card${chonUids.has(v.uid) ? ' k-selected' : ''}" draggable="true" data-uid="${v.uid}">
        <div class="k-card-top">
          ${v.phancap ? '<span class="k-badge">' + thoatHTML(v.phancap) + '</span>' : (v.hangmuc ? '<span class="k-badge">' + thoatHTML(v.hangmuc) + '</span>' : '<span></span>')}
          <span class="k-prio" style="${pStyle}">${thoatHTML(v.uutien || '')}</span>
          <button class="k-more" type="button" data-kmore="${v.uid}" title="Sửa / Xóa">⋯</button>
        </div>
        <div class="k-card-title">${thoatHTML(v.nhiemvu || tachCap(v.phancap).slice(-1)[0] || '(việc chưa đặt tên)')}</div>
        ${v.ghichu ? '<div class="k-note">' + thoatHTML(v.ghichu) + '</div>' : ''}
        <div class="k-card-meta">
          <span>👤 ${thoatHTML(v.nguoi)}</span>
          ${v.han && v.han !== '-' ? '<span style="color:var(--orange)">⏳ ' + thoatHTML(v.han) + '</span>' : ''}
        </div>
      </div>`;
    }).join('');
  });
}
const MSG_KANBAN_MACDINH = '💡 Chạm để chọn thẻ • Kéo thả nhiều thẻ cùng lúc • Chuột phải hoặc nút ⋯ để Sửa/Xóa';
function msgKanbanReset(tre){ setTimeout(()=>{ $('msgKanban').innerHTML = '<span style="color:var(--concrete)">' + MSG_KANBAN_MACDINH + '</span>'; }, tre || 3000); }

/* Chip lọc + sắp xếp */
document.querySelector('.kanban-tools').addEventListener('click', e=>{
  const c = e.target.closest('.k-chip');
  if(!c) return;
  kFilter[c.dataset.kf] = c.dataset.kv || null;
  veKanban();
});
$('k-sort-select').addEventListener('change', veKanban);

/* Chọn thẻ (giữ lựa chọn qua các lần vẽ lại nhờ chonUids) */
document.querySelector('.kanban-wrapper').addEventListener('click', e=>{
  if(e.target.closest('.k-more')) return;
  const card = e.target.closest('.k-card');
  if(!card) return;
  const uid = Number(card.dataset.uid);
  if(chonUids.has(uid)){ chonUids.delete(uid); card.classList.remove('k-selected'); }
  else { chonUids.add(uid); card.classList.add('k-selected'); }
});

/* Nút ⋯ trên thẻ — đường tắt Sửa/Xóa cho cả mobile (không có chuột phải) */
document.querySelector('.kanban-wrapper').addEventListener('click', e=>{
  const nut = e.target.closest('.k-more');
  if(!nut) return;
  e.stopPropagation();
  const uid = Number(nut.dataset.kmore);
  if(!chonUids.has(uid)){ chonUids.clear(); chonUids.add(uid); veKanban(); }
  ctxTaskUids = [...chonUids];
  const menu = $('taskContextMenu');
  const r = nut.getBoundingClientRect();
  menu.style.top = (r.bottom + window.scrollY + 4) + 'px';
  menu.style.left = Math.max(8, r.right + window.scrollX - 170) + 'px';
  menu.classList.add('show');
  $('ctx-t-edit').style.display = ctxTaskUids.length > 1 ? 'none' : 'flex';
});

/* Kéo thả — theo uid */
document.addEventListener('dragstart', e=>{
  const card = e.target.closest && e.target.closest('.k-card');
  if(!card) return;
  const uid = Number(card.dataset.uid);
  if(!chonUids.has(uid)){ chonUids.clear(); chonUids.add(uid); }
  keoUids = [...chonUids];
  if(e.dataTransfer) e.dataTransfer.setData('text/plain', String(uid));
  setTimeout(()=>{ document.querySelectorAll('.k-card.k-selected').forEach(c=>c.classList.add('k-dragging')); }, 0);
});
document.addEventListener('dragend', ()=>{
  document.querySelectorAll('.k-card.k-dragging').forEach(c=>c.classList.remove('k-dragging'));
});
document.querySelectorAll('.kanban-col').forEach(col=>{
  col.addEventListener('dragover', e=>e.preventDefault());
  col.addEventListener('drop', e=>{ e.preventDefault(); thaThe(col.dataset.cot); });
});

async function thaThe(trangThaiMoi){
  const uids = [...keoUids]; keoUids = [];
  if(!uids.length || !madaKanbanHienTai) return;
  const canDoi = uids.map(u => NHIEM_VU.find(v => v.uid === u))
                     .filter(v => v && chuanCot(v.trangthai) !== trangThaiMoi);
  if(!canDoi.length){ chonUids.clear(); veKanban(); return; }

  /* Lấy mã xác nhận TRƯỚC khi đổi giao diện */
  let mk = maXacNhanCache;
  if(!mk){
    mk = prompt('Di chuyển ' + canDoi.length + ' công việc. Nhập mã xác nhận của phòng:');
    if(!mk){ chonUids.clear(); veKanban(); return; }
  }

  /* Lưu trạng thái cũ để hoàn tác nếu lỗi */
  const cu = canDoi.map(v => ({uid: v.uid, tt: v.trangthai}));
  canDoi.forEach(v => v.trangthai = trangThaiMoi);
  chonUids.clear();
  veKanban();
  $('msgKanban').innerHTML = '<span style="color:var(--orange)">⏳ Đang lưu ' + canDoi.length + ' cập nhật lên Sheets...</span>';

  try{
    /* MỘT request hàng loạt — không còn race condition */
    const res = await fetch(LINK_APPS_SCRIPT, {
      method:'POST',
      body: JSON.stringify({ type:'sua_trangthai_nhiemvu', matkhau: mk,
        data:{ mada: madaKanbanHienTai, trangthai: trangThaiMoi,
               items: canDoi.map(v => ({nhiemvu: v.nhiemvu, nguoi: v.nguoi, phancap: v.phancap})) } })
    });
    const kq = await res.json();
    if(kq.ok){
      nhoMaTrongPhien(mk); chamHoatDong(); lanGhiCuoi = Date.now();
      $('msgKanban').innerHTML = '<span style="color:var(--green)">✔ Đã lưu ' + (kq.soluong ?? canDoi.length) + ' cập nhật!</span>';
      baoToast('✓ Đã lưu ' + (kq.soluong ?? canDoi.length) + ' cập nhật', 'ok');
      veDanhSach();
      msgKanbanReset();
    } else {
      throw new Error(kq.loi || 'Lỗi không xác định');
    }
  }catch(err){
    cu.forEach(c => { const v = NHIEM_VU.find(x=>x.uid===c.uid); if(v) v.trangthai = c.tt; });
    veKanban();
    baoToast('✖ ' + err.message, 'err');
    msgKanbanReset(100);
  }
}

/* ====== Menu chuột phải ====== */
document.addEventListener('contextmenu', e=>{
  const infoUid = thePhanCong(e.target);
  if(infoUid){
    e.preventDefault(); e.stopPropagation();
    moFormSuaViec(infoUid);
    return;
  }
  const kCard = e.target.closest('.k-card');
  if(kCard){
    e.preventDefault(); e.stopPropagation();
    const uid = Number(kCard.dataset.uid);
    if(!chonUids.has(uid)){ chonUids.clear(); chonUids.add(uid); veKanban(); }
    ctxTaskUids = [...chonUids];
    const menu = $('taskContextMenu');
    menu.style.top = e.pageY + 'px'; menu.style.left = e.pageX + 'px';
    menu.classList.add('show');
    $('ctx-t-edit').style.display = ctxTaskUids.length > 1 ? 'none' : 'flex';
    return;
  }
  const pCard = e.target.closest('.card');
  if(pCard){
    e.preventDefault(); e.stopPropagation();
    ctxProjectMa = pCard.dataset.ma;
    const d = DU_AN.find(x => x.ma === ctxProjectMa);
    const menu = $('projectContextMenu');
    menu.style.top = e.pageY + 'px'; menu.style.left = e.pageX + 'px';
    menu.classList.add('show');
    $('ctx-p-portal').style.display = (d && d.link && d.link !== '#' && d.link !== '-') ? 'flex' : 'none';
  }
});
document.addEventListener('click', e=>{
  if(!e.target.closest('.context-menu')) dongCtx();
});

/* --- Menu dự án --- */
$('ctx-p-portal').onclick = () => {
  dongCtx();
  const d = DU_AN.find(x => x.ma === ctxProjectMa);
  if(d) window.open(d.link, '_blank', 'noopener');
};
$('ctx-p-edit').onclick = () => {
  dongCtx();
  const d = DU_AN.find(x => x.ma === ctxProjectMa); if(!d) return;
  maDangSua = d.ma;
  $('tieuDeFormDA').textContent = '✎ Chỉnh sửa: ' + d.ma;
  $('guiDuAn').textContent = 'Lưu thay đổi';
  $('da-ma').value = d.ma; $('da-ten').value = d.ten; $('da-loai').value = d.loai;
  $('da-giaidoan').value = d.giaidoan; $('da-vaitro').value = d.vaitro;
  setMultiSelect('da-phutrach', d.phutrach); setMultiSelect('da-leader', d.leader || '');
  apQuyenFormDuAn();
  $('da-trangthai').value = d.trangthai || 'Đang triển khai';
  const fp = document.querySelector('#da-hannop')._flatpickr;
  if(fp) fp.setDate(d.hannop === '-' ? '' : d.hannop, false, 'd/m/Y'); else $('da-hannop').value = d.hannop === '-' ? '' : d.hannop;
  $('da-link').value = (d.link === '-' || d.link === '#') ? '' : d.link;
  $('da-matkhau').value = maXacNhanCache;
  $('msgDuAn').textContent = '';
  moOverlay('modalDuAn');
};
$('ctx-p-del').onclick = async () => {
  dongCtx();
  const ma = ctxProjectMa; if(!ma) return;
  let mk = maXacNhanCache || prompt('Nhập mã xác nhận của phòng để XÓA dự án:');
  if(!mk) return;
  if(!confirm('Xóa hẳn dự án "' + ma + '" khỏi Sheets?\nHành động này không thể hoàn tác!')) return;
  baoToast('⏳ Đang xóa dự án...');
  try{
    const res = await fetch(LINK_APPS_SCRIPT, {
      method:'POST', body: JSON.stringify({ type:'xoaduan', matkhau: mk, data:{ magoc: ma } })
    });
    const kq = await res.json();
    if(kq.ok){
      nhoMaTrongPhien(mk); chamHoatDong(); lanGhiCuoi = Date.now();
      DU_AN = DU_AN.filter(d => d.ma !== ma);
      NHIEM_VU = NHIEM_VU.filter(v => v.mada !== ma);   /* dọn cả việc của dự án */
      veDanhSach(); dungBoLoc();
      baoToast('✔ Đã xóa dự án ' + ma, 'ok');
    } else {
      baoToast('✖ ' + (kq.loi || 'Không xóa được'), 'err');
    }
  }catch(err){ baoToast('✖ Không gửi được: ' + err.message, 'err'); }
};

/* --- Menu công việc --- */
function moFormSuaViec(uid){
  const nv = NHIEM_VU.find(v => v.uid === uid); if(!nv) return;
  uidDangSua = nv.uid;
  gocDangSua = { mada: nv.mada, nvgoc: nv.nhiemvu, nguoigoc: nv.nguoi, phancapgoc: nv.phancap || '' };
  if($('xoaViec')) $('xoaViec').hidden = false;
  $('tieuDeFormCV').textContent = '✎ Chỉnh sửa công việc';
  $('guiViec').textContent = 'Lưu cập nhật';
  $('cv-mada').value = nv.mada;
  $('cv-phancap').value = nv.phancap || '';
  $('cv-nhiemvu').value = nv.nhiemvu;
  datNguoiForm(nv.nguoi);
  apQuyenFormViec(nv.mada);
  $('cv-uutien').value = ['Cao','Trung bình','Thấp'].includes(nv.uutien) ? nv.uutien : 'Trung bình';
  const fp = document.querySelector('#cv-han')._flatpickr;
  if(fp) fp.setDate(nv.han === '-' ? '' : nv.han, false, 'd/m/Y'); else $('cv-han').value = nv.han === '-' ? '' : nv.han;
  $('cv-trangthai').value = chuanCot(nv.trangthai);
  $('cv-ghichu').value = nv.ghichu || '';
  $('cv-vuongmac').value = nv.vuongmac || '';
  $('cv-tamngung').value = nv.tamngung || '';
  $('cv-matkhau').value = maXacNhanCache;
  $('msgViec').textContent = '';
  moOverlay('modalViec');
}
$('ctx-t-edit').onclick = () => {
  dongCtx();
  if(ctxTaskUids.length !== 1) return;
  moFormSuaViec(ctxTaskUids[0]);
};
$('ctx-t-del').onclick = async () => {
  dongCtx();
  if(!ctxTaskUids.length) return;
  const items = ctxTaskUids.map(u => NHIEM_VU.find(v => v.uid === u)).filter(Boolean);
  if(!items.length) return;
  let mk = maXacNhanCache || prompt('XÓA ' + items.length + ' công việc.\nNhập mã xác nhận của phòng:');
  if(!mk) return;
  if(!confirm('Xóa vĩnh viễn ' + items.length + ' công việc này khỏi Sheets?')) return;
  $('msgKanban').innerHTML = '<span style="color:var(--orange)">⏳ Đang xóa...</span>';
  try{
    /* MỘT request — script xóa từ dưới lên, không lệch dòng */
    const res = await fetch(LINK_APPS_SCRIPT, {
      method:'POST',
      body: JSON.stringify({ type:'xoanhiemvu', matkhau: mk,
        data:{ mada: madaKanbanHienTai, items: items.map(v => ({nhiemvu: v.nhiemvu, nguoi: v.nguoi, phancap: v.phancap})) } })
    });
    const kq = await res.json();
    if(kq.ok){
      nhoMaTrongPhien(mk); chamHoatDong(); lanGhiCuoi = Date.now();
      const xoaUids = new Set(items.map(v=>v.uid));
      NHIEM_VU = NHIEM_VU.filter(v => !xoaUids.has(v.uid));
      chonUids.clear();
      veKanban(); veDanhSach();
      $('msgKanban').innerHTML = '<span style="color:var(--green)">✔ Đã xóa ' + (kq.soluong ?? items.length) + ' việc!</span>';
      msgKanbanReset();
    } else {
      $('msgKanban').innerHTML = '';
      baoToast('✖ ' + (kq.loi || 'Không xóa được'), 'err');
      msgKanbanReset(100);
    }
  }catch(err){
    baoToast('✖ Không gửi được: ' + err.message, 'err');
    msgKanbanReset(100);
  }
};

/* ====== Gửi dữ liệu (dùng chung cho form) ====== */
async function guiLenSheets(type, data, matkhau, msgEl, nutEl){
  msgEl.className = 'modal-msg'; msgEl.textContent = 'Đang ghi...';
  nutEl.disabled = true;
  try{
    const res = await fetch(LINK_APPS_SCRIPT, { method:'POST', body: JSON.stringify({type, matkhau, data}) });
    const kq = await res.json();
    if(kq.ok){ msgEl.className = 'modal-msg ok'; return true; }
    msgEl.className = 'modal-msg err';
    msgEl.textContent = '✖ ' + (kq.loi || 'Lỗi không xác định');
    return false;
  }catch(err){
    msgEl.className = 'modal-msg err';
    msgEl.textContent = '✖ Không gửi được: ' + err.message;
    return false;
  }finally{ nutEl.disabled = false; }
}

/* ====== Đóng modal ====== */
document.querySelectorAll('[data-dong]').forEach(b=>{
  b.addEventListener('click', e=>{ e.target.closest('.modal-overlay').hidden = true; moCuonNeuHetModal(); if(typeof dongBoQuyen==='function') dongBoQuyen(); });
});
document.querySelectorAll('.modal-overlay').forEach(ov=>{
  ov.addEventListener('click', e=>{ if(e.target===ov && ov.id!=='modalDangNhap'){ ov.hidden = true; moCuonNeuHetModal(); if(typeof dongBoQuyen==='function') dongBoQuyen(); } });
});

/* ====== Multi-select nhân sự (khôi phục) ====== */
function taoMultiSelect(containerId, inputId){
  const c = $(containerId);
  if(!c) return;
  let html = '<div class="ms-header"><span id="' + inputId + '-text" style="opacity:0.6">Chọn nhân sự...</span> <span style="font-size:10px">▼</span></div><div class="ms-options">';
  TEN_NHAN_SU.forEach(name => {
    html += '<label><input type="checkbox" value="' + thoatHTML(name) + '" class="' + inputId + '-cb"> ' + thoatHTML(name) + '</label>';
  });
  html += '</div><input type="hidden" id="' + inputId + '">';
  c.innerHTML = html;
  c.querySelector('.ms-header').addEventListener('click', function(){ this.nextElementSibling.classList.toggle('open'); });
  const cbs = c.querySelectorAll('.' + inputId + '-cb');
  cbs.forEach(cb => cb.addEventListener('change', () => {
    const sel = Array.from(cbs).filter(x => x.checked).map(x => x.value);
    $(inputId).value = sel.join(', ');
    $(inputId + '-text').textContent = sel.length ? sel.join(', ') : 'Chọn nhân sự...';
    $(inputId + '-text').style.opacity = sel.length ? '1' : '0.6';
  }));
}
function setMultiSelect(inputId, valString){
  const vals = (valString || '').split(',').map(s=>s.trim());
  const cbs = document.querySelectorAll('.' + inputId + '-cb');
  cbs.forEach(cb => cb.checked = vals.includes(cb.value));
  const sel = Array.from(cbs).filter(x => x.checked).map(x => x.value);
  $(inputId).value = sel.join(', ');
  const txt = $(inputId + '-text');
  if(txt){
    txt.textContent = sel.length ? sel.join(', ') : 'Chọn nhân sự...';
    txt.style.opacity = sel.length ? '1' : '0.6';
  }
}
document.addEventListener('click', e=>{
  document.querySelectorAll('.ms-wrapper').forEach(w=>{
    if(!w.contains(e.target)){
      const opt = w.querySelector('.ms-options');
      if(opt) opt.classList.remove('open');
    }
  });
});

/* ====== Nút & form ====== */
$('luoiDuAn').addEventListener('click', e=>{
  const nutSoDo = e.target.closest('[data-mosodo]');
  if(nutSoDo){ moSoDo(nutSoDo.dataset.mosodo); return; }
  const nutKanban = e.target.closest('[data-mokanban]');
  if(!nutKanban) return;
  madaKanbanHienTai = nutKanban.dataset.mokanban;
  datQuyenTheoDuAn(madaKanbanHienTai);
  $('kanbanTitle').textContent = 'BẢNG CÔNG VIỆC: ' + madaKanbanHienTai;
  kFilter = { hangmuc: null, nguoi: null };
  chonUids.clear();
  $('k-sort-select').value = 'macdinh';
  veKanban();
  moOverlay('modalKanban');
});

$('nutThemDuAn').addEventListener('click', ()=>{
  maDangSua = null;
  $('tieuDeFormDA').textContent = '➕ Thêm dự án mới';
  $('guiDuAn').textContent = 'Ghi vào Sheets';
  ['da-ma','da-ten','da-loai','da-giaidoan','da-vaitro','da-link'].forEach(id=>$(id).value='');
  const fp = document.querySelector('#da-hannop')._flatpickr; if(fp) fp.clear(); else $('da-hannop').value = '';
  setMultiSelect('da-phutrach', ''); setMultiSelect('da-leader', '');
  apQuyenFormDuAn();
  $('da-matkhau').value = maXacNhanCache;
  $('msgDuAn').textContent = '';
  moOverlay('modalDuAn');
});

$('btnGiaoViecKanban').addEventListener('click', ()=>{
  uidDangSua = null; gocDangSua = null;
  if($('xoaViec')) $('xoaViec').hidden = true;
  $('tieuDeFormCV').textContent = '🗒 Khai báo công việc';
  $('guiViec').textContent = 'Ghi vào Sheets';
  $('cv-mada').value = madaKanbanHienTai || '';
  ['cv-phancap','cv-nhiemvu','cv-ghichu','cv-vuongmac','cv-tamngung'].forEach(id=>$(id).value='');
  $('cv-uutien').value = 'Trung bình';
  $('cv-trangthai').value = 'Chưa bắt đầu';
  const fp = document.querySelector('#cv-han')._flatpickr; if(fp) fp.clear(); else $('cv-han').value = '';
  datNguoiForm('');
  apQuyenFormViec(madaKanbanHienTai || '');
  $('cv-matkhau').value = maXacNhanCache;
  $('msgViec').textContent = '';
  moOverlay('modalViec');
});

$('guiDuAn').addEventListener('click', async ()=>{
  const v = id => $(id).value.trim();
  const msg = $('msgDuAn');
  if(!v('da-ma') || !v('da-ten') || !v('da-phutrach')){ msg.className='modal-msg err'; msg.textContent='✖ Điền đủ Mã, Tên, Phụ trách'; return; }
  const duLieu = {
    magoc: maDangSua || '',
    ma:v('da-ma'), ten:v('da-ten'), loai:v('da-loai'), giaidoan:v('da-giaidoan'),
    vaitro:v('da-vaitro'), tiendo: tinhTienDo(maDangSua || v('da-ma')),
    phutrach:v('da-phutrach'), trangthai:v('da-trangthai'), hannop:v('da-hannop')||'-', link:v('da-link')||'-',
    leader:v('da-leader')
  };
  const ok = await guiLenSheets(maDangSua ? 'suaduan' : 'duan', duLieu, maGui(), msg, $('guiDuAn'));
  if(ok){
    lanGhiCuoi = Date.now();
    const moi = {...duLieu}; delete moi.magoc;
    if(maDangSua){
      const i = DU_AN.findIndex(d => d.ma === maDangSua);
      if(i > -1){
        DU_AN[i] = moi;
        if(maDangSua !== moi.ma) NHIEM_VU.forEach(x=>{ if(x.mada===maDangSua) x.mada = moi.ma; });
      }
      msg.textContent = '✔ Đã lưu!';
      setTimeout(()=>{ $('modalDuAn').hidden = true; moCuonNeuHetModal(); }, 900);
    } else {
      DU_AN.push(moi);
      msg.textContent = '✔ Đã thêm!';
      ['da-ma','da-ten','da-giaidoan','da-link'].forEach(id=>$(id).value='');
      const fp = document.querySelector('#da-hannop')._flatpickr; if(fp) fp.clear();
      setMultiSelect('da-phutrach', ''); setMultiSelect('da-leader', '');
    }
    veDanhSach(); dungBoLoc();
  }
});

/* Xóa công việc — chỉ leader (gác bằng MÃ LEADER), đặt xa nút Lưu để tránh bấm nhầm */
if($('xoaViec')) $('xoaViec').addEventListener('click', async ()=>{
  if(!gocDangSua) return;
  if(!confirm('Xóa hẳn công việc này khỏi Sheets? Không thể hoàn tác.')) return;
  let mk = maGui(); if(!mk){ baoToast('✖ Hãy đăng nhập lại','err'); return; }
  const g = gocDangSua, msg = $('msgViec');
  msg.className='modal-msg'; msg.textContent='Đang xóa...';
  try{
    const res = await fetch(LINK_APPS_SCRIPT, { method:'POST', body: JSON.stringify({
      type:'xoanhiemvu', matkhau: mk,
      data:{ mada: g.mada, items:[{ nhiemvu: g.nvgoc, nguoi: g.nguoigoc, phancap: g.phancapgoc }] } }) });
    const kq = await res.json();
    if(kq.ok){
      nhoMaTrongPhien(mk); chamHoatDong(); lanGhiCuoi = Date.now();
      NHIEM_VU = NHIEM_VU.filter(x=> !(x.mada===g.mada && (x.nhiemvu||'')===(g.nvgoc||'') && x.nguoi===g.nguoigoc && (x.phancap||'')===(g.phancapgoc||'')));
      baoToast('🗑 Đã xóa công việc','ok');
      $('modalViec').hidden = true; moCuonNeuHetModal();
      veViewPhu(); veDanhSach(); if(!$('modalKanban').hidden) veKanban();
    } else { msg.className='modal-msg err'; msg.textContent='✖ '+(kq.loi||'Lỗi'); }
  }catch(err){ msg.className='modal-msg err'; msg.textContent='✖ '+err.message; }
});

$('guiViec').addEventListener('click', async ()=>{
  const v = id => $(id).value.trim();
  const msg = $('msgViec');
  if(!v('cv-mada')){ msg.className='modal-msg err'; msg.textContent='✖ Thiếu mã dự án — đóng form và mở lại từ bảng công việc'; return; }
  if((!v('cv-phancap') && !v('cv-nhiemvu')) || !v('cv-nguoi-chinh')){ msg.className='modal-msg err'; msg.textContent='✖ Cần Phân cấp (hoặc Nội dung) và Người thực hiện'; return; }
  if(!v('cv-matkhau')){ msg.className='modal-msg err'; msg.textContent='✖ Nhập mã xác nhận của phòng'; return; }

  const dangSua = !!gocDangSua;
  const nvHienTai = dangSua ? (NHIEM_VU.find(x => x.uid === uidDangSua)
      || NHIEM_VU.find(x => x.mada===gocDangSua.mada && (x.nhiemvu||'')===(gocDangSua.nvgoc||'') && x.nguoi===gocDangSua.nguoigoc && (x.phancap||'')===(gocDangSua.phancapgoc||''))) : null;
  const duLieuViec = {
    mada:v('cv-mada'), phancap:v('cv-phancap'), hangmuc:(nvHienTai?(nvHienTai.hangmuc||''):''), nhiemvu:v('cv-nhiemvu'), nguoi:ghepNguoi(),
    uutien:v('cv-uutien'), han:v('cv-han')||'-', trangthai:v('cv-trangthai'), ghichu:v('cv-ghichu'), vuongmac:v('cv-vuongmac'), tamngung:v('cv-tamngung')
  };
  if(dangSua){
    duLieuViec.magoc = gocDangSua.mada;
    duLieuViec.nvgoc = gocDangSua.nvgoc;
    duLieuViec.nguoigoc = gocDangSua.nguoigoc;   /* danh tính gốc đã chụp lúc mở form */
    duLieuViec.phancapgoc = gocDangSua.phancapgoc || '';
  }
  if(dangSua){
    /* === SỬA: phản hồi TỨC THÌ — áp vào bộ nhớ, đóng form ngay, ghi lên Sheets ở NỀN === */
    const mk = maGui();
    const nvGoc = NHIEM_VU.find(x => x.uid === uidDangSua)
      || NHIEM_VU.find(x => x.mada===gocDangSua.mada && (x.nhiemvu||'')===(gocDangSua.nvgoc||'') && x.nguoi===gocDangSua.nguoigoc && (x.phancap||'')===(gocDangSua.phancapgoc||''));
    if(!nvGoc){ msg.className='modal-msg err'; msg.textContent='✖ Không tìm thấy công việc — bấm ⟳ rồi mở lại'; return; }
    const banCu = Object.assign({}, nvGoc);            /* lưu để hoàn tác nếu lỗi */
    const giuUid = nvGoc.uid;
    const {magoc, nvgoc, nguoigoc, phancapgoc, ...choBoNho} = duLieuViec;  /* bỏ trường gốc khỏi bộ nhớ */
    Object.assign(nvGoc, choBoNho, {uid: giuUid});     /* áp thay đổi ngay */

    /* đóng form + vẽ lại NGAY, không chờ máy chủ */
    $('modalViec').hidden = true; moCuonNeuHetModal();
    veDanhSach(); if(!$('modalKanban').hidden) veKanban(); veViewPhu();
    baoToast('✔ Đã lưu — đang đồng bộ…', 'ok');

    const hoanTac = (loi)=>{
      const nv2 = NHIEM_VU.find(x=>x.uid===giuUid); if(nv2) Object.assign(nv2, banCu);
      veDanhSach(); if(!$('modalKanban').hidden) veKanban(); veViewPhu();
      baoToast('✖ Chưa lưu được: '+loi+'. Mở lại và sửa.', 'err');
    };
    fetch(LINK_APPS_SCRIPT, { method:'POST', body: JSON.stringify({ type:'suanhiemvu', matkhau:mk, data:duLieuViec }) })
      .then(r=>r.json())
      .then(kq=>{ if(kq && kq.ok){ nhoMaTrongPhien(mk); chamHoatDong(); lanGhiCuoi = Date.now(); }
                  else hoanTac((kq && kq.loi) || 'lỗi'); })
      .catch(()=> hoanTac('mất kết nối'));
    return;
  }

  /* === THÊM MỚI: giữ luồng chờ máy chủ rồi mới thêm vào danh sách === */
  const ok = await guiLenSheets('nhiemvu', duLieuViec, maGui(), msg, $('guiViec'));
  if(ok){
    nhoMaTrongPhien(maGui()); chamHoatDong(); lanGhiCuoi = Date.now();
    NHIEM_VU.push({ uid: ++demUid, ...duLieuViec });
    msg.textContent = '✔ Đã giao việc!';
    ['cv-phancap','cv-nhiemvu','cv-ghichu','cv-vuongmac','cv-tamngung'].forEach(id=>$(id).value='');
    const fp = document.querySelector('#cv-han')._flatpickr; if(fp) fp.clear();
    datNguoiForm('');
    veDanhSach(); if(!$('modalKanban').hidden) veKanban(); veViewPhu();
  }
});

/* ====== Bộ lọc & khởi tạo ====== */
$('oTimKiem').addEventListener('input', veDanhSach);
['locLoai','locGiaiDoan','locTrangThai','sapXep'].forEach(id=>$(id).addEventListener('change', veDanhSach));
$('nutLamMoi').addEventListener('click', taiDuLieu);

taoMultiSelect('ms-phutrach-container', 'da-phutrach');
taoMultiSelect('ms-leader-container', 'da-leader');
/* Người chính (select) + Hỗ trợ (multi-select) */
(function(){
  const sel = $('cv-nguoi-chinh');
  if(sel && typeof TEN_NHAN_SU!=='undefined'){
    TEN_NHAN_SU.forEach(n=> sel.add(new Option(n, n)));
  }
  taoMultiSelect('ms-nguoiho-container', 'cv-nguoiho');
})();
function ghepNguoi(){
  const c = ($('cv-nguoi-chinh').value || '').trim();
  const h = ($('cv-nguoiho') ? $('cv-nguoiho').value : '') || '';
  const arr = [c].concat(h.split(',').map(s=>s.trim())).filter(Boolean);
  return [...new Set(arr)].join(', ');
}
function datNguoiForm(nguoiStr){
  const parts = (nguoiStr||'').split(',').map(s=>s.trim()).filter(Boolean);
  $('cv-nguoi-chinh').value = parts[0] || '';
  setMultiSelect('cv-nguoiho', parts.slice(1).join(', '));
}

try{
  const fpConfig = {
    locale: 'vn', dateFormat: 'd/m/Y', allowInput: true,
    onReady: function(dObj, dStr, fp){
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'flatpickr-today-btn'; btn.textContent = '🎯 Chọn hôm nay';
      btn.onclick = function(){ fp.setDate(new Date()); fp.close(); };
      fp.calendarContainer.appendChild(btn);
    }
  };
  flatpickr('#da-hannop', fpConfig);
  flatpickr('#cv-han', fpConfig);
}catch(e){ /* thiếu CDN thì gõ tay dd/mm/yyyy vẫn dùng được */ }

/* ===== Khóa chỉnh DEADLINE — chỉ leader (khóa ở giao diện) ===== */
let leaderMoKhoa = false, _henXoaLeader = null;
function chamLeader(){
  if(!leaderMoKhoa) return;
  if(_henXoaLeader) clearTimeout(_henXoaLeader);
  _henXoaLeader = setTimeout(()=>{ leaderMoKhoa = false; khoaHanForm(); }, 30*60*1000);  /* 30' không hoạt động */
}
['pointerdown','keydown'].forEach(ev=>document.addEventListener(ev, chamLeader, {passive:true}));
function khoaHanForm(){
  ['da-hannop','cv-han'].forEach(id=>{
    const inp = document.getElementById(id); if(!inp) return;
    const fp = inp._flatpickr;
    if(fp) fp.set('clickOpens', leaderMoKhoa);
    inp.readOnly = !leaderMoKhoa;
    inp.classList.toggle('han-khoa', !leaderMoKhoa);
  });
  document.querySelectorAll('.nut-mo-han').forEach(b=>{
    b.textContent = leaderMoKhoa ? '🔓 Hạn đang mở — bấm để khóa' : '🔒 Đổi hạn (leader)';
    b.classList.toggle('mo', leaderMoKhoa);
  });
}
document.querySelectorAll('.nut-mo-han').forEach(b=>b.addEventListener('click', ()=>{
  if(leaderMoKhoa){ leaderMoKhoa = false; if(_henXoaLeader) clearTimeout(_henXoaLeader); khoaHanForm(); return; }
  leaderMoKhoa = true; chamLeader(); khoaHanForm();
  baoToast('🔓 Đã mở để chỉnh deadline','ok');
}));
khoaHanForm();   /* trạng thái ban đầu: khóa */

try{
  MobileDragDrop.polyfill({ dragImageTranslateOverride: MobileDragDrop.scrollBehaviourDragImageTranslateOverride });
  window.addEventListener('touchmove', function(){}, {passive:false});
}catch(e){ /* mobile dùng nút ⋯ thay kéo thả */ }

try{
  const sw = $('checkboxTheme');
  if(localStorage.getItem('theme') === 'dark'){ document.documentElement.setAttribute('data-theme','dark'); sw.checked = true; }
  sw.addEventListener('change', e=>{
    const t = e.target.checked ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', t);
    try{ localStorage.setItem('theme', t); }catch(x){}
  });
}catch(x){}


/* ============================================================
   MÀN HÌNH PHỤ: "Bảng tổng hợp" (cây phân cấp) & "Việc của tôi"
   ============================================================ */
let viewHienTai = 'duan';                 /* duan | tonghop | toi */
let nguoiCuaToi = '';                     /* tên đang lọc ở "Việc của tôi" */
const moNhanh = new Set();                /* các nhánh đang mở trong cây */
try{ nguoiCuaToi = localStorage.getItem('nguoiCuaToi') || ''; }catch(e){}

/* % theo trạng thái 1 việc */
function pctTrangThai(tt){
  const c = chuanCot(tt);
  if(c === 'Hoàn thành') return 100;
  if(c === 'Trình duyệt KCS / TT') return 90;
  if(c === 'Đang thực hiện / Chỉnh sửa') return 50;
  return 0;   /* chưa bắt đầu */
}
function mauPct(p){ return p>=100 ? 'var(--green)' : p>0 ? 'var(--amber)' : 'var(--concrete)'; }

/* ============================================================
   SƠ ĐỒ TỔNG QUAN DỰ ÁN — tự dựng từ cột Phân cấp
   Phân mục = tầng 1 · Cột = tầng chọn (mặc định sâu nhất) · Dòng = các tầng giữa
   ============================================================ */
let _sodoMada = null;
function mauSoDo(p){ if(p<=0) return null; if(p<50) return 'var(--red)'; if(p<100) return 'var(--amber)'; return 'var(--green)'; }
function oSoDo(p){
  if(p===null||p===undefined) return '<div></div>';
  const c=mauSoDo(p), fill=c?'<div style="height:100%;width:'+Math.min(p,100)+'%;background:'+c+';border-radius:3px"></div>':'';
  return '<div style="display:flex;align-items:center;gap:5px;min-width:0"><span style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;width:30px;flex-shrink:0;color:var(--concrete)">'+Math.round(p)+'%</span><div style="flex:1;height:9px;background:var(--paper);border:1px solid var(--line);border-radius:3px;overflow:hidden;min-width:0">'+fill+'</div></div>';
}
function chipPctNhom(s){
  let tot=0,cnt=0; Object.values(s.map).forEach(a=>a.forEach(v=>{tot+=v;cnt++;}));
  const p=cnt?Math.round(tot/cnt):0;
  return '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:12px;color:'+(mauSoDo(p)||'var(--concrete)')+'">'+p+'%</span>';
}
function moSoDo(mada){
  _sodoMada = mada;
  const d = DU_AN.find(x=>x.ma===mada);
  $('sdTitle').textContent = 'Sơ đồ tổng quan: ' + (d && d.ten ? d.ten + ' (' + mada + ')' : mada);
  let ct='auto'; try{ ct = localStorage.getItem('sodo_ct_'+mada) || 'auto'; }catch(e){}
  if($('sd-ct')) $('sd-ct').value = ct;
  const leg=[['Chưa (0%)','var(--line)'],['<50%','var(--red)'],['50–99%','var(--amber)'],['100%','var(--green)']];
  $('sd-legend').innerHTML = leg.map(x=>'<span style="display:inline-flex;align-items:center;gap:4px"><span style="width:13px;height:8px;border-radius:3px;background:'+x[1]+';display:inline-block"></span>'+x[0]+'</span>').join('');
  veSoDo();
  moOverlay('modalSoDo');
}
function veSoDo(){
  if(!_sodoMada || !$('sd-noidung')) return;
  const items = NHIEM_VU.filter(v => v.mada===_sodoMada && !dangNgung(v))
    .map(v => ({ segs: tachCap(v.phancap), pct: pctTrangThai(v.trangthai) }))
    .filter(x => x.segs.length >= 1);
  const deepest = items.reduce((m,x)=>Math.max(m,x.segs.length),0) || 1;
  const sel = $('sd-ct') ? $('sd-ct').value : 'auto';
  const ct = sel==='auto' ? deepest : Math.min(+sel, deepest);
  if($('sd-info')) $('sd-info').textContent = items.length ? ('sâu nhất '+deepest+' tầng · cột = tầng '+ct) : '';
  const order=[], S={};
  items.forEach(x=>{
    const sec = x.segs[0] || '(không phân mục)';
    let col, itemSegs;
    if(x.segs.length>=ct){ col=x.segs[ct-1]; itemSegs=x.segs.slice(1,ct-1); }
    else { col='(tổng)'; itemSegs=x.segs.slice(1); }
    const item = itemSegs.join(' / ') || '(toàn mục)';
    if(!S[sec]){ S[sec]={cols:[],items:[],map:{}}; order.push(sec); }
    const s=S[sec];
    if(!s.cols.includes(col)) s.cols.push(col);
    if(!s.items.includes(item)) s.items.push(item);
    const k=item+'|'+col; (s.map[k]=s.map[k]||[]).push(x.pct);
  });
  if(!order.length){ $('sd-noidung').innerHTML = '<div class="th-empty">Dự án chưa có công việc để dựng sơ đồ.</div>'; return; }
  order.sort(soSanhTuNhien);
  let h='', code=64;
  order.forEach(sec=>{
    code++; const s=S[sec], n=s.cols.length;
    const labels = (n===1 && s.cols[0]==='(tổng)') ? ['Tiến độ'] : s.cols;
    s.items.sort(soSanhTuNhien);
    const gs='display:grid;grid-template-columns:repeat('+n+',1fr);gap:8px;flex:1;min-width:0';
    h+='<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:rgba(232,93,4,.08);border-top:2px solid var(--ink)"><span style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;font-weight:700;color:var(--orange);width:16px;text-align:right">'+String.fromCharCode(code)+'</span><span style="font-family:\'Saira Condensed\',sans-serif;font-weight:700;font-size:15px;text-transform:uppercase">'+thoatHTML(sec)+'</span><span style="flex:1"></span>'+chipPctNhom(s)+'</div>';
    h+='<div style="display:flex;gap:8px;padding:3px 10px;background:var(--paper)"><span style="width:16px;flex-shrink:0"></span><span style="width:150px;flex-shrink:0"></span><div style="'+gs+'">'+labels.map(l=>'<span style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;text-transform:uppercase;color:var(--concrete);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+thoatHTML(l)+'</span>').join('')+'</div></div>';
    s.items.forEach((it,i)=>{
      const cells = s.cols.map(c=>{ const a=s.map[it+'|'+c]; return oSoDo(a? Math.round(a.reduce((p,q)=>p+q,0)/a.length): null); }).join('');
      h+='<div style="display:flex;align-items:center;gap:8px;padding:5px 10px;border-top:1px solid var(--line)"><span style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:var(--concrete);width:16px;flex-shrink:0;text-align:right">'+(i+1)+'</span><span style="width:150px;flex-shrink:0;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+thoatHTML(it)+'">'+thoatHTML(it)+'</span><div style="'+gs+'">'+cells+'</div></div>';
    });
  });
  $('sd-noidung').innerHTML = h;
}
if($('sd-ct')) $('sd-ct').addEventListener('change', ()=>{
  if(_sodoMada){ try{ localStorage.setItem('sodo_ct_'+_sodoMada, $('sd-ct').value); }catch(e){} }
  veSoDo();
});

/* Chuyển màn hình */
function doiView(v){
  viewHienTai = v;
  document.querySelectorAll('.view-tab').forEach(b=>b.classList.toggle('active', b.dataset.view===v));
  $('luoiDuAn').style.display      = v==='duan' ? '' : 'none';
  $('thongBaoTrong').style.display = v==='duan' ? '' : 'none';
  $('thanhCongCu').style.display   = v==='duan' ? '' : 'none';
  $('viewTongHop').hidden = v!=='tonghop';
  $('viewToi').hidden     = v!=='toi';
  veViewPhu();
}
function veViewPhu(){
  if(viewHienTai==='tonghop') veTongHop();
  else if(viewHienTai==='toi') veViecCuaToi();
}

/* ---------- BẢNG TỔNG HỢP (cây) ----------
   - Phân cấp chia bằng dấu "/" → các cấp của cây.
   - Nội dung công việc (nhiemvu) KHÔNG phải một cấp; chỉ là ghi chú tùy chọn
     gắn vào nút cuối cùng của đường dẫn phân cấp.
   - Mỗi việc gắn vào node ở cuối đường dẫn (node.viec). Việc không có phân cấp
     gắn thẳng dưới mã dự án (nhóm "Chưa phân loại" hiển thị bằng tên việc nếu có). */
function tachCap(s){ return String(s||'').split('/').map(x=>x.trim()).filter(Boolean); }
function dungCay(){
  const root = {ten:'', con:new Map(), viec:[], key:''};
  NHIEM_VU.forEach(v=>{
    if(!xemDuocDuAn(v.mada)) return;   /* mục 5: ẩn dự án không tham gia */
    const segs = [v.mada].concat(tachCap(v.phancap));
    let node = root, key='';
    segs.forEach(seg=>{
      key += '/' + seg;
      if(!node.con.has(seg)) node.con.set(seg, {ten:seg, con:new Map(), viec:[], key:key});
      node = node.con.get(seg);
    });
    node.viec.push(v);           /* gắn việc vào node cuối đường dẫn */
  });
  return root;
}
/* Tìm node trong cây theo key (đường dẫn) */
function timNodeTheoKey(node, key){
  if(node.key === key) return node;
  for(const c of node.con.values()){ const r = timNodeTheoKey(c, key); if(r) return r; }
  return null;
}
/* Mở tất cả nhánh con/cháu (trong subtree) chứa việc thỏa điều kiện fn → để lộ đúng các việc đó.
   Trả về true nếu subtree có ít nhất 1 việc thỏa. */
function moNhanhTheoDieuKien(node, fn){
  let co = node.viec.some(fn);
  node.con.forEach(c=>{ if(moNhanhTheoDieuKien(c, fn)) co = true; });
  if(co) moNhanh.add(node.key);
  return co;
}
/* tất cả việc nằm trong 1 nhánh (kể cả con cháu) */
let _caySub = new WeakMap();
function viecCuaNhanh(node){
  if(_caySub.has(node)) return _caySub.get(node);
  let arr = node.viec.slice();
  node.con.forEach(c=> arr = arr.concat(viecCuaNhanh(c)));
  _caySub.set(node, arr);
  return arr;
}
function pctCay(node){
  const vs = viecCuaNhanh(node).filter(v=>!dangNgung(v));
  if(!vs.length) return 0;
  return Math.round(vs.reduce((s,v)=>s+pctTrangThai(v.trangthai),0) / vs.length);
}
function nhanhKhop(node, fNguoi, fText){
  return viecCuaNhanh(node).some(v=>vietKhop(v, fNguoi, fText));
}
function vietKhop(v, fNguoi, fText){
  if(window._anXongCay && chuanCot(v.trangthai)==='Hoàn thành') return false;
  const okN = !fNguoi || v.nguoi.split(',').map(s=>s.trim()).includes(fNguoi);
  const okT = !fText || boDau(v.mada+' '+(v.phancap||'')+' '+v.nhiemvu+' '+v.nguoi).includes(fText);
  return okN && okT;
}
function veTongHop(){
  chuanBiCache();
  const fNguoi = $('thNguoi').value;
  const fText = boDau($('thTim').value);
  window._anXongCay = $('thAnXong') && $('thAnXong').getAttribute('aria-pressed')==='true';
  const root = dungCay();
  /* Mặc định: gập hết — chỉ hiện cấp 1 (tên dự án). Người dùng tự mở nhánh khi cần. */
  /* Khi bộ lọc VỪA thay đổi: tự mở các nhánh có kết quả (chỉ 1 lần), sau đó cho đóng/mở tay */
  const chuKyLoc = fNguoi + '\u0001' + fText;
  if(veTongHop._locTruoc !== chuKyLoc){
    veTongHop._locTruoc = chuKyLoc;
    if(fNguoi || fText){
      (function moKhop(node){
        node.con.forEach(c=>{
          if(nhanhKhop(c, fNguoi, fText)){ moNhanh.add(c.key); moKhop(c); }
        });
      })(root);
    }
  }
  const out = [];

  function dongLa(ten, v, depth){
    const p = pctTrangThai(v.trangthai);
    const pad = 10 + depth*18;
    const ghichu = '';   /* mục 5: không hiện Nội dung công việc */
    const vm = v.vuongmac ? '<span class="th-vm" title="'+thoatHTML(v.vuongmac)+'">⚠</span>' : '';
    const tn = dangNgung(v) ? '<span class="th-tn" title="Tạm ngưng: '+thoatHTML(v.tamngung)+'">⏸</span>' : '';
    const htCo = (fNguoi && vaiTroNguoi(v, fNguoi)==='ho') ? '<span class="badge-ht" title="'+thoatHTML(fNguoi)+' là người hỗ trợ (chính: '+thoatHTML(nguoiChinhCua(v))+')">🤝 HT</span>' : '';
    const ql = quanLyDuoc(v.mada);
    return '<div class="th-row th-leaf'+(v.vuongmac?' co-vm':'')+(dangNgung(v)?' co-tn':'')+'"'+(ql?' data-cbuid="'+v.uid+'"':'')+'>'
      + '<span class="th-ten" style="padding-left:'+pad+'px"><span class="th-ico"></span>'+vm+tn+htCo+thoatHTML(ten)+ghichu+'</span>'
      + '<span class="th-c-tt"'+(ql?' data-ttpick="'+v.uid+'" title="Bấm để đổi trạng thái"':'')+'>'+(ql?chipTrangThaiNho(v.trangthai):'')+'</span>'
      + '<span class="th-c-ng">'+hienNguoi(v.nguoi)+'</span>'
      + '<span class="th-c-pct"><span class="th-bar"><span class="th-fill" style="width:'+p+'%;background:'+mauPct(p)+'"></span></span><span class="th-pct" style="color:'+mauPct(p)+'">'+p+'%</span></span></div>';
  }
  function dongNhanh(c, depth){
    const p = pctCay(c);
    const pad = 10 + depth*18;
    const soViec = viecCuaNhanh(c).length;
    let tenHien = c.ten;
    if(depth===0){
      const da = DU_AN.find(d=>d.ma===c.ten);
      if(da && da.ten) tenHien = da.ten + ' (' + c.ten + ')';
    }
    const cb = demCanhBaoNhanh(c);
    const tags = (cb.tre?'<span class="tag-tre th-mo-canhbao" data-mo-cb="tre" data-mo-key="'+thoatHTML(c.key)+'" style="cursor:pointer" title="Bấm để sổ '+cb.tre+' việc trễ hạn">🔴 '+cb.tre+'</span>':'')
               + (cb.vm?'<span class="tag-vm th-mo-canhbao" data-mo-cb="vm" data-mo-key="'+thoatHTML(c.key)+'" style="cursor:pointer" title="Bấm để sổ '+cb.vm+' việc vướng mắc">⚠ '+cb.vm+'</span>':'');
    return '<div class="th-row th-br'+(depth===0?' th-lv0':'')+'" data-mo="'+thoatHTML(c.key)+'">'
      + '<span class="th-ten" style="padding-left:'+pad+'px;font-weight:600"><span class="th-ico">▸</span>'+thoatHTML(tenHien)+tags+'</span>'
      + '<span class="th-c-tt"></span>'
      + '<span class="th-c-ng th-dem">'+soViec+' việc</span>'
      + '<span class="th-c-pct"><span class="th-bar"><span class="th-fill" style="width:'+p+'%;background:'+mauPct(p)+'"></span></span><span class="th-pct" style="color:'+mauPct(p)+'">'+p+'%</span></span></div>';
  }
  function walk(node, depth){
    [...node.con.values()].sort((a,b)=>soSanhTuNhien(a.ten,b.ten)).forEach(c=>{
      if(!nhanhKhop(c, fNguoi, fText)) return;
      const soCon = c.con.size;
      const soViec = c.viec.length;
      /* Lá thuần: không có nhánh con, đúng 1 việc → hiện tên cấp + trạng thái */
      if(soCon===0 && soViec===1){
        if(vietKhop(c.viec[0], fNguoi, fText)) out.push(dongLa(c.ten, c.viec[0], depth));
        return;
      }
      /* Nhánh: có con, hoặc nhiều việc cùng cấp */
      out.push(dongNhanh(c, depth));
      if(moNhanh.has(c.key)){
        walk(c, depth+1);                                   /* nhánh con */
        c.viec.slice().sort((a,b)=>soSanhTuNhien(a.nhiemvu,b.nhiemvu)).forEach(v=>{   /* việc gắn trực tiếp */
          if(vietKhop(v, fNguoi, fText))
            out.push(dongLa(v.nhiemvu || '(việc chưa đặt tên)', v, depth+1));
        });
      }
    });
  }
  walk(root, 0);
  $('thCay').innerHTML = out.join('') || '<div class="th-empty">Chưa có công việc nào khớp.</div>';
  $('thCay').querySelectorAll('.th-br').forEach(r=>{
    const ico = r.querySelector('.th-ico');
    if(ico) ico.textContent = moNhanh.has(r.dataset.mo) ? '▾' : '▸';
  });
  if($('thNguoi').dataset.loaded !== '1'){
    const ds = [...new Set(NHIEM_VU.flatMap(v=>v.nguoi.split(',').map(s=>s.trim())).filter(Boolean))].sort();
    ds.forEach(n=>$('thNguoi').add(new Option(n,n)));
    $('thNguoi').dataset.loaded = '1';
  }
}
function chipTrangThaiNho(tt){
  const c = chuanCot(tt);
  let col='var(--concrete)', t='Chưa';
  if(c==='Hoàn thành'){ col='var(--green)'; t='Xong'; }
  else if(c==='Trình duyệt KCS / TT'){ col='var(--orange)'; t='Duyệt'; }
  else if(c==='Đang thực hiện / Chỉnh sửa'){ col='var(--amber)'; t='Đang'; }
  return '<span class="th-chip" style="color:'+col+';border-color:'+col+'">'+t+'</span>';
}
$('thCay').addEventListener('click', e=>{
  if(_lpFired){ _lpFired=false; return; }
  /* Bấm tag ⚠ / 🔴 trên nhánh: sổ hết các nhánh con để lộ đúng việc đó */
  const tag = e.target.closest('.th-mo-canhbao');
  if(tag){
    e.stopPropagation();
    const key = tag.dataset.moKey, loai = tag.dataset.moCb;
    const node = timNodeTheoKey(dungCay(), key);
    if(node){
      const dk = loai==='tre'
        ? (v=> viecDangTreHan(v) && xemViecCanhBao(v))
        : (v=> v.vuongmac && String(v.vuongmac).trim());
      moNhanh.add(key);                 /* giữ chính nhánh này mở */
      moNhanhTheoDieuKien(node, dk);     /* mở các nhánh con chứa việc thỏa */
      veTongHop();
    }
    return;
  }
  const la = e.target.closest('.th-leaf');
  if(la && la.dataset.cbuid){ e.stopPropagation(); moMenuTrangThai(Number(la.dataset.cbuid), e.clientX, e.clientY); return; }
  const r = e.target.closest('.th-br'); if(!r) return;   /* nhánh: gập/mở */
  const k = r.dataset.mo;
  if(moNhanh.has(k)) moNhanh.delete(k); else moNhanh.add(k);
  veTongHop();
});
$('thTim').addEventListener('input', veTongHop);
$('thNguoi').addEventListener('change', veTongHop);
$('thMoTatCa').addEventListener('click', ()=>{
  (function w(n){ n.con.forEach(c=>{ if(c.con.size || c.viec.length>1){ moNhanh.add(c.key); w(c);} }); })(dungCay());
  veTongHop();
});
$('thGapTatCa').addEventListener('click', ()=>{ moNhanh.clear(); veTongHop(); });
if($('thAnXong')){
  try{ const on = localStorage.getItem('anXongCay')==='1'; $('thAnXong').setAttribute('aria-pressed', on?'true':'false'); $('thAnXong').classList.toggle('on', on); }catch(e){}
  $('thAnXong').addEventListener('click', ()=>{
    const on = $('thAnXong').getAttribute('aria-pressed')!=='true';
    $('thAnXong').setAttribute('aria-pressed', on?'true':'false');
    $('thAnXong').classList.toggle('on', on);
    try{ localStorage.setItem('anXongCay', on?'1':'0'); }catch(e){}
    veTongHop();
  });
}

/* ---------- VIỆC CỦA TÔI ---------- */
let cheDoToi = 'list';   /* list | cay */
let sapXepToi = 'tiendo-asc';
const moNhanhToi = new Set();
try{ cheDoToi = localStorage.getItem('cheDoToi') || 'list'; }catch(e){}
try{ sapXepToi = localStorage.getItem('sapXepToi') || 'tiendo-asc'; }catch(e){}

function sapXepDuAn(maList, viecTheoDA){
  const tienDoDA = ma => {
    const vs = viecTheoDA[ma].filter(v=>!dangNgung(v)); if(!vs.length) return 0;
    return vs.reduce((s,v)=>s+pctTrangThai(v.trangthai),0)/vs.length;
  };
  const uutienDA = ma => {
    const rank = {'Cao':3,'Trung bình':2,'Thấp':1};
    return Math.max(...viecTheoDA[ma].map(v=>rank[v.uutien]||2));
  };
  const arr = maList.slice();
  if(sapXepToi==='tiendo-asc') arr.sort((a,b)=>tienDoDA(a)-tienDoDA(b));
  else if(sapXepToi==='tiendo-desc') arr.sort((a,b)=>tienDoDA(b)-tienDoDA(a));
  else if(sapXepToi==='uutien') arr.sort((a,b)=>uutienDA(b)-uutienDA(a));
  else arr.sort();
  return arr;
}

function veViecCuaToi(){
  chuanBiCache();
  const selT = $('toiNguoi');
  const scope = nguoiDangNhap ? (nguoiDangNhap.ten+'|'+nguoiDangNhap.role) : '';
  if(selT.dataset.scope !== scope){
    let ds;
    if(laAdmin()){
      ds = [...new Set((typeof TEN_NHAN_SU!=='undefined'?TEN_NHAN_SU:[])
        .concat(NHIEM_VU.flatMap(v=>v.nguoi.split(',').map(s=>s.trim()))).filter(Boolean))].sort();
    } else if(laQuanLyChung()){
      const set = new Set(nguoiDangNhap ? [nguoiDangNhap.ten] : []);
      NHIEM_VU.forEach(v=>{ if(laLeaderCuaDuAn(v.mada)) v.nguoi.split(',').map(s=>s.trim()).forEach(n=>{ if(n) set.add(n); }); });
      ds = [...set].sort();
    } else {
      ds = nguoiDangNhap ? [nguoiDangNhap.ten] : [];
    }
    selT.innerHTML = '<option value="">— Chọn tên —</option>';
    ds.forEach(n=>selT.add(new Option(n,n)));
    selT.dataset.scope = scope;
    if(nguoiCuaToi && ds.includes(nguoiCuaToi)) selT.value = nguoiCuaToi;
    else if(nguoiDangNhap){ selT.value = nguoiDangNhap.ten; }
  }
  if($('toiCheDo')){ $('toiCheDo').dataset.mode = cheDoToi; $('toiCheDo').innerHTML = (cheDoToi==='cay' ? '🌳 Cây dự án' : '☰ Danh sách'); }
  const anXongToi = $('toiAnXong') && $('toiAnXong').getAttribute('aria-pressed')==='true';
  if($('toiSapXep')) $('toiSapXep').value = sapXepToi;
  /* nút mở/gập chỉ hiện khi xem dạng cây */
  if($('toiMoTatCa')) $('toiMoTatCa').hidden = (cheDoToi!=='cay');
  if($('toiGapTatCa')) $('toiGapTatCa').hidden = (cheDoToi!=='cay');
  /* mục 2: thành viên chỉ xem việc của chính mình; leader/admin được chọn người khác */
  const quanLyChung = laQuanLyChung();
  if(!quanLyChung && nguoiDangNhap){ selT.value = nguoiDangNhap.ten; }
  selT.disabled = !quanLyChung;
  selT.title = quanLyChung ? '' : 'Chỉ leader/quản trị mới xem được việc của người khác';
  nguoiCuaToi = selT.value;
  const wrap = $('toiNoiDung');
  if(!nguoiCuaToi){ wrap.innerHTML = '<div class="th-empty">Chọn tên bạn ở trên để xem việc được giao.</div>'; if($('toiLocDA')) $('toiLocDA').innerHTML='<option value="">Tất cả dự án</option>'; return; }

  let viec = NHIEM_VU.filter(v => v.nguoi.split(",").map(s=>s.trim()).includes(nguoiCuaToi) && xemDuocViecTab3(v.mada));
  if(!viec.length){ wrap.innerHTML = '<div class="th-empty">Không có việc nào giao cho '+thoatHTML(nguoiCuaToi)+'.</div>'; if($('toiLocDA')) $('toiLocDA').innerHTML='<option value="">Tất cả dự án</option>'; return; }

  /* phát hiện việc MỚI chưa xem (1 lần/phiên cho mỗi người) */
  if(veViecCuaToi._moiNguoi !== nguoiCuaToi){
    veViecCuaToi._moiNguoi = nguoiCuaToi;
    veViecCuaToi._moi = new Set();
    try{
      const key = 'daXem:'+nguoiCuaToi;
      const daXem = new Set(JSON.parse(localStorage.getItem(key) || '[]'));
      viec.forEach(v=>{ if(!daXem.has(idViec(v))) veViecCuaToi._moi.add(idViec(v)); });
      const tatCa = viec.map(idViec);
      localStorage.setItem(key, JSON.stringify(tatCa));   /* đánh dấu đã xem cho lần sau */
    }catch(e){ veViecCuaToi._moi = new Set(); }
  }

  /* nạp bộ lọc dự án theo các dự án người này có việc */
  const selDA = $('toiLocDA');
  if(selDA){
    const giuLai = selDA.value;
    const maDS = [...new Set(viec.map(v=>v.mada))].sort();
    selDA.innerHTML = '<option value="">Tất cả dự án</option>'
      + maDS.map(ma=>{ const d=DU_AN.find(x=>x.ma===ma); return '<option value="'+thoatHTML(ma)+'"'+(d?' title="'+thoatHTML(d.ten)+'"':'')+'>'+thoatHTML(ma)+'</option>'; }).join('');
    if(maDS.includes(giuLai)) selDA.value = giuLai;
    if(selDA.value) viec = viec.filter(v=>v.mada===selDA.value);
    if(!viec.length){ wrap.innerHTML = '<div class="th-empty">Không có việc trong dự án đã lọc.</div>'; return; }
  }

  const theoDA = {};
  viec.forEach(v=>{ (theoDA[v.mada] = theoDA[v.mada] || []).push(v); });
  const ngung = viec.filter(v=>dangNgung(v)).length;
  const conLai = viec.filter(v=>!dangNgung(v));
  const xong = conLai.filter(v=>chuanCot(v.trangthai)==='Hoàn thành').length;
  const dang = conLai.filter(v=>['Đang thực hiện / Chỉnh sửa','Trình duyệt KCS / TT'].includes(chuanCot(v.trangthai))).length;
  const chua = conLai.length - xong - dang;

  let html = '<div class="toi-tom"><span><b>'+viec.length+'</b> việc</span>'
    + '<span style="color:var(--concrete)">'+chua+' chưa</span>'
    + '<span style="color:var(--amber)">'+dang+' đang</span>'
    + '<span style="color:var(--green)">'+xong+' xong</span>'
    + (ngung?'<span style="color:var(--concrete)">⏸ '+ngung+' tạm ngưng</span>':'')+'</div>';

  const dsMa = sapXepDuAn(Object.keys(theoDA), theoDA);

  if(cheDoToi === 'cay'){
    /* ----- Chế độ CÂY theo dự án ----- */
    dsMa.forEach(ma=>{
      const da = DU_AN.find(d=>d.ma===ma);
      const vs = theoDA[ma];
      const vsHien = anXongToi ? vs.filter(v=>chuanCot(v.trangthai)!=='Hoàn thành') : vs;
      if(!vsHien.length) return;   /* cả dự án đã xong & đang ẩn */
      const vsTinh = vs.filter(v=>!dangNgung(v));
      const pDA = vsTinh.length ? Math.round(vsTinh.reduce((s,v)=>s+pctTrangThai(v.trangthai),0)/vsTinh.length) : 0;
      html += '<div class="toi-da-row" data-mato="'+thoatHTML(ma)+'">'
        + '<span class="toi-da-ten">'+( moNhanhToi.has(ma)?'▾':'▸' )+' '+thoatHTML(ma)+(da?' — '+thoatHTML(da.ten):'')+'</span>'
        + '<span class="toi-da-bar"><span style="width:'+pDA+'%;background:'+mauPct(pDA)+'"></span></span>'
        + '<span class="toi-da-pct" style="color:'+mauPct(pDA)+'">'+pDA+'%</span></div>';
      if(!moNhanhToi.has(ma)) return;
      /* dựng cây phân cấp trong dự án */
      const root = {con:new Map(), viec:[], key:ma};
      vsHien.forEach(v=>{
        let node=root, key=ma;
        tachCap(v.phancap).forEach(seg=>{ key+='/'+seg;
          if(!node.con.has(seg)) node.con.set(seg,{ten:seg,con:new Map(),viec:[],key:key});
          node=node.con.get(seg); });
        node.viec.push(v);
      });
      (function walk(node, depth){
        [...node.con.values()].sort((a,b)=>soSanhTuNhien(a.ten,b.ten)).forEach(c=>{
          const soCon=c.con.size, soViec=c.viec.length;
          if(soCon===0 && soViec===1){ html += dongLaToi(c.ten, c.viec[0], depth); return; }
          const vsB = viecTrong(c).filter(v=>!dangNgung(v));
          const p = vsB.length ? Math.round(vsB.reduce((s,v)=>s+pctTrangThai(v.trangthai),0)/vsB.length) : 0;
          html += '<div class="th-row th-br" data-moto="'+thoatHTML(c.key)+'">'
            + '<span class="th-ten" style="padding-left:'+(10+depth*18)+'px;font-weight:600"><span class="th-ico">'+(moNhanhToi.has(c.key)?'▾':'▸')+'</span>'+thoatHTML(c.ten)+'</span>'
            + '<span class="th-c-tt"></span><span class="th-c-ng th-dem">'+soViec+' việc</span>'
            + '<span class="th-c-pct"><span class="th-bar"><span class="th-fill" style="width:'+p+'%;background:'+mauPct(p)+'"></span></span><span class="th-pct" style="color:'+mauPct(p)+'">'+p+'%</span></span></div>';
          if(moNhanhToi.has(c.key)){ walk(c, depth+1); c.viec.slice().sort((a,b)=>soSanhTuNhien(a.nhiemvu,b.nhiemvu)).forEach(v=>{ html += dongLaToi(tachCap(v.phancap).slice(-1)[0]||v.nhiemvu||'(việc)', v, depth+1); }); }
        });
      })(root, 1);
    });
  } else {
    /* ----- Chế độ DANH SÁCH: gom theo độ khẩn ----- */
    const nhom = { tre:[], tuan:[], xa:[], xong:[], ngung:[] };
    viec.forEach(v=>{
      if(dangNgung(v)){ nhom.ngung.push(v); return; }   /* tạm ngưng tách riêng */
      if(chuanCot(v.trangthai)==='Hoàn thành'){ nhom.xong.push(v); return; }
      const n = soNgayConLai(docNgay(v.han));
      if(n!==null && n<0) nhom.tre.push(v);
      else if(n!==null && n<=7) nhom.tuan.push(v);
      else nhom.xa.push(v);
    });
    /* trong mỗi nhóm: trễ nhiều/đến hạn sớm lên đầu, rồi ưu tiên cao */
    const rankUt = {'Cao':3,'Trung bình':2,'Thấp':1};
    const sapNhom = arr => arr.sort((a,b)=>{
      const na=soNgayConLai(docNgay(a.han)), nb=soNgayConLai(docNgay(b.han));
      const va = na===null?9999:na, vb = nb===null?9999:nb;
      if(va!==vb) return va-vb;
      return (rankUt[b.uutien]||2)-(rankUt[a.uutien]||2);
    });
    sapNhom(nhom.tre); sapNhom(nhom.tuan); sapNhom(nhom.xa);

    const veNhom = (title, cls, arr, moMacDinh) => {
      if(!arr.length) return '';
      const moKey = 'nhom:'+cls;
      const mo = moMacDinh ? !moNhanhToi.has('dong:'+cls) : moNhanhToi.has(moKey);
      let h = '<div class="toi-nhom '+cls+'" data-nhom="'+cls+'" data-modef="'+(moMacDinh?1:0)+'">'
        + '<span>'+(mo?'▾':'▸')+' '+title+'</span><span class="toi-nhom-so">'+arr.length+'</span></div>';
      if(mo) h += arr.map(v=>dongViecToi(v)).join('');
      return h;
    };
    html += veNhom('🔴 Đã trễ hạn','tre',nhom.tre,true);
    html += veNhom('🟠 Trong tuần này','tuan',nhom.tuan,true);
    html += veNhom('⚪ Còn xa / chưa có hạn','xa',nhom.xa,true);
    if(!anXongToi) html += veNhom('✓ Đã hoàn thành','xong',nhom.xong,false);
    html += veNhom('⏸ Tạm ngưng','ngung',nhom.ngung,false);
  }
  wrap.innerHTML = html;
}
/* 1 dòng việc ở "Việc của tôi" — pill chạm để xoay trạng thái + cờ vướng mắc */
function idViec(v){ return v.mada+'|'+(v.phancap||'')+'|'+(v.nhiemvu||'')+'|'+v.nguoi; }
function laMoi(v){ return veViecCuaToi._moi && veViecCuaToi._moi.has(idViec(v)); }
function dongViecToi(v){
  const capArr = tachCap(v.phancap);
  const capCuoi = capArr.slice(-1)[0] || '';
  const tenViec = v.nhiemvu || capCuoi || '(việc chưa đặt tên)';
  /* Nội dung có sẵn → hiện full phân cấp; trống (đã lấy level cuối làm tên) → bỏ level cuối khỏi đường dẫn */
  const duongHt = (v.nhiemvu ? capArr : capArr.slice(0, -1)).join(' / ');
  const duong = duongHt ? '<div class="toi-path"><i>'+thoatHTML(duongHt)+'</i></div>' : '';
  const da = DU_AN.find(d=>d.ma===v.mada);
  const maChip = '<span class="toi-ma" title="'+thoatHTML(da&&da.ten?da.ten:v.mada)+'">'+thoatHTML(v.mada)+'</span>';
  const c = chuanCot(v.trangthai);
  let pillTxt='Chưa', pillCol='var(--concrete)';
  if(c==='Hoàn thành'){ pillTxt='Xong'; pillCol='var(--green)'; }
  else if(c==='Trình duyệt KCS / TT'){ pillTxt='Duyệt'; pillCol='var(--orange)'; }
  else if(c==='Đang thực hiện / Chỉnh sửa'){ pillTxt='Đang'; pillCol='var(--amber)'; }
  const vm = v.vuongmac ? '<div class="toi-vm">⚠ '+thoatHTML(v.vuongmac)+'</div>' : '';
  const dongNghiep = (v.nguoi||'').split(',').map(s=>s.trim()).filter(Boolean).filter(n=>n!==nguoiCuaToi);
  const vaiTro = vaiTroNguoi(v, nguoiCuaToi);
  const badgeHT = vaiTro==='ho' ? '<span class="badge-ht" title="Bạn là người hỗ trợ. Phụ trách chính: '+thoatHTML(nguoiChinhCua(v))+'">🤝 Hỗ trợ</span>' : '';
  const cung = dongNghiep.length ? '<span class="toi-cung" title="Cùng làm việc này">👥 '+thoatHTML(dongNghiep.join(', '))+'</span>' : '';
  const tn = dangNgung(v) ? '<div class="toi-tn">⏸ Tạm ngưng'+(String(v.tamngung).trim()&&String(v.tamngung).trim()!=='1'?': '+thoatHTML(v.tamngung):'')+'</div>' : '';
  const hanTxt = (v.han && v.han!=='-') ? '<span class="toi-han">⏳ '+thoatHTML(v.han)+'</span>' : '';
  return '<div class="toi-viec'+(v.vuongmac?' co-vm':'')+(dangNgung(v)?' co-tn':'')+'" data-uid="'+v.uid+'">'
    + '<div class="toi-noidung">'
      + '<div class="toi-dong1">'+maChip
      + (laMoi(v)?'<span class="badge-moi">• Mới</span>':'') + badgeHT
      + '<span class="toi-tenviec">'+thoatHTML(tenViec)+'</span>'+hanTxt+cung+'</div>'
      + duong + vm + tn + '</div>'
    + '<button class="toi-pill" type="button" data-ttpick="'+v.uid+'" style="color:'+pillCol+';border-color:'+pillCol+'" title="Bấm để đổi trạng thái">'+pillTxt+'</button>'
    + '<button class="toi-vm-nut'+(v.vuongmac?' on':'')+'" type="button" data-vm="'+v.uid+'" title="Báo/gỡ vướng mắc">⚠</button>'
    + '<button class="toi-ls-nut" type="button" data-ls="'+v.uid+'" title="Lịch sử / Soát xét">💬'+(soLichSu(v)?'<span class="ls-dem">'+soLichSu(v)+'</span>':'')+'</button>'
    + '<button class="toi-tn-nut'+(dangNgung(v)?' on':'')+'" type="button" data-tn="'+v.uid+'" title="'+(dangNgung(v)?'Tiếp tục công việc':'Tạm ngưng công việc')+'">'+(dangNgung(v)?'▶':'⏸')+'</button></div>';
}
function viecTrong(node){ return viecCuaNhanh(node); }
function viecDangTreHan(v){ if(dangNgung(v) || chuanCot(v.trangthai)==='Hoàn thành') return false; const n=soNgayConLai(docNgay(v.han)); return n!==null && n<0; }
function xemViecCanhBao(v){ return laAdmin() || laLeaderCuaDuAn(v.mada) || (!!nguoiDangNhap && v.nguoi.split(',').map(s=>s.trim()).includes(nguoiDangNhap.ten)); }
function demCanhBaoNhanh(node){
  let tre=0, vm=0;
  viecTrong(node).forEach(v=>{
    if(!xemViecCanhBao(v)) return;
    if(viecDangTreHan(v)) tre++;
    if(v.vuongmac && String(v.vuongmac).trim()) vm++;
  });
  return {tre, vm};
}
function dongLaToi(ten, v, depth){
  const p = pctTrangThai(v.trangthai);
  const ghichu = '';   /* mục 5: không hiện Nội dung công việc */
  const vm = v.vuongmac ? '<span class="th-vm" title="'+thoatHTML(v.vuongmac)+'">⚠</span>' : '';
  const tn = dangNgung(v) ? '<span class="th-tn" title="Tạm ngưng: '+thoatHTML(v.tamngung)+'">⏸</span>' : '';
  const ht = vaiTroNguoi(v, nguoiCuaToi)==='ho' ? '<span class="badge-ht" title="Hỗ trợ. Chính: '+thoatHTML(nguoiChinhCua(v))+'">🤝</span>' : '';
  return '<div class="th-row th-leaf'+(dangNgung(v)?' co-tn':'')+'" data-cbuid="'+v.uid+'">'
    + '<span class="th-ten" style="padding-left:'+(10+depth*18)+'px"><span class="th-ico"></span>'+(laMoi(v)?'<span class="badge-moi">• Mới</span>':'')+vm+tn+ht+thoatHTML(ten)+ghichu+'</span>'
    + '<span class="th-c-tt" data-ttpick="'+v.uid+'" title="Bấm để đổi trạng thái">'+chipTrangThaiNho(v.trangthai)+'</span>'
    + '<span class="th-c-ng">'+(v.han&&v.han!=='-'?'⏳ '+thoatHTML(v.han):'')+'</span>'
    + '<span class="th-c-pct"><span class="th-bar"><span class="th-fill" style="width:'+p+'%;background:'+mauPct(p)+'"></span></span><span class="th-pct" style="color:'+mauPct(p)+'">'+p+'%</span></span></div>';
}
$('toiNguoi').addEventListener('change', e=>{
  nguoiCuaToi = e.target.value;
  try{ localStorage.setItem('nguoiCuaToi', nguoiCuaToi); }catch(x){}
  veViecCuaToi();
});
if($('toiCheDo')) $('toiCheDo').addEventListener('click', ()=>{
  cheDoToi = (cheDoToi==='cay' ? 'list' : 'cay');
  try{ localStorage.setItem('cheDoToi', cheDoToi); }catch(x){}
  veViecCuaToi();
});
if($('toiSapXep')) $('toiSapXep').addEventListener('change', e=>{
  sapXepToi = e.target.value;
  try{ localStorage.setItem('sapXepToi', sapXepToi); }catch(x){}
  veViecCuaToi();
});
if($('toiLocDA')) $('toiLocDA').addEventListener('change', veViecCuaToi);
if($('toiMoTatCa')) $('toiMoTatCa').addEventListener('click', ()=>{
  const viec = NHIEM_VU.filter(v => v.nguoi.split(',').map(s=>s.trim()).includes(nguoiCuaToi));
  viec.forEach(v=>{ moNhanhToi.add(v.mada); let key=v.mada; tachCap(v.phancap).forEach(seg=>{ key+='/'+seg; moNhanhToi.add(key); }); });
  veViecCuaToi();
});
if($('toiGapTatCa')) $('toiGapTatCa').addEventListener('click', ()=>{ moNhanhToi.clear(); veViecCuaToi(); });
if($('toiAnXong')){
  try{ const on = localStorage.getItem('anXongToi')==='1'; $('toiAnXong').setAttribute('aria-pressed', on?'true':'false'); $('toiAnXong').classList.toggle('on', on); }catch(e){}
  $('toiAnXong').addEventListener('click', ()=>{
    const on = $('toiAnXong').getAttribute('aria-pressed')!=='true';
    $('toiAnXong').setAttribute('aria-pressed', on?'true':'false');
    $('toiAnXong').classList.toggle('on', on);
    try{ localStorage.setItem('anXongToi', on?'1':'0'); }catch(e){}
    veViecCuaToi();
  });
}
/* Bấm ✎ / pill / vướng mắc / gập nhóm trong "Việc của tôi" */
$('toiNoiDung').addEventListener('click', e=>{
  if(_lpFired){ _lpFired=false; return; }   /* vừa nhấn giữ xong, bỏ qua click kèm theo */
  const vmb = e.target.closest('[data-vm]');
  if(vmb){ datVuongMac(Number(vmb.dataset.vm)); return; }
  const tnb = e.target.closest('[data-tn]');
  if(tnb){ datTamNgung(Number(tnb.dataset.tn)); return; }
  const lsb = e.target.closest('[data-ls]');
  if(lsb){ moLichSu(Number(lsb.dataset.ls)); return; }
  const suaNut = e.target.closest('[data-suatoi]');
  if(suaNut){ moFormSuaViec(Number(suaNut.dataset.suatoi)); return; }
  const nhomRow = e.target.closest('.toi-nhom');
  if(nhomRow){
    const cls = nhomRow.dataset.nhom, def = nhomRow.dataset.modef==='1';
    const k = (def?'dong:':'nhom:')+cls;
    if(moNhanhToi.has(k)) moNhanhToi.delete(k); else moNhanhToi.add(k);
    veViecCuaToi(); return;
  }
  const daRow = e.target.closest('[data-mato]');
  if(daRow){ const k=daRow.dataset.mato; if(moNhanhToi.has(k))moNhanhToi.delete(k);else moNhanhToi.add(k); veViecCuaToi(); return; }
  const br = e.target.closest('[data-moto]');
  if(br){ const k=br.dataset.moto; if(moNhanhToi.has(k))moNhanhToi.delete(k);else moNhanhToi.add(k); veViecCuaToi(); return; }
  /* click vào bất kỳ đâu trong thẻ công việc → menu cập nhật nhanh trạng thái */
  const tv = e.target.closest('.toi-viec');
  if(tv && tv.dataset.uid){ e.stopPropagation(); moMenuTrangThai(Number(tv.dataset.uid), e.clientX, e.clientY); return; }
  const la = e.target.closest('.th-leaf');
  if(la && la.dataset.cbuid){ e.stopPropagation(); moMenuTrangThai(Number(la.dataset.cbuid), e.clientX, e.clientY); return; }
});
/* Báo / gỡ vướng mắc nhanh (ghi cả việc về Sheets) */
async function datVuongMac(uid){
  const nv = NHIEM_VU.find(v=>v.uid===uid); if(!nv) return;
  const lyDo = await hoiNhap({ tieuDe:'⚠ Báo / gỡ vướng mắc', nhan:'Mô tả vướng mắc (chờ gì, kẹt ở đâu). Để TRỐNG rồi Lưu để gỡ cờ.', giaTri: nv.vuongmac || '', goiY:'VD: Chờ số liệu khảo sát từ tổ Trắc địa...' });
  if(lyDo === null) return;              /* bấm Hủy */
  const moi = lyDo.trim();
  if(moi === (nv.vuongmac||'')) return;
  let mk = maXacNhanCache || prompt('Nhập mã xác nhận của phòng để lưu:');
  if(!mk) return;
  const cu = nv.vuongmac; nv.vuongmac = moi;
  veViewPhu(); veDanhSach();   /* hiện ngay */
  baoToast('⏳ Đang lưu…', '', true);
  fetch(LINK_APPS_SCRIPT, { method:'POST', body: JSON.stringify({
      type:'suanhiemvu', matkhau: mk, data:{
        magoc: nv.mada, nvgoc: nv.nhiemvu, nguoigoc: nv.nguoi, phancapgoc: nv.phancap||'',
        mada: nv.mada, phancap: nv.phancap||'', hangmuc: nv.hangmuc||'', nhiemvu: nv.nhiemvu,
        nguoi: nv.nguoi, uutien: nv.uutien, han: nv.han||'-', trangthai: chuanCot(nv.trangthai),
        ghichu: nv.ghichu||'', vuongmac: moi, tamngung: nv.tamngung||''
      } }) })
    .then(r=>r.json())
    .then(kq=>{
      if(kq.ok){ nhoMaTrongPhien(mk); chamHoatDong(); lanGhiCuoi = Date.now(); baoToast(moi?'✓ Đã lưu vướng mắc':'✓ Đã gỡ vướng mắc', 'ok'); }
      else { nv.vuongmac = cu; veViewPhu(); veDanhSach(); baoToast('✖ Chưa lưu — '+(kq.loi||'lỗi')+'. Thử lại.','err'); }
    })
    .catch(()=>{ nv.vuongmac = cu; veViewPhu(); veDanhSach(); baoToast('✖ Mất kết nối, chưa lưu. Thử lại.','err'); });
}
/* Đánh dấu / gỡ TẠM NGƯNG nhanh (ghi cả việc về Sheets) */
async function datTamNgung(uid){
  const nv = NHIEM_VU.find(v=>v.uid===uid); if(!nv) return;
  const lyDo = await hoiNhap({ tieuDe:'⏸ Tạm ngưng / tiếp tục', nhan:'Lý do tạm ngưng (việc này sẽ KHÔNG tính vào %). Để TRỐNG rồi Lưu để bỏ tạm ngưng.', giaTri: nv.tamngung || '', goiY:'VD: Dự án hoãn đến Q3; chờ phê duyệt chủ trương...' });
  if(lyDo === null) return;
  const moi = lyDo.trim();
  if(moi === (nv.tamngung||'')) return;
  let mk = maXacNhanCache || prompt('Nhập mã xác nhận của phòng để lưu:');
  if(!mk) return;
  const cu = nv.tamngung; nv.tamngung = moi;
  veViewPhu(); veDanhSach();   /* hiện ngay */
  baoToast('⏳ Đang lưu…', '', true);
  fetch(LINK_APPS_SCRIPT, { method:'POST', body: JSON.stringify({
      type:'suanhiemvu', matkhau: mk, data:{
        magoc: nv.mada, nvgoc: nv.nhiemvu, nguoigoc: nv.nguoi, phancapgoc: nv.phancap||'',
        mada: nv.mada, phancap: nv.phancap||'', hangmuc: nv.hangmuc||'', nhiemvu: nv.nhiemvu,
        nguoi: nv.nguoi, uutien: nv.uutien, han: nv.han||'-', trangthai: chuanCot(nv.trangthai),
        ghichu: nv.ghichu||'', vuongmac: nv.vuongmac||'', tamngung: moi
      } }) })
    .then(r=>r.json())
    .then(kq=>{
      if(kq.ok){ nhoMaTrongPhien(mk); chamHoatDong(); lanGhiCuoi = Date.now(); baoToast(moi?'✓ Đã tạm ngưng':'✓ Đã tiếp tục', 'ok'); }
      else { nv.tamngung = cu; veViewPhu(); veDanhSach(); baoToast('✖ Chưa lưu — '+(kq.loi||'lỗi')+'. Thử lại.','err'); }
    })
    .catch(()=>{ nv.tamngung = cu; veViewPhu(); veDanhSach(); baoToast('✖ Mất kết nối, chưa lưu. Thử lại.','err'); });
}
/* Cập nhật trạng thái 1 việc về Sheets (dùng cho dropdown + chuột phải) */
function capNhatTrangThaiViec(uid, ttMoi){
  const nv = NHIEM_VU.find(v=>v.uid===uid); if(!nv) return false;
  const ttCu = nv.trangthai;
  if(chuanCot(ttCu)===ttMoi) return false;
  let mk = maXacNhanCache || prompt('Nhập mã xác nhận của phòng để lưu:');
  if(!mk) return false;
  /* cập nhật giao diện NGAY */
  nv.trangthai = ttMoi;
  veViewPhu(); veDanhSach();
  baoToast('⏳ Đang lưu…', '', true);
  /* lưu Sheets chạy NGẦM */
  fetch(LINK_APPS_SCRIPT, { method:'POST',
    body: JSON.stringify({ type:'sua_trangthai_nhiemvu', matkhau: mk,
      data:{ mada: nv.mada, trangthai: ttMoi, items:[{nhiemvu:nv.nhiemvu, nguoi:nv.nguoi, phancap:nv.phancap}] } }) })
    .then(r=>r.json())
    .then(kq=>{
      if(kq.ok){ nhoMaTrongPhien(mk); chamHoatDong(); lanGhiCuoi = Date.now(); baoToast('✓ Đã lưu', 'ok'); }
      else { nv.trangthai = ttCu; veViewPhu(); veDanhSach(); baoToast('✖ Chưa lưu — '+(kq.loi||'lỗi')+'. Bấm lại để thử.', 'err'); }
    })
    .catch(()=>{ nv.trangthai = ttCu; veViewPhu(); veDanhSach(); baoToast('✖ Mất kết nối, chưa lưu. Bấm lại để thử.', 'err'); });
  return true;
}
/* Đổi trạng thái ngay trong "Việc của tôi" — ghi 1 việc về Sheets */
$('toiNoiDung').addEventListener('change', async e=>{
  const sel = e.target.closest('.toi-tt'); if(!sel) return;
  const uid = Number(sel.dataset.uid);
  const nv = NHIEM_VU.find(v=>v.uid===uid); if(!nv) return;
  const ttMoi = sel.value, ttCu = nv.trangthai;
  if(chuanCot(ttCu)===ttMoi) return;
  sel.disabled = true;
  const ok = await capNhatTrangThaiViec(uid, ttMoi);
  if(!ok) sel.value = chuanCot(ttCu);
  sel.disabled = false;
});
/* (handler cũ giữ tương thích — không dùng nữa) */

/* Nút chuyển màn hình */
document.querySelectorAll('.view-tab').forEach(b=>{
  b.addEventListener('click', ()=>doiView(b.dataset.view));
});

/* ===== Trên 1 THẺ CÔNG VIỆC (cả tab 2 & 3):
   - Chuột trái / chạm  → menu cập nhật nhanh trạng thái
   - Chuột phải / nhấn giữ → mở thông tin (form sửa)
   Bấm vào nút ✎ / ⚠ hoặc dòng nhóm/nhánh thì giữ hành vi riêng. ===== */
let _ttPickUid = null, _lpTimer = null, _lpFired = false, _lastPtr = 'mouse';
function moMenuTrangThai(uid, x, y){
  _ttPickUid = uid;
  const nv = NHIEM_VU.find(v=>v.uid===uid);
  const cur = nv ? chuanCot(nv.trangthai) : '';
  const menu = $('menuTrangThai');
  menu.querySelectorAll('.mtt').forEach(li=> li.classList.toggle('dang-chon', li.dataset.tt===cur));
  const mw = 220, mh = 180;
  const px = Math.min(x, window.innerWidth - mw);
  const py = Math.min(y, window.innerHeight - mh + window.scrollY);
  menu.style.left = Math.max(8, px) + 'px';
  menu.style.top = (py + window.scrollY) + 'px';
  menu.classList.add('show');
}
/* lấy uid của thẻ công việc tại điểm bấm (loại trừ nút/nhánh) */
function thePhanCong(target){
  if(target.closest('[data-suatoi],[data-vm],[data-tn],[data-mato],[data-moto],.th-br,.toi-nhom,.toi-da-row')) return null;
  const row = target.closest('#toiNoiDung .toi-viec, #toiNoiDung .th-leaf, #thCay .th-leaf');
  if(!row) return null;
  return Number(row.dataset.uid || row.dataset.cbuid) || null;
}
document.addEventListener('pointerdown', e=>{
  _lastPtr = e.pointerType || 'mouse';
  if(e.pointerType==='touch'){
    const uid = thePhanCong(e.target); if(!uid) return;
    _lpFired = false;
    _lpTimer = setTimeout(()=>{ _lpFired = true; if(navigator.vibrate) navigator.vibrate(15); moFormSuaViec(uid); }, 480);  /* nhấn giữ = thông tin */
  }
});
['pointermove','pointerup','pointercancel'].forEach(ev=>document.addEventListener(ev, ()=>{ if(_lpTimer){ clearTimeout(_lpTimer); _lpTimer=null; } }));
document.querySelectorAll('#menuTrangThai .mtt').forEach(li=>{
  li.onclick = ()=>{ const tt = li.dataset.tt, uid = _ttPickUid; dongCtx(); if(uid!=null) capNhatTrangThaiViec(uid, tt); };
});


/* Gợi ý phân cấp đã dùng (cho ô cv-phancap) */

/* ---------- CẢNH BÁO TRỄ HẠN ---------- */
/* ====== BÁO CÁO NHANH (copy dán Zalo/email) ====== */
function ngayHomNay(){ const d=new Date(); return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear(); }
function tenViecNgan(v){ return v.nhiemvu || (tachCap(v.phancap).slice(-1)[0]) || '(việc)'; }
/* ===== Báo cáo có lọc theo KHOẢNG HẠN (tuần qua / dự kiến) ===== */
let _bcLoai = 'phong';                 /* 'phong' | 'toi' */
let _bcKhoang = { tu:null, den:null }; /* mặc định: tất cả */
function fmtNgay(d){ return d ? (String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear()) : ''; }
function inputTuNgay(d){ return d ? (d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')) : ''; }
function ngayTuInput(s){ if(!s) return null; const m=String(s).split('-'); if(m.length!==3) return null; const d=new Date(+m[0],+m[1]-1,+m[2]); d.setHours(0,0,0,0); return isNaN(d)?null:d; }
function nhanKhoang(kh){ return (!kh.tu && !kh.den) ? 'TẤT CẢ HẠN' : ('HẠN '+(kh.tu?fmtNgay(kh.tu):'…')+' → '+(kh.den?fmtNgay(kh.den):'…')); }
function trongKhoang(v, kh){
  if(!kh.tu && !kh.den) return true;
  const d = docNgay(v.han); if(!d) return false; d.setHours(0,0,0,0);
  if(kh.tu && d < kh.tu) return false;
  if(kh.den && d > kh.den) return false;
  return true;
}
function bcPreset(p){
  const t = new Date(); t.setHours(0,0,0,0);
  if(p==='all') return { tu:null, den:null };
  if(p==='qua'){ const tu=new Date(t); tu.setDate(t.getDate()-7); return { tu, den:t }; }            /* 7 ngày qua */
  if(p==='toi'){ const tu=new Date(t); tu.setDate(t.getDate()+1); const den=new Date(t); den.setDate(t.getDate()+7); return { tu, den }; } /* 7 ngày tới */
  const wd=(t.getDay()+6)%7; const tu=new Date(t); tu.setDate(t.getDate()-wd); const den=new Date(tu); den.setDate(tu.getDate()+6); return { tu, den }; /* tuần này T2–CN */
}
/* Khối liệt kê việc theo hạn — dùng chung cho 2 loại báo cáo */
function khoiTheoHan(viecList, kh){
  const ds = viecList.filter(v=>trongKhoang(v,kh))
                     .sort((a,b)=>{ const x=docNgay(a.han), y=docNgay(b.han); return (x?x.getTime():9e15)-(y?y.getTime():9e15); });
  const L = ['', '— CÔNG VIỆC THEO '+nhanKhoang(kh)+' ('+ds.length+') —'];
  if(!ds.length) L.push('(không có)');
  ds.forEach(v=> L.push('• ['+v.mada+'] '+tenViecNgan(v)+' — '+v.nguoi+' — hạn '+(v.han&&v.han!=='-'?v.han:'(chưa đặt)')+' — '+chuanCot(v.trangthai)));
  return L;
}
/* Thanh công cụ lọc trong cửa sổ báo cáo — chèn 1 lần */
function bcDungCongCu(){
  if($('bcCongCu')) return;
  const ta = $('bcNoiDung'); if(!ta) return;
  const bar = document.createElement('div');
  bar.id = 'bcCongCu';
  bar.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 10px;padding:8px;border:1px solid var(--line);border-radius:6px;background:var(--paper)';
  bar.innerHTML =
    '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:10.5px;color:var(--concrete);text-transform:uppercase;letter-spacing:.05em">Lọc theo hạn:</span>'
    + '<button type="button" class="th-nut" data-bc-preset="qua">Tuần qua</button>'
    + '<button type="button" class="th-nut" data-bc-preset="nay">Tuần này</button>'
    + '<button type="button" class="th-nut" data-bc-preset="toi">Tuần tới (dự kiến)</button>'
    + '<button type="button" class="th-nut" data-bc-preset="all">Tất cả</button>'
    + '<span style="font-size:11px;color:var(--concrete)">Từ</span><input type="date" id="bcTu" style="font-size:12px;padding:5px;border:1px solid var(--line);border-radius:4px;background:var(--white);color:var(--ink)">'
    + '<span style="font-size:11px;color:var(--concrete)">đến</span><input type="date" id="bcDen" style="font-size:12px;padding:5px;border:1px solid var(--line);border-radius:4px;background:var(--white);color:var(--ink)">';
  ta.insertAdjacentElement('beforebegin', bar);
  bar.addEventListener('click', e=>{
    const b = e.target.closest('[data-bc-preset]'); if(!b) return;
    _bcKhoang = bcPreset(b.dataset.bcPreset);
    $('bcTu').value = inputTuNgay(_bcKhoang.tu); $('bcDen').value = inputTuNgay(_bcKhoang.den);
    taoBaoCao();
  });
  bar.addEventListener('change', e=>{
    if(e.target.id==='bcTu' || e.target.id==='bcDen'){
      _bcKhoang = { tu: ngayTuInput($('bcTu').value), den: ngayTuInput($('bcDen').value) };
      taoBaoCao();
    }
  });
}
function taoBaoCao(){
  const txt = _bcLoai==='toi' ? baoCaoCuaToi(_bcKhoang) : baoCaoPhong(_bcKhoang);
  $('bcNoiDung').value = txt; $('bcNoiDung').scrollTop = 0;
}
function moBaoCao(loai){
  _bcLoai = loai || 'phong';
  if($('bcTitle')) $('bcTitle').textContent = _bcLoai==='toi' ? '📋 Báo cáo việc của tôi' : '📋 Báo cáo phòng';
  bcDungCongCu();
  if($('bcTu')) $('bcTu').value = inputTuNgay(_bcKhoang.tu);
  if($('bcDen')) $('bcDen').value = inputTuNgay(_bcKhoang.den);
  taoBaoCao();
  moOverlay('modalBaoCao');
  $('bcNoiDung').scrollTop = 0;
}

function baoCaoPhong(kh){
  kh = kh || _bcKhoang || {tu:null,den:null};
  chuanBiCache();
  const L = [];
  const DA = DU_AN.filter(d=>xemDuocDuAn(d.ma));
  const NV = NHIEM_VU.filter(v=>xemDuocDuAn(v.mada));
  L.push('BÁO CÁO TIẾN ĐỘ — ' + TEN_DON_VI);
  L.push('Ngày ' + ngayHomNay());
  L.push('');
  const tongTD = DA.length ? Math.round(DA.reduce((s,d)=>s+tinhTienDo(d.ma),0)/DA.length) : 0;
  L.push('Tổng dự án: ' + DA.length + ' · Tiến độ TB: ' + tongTD + '%');
  if(kh.tu || kh.den){ khoiTheoHan(NV, kh).forEach(x=>L.push(x)); }
  L.push('');
  L.push('— TIẾN ĐỘ THEO DỰ ÁN —');
  DA.slice().sort((a,b)=>tinhTienDo(a.ma)-tinhTienDo(b.ma)).forEach(d=>{
    L.push('• ' + d.ma + (d.ten?' '+d.ten:'') + ': ' + tinhTienDo(d.ma) + '%');
  });
  const tre = dsTreHan();
  L.push('');
  L.push('— TRỄ HẠN (' + tre.length + ') —');
  if(!tre.length) L.push('(không có)');
  tre.forEach(x=> L.push('• [' + x.mada + '] ' + x.ten + ' — ' + x.nguoi + ' — trễ ' + x.tre + ' ngày'));
  const vm = NV.filter(v=>v.vuongmac && String(v.vuongmac).trim());
  L.push('');
  L.push('— VƯỚNG MẮC (' + vm.length + ') —');
  if(!vm.length) L.push('(không có)');
  vm.forEach(v=> L.push('• [' + v.mada + '] ' + tenViecNgan(v) + ' — ' + v.nguoi + ' — ' + v.vuongmac));
  const tn = NV.filter(v=>dangNgung(v));
  if(tn.length){
    L.push('');
    L.push('— TẠM NGƯNG (' + tn.length + ') —');
    tn.forEach(v=> L.push('• [' + v.mada + '] ' + tenViecNgan(v) + (String(v.tamngung).trim()&&String(v.tamngung).trim()!=='1'?' — '+v.tamngung:'')));
  }
  return L.join('\n');
}

function baoCaoCuaToi(kh){
  kh = kh || _bcKhoang || {tu:null,den:null};
  if(!nguoiCuaToi) return 'Hãy chọn tên ở tab "Việc của tôi" trước khi tạo báo cáo.';
  let viec = NHIEM_VU.filter(v => v.nguoi.split(",").map(s=>s.trim()).includes(nguoiCuaToi) && xemDuocViecTab3(v.mada));
  const locDA = $('toiLocDA') ? $('toiLocDA').value : '';
  if(locDA) viec = viec.filter(v=>v.mada===locDA);
  const L = [];
  L.push('VIỆC CỦA ' + nguoiCuaToi.toUpperCase() + (locDA?' — DỰ ÁN '+locDA:''));
  L.push('Ngày ' + ngayHomNay());
  L.push('');
  const ngung = viec.filter(v=>dangNgung(v));
  const conLai = viec.filter(v=>!dangNgung(v));
  const xong = conLai.filter(v=>chuanCot(v.trangthai)==='Hoàn thành').length;
  const dang = conLai.filter(v=>['Đang thực hiện / Chỉnh sửa','Trình duyệt KCS / TT'].includes(chuanCot(v.trangthai))).length;
  const chua = conLai.length - xong - dang;
  L.push('Tổng ' + viec.length + ' việc · Chưa ' + chua + ' · Đang ' + dang + ' · Xong ' + xong + (ngung.length?' · Tạm ngưng '+ngung.length:''));
  if(kh.tu || kh.den){ khoiTheoHan(viec, kh).forEach(x=>L.push(x)); }
  const tre=[], tuan=[];
  conLai.forEach(v=>{
    if(chuanCot(v.trangthai)==='Hoàn thành') return;
    const n = soNgayConLai(docNgay(v.han));
    if(n!==null && n<0) tre.push({v,n}); else if(n!==null && n<=7) tuan.push({v,n});
  });
  tre.sort((a,b)=>a.n-b.n); tuan.sort((a,b)=>a.n-b.n);
  L.push(''); L.push('— ĐÃ TRỄ (' + tre.length + ') —');
  if(!tre.length) L.push('(không có)');
  tre.forEach(o=> L.push('• [' + o.v.mada + '] ' + tenViecNgan(o.v) + ' — trễ ' + (-o.n) + ' ngày'));
  L.push(''); L.push('— TRONG TUẦN (' + tuan.length + ') —');
  if(!tuan.length) L.push('(không có)');
  tuan.forEach(o=> L.push('• [' + o.v.mada + '] ' + tenViecNgan(o.v) + ' — còn ' + o.n + ' ngày'));
  const vm = viec.filter(v=>v.vuongmac && String(v.vuongmac).trim());
  if(vm.length){
    L.push(''); L.push('— VƯỚNG MẮC (' + vm.length + ') —');
    vm.forEach(v=> L.push('• [' + v.mada + '] ' + tenViecNgan(v) + ' — ' + v.vuongmac));
  }
  return L.join('\n');
}

if($('thBaoCao')) $('thBaoCao').addEventListener('click', ()=> moBaoCao('phong'));
if($('toiBaoCao')) $('toiBaoCao').addEventListener('click', ()=> moBaoCao('toi'));
if($('bcCopy')) $('bcCopy').addEventListener('click', async ()=>{
  const t = $('bcNoiDung').value;
  try{ await navigator.clipboard.writeText(t); baoToast('✔ Đã sao chép','ok'); }
  catch(e){ $('bcNoiDung').focus(); $('bcNoiDung').select(); try{ document.execCommand('copy'); baoToast('✔ Đã sao chép','ok'); }catch(x){ baoToast('Hãy giữ & sao chép thủ công','err'); } }
});

/* ====== Hộp thoại nhập lý do (thay prompt) ====== */
let _nhapResolve = null;
function hoiNhap(opt){
  return new Promise(resolve=>{
    _nhapResolve = resolve;
    $('nhapTitle').textContent = opt.tieuDe || 'Nhập';
    $('nhapNhan').textContent = opt.nhan || '';
    $('nhapO').value = opt.giaTri || '';
    $('nhapO').placeholder = opt.goiY || 'Nhập nội dung...';
    moOverlay('modalNhap');
    setTimeout(()=>{ $('nhapO').focus(); }, 60);
  });
}
function dongNhap(kq){
  const r = _nhapResolve; _nhapResolve = null;
  $('modalNhap').hidden = true; moCuonNeuHetModal();
  if(r) r(kq);
}
if($('nhapLuu')) $('nhapLuu').addEventListener('click', ()=> dongNhap($('nhapO').value));
if($('nhapHuy')) $('nhapHuy').addEventListener('click', ()=> dongNhap(null));
if($('nhapX')) $('nhapX').addEventListener('click', ()=> dongNhap(null));
if($('modalNhap')) $('modalNhap').addEventListener('click', e=>{ if(e.target.id==='modalNhap') dongNhap(null); });
if($('nhapO')) $('nhapO').addEventListener('keydown', e=>{ if(e.key==='Enter' && (e.ctrlKey||e.metaKey)) dongNhap($('nhapO').value); });

/* ====== Lịch sử / Soát xét (gộp 1 ô, nối thêm phía máy chủ) ====== */
let lsUid = null;
function soLichSu(v){ return String(v.lichsukcs||'').split('|').map(x=>x.trim()).filter(Boolean).length; }
function nhanThoiGian(){ const d=new Date(), p=n=>String(n).padStart(2,'0'); return p(d.getDate())+'/'+p(d.getMonth()+1)+'/'+d.getFullYear()+' '+p(d.getHours())+':'+p(d.getMinutes()); }
function parseLichSu(s){
  return String(s||'').split('|').map(x=>x.trim()).filter(Boolean).map(seg=>{
    const m = seg.match(/^\[([^\]]*)\]:\s*([\s\S]*)$/);
    return m ? { dau:m[1].trim(), noidung:m[2].trim() } : { dau:'', noidung:seg };
  });
}
function veThread(s){
  const el = $('lsThread'); const arr = parseLichSu(s);
  if(!arr.length){ el.innerHTML = '<div class="ls-trong">Chưa có ghi chú nào. Thêm dòng đầu tiên bên dưới.</div>'; return; }
  el.innerHTML = arr.map(e=> '<div class="ls-item"><div class="ls-dau">'+thoatHTML(e.dau)+'</div><div class="ls-noi">'+thoatHTML(e.noidung)+'</div></div>').join('');
  el.scrollTop = el.scrollHeight;
}
function moLichSu(uid){
  const nv = NHIEM_VU.find(v=>v.uid===uid); if(!nv) return;
  lsUid = uid;
  $('lsTitle').textContent = '💬 ' + (nv.nhiemvu || tachCap(nv.phancap).slice(-1)[0] || 'Lịch sử');
  veThread(nv.lichsukcs); $('lsO').value = '';
  moOverlay('modalLichSu');
  setTimeout(()=>$('lsO').focus(), 60);
}
function dongLichSu(){ $('modalLichSu').hidden = true; moCuonNeuHetModal(); }
if($('lsDong')) $('lsDong').addEventListener('click', dongLichSu);
if($('lsX')) $('lsX').addEventListener('click', dongLichSu);
if($('modalLichSu')) $('modalLichSu').addEventListener('click', e=>{ if(e.target.id==='modalLichSu') dongLichSu(); });
if($('lsThem')) $('lsThem').addEventListener('click', ()=>{
  const nv = NHIEM_VU.find(v=>v.uid===lsUid); if(!nv) return;
  const text = $('lsO').value.trim(); if(!text){ $('lsO').focus(); return; }
  let tac = nguoiDangNhap ? nguoiDangNhap.ten : (nguoiCuaToi || 'Người dùng');
  let mk = maXacNhanCache || prompt('Nhập mã xác nhận của phòng để lưu:'); if(!mk) return;
  const entry = '['+nhanThoiGian()+' - '+tac+']: '+text;
  const cu = nv.lichsukcs || '';
  nv.lichsukcs = cu ? (cu + ' | ' + entry) : entry;   /* hiện ngay */
  $('lsO').value=''; veThread(nv.lichsukcs); veViewPhu(); veDanhSach();
  baoToast('⏳ Đang lưu…','',true);
  fetch(LINK_APPS_SCRIPT, { method:'POST', body: JSON.stringify({
      type:'themlichsu', matkhau: mk, data:{
        magoc: nv.mada, nvgoc: nv.nhiemvu, nguoigoc: nv.nguoi, phancapgoc: nv.phancap||'',
        mada: nv.mada, entry: entry } }) })
    .then(r=>r.json())
    .then(kq=>{
      if(kq.ok){ nhoMaTrongPhien(mk); chamHoatDong(); lanGhiCuoi=Date.now();
        if(kq.lichsu){ nv.lichsukcs = kq.lichsu; if(!$('modalLichSu').hidden && lsUid===nv.uid) veThread(nv.lichsukcs); veViewPhu(); veDanhSach(); }
        baoToast('✓ Đã lưu','ok'); }
      else { nv.lichsukcs = cu; veThread(nv.lichsukcs); veViewPhu(); veDanhSach(); baoToast('✖ Chưa lưu — '+(kq.loi||'lỗi')+'. Thử lại.','err'); }
    })
    .catch(()=>{ nv.lichsukcs = cu; veThread(nv.lichsukcs); veViewPhu(); veDanhSach(); baoToast('✖ Mất kết nối, chưa lưu. Thử lại.','err'); });
});

function dsTreHan(){
  chuanBiCache();
  const out = [];
  const me = nguoiDangNhap ? nguoiDangNhap.ten : '';
  NHIEM_VU.forEach(v=>{
    /* mục 6: admin thấy hết · leader thấy dự án mình lead · thành viên chỉ thấy việc của mình */
    const xem = laAdmin() || laLeaderCuaDuAn(v.mada) || (me && v.nguoi.split(',').map(s=>s.trim()).includes(me));
    if(!xem) return;
    if(chuanCot(v.trangthai)==='Hoàn thành') return;
    const n = soNgayConLai(docNgay(v.han));
    if(n !== null && n < 0) out.push({loai:'việc', mada:v.mada, ten:v.nhiemvu, phancap:v.phancap, nguoi:v.nguoi, tre:-n, uid:v.uid});
  });
  DU_AN.forEach(d=>{
    if(!(laAdmin() || laLeaderCuaDuAn(d.ma))) return;   /* trễ hạn dự án: chỉ leader/admin */
    if(tinhTienDo(d.ma) >= 100) return;
    const n = soNgayConLai(docNgay(d.hannop));
    if(n !== null && n < 0) out.push({loai:'dự án', mada:d.ma, ten:d.ten, phancap:'', nguoi:d.phutrach, tre:-n, uid:null});
  });
  out.sort((a,b)=>b.tre - a.tre);
  return out;
}
function veCanhBao(){
  const bang = $('bangCanhBao'); if(!bang) return;
  const ds = dsTreHan();
  if(ds.length === 0){ bang.hidden = true; return; }
  bang.hidden = false;
  $('cbSo').textContent = ds.length;
  $('cbChiTiet').innerHTML = ds.map(x=>{
    const duong = x.phancap ? thoatHTML(x.phancap)+' / ' : '';
    return '<div class="cb-dong"'+(x.uid?' data-cbuid="'+x.uid+'"':'')+'>'
      + '<span class="cb-badge">'+x.loai+'</span>'
      + '<span class="cb-ma">'+thoatHTML(x.mada)+'</span>'
      + '<span class="cb-ten">'+duong+thoatHTML(x.ten)+'</span>'
      + '<span class="cb-ng">'+thoatHTML(x.nguoi)+'</span>'
      + '<span class="cb-tre">trễ '+x.tre+' ngày</span></div>';
  }).join('');
}
$('cbToggle').addEventListener('click', ()=>{
  const ct = $('cbChiTiet');
  ct.hidden = !ct.hidden;
  $('cbMui').textContent = ct.hidden ? '▾' : '▴';
});
/* Bấm 1 dòng việc trễ → mở form sửa việc đó */
$('cbChiTiet').addEventListener('click', e=>{
  const d = e.target.closest('[data-cbuid]'); if(!d) return;
  moFormSuaViec(Number(d.dataset.cbuid));
});
/* ===================== ĐĂNG NHẬP & PHÂN QUYỀN ===================== */
let nguoiDangNhap = null;   /* {ten, pin, role} */
function timNguoiDung(ten){ return (typeof DANH_SACH_NHAN_SU!=='undefined') ? (DANH_SACH_NHAN_SU.find(u=>u.ten===ten) || null) : null; }
function laAdmin(){ return !!(nguoiDangNhap && nguoiDangNhap.role==='super_admin'); }
function maGui(){ return nguoiDangNhap ? String(nguoiDangNhap.pin) : (maXacNhanCache||''); }
function dsLeader(da){ return (da && da.leader ? String(da.leader) : '').split(',').map(s=>s.trim()).filter(Boolean); }
function laLeaderCuaDuAn(mada){
  if(laAdmin()) return true;
  if(!nguoiDangNhap) return false;
  const da = timDA(mada);
  return !!(da && dsLeader(da).includes(nguoiDangNhap.ten));
}
/* Khóa (làm xám + chặn bấm) một ô native hoặc multi-select */
function datKhoaO(el, khoa){
  if(!el) return;
  el.classList.toggle('o-khoa', !!khoa);
  if('disabled' in el) el.disabled = !!khoa;
  el.querySelectorAll && el.querySelectorAll('input,select,button').forEach(x=>{ x.disabled = !!khoa; });
}
function datQuyenTheoDuAn(mada){ document.body.classList.toggle('is-leader', laLeaderCuaDuAn(mada)); }
/* Quản lý được (thấy trạng thái, sửa, deadline) = admin hoặc leader của dự án đó */
function quanLyDuoc(mada){ return laLeaderCuaDuAn(mada); }
/* Tham gia dự án = admin / leader / có tên trong Phụ trách / được giao việc trong dự án */
function thamGiaDuAn(mada){
  if(laAdmin()) return true;
  if(!nguoiDangNhap) return false;
  const ten = nguoiDangNhap.ten;
  const da = timDA(mada);
  if(da){
    if(dsLeader(da).includes(ten)) return true;
    if(String(da.phutrach||'').split(',').map(s=>s.trim()).includes(ten)) return true;
  }
  return _setCoViec.has(mada) || NHIEM_VU.some(v=>v.mada===mada && v.nguoi.split(',').map(s=>s.trim()).includes(ten));
}
function xemDuocDuAn(mada){ return thamGiaDuAn(mada); }
/* Tab 3: được xem việc này không — xem CHÍNH MÌNH thì theo dự án tham gia; xem NGƯỜI KHÁC chỉ trong dự án mình LÀM LEADER (admin xem tất cả) */
function xemDuocViecTab3(mada){
  if(laAdmin()) return true;
  if(!nguoiDangNhap) return false;
  if(nguoiCuaToi === nguoiDangNhap.ten) return xemDuocDuAn(mada);
  return laLeaderCuaDuAn(mada);
}
/* Được xem việc của người khác (Tab 3) = admin hoặc đang là leader của ít nhất 1 dự án */
function laQuanLyChung(){ return laAdmin() || (!!nguoiDangNhap && DU_AN.some(d=>dsLeader(d).includes(nguoiDangNhap.ten))); }
/* #1: chỉ super_admin sửa Leader. #2: super_admin hoặc leader của dự án mới sửa Phụ trách */
function apQuyenFormDuAn(){
  datKhoaO($('ms-leader-container'), !laAdmin());
  const suaPhuTrach = laAdmin() || (typeof maDangSua!=='undefined' && maDangSua && laLeaderCuaDuAn(maDangSua));
  datKhoaO($('ms-phutrach-container'), !suaPhuTrach);
}
/* #3: chỉ leader/admin của dự án mới sửa Người chính; thành viên chỉ sửa Hỗ trợ */
function apQuyenFormViec(mada){
  const ql = quanLyDuoc(mada);
  const sel = $('cv-nguoi-chinh');
  datKhoaO(sel, !ql);
  if(!ql && sel && !sel.value && nguoiDangNhap){ sel.value = nguoiDangNhap.ten; }  /* thành viên tạo việc: tự là người chính */
}
function capNhatQuyen(){ document.body.classList.toggle('is-leader', laAdmin()); }
function dongBoQuyen(){
  if(!$('modalKanban').hidden && madaKanbanHienTai) datQuyenTheoDuAn(madaKanbanHienTai);
  else capNhatQuyen();
}
function ketThucDangNhap(){
  $('modalDangNhap').hidden = true; moCuonNeuHetModal();
  maXacNhanCache = String(nguoiDangNhap.pin);
  capNhatQuyen();
  const fn = $('footDangNhap');
  if(fn){ fn.innerHTML = '· 👤 ' + thoatHTML(nguoiDangNhap.ten) + ' (' + (laAdmin()?'quản trị':'nhân viên') + ') · <a href="#" id="dangXuat">Đăng xuất</a>';
    const dx = $('dangXuat'); if(dx) dx.addEventListener('click', e=>{ e.preventDefault(); dangXuat(); }); }
  if(!nguoiCuaToi){ nguoiCuaToi = nguoiDangNhap.ten; try{ localStorage.setItem('nguoiCuaToi', nguoiCuaToi); }catch(e){} }
}
function dangNhap(){
  const u = timNguoiDung($('dn-ten').value);
  const pin = $('dn-pin').value.trim();
  const msg = $('dn-msg');
  if(!u){ msg.className='modal-msg err'; msg.textContent='✖ Hãy chọn tên của bạn'; return; }
  if(!pin || pin!==String(u.pin)){ msg.className='modal-msg err'; msg.textContent='✖ Mã PIN không đúng'; return; }
  nguoiDangNhap = { ten:u.ten, pin:u.pin, role:u.role };
  try{ localStorage.setItem('phienDangNhap', JSON.stringify({ ten:u.ten, pin:u.pin })); }catch(e){}
  $('dn-pin').value=''; msg.textContent='';
  ketThucDangNhap();
  veDanhSach(); veViewPhu();
}
function dangXuat(){
  nguoiDangNhap=null; maXacNhanCache='';
  try{ localStorage.removeItem('phienDangNhap'); }catch(e){}
  document.body.classList.remove('is-leader');
  const fn=$('footDangNhap'); if(fn) fn.textContent='';
  moOverlay('modalDangNhap');
}
(function khoiDongDangNhap(){
  const sel = $('dn-ten');
  if(sel && typeof DANH_SACH_NHAN_SU!=='undefined') DANH_SACH_NHAN_SU.forEach(u=> sel.add(new Option(u.ten, u.ten)));
  try{ const s = JSON.parse(localStorage.getItem('phienDangNhap')||'null');
    const u = s && timNguoiDung(s.ten);
    if(u && String(u.pin)===String(s.pin)){ nguoiDangNhap = { ten:u.ten, pin:u.pin, role:u.role }; }
  }catch(e){}
  if(nguoiDangNhap) ketThucDangNhap();
  else moOverlay('modalDangNhap');
  if($('dn-vao')) $('dn-vao').addEventListener('click', dangNhap);
  if($('dn-pin')) $('dn-pin').addEventListener('keydown', e=>{ if(e.key==='Enter') dangNhap(); });
})();

taiDuLieu();
setInterval(()=>{
  if(Date.now() - lanGhiCuoi <= 6*60*1000) return;
  if(document.querySelector('.modal-overlay:not([hidden])')) return;   /* đang mở form thì hoãn, tránh xáo trộn khi đang sửa */
  taiDuLieu();
}, 5*60*1000);