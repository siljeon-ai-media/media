// ======================================================
// ▼ 아래는 건드리지 않습니다. "우리 회사 사무실 프로그램" v2.6 — 비서실장 보고 규격 (2026-09-18)
//   부서가 스스로 일을 시작하고, 비서실장(보고팀 김대리)이 결재를 올립니다. 사장님은 답장으로 승인/보류만.
//   부서: 보고팀(비서실장) / 고객응대팀 / 콘텐츠팀 / 인사팀 / 시장조사팀 / 광고팀 / 정산팀

const API = "https://api.telegram.org/bot" + BOT_TOKEN;
const 저장소 = PropertiesService.getScriptProperties();

// ---------- 처음 한 번: 설치 (Day 4) ----------
function 설치() {
  탭준비();
  저장소.deleteProperty("offset");                                         // 토큰 재발급 뒤에도 새 메시지를 놓치지 않게(v2.6)
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  const 설정 = 설정읽기();
  ScriptApp.newTrigger("아침보고").timeBased().atHour(Number(설정["보고 시각"] || 8)).everyDays(1).inTimezone("Asia/Seoul").create();
  ScriptApp.newTrigger("직원업무").timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger("주간요약").timeBased().onWeekDay(ScriptApp.WeekDay.FRIDAY).atHour(17).inTimezone("Asia/Seoul").create();
  ScriptApp.newTrigger("월요소재").timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(7).inTimezone("Asia/Seoul").create();      // 콘텐츠팀이 먼저 소재를 올림
  ScriptApp.newTrigger("경쟁사정찰").timeBased().onWeekDay(ScriptApp.WeekDay.WEDNESDAY).atHour(7).inTimezone("Asia/Seoul").create(); // 시장조사팀이 먼저 정찰함
  ScriptApp.newTrigger("저녁정리").timeBased().atHour(18).everyDays(1).inTimezone("Asia/Seoul").create();                         // 비서실장이 미결재·할일을 챙김
  ScriptApp.newTrigger("월정산").timeBased().onMonthDay(1).atHour(9).inTimezone("Asia/Seoul").create();                          // 정산팀이 지난달을 정리함
  Logger.log("✅ 설치 완료: 매일 " + (설정["보고 시각"] || 8) + "시 아침 보고 · 5분마다 부서 업무 · 월 7시 소재 제안 · 수 7시 경쟁사 정찰 · 매일 18시 저녁 정리 · 금 17시 주간 요약 · 매월 1일 월 정산");
  Logger.log("→ 왼쪽 시계 모양(트리거)을 누르면 7줄이 보입니다.");
}

// ---------- 매일 아침: 보고 (Day 5부터 저절로) ----------
function 아침보고() {
  let 방 = 방찾기("보고팀");
  if (!방) { 직원업무(); 방 = 방찾기("보고팀"); }
  if (!방) { Logger.log("② 보고팀 방을 아직 몰라요. 텔레그램 보고팀에 /start@내직원아이디 를 보내고 30초 뒤 다시 실행하세요."); return; }
  const 정보 = 회사정보(); const 설정 = 설정읽기();
  const 오늘 = new Date(); const 날짜 = Utilities.formatDate(오늘, "Asia/Seoul", "M월 d일") + " (" + ["월", "화", "수", "목", "금", "토", "일"][Number(Utilities.formatDate(오늘, "Asia/Seoul", "u")) - 1] + ")";
  const 어제결재 = 최근행("결재", 5).map(r => "- " + r[2]).join("\n") || "- (없음)";
  const 할일 = (정보["매일 반복하는 일 3개"] || "문의 답장, 재고 확인, SNS 올리기").split(/[,，/·]/).map(s => s.trim()).filter(Boolean).slice(0, 3);
  let 글 = null, 두뇌문제 = "";
  const 어제 = 며칠전(1); const 어제문의 = 기간행("문의", 어제, 어제); const 어제게시 = 기간행("게시", 어제, 어제); const 어제정산 = 기간행("정산", 어제, 어제).pop();
  const 할일목록 = 최근행("메모", 60).filter(r => /^할일/.test(String(r[2]))).slice(-3).map(r => String(r[2]).replace(/^할일\s*\|\s*/, "").slice(0, 40));
  const 대기 = 결재대기목록();
  const 어제사실 = "문의 " + 어제문의.length + "건 · 게시 " + 어제게시.length + "건" + (어제정산 ? " · 매출 " + 원(어제정산[1]) + " 지출 " + 원(어제정산[2]) : " · 정산 기록 없음");
  const 챙길것 = "결재 대기 " + 대기.length + "건" + (대기.length ? "(" + 대기.map(r => "#" + r[0]).join(",") + ")" : "") + " · 남은 할일 " + 할일목록.length + "개" + (할일목록.length ? "(" + 할일목록.join(" / ") + ")" : "");
  const 호칭 = 설정["호칭"] || 정보["사장님을 부르는 호칭"] || "사장님";
  try { 글 = 두뇌("너는 아래 가게의 AI 직원 '보고팀 김대리'(비서실장)다. 오늘 아침 보고를 아래 형식 그대로 써라. 다른 말은 쓰지 마라.\n☀️ 보고팀 · 아침 보고 — " + 날짜 + "\n" + 호칭 + ", (한 줄 인사)\n① 오늘 할 일 3: 1 … · 2 … · 3 … (아래 반복 업무를 기본으로, 어제 문의·남은 할일이 있으면 그것을 먼저)\n② 어제: " + 어제사실 + " (이 줄은 그대로 쓰고, 어제 결재 기록이 있으면 '정한 것: …'을 뒤에 붙여라)\n③ 챙길 것: " + 챙길것 + " · 걱정: (없으면 '없음')\n④ 오늘 제안 1개: (가게 정보와 어제 기록에서 근거를 찾아 무엇을·언제 한 줄. 근거 없으면 '없음')\n→ 답장 1 = 제안 승인(할일로 등록) / 2 = 보류 / 고칠 내용은 그대로\n말투: " + (설정["말투"] || 정보["AI 직원에게 바라는 말투"] || "짧고 공손하게") + ". 호칭은 반드시 '" + 호칭 + "'.\n[가게 정보]\n" + 정보문장(정보) + "\n[반복 업무]\n" + 할일.join("\n") + "\n[어제 결재 기록]\n" + 어제결재 + "\n[어제 문의]\n" + (어제문의.map(r => "- " + String(r[1]).slice(0, 60)).join("\n") || "- (없음)")); } catch (e) { 두뇌문제 = e.message; Logger.log("두뇌 문제(기본 형식으로 보냄): " + e.message); }
  if (!글) 글 = 규격("☀️ 보고팀 · 아침 보고 — " + 날짜 + "\n" + 호칭 + ", 좋은 아침입니다.", "오늘 할 일 3: " + 할일.map((h, i) => (i + 1) + " " + h).join(" · "), "어제: " + 어제사실, "챙길 것: " + 챙길것 + " · 걱정: 없음", "없음", "답장 없이 두셔도 됩니다") + (두뇌문제 ? "\n(두뇌 연결 문제로 기본 보고입니다: " + 두뇌문제.slice(0, 60) + ")" : "");
  if (대기.length) 글 += "\n\n🗂 결재 기다리는 것 " + 대기.length + "건: " + 대기.map(r => "#" + r[0] + " " + r[3]).join(", ") + "\n(각 결재 글에 답장으로 승인/보류)";
  const 보낸것 = 보내기(방.chat, 방.thread, 글);
  기록("보고기록", [지금(), "아침보고", 글, 보낸것 && 보낸것.message_id]);
  Logger.log("✅ 아침 보고를 보고팀에 올렸습니다.");
}

