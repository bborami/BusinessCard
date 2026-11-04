// 명함 주소(/kimmega)로 들어오면, 카카오톡 같은 메신저가 읽는 미리보기 정보(오픈 그래프)를
// 그 명함의 이름·회사·전화번호·사진으로 바꿔서 보내줘요. 화면 자체는 그대로 index.html 이에요.
const SUPABASE_URL = 'https://tgxkbbisamxfkgypqtdo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_rslhyKpfUMeQXHvfv8xA1A_5ueHLAMc'; // 공개용 키
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,29}$/;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function setMeta(html, prop, value) {
  const re = new RegExp(`<meta (property|name)="${prop.replace(/[:.]/g, '\\$&')}" content="[^"]*">`);
  const tag = `<meta ${prop.startsWith('og:') ? 'property' : 'name'}="${prop}" content="${esc(value)}">`;
  return re.test(html) ? html.replace(re, tag) : html.replace('</head>', `${tag}\n</head>`);
}

export default async (request, context) => {
  const url = new URL(request.url);
  const slug = url.pathname.replace(/^\/+|\/+$/g, '');
  const res = await context.next();
  if (!(res.headers.get('content-type') || '').includes('text/html')) return res;

  // 기본 미리보기 이미지 주소를 이 사이트 주소로 채워요
  let html = (await res.text()).replaceAll('__SITE_URL__', `${url.origin}/`);
  const done = () => {
    const headers = new Headers(res.headers);
    headers.delete('content-length');
    return new Response(html, { status: 200, headers });
  };
  if (!SLUG_RE.test(slug)) return done(); // 명함 주소가 아니면 기본 미리보기

  let card = null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/cards?slug=eq.${slug}&select=data`, {
      headers: { apikey: SUPABASE_KEY, Accept: 'application/json' }
    });
    if (r.ok) card = (await r.json())[0]?.data || null;
  } catch (e) { /* 실패하면 기본 미리보기 그대로 */ }
  if (!card) return done();

  const name = card.n || '디지털 명함';
  const title = [name, card.c, card.p].filter(Boolean).join(' · ');
  const desc = (card.i || '').replace(/\s+/g, ' ').trim() || `${name} 디지털 명함`;
  const image = /^https:\/\//.test(card.f || '') ? card.f : `${url.origin}/og-image.jpg`;

  html = setMeta(html, 'og:title', title);
  html = setMeta(html, 'og:description', desc);
  html = setMeta(html, 'og:image', image);
  html = setMeta(html, 'og:url', `${url.origin}/${slug}`);
  html = setMeta(html, 'description', desc);
  if (image !== `${url.origin}/og-image.jpg`) {
    // 사진은 세로라서 기본 이미지 크기 정보는 지워요
    html = html.replace(/<meta property="og:image:(width|height)" content="[^"]*">\n?/g, '');
  }
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(name)} · 디지털 명함</title>`);

  return done();
};
