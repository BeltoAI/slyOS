/* Simple helpers */
const $ = (sel, el=document) => el.querySelector(sel);
const $$ = (sel, el=document) => Array.from(el.querySelectorAll(sel));

/* Animated counters on view */
(function counters(){
  const els = $$('.counter');
  if (!els.length) return;
  const io = new IntersectionObserver(entries=>{
    entries.forEach(e=>{
      if (!e.isIntersecting) return;
      const el = e.target; io.unobserve(el);
      const target = Number(el.dataset.count || '0');
      const dur = 900;
      const t0 = performance.now();
      function step(t){
        const k = Math.min(1, (t - t0)/dur);
        el.textContent = Math.round(target * (0.15 + 0.85*k));
        if (k<1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }, { threshold: 0.4 });
  els.forEach(el=>io.observe(el));
})();

/* Pricing slider */
(function pricing(){
  const slider = $('#tokens');
  const out = $('#tokensOut');
  const slyEl = $('#slyTotal');
  const awsEl = $('#awsTotal');
  const gcpEl = $('#gcpTotal');
  const big = $('#savingsPctBig');
  const bar = $('.saveBar .fill');

  if (!slider) return;
  const RATE = { sly: 0.01, aws: 0.70, gcp: 0.85 }; // per 1M tokens (illustrative)
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  function fmt(n){ return `$${n.toFixed(n>=100?0:(n>=10?1:2))}`; }

  function update(){
    const m = clamp(Number(slider.value||'1'), 1, 200);
    out.textContent = `${m}M tokens / mo`;
    const sly = m * RATE.sly;
    const aws = m * RATE.aws;
    const gcp = m * RATE.gcp;
    const avg = (aws + gcp)/2;
    const savePct = clamp(100 * (1 - (sly/avg)), 0, 98.0);

    slyEl.textContent = fmt(sly);
    awsEl.textContent = fmt(aws);
    gcpEl.textContent = fmt(gcp);
    big.textContent = `up to ${Math.round(savePct)}%`;
    bar.style.width = `${savePct}%`;
  }

  slider.addEventListener('input', update);
  update();
})();

/* Waitlist form -> /api/waitlist */
(function waitlist(){
  const form = $('#waitlistForm');
  if (!form) return;
  const email = $('#email');
  const status = $('#status');
  const orgRow = $('#orgRow');
  const audCompany = $('#aud-company');
  const audApp = $('#aud-app');

  function show(msg, ok=true){
    status.textContent = msg;
    status.style.color = ok ? '#9be47a' : '#ff7a7a';
  }

  function toggleOrg(){
    const isCompany = audCompany.checked;
    orgRow.style.display = isCompany ? '' : 'none';
  }
  toggleOrg();
  audCompany.addEventListener('change', toggleOrg);
  audApp.addEventListener('change', toggleOrg);

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const emailVal = (email.value||'').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) { show('Enter a valid email', false); return; }
    const audience = audCompany.checked ? 'company' : 'app';
    const org = ($('#org').value||'').trim();

    try{
      const res = await fetch('/api/waitlist', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ email: emailVal, audience, org })
      });
      const data = await res.json().catch(()=>({}));
      if (!res.ok || !data.ok){ throw new Error(data.error || 'Failed'); }
      show('Added to waitlist. Check your inbox soon.');
      form.reset(); toggleOrg();
    }catch(err){
      show(err.message || 'Error. Please try again.', false);
    }
  });
})();

/* Background canvases (soft nebula + mesh) */
(function bg(){
  const nebula = $('#nebula');
  const mesh = $('#mesh');
  [nebula, mesh].forEach(c=>{
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio||1);
    function size(){
      c.width = Math.floor(innerWidth * dpr);
      c.height = Math.floor(innerHeight * dpr);
      c.style.width = innerWidth+'px';
      c.style.height = innerHeight+'px';
    }
    size();
    window.addEventListener('resize', size);
  });

  if (nebula){
    const ctx = nebula.getContext('2d');
    let t0 = performance.now();
    function draw(t){
      const dt = (t - t0)/1000;
      t0 = t;
      const w = nebula.width, h = nebula.height;
      ctx.clearRect(0,0,w,h);
      const cx = w*0.28, cy = h*0.32;
      const r = Math.max(w,h)*0.6;
      const g = ctx.createRadialGradient(cx + 20*Math.sin(t/2000), cy + 12*Math.cos(t/1900), r*0.05, cx, cy, r);
      g.addColorStop(0, 'rgba(255,122,24,0.25)');
      g.addColorStop(0.35, 'rgba(255,184,0,0.18)');
      g.addColorStop(0.7, 'rgba(255,61,129,0.12)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0,0,w,h);
      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  }

  if (mesh){
    const ctx = mesh.getContext('2d');
    function draw(){
      const w = mesh.width, h = mesh.height;
      ctx.clearRect(0,0,w,h);
      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = '#ffffff';
      const step = Math.max(40, Math.min(90, Math.floor(Math.min(w,h)/18)));
      for (let x=0; x<w; x+=step){
        ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke();
      }
      for (let y=0; y<h; y+=step){
        ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    draw();
    addEventListener('resize', draw);
  }
})();