// ---------- Day 4 마지막: 첫 출근 인사 ----------
function 자기소개() {
  let 방 = 방찾기("보고팀");
  if (!방) { 직원업무(); 방 = 방찾기("보고팀"); }
  if (!방) { Logger.log("② 보고팀 방을 아직 몰라요. 텔레그램 보고팀에 /start@내직원아이디 를 보내고 30초 뒤 다시 실행하세요."); return; }
  const 정보 = 회사정보(); const 호칭 = 정보["사장님을 부르는 호칭"] || "사장님";
  const 가게 = 정보["가게 이름"] || 정보["상호"] || Object.values(정보)[0] || "우리 가게";
  let 글 = null;
  try { 글 = 두뇌("너는 아래 가게의 AI 직원 '보고팀 김대리'(비서실장)다. " + 호칭 + "께 첫 출근 인사를 5줄 이내로 해라. 가게 이름과 손님 특징을 한 번씩 언급하고, '매일 반복하는 일' 중 하나를 골라 '이건 제가 맡겠습니다'라고 말해라. 마지막 줄은 '내일 아침 " + (설정읽기()["보고 시각"] || 8) + "시에 첫 보고 올리겠습니다.'로 끝내라. 인사말만 출력해라.\n\n[가게 정보]\n" + 정보문장(정보)); } catch (e) { Logger.log("두뇌 없이 인사합니다: " + e.message.slice(0, 80)); }
  if (!글) 글 = "👋 " + 호칭 + ", 보고팀 김대리 첫 출근했습니다.\n" + 가게 + "의 매일 반복하는 일부터 제가 챙기겠습니다.\n내일 아침 " + (설정읽기()["보고 시각"] || 8) + "시에 첫 보고 올리겠습니다.";
  const 보낸것 = 보내기(방.chat, 방.thread, 글);
  기록("보고기록", [지금(), "자기소개", 글, 보낸것 && 보낸것.message_id]);
  Logger.log("✅ 성공! 보고팀에 첫 인사가 올라갔습니다. 내일 아침 보고는 저절로 옵니다(설치가 만든 시계).");
}

// ---------- 5분마다: 부서방 새 글 처리 (Day 5~19) ----------
function 직원업무() {
  const 잠금 = LockService.getScriptLock(); if (!잠금.tryLock(5000)) return;   // 5분 트리거와 수동 실행이 겹쳐도 두 번 처리하지 않게
  try { 직원업무_실행(); } finally { 잠금.releaseLock(); }
}
function 직원업무_실행() {
  const offset = Number(저장소.getProperty("offset") || 0);
  const upd = JSON.parse(UrlFetchApp.fetch(API + "/getUpdates?timeout=0&limit=100&offset=" + offset, { muteHttpExceptions: true }).getContentText());
  let last = offset - 1;
  for (const u of (upd.result || [])) {
    last = u.update_id;
    const m = u.message; if (!m || !m.chat || m.chat.type === "private" || !m.text) continue;
    if (m.from && m.from.is_bot) continue;
    const 부서 = 부서이름(m);
    방저장(부서, m.chat.id, m.message_thread_id || null);
    try { 처리(부서, m); } catch (e) { 보내기(m.chat.id, m.message_thread_id, "⚠️ 처리 중 문제: " + e.message.slice(0, 120)); }
  }
  저장소.setProperty("offset", String(last + 1));
}

