const USE_GOOGLE_SHEETS = true;
const SHEET_ID = '1UUUu153ZXHCOUBK5ulZRt_ivpl_9NyTj';

const SHEET_NAMES = ['project_meta', 'modules', 'closure_status', 'infra', 'upcoming'];

function buildSheetUrl(sheetName) {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
}

const ENGINE = (() => {

  async function fetchGoogleSheets() {
    const sheets = {};
    await Promise.all(SHEET_NAMES.map(async name => {
      const url = buildSheetUrl(name);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch sheet "${name}": ${res.status}`);
      const csv = await res.text();
      const parsed = Papa.parse(csv.trim(), { header: true, skipEmptyLines: true });
      sheets[name] = parsed.data;
    }));
    return sheets;
  }

  function parseCSV(raw) {
    const sheets = {};
    const sections = raw.split(/^## SHEET:\s*/m).filter(s => s.trim());
    sections.forEach(section => {
      const lines = section.trim().split('\n');
      const sheetName = lines[0].trim();
      const csvBody = lines.slice(1).join('\n');
      const parsed = Papa.parse(csvBody.trim(), { header: true, skipEmptyLines: true });
      sheets[sheetName] = parsed.data;
    });
    return sheets;
  }

  function setEl(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function buildMeta(data) {
    const m = {};
    data.forEach(r => { m[r.key] = r.value; });
    setEl('meta-org', m.org_name);
    setEl('meta-project', m.project_name);
    setEl('meta-week', m.week_label);
    setEl('meta-closure', m.expected_closure);
    setEl('meta-closure-note', m.closure_note);
    setEl('meta-desc', m.project_desc);
    setEl('meta-scope', m.scope_note);
    setEl('meta-quality', m.quality_note);
    setEl('meta-trophy', m.footer_trophy);
    const pct = parseInt(m.completion_pct) || 0;
    setEl('stat-completion', pct + '%');
    document.querySelectorAll('.main-progress-fill').forEach(el => {
      setTimeout(() => el.style.width = pct + '%', 300);
    });
    const circle = document.getElementById('progress-circle');
    if (circle) {
      const r = 54; const circ = 2 * Math.PI * r;
      circle.style.strokeDasharray = circ;
      setTimeout(() => { circle.style.strokeDashoffset = circ - (pct / 100) * circ; }, 400);
    }
    setEl('progress-pct-text', pct + '%');
  }

  function buildStats(modules) {
    setEl('stat-total', modules.length);
    setEl('stat-completed', modules.filter(m => m.status === 'Completed').length);
    setEl('stat-inprogress', modules.filter(m => m.status === 'In Progress').length);
    setEl('stat-upcoming', modules.filter(m => m.status === 'Upcoming').length);
  }

  function buildModuleLists(modules) {
    const completed = modules.filter(m => m.status === 'Completed');
    const inprogress = modules.filter(m => m.status === 'In Progress');
    const upcoming = modules.filter(m => m.status === 'Upcoming');

    const allList = document.getElementById('all-modules-list');
    if (allList) {
      allList.innerHTML = modules.map((m, i) => `
        <div class="module-item status-${m.status.toLowerCase().replace(' ','-')}">
          <span class="mod-num">${String(i+1).padStart(2,'0')}</span>
          <span class="mod-name">${m.module_name}</span>
          <span class="mod-badge badge-${m.status.toLowerCase().replace(' ','-')}">${m.status}</span>
        </div>
      `).join('');
    }

    const compList = document.getElementById('completed-modules-list');
    if (compList) {
      compList.innerHTML = completed.map(m => `
        <div class="module-item">
          <span class="check-icon">✓</span>
          <span>${m.module_name}</span>
        </div>
      `).join('') || '<div class="module-item" style="color:var(--muted);font-style:italic">No completed modules yet.</div>';
    }

    const ipList = document.getElementById('inprogress-modules-list');
    if (ipList) {
      ipList.innerHTML = inprogress.map(m => `
        <div class="module-item ip">
          <div class="ip-top">
            <span class="ip-dot"></span>
            <span class="ip-name">${m.module_name}</span>
            <span class="sub-badge sub-${(m.sub_status||'').toLowerCase().replace(/ /g,'-')}">${m.sub_status||''}</span>
          </div>
          ${m.expected_date ? `<div class="ip-date">Expected: ${m.expected_date}</div>` : ''}
        </div>
      `).join('') || '<div class="module-item" style="color:var(--muted);font-style:italic">None currently in progress.</div>';
    }

    const upList = document.getElementById('upcoming-modules-list');
    if (upList) {
      upList.innerHTML = upcoming.map(m => `
        <div class="module-item upcoming">
          <span class="up-dot">◦</span>
          <span>${m.module_name}</span>
          ${m.expected_date ? `<span class="up-date">${m.expected_date}</span>` : ''}
        </div>
      `).join('') || '<div class="module-item" style="color:var(--muted);font-style:italic">No upcoming modules listed.</div>';
    }
  }

  function buildDonutChart(canvasId, completed, inprogress, upcoming) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const data = [completed, inprogress, upcoming];
    const colors = ['#22c55e','#2563eb','#94a3b8'];
    const labels = ['Completed','In Progress','Upcoming'];
    const total = data.reduce((a,b) => a+b, 0);
    if (total === 0) return;
    const cx = canvas.width/2, cy = canvas.height/2;
    const r = Math.min(cx, cy) - 20;
    const innerR = r * 0.62;
    let startAngle = -Math.PI/2;
    data.forEach((val, i) => {
      if (val === 0) return;
      const slice = (val / total) * 2 * Math.PI;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, startAngle, startAngle + slice);
      ctx.closePath();
      ctx.fillStyle = colors[i];
      ctx.fill();
      startAngle += slice;
    });
    ctx.beginPath();
    ctx.arc(cx, cy, innerR, 0, 2*Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#1a2744';
    ctx.font = 'bold 22px Rajdhani';
    ctx.fillText(total, cx, cy + 4);
    ctx.font = '11px Nunito Sans';
    ctx.fillStyle = '#8899bb';
    ctx.fillText('Total', cx, cy + 18);
    const legend = document.getElementById(canvasId + '-legend');
    if (legend) {
      legend.innerHTML = data.map((v, i) => `
        <div class="legend-item">
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${colors[i]};margin-right:5px"></span>
          <span>${labels[i]}: <strong>${v}</strong></span>
        </div>
      `).join('');
    }
  }

  function buildBarChart(canvasId, modules) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const completed = modules.filter(m=>m.status==='Completed').length;
    const inprogress = modules.filter(m=>m.status==='In Progress').length;
    const upcoming = modules.filter(m=>m.status==='Upcoming').length;
    const total = modules.length;
    const bars = [
      { label: 'Total', val: total, color: '#94a3b8' },
      { label: 'Completed', val: completed, color: '#22c55e' },
      { label: 'In Progress', val: inprogress, color: '#2563eb' },
      { label: 'Upcoming', val: upcoming, color: '#f59e0b' },
    ];
    const W = canvas.width, H = canvas.height;
    const padL = 36, padR = 16, padT = 16, padB = 48;
    const barW = (W - padL - padR) / bars.length * 0.55;
    const gap = (W - padL - padR) / bars.length;
    const maxVal = total || 1;
    const chartH = H - padT - padB;
    ctx.clearRect(0, 0, W, H);
    for (let i=0; i<=4; i++) {
      const y = padT + chartH - (i/4)*chartH;
      ctx.strokeStyle = '#e8eef8'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
      ctx.fillStyle = '#8899bb'; ctx.font = '10px Nunito Sans'; ctx.textAlign = 'right';
      ctx.fillText(Math.round(maxVal*i/4), padL - 4, y + 3);
    }
    bars.forEach((b, i) => {
      const x = padL + i * gap + gap/2 - barW/2;
      const barH = (b.val / maxVal) * chartH;
      const y = padT + chartH - barH;
      const rad = 4;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.moveTo(x + rad, y);
      ctx.lineTo(x + barW - rad, y);
      ctx.quadraticCurveTo(x+barW, y, x+barW, y+rad);
      ctx.lineTo(x+barW, y+barH);
      ctx.lineTo(x, y+barH);
      ctx.lineTo(x, y+rad);
      ctx.quadraticCurveTo(x, y, x+rad, y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#1a2744'; ctx.font = 'bold 12px Rajdhani'; ctx.textAlign = 'center';
      ctx.fillText(b.val, x + barW/2, y - 5);
      ctx.fillStyle = '#4a5880'; ctx.font = '10px Nunito Sans';
      ctx.fillText(b.label, x + barW/2, H - 8);
    });
  }

  function buildClosureStrip(data) {
    const strip = document.getElementById('closure-strip');
    if (!strip) return;
    strip.innerHTML = data.map(d => `
      <div class="closure-item badge-bg-${d.badge_color}">
        <div class="closure-icon">${d.icon}</div>
        <div class="closure-info">
          <div class="closure-name">${d.group_name}</div>
          <div class="closure-desc">${d.group_desc}</div>
        </div>
        <div class="closure-status badge-${d.badge_color}">${d.status}</div>
      </div>
    `).join('');
  }

  function buildInfra(data) {
    const wrap = document.getElementById('infra-tiles');
    if (!wrap) return;
    wrap.innerHTML = data.map(d => `
      <div class="infra-tile">
        <span class="infra-icon">${d.icon}</span>
        <span class="infra-name">${d.name}</span>
        <span class="infra-sub">${d.sublabel}</span>
      </div>
    `).join('');
  }

  function buildUpcoming(data) {
    const wrap = document.getElementById('upcoming-list');
    if (!wrap) return;
    wrap.innerHTML = data.map(d => `
      <div class="upcoming-item">
        <div class="upcoming-title">◦ ${d.title}</div>
        <div class="upcoming-desc">${d.description}</div>
      </div>
    `).join('');
  }

  function showError(msg) {
    const el = document.getElementById('load-error');
    if (el) {
      el.style.display = 'block';
      el.innerHTML = `<strong>⚠ Data load failed.</strong> ${msg}<br>
        <small style="opacity:.7">Check that the Google Sheet is published to the web, the SHEET_ID is correct, and CORS is not blocked.</small>`;
    }
  }

  async function init() {
    try {
      let sheets;
      if (USE_GOOGLE_SHEETS) {
        sheets = await fetchGoogleSheets();
      } else {
        const res = await fetch('data.csv');
        if (!res.ok) throw new Error(`HTTP ${res.status} fetching data.csv`);
        const raw = await res.text();
        sheets = parseCSV(raw);
      }
      buildMeta(sheets['project_meta'] || []);
      const modules = sheets['modules'] || [];
      buildStats(modules);
      buildModuleLists(modules);
      const completed = modules.filter(m=>m.status==='Completed').length;
      const inprogress = modules.filter(m=>m.status==='In Progress').length;
      const upcoming = modules.filter(m=>m.status==='Upcoming').length;
      buildDonutChart('donut-features', completed, inprogress, upcoming);
      buildDonutChart('donut-modules', completed, inprogress, upcoming);
      buildBarChart('bar-chart', modules);
      buildClosureStrip(sheets['closure_status'] || []);
      buildInfra(sheets['infra'] || []);
      buildUpcoming(sheets['upcoming'] || []);
    } catch(e) {
      console.error('Engine error:', e);
      showError(e.message || 'Unknown error.');
    }
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', ENGINE.init);