function 처리(부서, m) {
  const t = m.text.trim();
  if (t.indexOf("/start") === 0) { 보내기(m.chat.id, m.message_thread_id, "✅ " + 부서 + " 방을 기억했습니다."); return; }
  const 답 = (글) => 보내기(m.chat.id, m.message_thread_id, 글);
  const 답장인가 = !!(m.reply_to_message && m.reply_to_message.from && m.reply_to_message.from.is_bot);
  const 결재번호 = 답장인가 ? ((m.reply_to_message.text || "").match(/^🗂 결재 #(\d+)/) || [])[1] : null;
  if (결재번호) { if (결재답장(Number(결재번호), t, m)) return; }                  // 비서실장이 올린 결재에 답장 = 승인/보류/번호 (끝난 결재에 "올렸어요" 같은 말은 일반 처리로)
  if (부서 === "시장조사팀" && /경쟁사\s*등록/.test(t)) {                            // Day 14: 경쟁사 등록 → 매주 수요일 자동 정찰
    const 링크 = t.match(/https?:\/\/\S+/g) || []; if (!링크.length) { 답("이렇게 보내 주세요: 경쟁사 등록 https://주소1 https://주소2"); return; }
    링크.forEach(u => 기록("경쟁사", [u, "", 지금()])); 답("📌 경쟁사 " + 링크.length + "곳을 등록했습니다. 매주 수요일 아침에 제가 먼저 살펴보고 바뀐 점을 보고드리겠습니다."); return;
  }
  if (!결재번호 && 답장인가 && /^(🗓|🗂)/.test(m.reply_to_message.text || "")) {                  // 직원이 올린 소재 목록·결재 글에 단 답장 = 무조건 결재 답으로 (번호/승인/보류)
    const 대기 = 결재대기목록().filter(r => r[2] === 부서 || 부서 === "보고팀");
    if (대기.length) { 결재답장(Number(대기[대기.length - 1][0]), t, m); return; }
  }
  const 제안줄 = 답장인가 ? ((m.reply_to_message.text || "").split("\n").find(l => l.indexOf("④ 제안:") === 0) || "") : "";
  if (제안줄 && /^(1|승인|ㅇㅇ|네|좋아요?|해\s?줘|그렇게 해)$/.test(t)) {                 // v2.1: 제안 승인 → 인사팀 할일로 등록, 저녁 정리·아침 보고가 다시 챙김
    const 내용 = 제안줄.replace(/^④ 제안:\s*/, "").replace(/\s*[—-]\s*답장 1.*$/, "").replace(/\(답장 1[^)]*\)/, "").trim();
    if (/^없음/.test(내용)) { 답("이번 보고에는 제안이 없어서 등록할 게 없습니다."); return; }
    기록("메모", [지금(), "제안 승인(" + 부서 + ")", "할일 | " + 내용.slice(0, 80)]); 기록("결재", [지금(), 제안줄.slice(0, 40), t, 부서]);
    답("✅ 제안을 할일로 등록했습니다. 저녁 정리와 내일 아침 보고에서 다시 챙기겠습니다.\n" + 내용); return;
  }
  if (제안줄 && /^(2|보류|나중에?|아니요?)$/.test(t)) { 기록("결재", [지금(), 제안줄.slice(0, 40), "보류", 부서]); 답("📝 제안 보류로 기록했습니다."); return; }
  const 업무말 = /카드뉴스|문구|올렸|게시 완료|업로드|https?:\/\/|매출|지출/.test(t);
  if (답장인가 && !업무말) {                                  // Day 5·7·12: 직원 말풍선에 단 답장 = 결재·선택 기록
    기록("결재", [지금(), (m.reply_to_message.text || "").split("\n")[0].slice(0, 40), t, 부서]);
    답("📝 결재 기록했습니다: " + t); return;
  }
  const 정보 = 회사정보(); const 설정 = 설정읽기();
  const 말투 = "말투: " + (설정["말투"] || 정보["AI 직원에게 바라는 말투"] || "짧고 공손하게, 존댓말") + ". 호칭: " + (설정["호칭"] || 정보["사장님을 부르는 호칭"] || "사장님") + ".";

  if (부서 === "보고팀") {                                   // 보고팀은 답장(결재)만 받고, 그 외 글은 무시
    return;
  } else if (부서 === "고객응대팀") {                        // Day 6
    const 비슷 = 최근행("문의", 60).filter(x => String(x[1]) !== t && 낱말들(t).some(w => String(x[1]).indexOf(w) >= 0)).slice(-3);
    const r = 두뇌("손님 문의에 답할 초안을 아래 형식 그대로 써라. 형식 밖의 말은 쓰지 마라.\n유형: (예약/가격/영업시간/불만/단체/기타 중 하나) — 손님이 진짜 알고 싶은 것 한 줄\nA. 짧게: (3줄 이내)\nB. 친절하게: (3줄 이내)\nC. 단골 만들기: (3줄 이내, 다음 방문 이유 한 가지)\n추천: A/B/C 중 하나 — 이유 한 줄\n가게 정보에 없는 것은 지어내지 말고 '확인 후 안내'라고 써라. 초안은 손님에게 보내는 글이니 손님은 '고객님'이라 부르고 '사장님'이라 부르지 마라(사장님 = 이 가게 주인 = 나). " + 말투 + "\n[가게 정보]\n" + 정보문장(정보) + "\n[손님 문의]\n" + t) || "(Gemini 키가 없어 초안을 못 씁니다. Day 5를 확인하세요)";
    기록("문의", [지금(), t, r]);
    const 줄 = r.split("\n"); const 유형 = (줄.find(l => l.indexOf("유형") === 0) || "유형: 기타").replace(/^유형\s*[:：]\s*/, ""); const 추천 = (줄.find(l => l.indexOf("추천") === 0) || "추천: B — 손님 말투에 맞춤").replace(/^추천\s*[:：]\s*/, "");
    const 초안 = 줄.filter(l => l.indexOf("유형") !== 0 && l.indexOf("추천") !== 0).join("\n").trim();
    const 비교 = 비슷.length ? "비슷한 문의 " + 비슷.length + "건 있었음 (" + 비슷.map(x => String(x[0]).slice(5, 10)).join(", ") + ") — 그때 초안은 시트 '문의' 탭" : "처음 받는 유형의 문의";
    const 제안 = 비슷.length >= 2 ? "자주 오는 질문 → 프로필 소개글·고정 게시물에 답을 미리 적어 두기" : (/불만/.test(유형) ? "답장 뒤 하루 안에 다시 연락해 확인하기" : "없음");
    답("💬 고객응대팀 · 문의 답변 — " + 날짜표() + "\n① 유형: " + 유형 + "\n" + 초안 + "\n② " + 비교 + "\n③ 추천: " + 추천 + "\n④ 제안: " + 제안 + "\n→ 보낼 초안(A/B/C)을 복사해 손님께 보내세요" + (제안 === "없음" ? "" : " · 제안 승인은 답장 1"));
  } else if (부서 === "콘텐츠팀") {                          // Day 7~9
    if (/올렸|게시 완료|업로드/.test(t)) { 기록("게시", [지금(), t]); 답("📌 게시 완료로 기록했습니다. 수고하셨습니다!"); return; }
    if (/카드뉴스|문구/.test(t)) {
      const r = 두뇌("아래 소재로 인스타 카드뉴스 문구를 써라: 표지 제목(10자 내) 1개, 본문 슬라이드 4장(각 2줄), 마지막 슬라이드 행동 유도 1줄. 해시태그 5개. " + 말투 + "\n[가게 정보]\n" + 정보문장(정보) + "\n[소재]\n" + t) || "(Gemini 키 필요)";
      기록("소재", [지금(), "카드뉴스", t, r]); 답("🗓 콘텐츠팀 · 카드뉴스 문구 — " + 날짜표() + "\n" + r + "\n→ 올리신 뒤 '올렸어요'라고만 답장해 주세요 (게시 기록으로 남깁니다)"); return;
    }
    const 지난소재 = 최근행("소재", 30).filter(x => /소재10/.test(String(x[1]))).slice(-1).map(x => String(x[3]).slice(0, 600)).join("");
    const 리뷰모음 = /^리뷰\s*모음/.test(t);                                   // Day 18: 손님 리뷰 묶음 → 손님 말 그대로 훅
    const r = 두뇌(리뷰모음
      ? "아래는 우리 가게 손님들이 남긴 리뷰다. 리뷰에 나온 손님의 말(메뉴 이름·칭찬 표현)을 그대로 훅으로 써서 이번 주 SNS 소재 10개를 한 줄에 하나씩 써라. 각 줄: 번호. 훅(손님 말 그대로, 15자 내) — 어느 리뷰에서 왔는지 한 마디 — 형식(릴스/카드 1장/스토리). 리뷰에 없는 장점은 넣지 마라. 마지막 줄은 '추천: 번호 3개 — 이유 한 줄'. " + 말투 + "\n[가게 정보]\n" + 정보문장(정보) + "\n[손님 리뷰]\n" + t
      : "이 가게의 이번 주 SNS 소재 10개를 한 줄에 하나씩 써라. 각 줄: 번호. 제목(15자 내) — 왜 손님이 반응할지 한 마디. 손님이 자주 묻는 질문·요즘 고민·계절을 섞고, 지난주 소재와 겹치지 않게 하라. 마지막 줄은 '추천: 번호 3개 — 이유 한 줄'. " + 말투 + "\n[가게 정보]\n" + 정보문장(정보) + "\n[사장님 요청]\n" + t + "\n[지난주 소재]\n" + (지난소재 || "(없음)")) || "(Gemini 키 필요)";
    기록("소재", [지금(), "소재10", t, r]); 답("🗓 콘텐츠팀 · 이번 주 소재 10개 — " + 날짜표() + "\n" + r + "\n→ 이 글에 답장으로 만들 번호를 적어 주세요 (예: 3, 7)");
  } else if (부서 === "인사팀") {                            // Day 11
    const r = 두뇌("사장님이 남긴 메모를 한 줄로 정리하고(핵심만), 분류를 하나 붙여라: 아이디어/불만/칭찬/할일/기타. 형식: '분류 | 한 줄'. 다른 말은 쓰지 마라. " + 말투 + "\n[메모]\n" + t) || "기타 | " + t;
    const 분류 = ((r.match(/아이디어|불만|칭찬|할일|기타/) || ["기타"])[0]); const 한줄 = (r.indexOf("|") >= 0 ? r.split("|").slice(1).join("|") : r.replace(/아이디어|불만|칭찬|할일|기타/, "")).replace(/^[ :：|—·-]+/, "").trim() || t;
    const 관련 = 최근행("메모", 150).filter(x => String(x[1]) !== t && !/^제안 승인/.test(String(x[1])) && 낱말들(t).some(w => String(x[1]).indexOf(w) >= 0 || String(x[2]).indexOf(w) >= 0)).slice(-3);
    기록("메모", [지금(), t, r]);
    const 비교 = 관련.length ? "관련 메모 " + 관련.length + "건: " + 관련.map(x => String(x[0]).slice(5, 10) + " \"" + String(x[2]).split("|").pop().trim().slice(0, 18) + "\"").join(" · ") + " — 이번이 " + (관련.length + 1) + "번째" : "비슷한 메모 없음 (처음 나온 이야기)";
    const 최근14 = 관련.filter(x => (new Date() - 시각파싱(x[0])) < 14 * 86400000);
    const 걱정 = 최근14.length >= 2 ? "같은 이야기가 2주 안에 " + (최근14.length + 1) + "번째 — 손님이 말할 정도면 이미 여러 번 겪은 것" : null;
    const 신호 = "잘한 것: " + (분류 === "칭찬" ? "칭찬은 이번 주 SNS 소재로 쓸 수 있음" : "없음") + " · 걱정: " + (걱정 || "없음");
    let 제안 = "없음";
    if (걱정) 제안 = "이번 주 안에 처리하고, 처리 뒤 이 방에 '했어요'라고 남겨 주세요";
    else if (분류 === "할일") 제안 = "이번 주 안에 처리 — 저녁 정리·아침 보고에서 제가 다시 챙기겠습니다";
    else if (분류 === "불만") 제안 = "같은 불만이 한 번 더 오면 할일로 올리겠습니다 — 지금 바로 처리하시려면 승인";
    else if (분류 === "아이디어") 제안 = "콘텐츠팀에 이번 주 소재로 넘기기";
    else if (분류 === "칭찬") 제안 = "이번 주 카드뉴스 소재로 쓰기 (손님 말 그대로 인용)";
    답(규격("📇 인사팀 · 메모 기록 — " + 날짜표(), "기록: " + 분류 + " | " + 한줄, 비교, 신호, 제안, 제안 === "없음" ? "답장 없이 두셔도 됩니다" : "답장 1 = 승인(할일로 등록) / 2 = 보류"));
  } else if (부서 === "시장조사팀") {                        // Day 14
    const 링크 = t.match(/https?:\/\/\S+/g) || [];
    if (!링크.length) { 답("경쟁 가게의 블로그·홈페이지·플레이스 주소를 붙여 주세요 (1~3개). 인스타그램은 로그인 벽 때문에 못 읽습니다."); return; }
    const 본문 = 링크.slice(0, 3).map(u => { try { return u + "\n" + 본문추출(UrlFetchApp.fetch(u, { muteHttpExceptions: true, followRedirects: true }).getContentText()).slice(0, 3000); } catch (e) { return u + "\n(못 읽음: " + e.message + ")"; } }).join("\n\n");
    const r = 두뇌("아래는 경쟁 가게 페이지 내용이다. 가게별로 제목 한 줄 뒤에 항목을 한 줄씩 정리하라: ①요즘 미는 상품/이벤트 ②가격 신호 ③우리가 바로 따라 할 것 1개 ④우리가 다르게 갈 것 1개. 페이지에 없는 건 '없음'. " + 말투 + "\n[우리 가게]\n" + 정보문장(정보) + "\n[경쟁 페이지]\n" + 본문) || "(Gemini 키 필요)";
    기록("조사", [지금(), 링크.join(" "), r]); 답(r);
  } else if (부서 === "광고팀") {                            // Day 15
    const 지난 = 최근행("광고", 10).slice(-3).map(x => String(x[0]).slice(0, 10) + ": " + String(x[1]).slice(0, 200)).join("\n");
    const r = 두뇌("사장님이 붙여넣은 광고 숫자를 해석하라. 아래 형식 그대로, 다른 말 없이.\n① 한 줄 해석: (오늘 숫자의 뜻)\n② 지난 기록 대비: (지난 기록이 있으면 무엇이 얼마나 늘고 줄었는지 숫자로, 없으면 '첫 기록')\n③ 좋은 신호: … · 걱정 신호: …\n④ 제안: 오늘 할 것 1개 (무엇을·얼마나·왜, 한 줄)\n숫자에 없는 건 추측하지 마라. 용어는 쉬운 말로(노출=본 사람 수, 클릭=눌러 본 사람 수 처럼 괄호 설명). " + 말투 + "\n[가게 정보]\n" + 정보문장(정보) + "\n[지난 기록]\n" + (지난 || "(없음)") + "\n[오늘 광고 숫자]\n" + t) || "(Gemini 키 필요)";
    기록("광고", [지금(), t, r]); 답("📣 광고팀 · 숫자 해석 — " + 날짜표() + "\n" + r + "\n→ 답장 1 = 제안을 할일로 등록 / 2 = 보류");
  } else if (부서 === "정산팀") {                            // Day 16 (AI 없이 동작)
    const 매출 = 숫자(t, /매출[:\s]*([\d,.]+)\s*(만)?/); const 지출 = 숫자(t, /지출[:\s]*([\d,.]+)\s*(만)?/);
    if (매출 === null && 지출 === null) { 답("이렇게 보내 주세요: 매출 32만 지출 8만 (메모는 뒤에 자유롭게)"); return; }
    const 오늘매출 = 매출 || 0, 오늘지출 = 지출 || 0, 남는돈 = 오늘매출 - 오늘지출;
    기록("정산", [지금(), 오늘매출, 오늘지출, 남는돈, t]);
    const 행 = 최근행("정산", 400); const 달키 = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM"); const 오늘키 = 날짜키(new Date());
    const 이달 = 행.filter(x => String(x[0]).indexOf(달키) === 0); const 이전 = 이달.filter(x => String(x[0]).indexOf(오늘키) !== 0);
    const 합 = (arr, i) => arr.reduce((a, x) => a + (Number(x[i]) || 0), 0);
    const 일평균 = 이전.length ? 합(이전, 1) / 이전.length : null; const 달매출 = 합(이달, 1), 달지출 = 합(이달, 2);
    const 지난주 = 며칠전(7); const 지난행 = 행.filter(x => String(x[0]).indexOf(날짜키(지난주)) === 0).pop();
    const 비율 = 오늘매출 ? Math.round(오늘지출 / 오늘매출 * 100) : null; const 평균비율 = 이전.length && 합(이전, 1) ? Math.round(합(이전, 2) / 합(이전, 1) * 100) : null;
    const 비교 = [일평균 !== null ? "이번 달 일평균 매출 " + 원(Math.round(일평균)) + " → 오늘 " + 부호(퍼센트(오늘매출, 일평균)) : "", 지난행 ? "지난주 " + 요일(지난주) + "요일 " + 원(지난행[1]) + " → " + 부호(퍼센트(오늘매출, Number(지난행[1]))) : ""].filter(Boolean).join(" / ") || null;
    const 잘 = [], 걱 = [];
    if (비율 !== null && 평균비율 !== null) { if (비율 < 평균비율) 잘.push("지출 비율 " + 비율 + "% (이번 달 평균 " + 평균비율 + "%보다 낮음)"); else if (비율 > 평균비율 + 5) 걱.push("지출 비율 " + 비율 + "% (이번 달 평균 " + 평균비율 + "%보다 높음)"); }
    if (일평균 !== null && 오늘매출 >= 일평균 * 1.15) 잘.push("매출이 일평균보다 15% 이상 높음"); if (일평균 !== null && 오늘매출 <= 일평균 * 0.7) 걱.push("매출이 일평균의 70% 아래");
    const 신호 = "잘한 것: " + (잘.join(", ") || "없음") + " · 걱정: " + (걱.join(", ") || "없음");
    let 제안;
    if (걱.some(x => /지출 비율/.test(x))) 제안 = "오늘 지출 " + 원(오늘지출) + "의 항목을 인사팀에 한 줄로 남겨 두기 (같은 지출이 또 나오면 제가 묶어서 보고)";
    else if (일평균 !== null && 오늘매출 >= 일평균 * 1.15) 제안 = "오늘처럼 잘 된 이유(메뉴·날씨·행사)를 인사팀에 한 줄로 → 다음 주 " + 요일(new Date()) + "요일에 같은 걸 다시 해보기";
    else if (일평균 !== null && 오늘매출 <= 일평균 * 0.7) 제안 = "콘텐츠팀에 '이번 주 손님 부르는 소재' 요청하기 (콘텐츠팀 방에 '소재' 한 줄)";
    else 제안 = 이전.length < 5 ? "없음 — 기록이 " + (5 - 이전.length) + "일만 더 쌓이면 요일별 흐름을 같이 보고드립니다" : "없음";
    답(규격("💰 정산팀 · 하루 장부 — " + 날짜표(), "기록: 매출 " + 원(오늘매출) + " · 지출 " + 원(오늘지출) + " · 남는 돈 " + 원(남는돈) + "\n   이번 달 누적: 매출 " + 원(달매출) + " · 지출 " + 원(달지출) + " · 남는 돈 " + 원(달매출 - 달지출), 비교, 신호, 제안, /^없음/.test(제안) ? "답장 없이 두셔도 됩니다" : "답장 1 = 승인(할일로 등록) / 2 = 보류"));
  }
}

// ---------- 금요일: 주간 요약 (Day 12) ----------
function 주간요약() {
  const 방 = 방찾기("보고팀"); if (!방) return;
  const 이번 = { 결재: 기간행("결재", 며칠전(6), new Date()), 문의: 기간행("문의", 며칠전(6), new Date()), 게시: 기간행("게시", 며칠전(6), new Date()), 정산: 기간행("정산", 며칠전(6), new Date()) };
  const 지난 = { 결재: 기간행("결재", 며칠전(13), 며칠전(7)), 문의: 기간행("문의", 며칠전(13), 며칠전(7)), 게시: 기간행("게시", 며칠전(13), 며칠전(7)), 정산: 기간행("정산", 며칠전(13), 며칠전(7)) };
  const 합 = (arr, i) => arr.reduce((a, x) => a + (Number(x[i]) || 0), 0); const 매 = 합(이번.정산, 1), 지 = 합(이번.정산, 2), 지매 = 합(지난.정산, 1), 지지 = 합(지난.정산, 2);
  const 숫자줄 = "결재 " + 이번.결재.length + "건 · 문의 " + 이번.문의.length + "건 · 게시 " + 이번.게시.length + "건 · 매출 " + 원(매) + " · 지출 " + 원(지) + " · 남는 돈 " + 원(매 - 지);
  const 비교줄 = "지난주 대비: 결재 " + (이번.결재.length - 지난.결재.length >= 0 ? "+" : "") + (이번.결재.length - 지난.결재.length) + "건 · 문의 " + (이번.문의.length - 지난.문의.length >= 0 ? "+" : "") + (이번.문의.length - 지난.문의.length) + "건 · 게시 " + (이번.게시.length - 지난.게시.length >= 0 ? "+" : "") + (이번.게시.length - 지난.게시.length) + "건 · 매출 " + 부호(퍼센트(매, 지매)) + " · 지출 " + 부호(퍼센트(지, 지지));
  const 모음 = ["결재", "문의", "게시", "메모"].map(탭 => "[" + 탭 + " 이번 주]\n" + (탭 === "메모" ? 최근행("메모", 15) : 이번[탭]).map(r => r.slice(0, 4).join(" | ")).join("\n")).join("\n\n");
  const 머리 = "📊 비서실장 · 주간 요약 — " + 날짜표(며칠전(6)) + "~" + 날짜표();
  let 본문 = 두뇌("이번 주 우리 회사 기록을 보고 사장님께 주간 요약의 ③④ 두 줄만 아래 형식 그대로 써라. 다른 말은 쓰지 마라.\n③ 잘한 것: (기록에서 근거 있는 것 2개, 없으면 '기록 부족') · 걱정: (1개, 없으면 '없음')\n④ 다음 주 제안 1개: (무엇을·언제 한 줄, 기록에 근거)\n[이번 주 숫자]\n" + 숫자줄 + "\n" + 비교줄 + "\n" + 모음);
  if (!본문) 본문 = "③ 잘한 것: 기록 부족 · 걱정: 없음\n④ 다음 주 제안 1개: 없음";
  const 제안 = (본문.split("\n").find(l => l.indexOf("④") === 0) || "").replace(/^④\s*다음 주 제안 1개\s*[:：]?\s*/, "").trim();
  const 글 = "① " + 숫자줄 + "\n② " + 비교줄 + "\n" + 본문;
  기록("보고기록", [지금(), "주간요약", 머리 + "\n" + 글]);
  if (제안 && !/^없음/.test(제안)) 결재요청("보고팀", "주간 요약 · 다음 주 제안 승인", 머리 + "\n" + 글 + "\n(승인하면 제안을 할일로 등록하고 월요일 아침 보고에서 다시 보여드립니다)", "제안", 제안);
  else 보내기(방.chat, 방.thread, 머리 + "\n" + 글 + "\n→ 이번 주는 결재할 제안이 없습니다. 답장 없이 두셔도 됩니다.");
}

// ---------- 비서실장 결재함 (v2) ----------
function 결재요청(부서, 제목, 본문, 종류, 참고) {
  const 방 = 방찾기("보고팀"); if (!방) { Logger.log("보고팀 방을 몰라 결재를 못 올렸습니다: " + 제목); return null; }
  let s = 시트().getSheetByName("결재함"); if (!s) { 탭준비(); s = 시트().getSheetByName("결재함"); }
  const id = s.getLastRow(); // 헤더가 1행이므로 첫 결재는 #1
  const 안내 = 종류 === "번호선택" ? "→ 이 글에 답장으로 마음에 드는 번호를 적어 주세요 (예: 3, 7). 보류면 '보류'" : "→ 이 글에 답장으로 '승인' 또는 '보류'";
  const 글 = "🗂 결재 #" + id + " [" + 부서 + "] " + 제목 + "\n" + 본문 + "\n" + 안내;
  보내기(방.chat, 방.thread, 글);
  s.appendRow([id, 지금(), 부서, 제목, 종류, "대기", "", "", String(참고 || "")]);
  return id;
}
function 결재대기목록() { return 최근행("결재함", 30).filter(r => r[5] === "대기"); }
function 결재답장(id, 답, m) {
  const s = 시트().getSheetByName("결재함"); if (!s) return true;
  const rows = s.getRange(2, 1, Math.max(1, s.getLastRow() - 1), 9).getValues();
  const i = rows.findIndex(r => Number(r[0]) === id); if (i < 0) { 보내기(m.chat.id, m.message_thread_id, "그 결재 번호를 못 찾았습니다."); return true; }
  const r = rows[i]; const 보류 = /보류|나중|아니/.test(답); let 번호들 = Array.from(new Set((답.match(/\d+/g) || []).map(Number)));
  const 이미끝남 = r[5] === "승인"; let 추가 = false;
  if (이미끝남 && !보류 && !번호들.length) return false;                              // 끝난 결재에 번호도 보류도 없는 말("올렸어요" 등) = 결재 답이 아님 → 일반 처리
  if (이미끝남 && r[4] === "번호선택" && 번호들.length) {                            // 이미 승인된 소재 결재에 번호를 더 적음 = 추가 요청 (만든 번호는 건너뜀)
    const 이미 = Array.from(new Set((String(r[6]).match(/\d+/g) || []).map(Number))); const 새것 = 번호들.filter(n => 이미.indexOf(n) < 0);
    if (!새것.length) { 보내기(m.chat.id, m.message_thread_id, "이미 만들어 드린 번호(" + 이미.join(", ") + ")입니다. 다른 번호를 적어 주세요."); return true; }
    번호들 = 새것; 추가 = true;
  }
  const 상태 = 보류 ? "보류" : "승인";
  s.getRange(i + 2, 6, 1, 2).setValues([[상태, 추가 ? String(r[6]) + " + " + 번호들.join(",") : 답]]);
  기록("결재", [지금(), "결재 #" + id + " " + r[3], 답, r[2]]);
  let 후속 = 보류 ? "보류로 기록했습니다." : "승인 처리했습니다.";
  if (!보류 && r[4] === "번호선택" && 번호들.length) 후속 = (추가 ? "추가 " : "") + 소재후속(r, 번호들);
  else if (!보류 && (r[4] === "조사" || r[4] === "제안")) { 기록("메모", [지금(), "결재 #" + id + " 승인", "할일 | " + String(r[8]).slice(0, 80)]); 후속 = "승인 처리했습니다. " + (r[4] === "제안" ? "제안을 인사팀 할일로 넣어 두었습니다 — 아침 보고에서 다시 챙깁니다." : "'따라 할 것'을 인사팀 할일로 넣어 두었습니다."); }
  s.getRange(i + 2, 8, 1, 1).setValues([[후속.split("\n")[0].slice(0, 60)]]);
  보내기(m.chat.id, m.message_thread_id, "✅ 결재 #" + id + " " + 후속); return true;
}
function 소재후속(r, 번호들) {                                   // 승인된 소재 번호 → 카드뉴스 문구를 바로 만들어 콘텐츠팀에 올림
  const 목록 = String(r[8]).split("\n"); const 고른것 = 번호들.map(n => 목록.find(l => l.indexOf(n + ".") === 0)).filter(Boolean);
  if (!고른것.length) return "승인 처리했습니다(번호를 못 찾아 문구는 안 만들었습니다).";
  const 정보 = 회사정보(); const 방 = 방찾기("콘텐츠팀");
  고른것.forEach(소재 => {
    const 문구 = 두뇌("아래 소재로 인스타 카드뉴스 문구를 써라: 표지 제목(10자 내) 1개, 본문 슬라이드 4장(각 2줄), 마지막 슬라이드 행동 유도 1줄. 해시태그 5개.\n[가게 정보]\n" + 정보문장(정보) + "\n[소재]\n" + 소재) || "(Gemini 키 필요)";
    기록("소재", [지금(), "카드뉴스(결재)", 소재, 문구]); if (방) 보내기(방.chat, 방.thread, "🗂 결재 #" + r[0] + " 승인 → 카드뉴스 문구\n[" + 소재 + "]\n" + 문구);
  });
  return "승인 " + 고른것.length + "개 → 카드뉴스 문구를 콘텐츠팀에 올렸습니다. 올리신 뒤 '올렸어요'라고만 해 주세요.";
}

// ---------- 부서가 먼저 움직이는 일들 (v2) ----------
function 월요소재() {                                            // 월요일 07시: 콘텐츠팀이 소재 10개를 먼저 제안 → 결재
  const 정보 = 회사정보();
  const r = 두뇌("이 가게의 이번 주 SNS 소재 10개를 한 줄에 하나씩 써라. 각 줄: 번호. 제목(15자 내) — 왜 손님이 반응할지 한 마디. 손님이 자주 묻는 질문·요즘 고민·계절을 섞어라.\n[가게 정보]\n" + 정보문장(정보));
  if (!r) { Logger.log("Gemini 키가 없어 월요 소재를 건너뜁니다."); return; }
  기록("소재", [지금(), "소재10(자동)", "월요 자동", r]);
  const 방 = 방찾기("콘텐츠팀"); if (방) 보내기(방.chat, 방.thread, "🗓 이번 주 소재 10개 (제가 먼저 준비했습니다)\n" + r + "\n→ 이 글에 답장으로 만들 번호를 적어 주세요 (예: 3, 7)");
  결재요청("콘텐츠팀", "이번 주 소재 10개 중 만들 것 고르기", r, "번호선택", r);
}
function 경쟁사정찰() {                                          // 수요일 07시: 등록된 경쟁사 페이지를 다시 보고 바뀐 점만 보고 → 결재
  const s = 시트().getSheetByName("경쟁사"); if (!s || s.getLastRow() < 2) return;
  const rows = s.getRange(2, 1, s.getLastRow() - 1, 3).getValues(); const 정보 = 회사정보(); const 결과 = [];
  rows.forEach((row, i) => {
    const u = String(row[0]); if (!/^https?:/.test(u)) return;
    let 본문 = ""; try { 본문 = 본문추출(UrlFetchApp.fetch(u, { muteHttpExceptions: true, followRedirects: true }).getContentText()).slice(0, 3000); } catch (e) { 본문 = "(못 읽음: " + e.message + ")"; }
    const r = 두뇌("경쟁 가게 페이지를 지난주 요약과 비교해 정리하라. 형식: 첫 줄 '가게: 주소 끝부분', 그 다음 ①이번 주 새로 보이는 것(없으면 '변화 없음') ②가격 신호 ③우리가 바로 따라 할 것 1개 ④다르게 갈 것 1개. 페이지에 없는 건 '없음'.\n[우리 가게]\n" + 정보문장(정보) + "\n[지난주 요약]\n" + (row[1] || "(처음)") + "\n[이번 주 페이지]\n" + u + "\n" + 본문);
    if (!r) return;
    s.getRange(i + 2, 2, 1, 2).setValues([[r.slice(0, 1500), 지금()]]); 기록("조사", [지금(), u, r]); 결과.push(r);
  });
  if (!결과.length) return;
  const 방 = 방찾기("시장조사팀"); if (방) 보내기(방.chat, 방.thread, "🔎 수요일 경쟁사 정찰\n\n" + 결과.join("\n\n"));
  const 따라할것 = 결과.map(r => { const ls = r.split("\n"); const k = ls.findIndex(l => l.indexOf("③") === 0); if (k < 0) return ""; let t = ls[k].trim(); if (!t.replace(/^③\s*우리가\s*바로\s*따라\s*할\s*것\s*1개\s*[:：]?/, "").trim() && ls[k + 1]) t += " " + ls[k + 1].trim(); return t; }).filter(Boolean).join(" / ");   // "③ 따라 할 것 1개" 줄 다음 줄에 내용이 오는 경우까지
  결재요청("시장조사팀", "경쟁사 정찰 — 따라 할 것 승인", 따라할것 || 결과[0].split("\n").slice(0, 4).join("\n"), "조사", 따라할것);
}
function 저녁정리() {                                            // 매일 18시: 비서실장이 미결재·할일을 한 번 더 챙김
  const 방 = 방찾기("보고팀"); if (!방) return;
  const 대기 = 결재대기목록(); const 할일 = 최근행("메모", 30).filter(r => /^할일/.test(String(r[2]))).slice(-5);
  const 오늘 = new Date(); const 문의 = 기간행("문의", 오늘, 오늘), 게시 = 기간행("게시", 오늘, 오늘), 정산 = 기간행("정산", 오늘, 오늘), 메모 = 기간행("메모", 오늘, 오늘), 결재 = 기간행("결재", 오늘, 오늘);
  if (!대기.length && !할일.length && !문의.length && !게시.length && !정산.length && !메모.length) return;
  const 사실 = "오늘: 문의 " + 문의.length + "건 · 게시 " + 게시.length + "건 · 메모 " + 메모.length + "건 · 결재 " + 결재.length + "건" + (정산.length ? " · 장부 기록됨" : " · 장부 아직 안 씀");
  const 비교 = 대기.length ? "아직 결재 안 된 것 " + 대기.length + "건: " + 대기.map(r => "#" + r[0] + " " + r[3]).join(", ") + " (위로 올라가 그 글에 답장)" : "결재 밀린 것 없음";
  const 신호 = "잘한 것: " + (결재.length ? "결재 " + 결재.length + "건을 당일에 끝냄" : "없음") + " · 걱정: " + (!정산.length ? "오늘 장부가 아직 없음 (정산팀에 '매출 ○○만 지출 ○○만' 한 줄)" : (대기.length >= 3 ? "결재가 3건 이상 밀림" : "없음"));
  const 제안 = 할일.length ? "내일 첫 일: " + String(할일[0][2]).replace(/^할일\s*\|\s*/, "").slice(0, 40) + " (남은 할일 " + 할일.length + "개)" : "없음";
  보내기(방.chat, 방.thread, 규격("🌙 비서실장 · 저녁 정리 — " + 날짜표(), 사실, 비교, 신호, 제안, "답장 없이 두셔도 됩니다 · 할일을 끝냈으면 인사팀에 '했어요 (내용)' 한 줄"));
}
function 월정산() {                                              // 매월 1일: 지난달 정산 요약
  const 방 = 방찾기("정산팀") || 방찾기("보고팀"); if (!방) return;
  const d = new Date(); d.setDate(0); const 달 = Utilities.formatDate(d, "Asia/Seoul", "yyyy-MM");
  let 매출 = 0, 지출 = 0, 건 = 0; 최근행("정산", 400).forEach(r => { if (String(r[0]).indexOf(달) === 0) { 매출 += Number(r[1]) || 0; 지출 += Number(r[2]) || 0; 건++; } });
  const d2 = new Date(d); d2.setDate(0); const 전달 = Utilities.formatDate(d2, "Asia/Seoul", "yyyy-MM"); let 전매 = 0, 전지 = 0; 최근행("정산", 800).forEach(r => { if (String(r[0]).indexOf(전달) === 0) { 전매 += Number(r[1]) || 0; 전지 += Number(r[2]) || 0; } });
  const 비율 = 매출 ? Math.round(지출 / 매출 * 100) : null;
  보내기(방.chat, 방.thread, 규격("📅 정산팀 · " + 달 + " 월 정산", "기록 " + 건 + "일 · 매출 " + 원(매출) + " · 지출 " + 원(지출) + " · 남는 돈 " + 원(매출 - 지출), 전매 ? "지난달(" + 전달 + ") 대비 매출 " + 부호(퍼센트(매출, 전매)) + " · 지출 " + 부호(퍼센트(지출, 전지)) : null, "잘한 것: " + (건 >= 20 ? "장부를 " + 건 + "일 꾸준히 씀" : "없음") + " · 걱정: " + (비율 !== null && 비율 > 40 ? "지출 비율 " + 비율 + "%" : (건 < 15 ? "장부 기록이 " + 건 + "일뿐 — 흐름을 보려면 매일 한 줄" : "없음")), 건 < 15 ? "이번 달은 정산팀에 매일 한 줄 남기기 (보고 시각 알림에 붙여 드릴까요)" : "없음", "답장 1 = 승인(할일로 등록) / 2 = 보류"));
}

// ---------- 도구들 ----------
const 두뇌모델 = ["gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"]; // 무료 하루 한도: 앞 모델 20회 → 넘기면 다음 모델(각 500회)로 자동 전환 (2026-09 AI Studio 화면 기준)
function 두뇌(질문) {
  if (!GEMINI_KEY || GEMINI_KEY.indexOf("여기에") === 0) return null;
  const 규칙 = "텔레그램 메시지로 보낼 순수 텍스트로만 답해라. 표 기호(|, ---), 굵게(**), 제목(#), <br> 같은 마크다운은 절대 쓰지 말고, 번호와 줄바꿈만 써라.\n\n";
  let 오류 = "";
  for (let i = 0; i < 두뇌모델.length; i++) {
    const res = UrlFetchApp.fetch("https://generativelanguage.googleapis.com/v1beta/models/" + 두뇌모델[i] + ":generateContent?key=" + GEMINI_KEY,
      { method: "post", contentType: "application/json", payload: JSON.stringify({ contents: [{ parts: [{ text: 규칙 + 질문 }] }] }), muteHttpExceptions: true });
    const json = JSON.parse(res.getContentText());
    if (json.candidates) return 정리(json.candidates[0].content.parts.map(p => p.text).join(""));
    오류 = (json.error && json.error.message) || "";
    if (res.getResponseCode() !== 429 && res.getResponseCode() !== 503 && !/demand|overloaded/i.test(오류)) break;                    // 429 = 오늘 무료 한도 초과 → 다음 모델로. 그 외(키 오류 등)는 바로 알림
  }
  throw new Error("Gemini 키 문제: " + 오류.slice(0, 100));
}
function 정리(글) {                                          // 혹시 남은 마크다운 기호를 지웁니다 (텔레그램은 표를 못 그립니다)
  return String(글).replace(/<br\s*\/?>/gi, "\n").replace(/\*\*/g, "").replace(/^#+\s*/gm, "").split("\n")
    .filter(l => !/^\s*\|?\s*(:?-{2,}:?\s*\|\s*)+:?-*:?\s*\|?\s*$/.test(l)).map(l => l.replace(/^\s*\|\s*/, "").replace(/\s*\|\s*$/, "").replace(/\s*\|\s*/g, " · ")).join("\n").trim();
}
function 보내기(chat, thread, 글) {
  const body = { chat_id: chat, text: String(글).slice(0, 4000) }; if (thread) body.message_thread_id = thread;
  const r = JSON.parse(UrlFetchApp.fetch(API + "/sendMessage", { method: "post", contentType: "application/json", payload: JSON.stringify(body), muteHttpExceptions: true }).getContentText());
  return r.ok ? r.result : null;
}
const 부서목록 = ["보고팀", "고객응대팀", "콘텐츠팀", "인사팀", "시장조사팀", "광고팀", "정산팀"];
function 부서정리(이름) { const n = String(이름 || "").replace(/\s/g, ""); return 부서목록.find(b => n.indexOf(b) >= 0) || n; }
function 부서이름(m) {
  const r = m.reply_to_message; if (r && r.forum_topic_created) return 부서정리(r.forum_topic_created.name);
  if (m.forum_topic_created) return 부서정리(m.forum_topic_created.name);
  return m.message_thread_id ? (저장소.getProperty("이름:" + m.message_thread_id) || "General") : "General";
}
function 방저장(부서, chat, thread) { 저장소.setProperty("방:" + 부서, JSON.stringify({ chat: chat, thread: thread })); if (thread) 저장소.setProperty("이름:" + thread, 부서); }
function 방찾기(부서) { const s = 저장소.getProperty("방:" + 부서); return s ? JSON.parse(s) : null; }
function 시트() { return SpreadsheetApp.openByUrl(SHEET_URL); }
function 회사정보() { const o = {}; 시트().getSheets()[0].getRange("A2:B12").getValues().forEach(r => { if (r[0]) o[String(r[0]).trim()] = String(r[1] || "").trim(); }); const 설 = 설정읽기(); if (설["호칭"]) o["사장님을 부르는 호칭"] = 설["호칭"]; if (설["말투"]) o["AI 직원에게 바라는 말투"] = 설["말투"];
  const faq = 시트().getSheetByName("FAQ"); if (faq && faq.getLastRow() >= 2) { const q = faq.getRange(2, 1, Math.min(faq.getLastRow() - 1, 30), 2).getValues().filter(r => r[0]).map(r => "Q. " + String(r[0]).trim() + " → A. " + String(r[1] || "").trim()); if (q.length) o["자주 묻는 질문(이대로 답할 것)"] = q.join(" / "); }   // Day 17
  return o; } // 설정 탭(Day 13)이 시트1보다 우선
function 정보문장(정보) { return Object.keys(정보).map(k => k + ": " + (정보[k] || "(비어 있음)")).join("\n"); }
function 설정읽기() { const o = {}; const s = 시트().getSheetByName("설정"); if (s) s.getRange("A2:B10").getValues().forEach(r => { if (r[0]) o[String(r[0]).trim()] = String(r[1] || "").trim(); }); return o; }
function 탭준비() {
  const ss = 시트();
  const 틀 = { "설정": ["항목", "값"], "보고기록": ["시각", "종류", "내용", "메시지번호"], "결재": ["시각", "원문 첫 줄", "사장님 답장", "부서"], "문의": ["시각", "손님 문의", "답변 초안"], "소재": ["시각", "종류", "요청", "결과"], "게시": ["시각", "내용"], "메모": ["시각", "원문", "정리"], "조사": ["시각", "링크", "결과"], "광고": ["시각", "숫자", "해석"], "정산": ["시각", "매출", "지출", "남는 돈", "원문"], "결재함": ["번호", "시각", "부서", "제목", "종류", "상태", "답장", "후속", "참고"], "경쟁사": ["주소", "지난 요약", "마지막 확인"], "FAQ": ["질문", "답"] };
  Object.keys(틀).forEach(이름 => { let s = ss.getSheetByName(이름); if (!s) { s = ss.insertSheet(이름); s.appendRow(틀[이름]); s.getRange(1, 1, 1, 틀[이름].length).setFontWeight("bold"); } });
  const 설 = ss.getSheetByName("설정"); if (설.getLastRow() < 2) { 설.getRange("A2:B4").setValues([["보고 시각", "8"], ["말투", "짧고 공손하게, 존댓말"], ["호칭", "사장님"]]); }
}
function 기록(탭, 행) { let s = 시트().getSheetByName(탭); if (!s) { 탭준비(); s = 시트().getSheetByName(탭); } s.appendRow(행); }
function 최근행(탭, n) { const s = 시트().getSheetByName(탭); if (!s || s.getLastRow() < 2) return []; const from = Math.max(2, s.getLastRow() - n + 1); return s.getRange(from, 1, s.getLastRow() - from + 1, s.getLastColumn()).getValues().map(r => { if (r[0] instanceof Date) r[0] = Utilities.formatDate(r[0], "Asia/Seoul", "yyyy-MM-dd HH:mm"); return r; }); }
function 지금() { return Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm"); }
// ---------- 보고 규격 (v2.1): 모든 부서가 같은 5줄로 보고합니다 ----------
function 규격(머리, 사실, 비교, 신호, 제안, 결재) {
  return 머리 + "\n① " + 사실 + "\n② " + (비교 || "비교할 기록이 아직 없음 (기록이 쌓이면 자동으로 붙습니다)") + "\n③ " + (신호 || "잘한 것: 없음 · 걱정: 없음") + "\n④ 제안: " + (제안 || "없음") + "\n→ " + (결재 || "답장 1 = 제안 승인(할일로 등록) / 2 = 보류 / 고칠 내용은 그대로 써 주세요");
}
function 날짜표(d) { d = d || new Date(); return Utilities.formatDate(d, "Asia/Seoul", "M월 d일") + " (" + ["월", "화", "수", "목", "금", "토", "일"][Number(Utilities.formatDate(d, "Asia/Seoul", "u")) - 1] + ")"; }
function 요일(d) { return ["월", "화", "수", "목", "금", "토", "일"][Number(Utilities.formatDate(d, "Asia/Seoul", "u")) - 1]; }
function 퍼센트(a, b) { if (!b) return null; return Math.round((a - b) / b * 100); }
function 부호(n) { return n === null ? "-" : (n >= 0 ? "+" : "") + n + "%"; }
function 날짜키(d) { return Utilities.formatDate(d, "Asia/Seoul", "yyyy-MM-dd"); }
function 며칠전(n) { const d = new Date(); d.setDate(d.getDate() - n); return d; }
function 기간행(탭, 부터, 까지) { const a = 날짜키(부터), b = 날짜키(까지); return 최근행(탭, 400).filter(r => { const k = String(r[0]).slice(0, 10); return k >= a && k <= b; }); }
function 낱말들(t) { return String(t).replace(/[^가-힣a-zA-Z0-9 ]/g, " ").split(/\s+/).map(w => w.replace(/(이|가|은|는|을|를|도|에|의|로|과|와|만|께서|에서|한테|이라고|라고)$/, "")).filter(w => w.length >= 2 && !/^(그리고|그래서|오늘|어제|내일|손님|사장님|직접|말함|말씀|해야|같아|같음|있음|없음|다시|아직|이번|지난|그냥|진짜|정말|한번|우리|가게|매장)$/.test(w)).slice(0, 8); }
function 시각파싱(s) { const d = new Date(String(s).replace(" ", "T") + ":00+09:00"); return isNaN(d) ? new Date(0) : d; }
function 숫자(t, re) { const m = t.match(re); if (!m) return null; let v = Number(m[1].replace(/,/g, "")); if (m[2]) v *= 10000; return v; }
function 원(v) { return (Number(v) || 0).toLocaleString("ko-KR") + "원"; }
function 이번달합계() { const 달 = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM"); let 매출 = 0, 지출 = 0; 최근행("정산", 200).forEach(r => { if (String(r[0]).indexOf(달) === 0) { 매출 += Number(r[1]) || 0; 지출 += Number(r[2]) || 0; } }); return { 매출, 지출 }; }
function 본문추출(html) { return String(html).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").trim(); }
