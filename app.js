/* ==========================================================================
   생활·금융 계산기 허브 — app.js
   모든 계산은 브라우저 안에서만 이뤄집니다. (서버 전송 없음)
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ utils */
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function money(v) {
    var t = String(v == null ? '' : v).replace(/[^0-9]/g, '');
    if (!t) return 0;
    return Math.min(Number(t), 1e13);
  }
  function dec(v) {
    var t = String(v == null ? '' : v).replace(/,/g, '').replace(/[^0-9.\-]/g, '');
    var n = parseFloat(t);
    return isFinite(n) ? n : 0;
  }
  function fmt(n) {
    var x = Math.round(Number(n) || 0);
    if (x === 0) return '0';
    return x.toLocaleString('ko-KR');
  }
  function won(n) { return fmt(n) + ' 원'; }
  function pct(n, digits) {
    var d = typeof digits === 'number' ? digits : 2;
    var s = (Number(n) || 0).toFixed(d);
    if (s.indexOf('.') !== -1) s = s.replace(/0+$/, '').replace(/\.$/, '');
    return s + '%';
  }
  /* 금액을 한글 읽기로: 12,345,678 → 1,234만 원 */
  function readWon(n) {
    var x = Number(n) || 0;
    var neg = x < 0;
    var a = Math.abs(Math.round(x));
    var s = '';
    var approx = false;
    if (a === 0) return '0 원';
    if (a >= 100000000) {
      var eok = Math.floor(a / 100000000);
      var man = Math.floor((a % 100000000) / 10000);
      s = eok + '억' + (man > 0 ? ' ' + fmt(man) + '만' : '') + ' 원';
      approx = (a % 10000) !== 0;
    } else if (a >= 10000) {
      var manR = Math.round(a / 10000);
      s = fmt(manR) + '만 원';
      approx = Math.abs(manR * 10000 - a) >= 1;
    } else {
      s = fmt(a) + ' 원';
    }
    return (neg ? '-' : '') + (approx ? '약 ' : '') + s;
  }
  function pctFixed(n, digits) {
    var d = typeof digits === 'number' ? digits : 1;
    return (Number(n) || 0).toFixed(d) + '%';
  }
  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }
  function setHTML(id, html) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }
  function safe(id) { return document.getElementById(id); }

  /* --------------------------------------------------------- 세그먼트 상태 */
  var segState = {};

  function initSegments() {
    $$('.seg').forEach(function (seg) {
      var key = seg.getAttribute('data-seg');
      var active = seg.querySelector('button[aria-pressed="true"]') || seg.querySelector('button');
      segState[key] = active ? active.getAttribute('data-value') : null;
      seg.addEventListener('click', function (e) {
        var btn = e.target.closest('button');
        if (!btn) return;
        $$('button', seg).forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
        btn.setAttribute('aria-pressed', 'true');
        segState[key] = btn.getAttribute('data-value');
        onChangeLabels(key);
        computeAll();
      });
    });
  }

  function onChangeLabels(key) {
    if (key === 'saveType') {
      var dep = segState.saveType === 'deposit';
      setText('lblSaveAmount', dep ? '예치 금액' : '월 납입액');
      setText('hintSaveComp', segState.saveComp === 'simple' ? '원금에만 이자가 붙습니다.' : '한 달마다 이자가 원금에 더해집니다.');
    }
    if (key === 'saveComp') {
      setText('hintSaveComp', segState.saveComp === 'simple' ? '원금에만 이자가 붙습니다.' : '한 달마다 이자가 원금에 더해집니다.');
    }
    if (key === 'salaryMode') {
      setText('lblSalaryAmount', segState.salaryMode === 'annual' ? '연봉' : '월급');
    }
    if (key === 'convMode') {
      setText('lblConvAmount', segState.convMode === 'd2m' ? '전환할 보증금' : '전환할 월세');
      setText('outConvLabel', segState.convMode === 'd2m' ? '늘어나는 월세' : '늘어나는 보증금');
    }
  }

  /* --------------------------------------------------------------- 칩(빠른값) */
  function initChips() {
    $$('[data-chips]').forEach(function (box) {
      var target = safe(box.getAttribute('data-chips'));
      if (!target) return;
      box.addEventListener('click', function (e) {
        var btn = e.target.closest('.chip');
        if (!btn) return;
        target.value = btn.getAttribute('data-value');
        syncChips();
        computeAll();
      });
    });
  }
  function syncChips() {
    $$('[data-chips]').forEach(function (box) {
      var target = safe(box.getAttribute('data-chips'));
      if (!target) return;
      var v = String(target.value).replace(/[^0-9.]/g, '');
      $$('.chip', box).forEach(function (c) {
        c.setAttribute('aria-pressed', c.getAttribute('data-value') === v ? 'true' : 'false');
      });
    });
  }

  /* ------------------------------------------------------------ 금액 포맷팅 */
  function formatMoneyInput(el) {
    var raw = el.value.replace(/[^0-9]/g, '');
    if (raw === '') { el.value = ''; return; }
    raw = raw.replace(/^0+(?=\d)/, '');
    if (raw.length > 14) raw = raw.slice(0, 14);
    el.value = Number(raw).toLocaleString('ko-KR');
  }

  /* --------------------------------------------------------------- 탭 전환 */
  var TAB_NAMES = ['save', 'salary', 'loan', 'severance', 'housing'];

  function showTab(name) {
    if (TAB_NAMES.indexOf(name) === -1) name = 'save';
    $$('.tab').forEach(function (t) {
      var on = t.getAttribute('data-tab') === name;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
    });
    $$('.panel').forEach(function (p) {
      p.classList.toggle('is-active', p.id === 'panel-' + name);
    });
    if (document.body) {
      $$('.hero').forEach(function (h) { h.style.display = name === 'save' ? '' : 'none'; });
    }
    try { history.replaceState(null, '', '#' + name); } catch (err) { /* noop */ }
  }

  function initTabs() {
    var tablist = $('.tabs-inner');
    $$('.tab').forEach(function (t) {
      t.addEventListener('click', function () { showTab(t.getAttribute('data-tab')); });
      t.addEventListener('keydown', function (e) {
        var i = TAB_NAMES.indexOf(t.getAttribute('data-tab'));
        var next = null;
        if (e.key === 'ArrowRight') next = TAB_NAMES[(i + 1) % TAB_NAMES.length];
        if (e.key === 'ArrowLeft') next = TAB_NAMES[(i - 1 + TAB_NAMES.length) % TAB_NAMES.length];
        if (next) {
          e.preventDefault();
          showTab(next);
          var btn = $('.tab[data-tab="' + next + '"]');
          if (btn) btn.focus();
        }
      });
    });
    void tablist;
  }

  function initSubtabs() {
    $$('.subtabs').forEach(function (group) {
      group.addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-sub]');
        if (!btn) return;
        var name = btn.getAttribute('data-sub');
        $$('button', group).forEach(function (b) {
          b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
        });
        var panel = btn.closest('.card');
        $$('.subpanel', panel).forEach(function (sp) {
          sp.classList.toggle('is-active', sp.id === 'sub-' + name);
        });
        computeAll();
      });
    });
  }

  /* ======================================================================
     01. 예·적금 이자
     ====================================================================== */
  function calcSave() {
    var type = segState.saveType || 'deposit';
    var comp = segState.saveComp || 'simple';
    var amt = money(safe('inSaveAmount') ? safe('inSaveAmount').value : 0);
    var m = Math.max(0, Math.round(dec(safe('inSaveMonths') ? safe('inSaveMonths').value : 0)));
    var annual = Math.max(0, dec(safe('inSaveRate') ? safe('inSaveRate').value : 0));
    var r = annual / 100;

    var principal = type === 'deposit' ? amt : amt * m;
    var interest = 0;

    if (m > 0 && r > 0) {
      if (type === 'deposit') {
        interest = comp === 'simple'
          ? amt * r * m / 12
          : amt * (Math.pow(1 + r / 12, m) - 1);
      } else {
        if (comp === 'simple') {
          interest = amt * r / 12 * (m * (m + 1) / 2);
        } else {
          var i = r / 12;
          interest = amt * (((Math.pow(1 + i, m + 1) - (1 + i)) / i) - m);
        }
      }
    }
    if (!isFinite(interest) || interest < 0) interest = 0;

    var scenarios = [
      { key: 'normal', name: '일반과세', rate: 0.154, cls: '', tag: '' },
      { key: 'pref', name: '세금우대', rate: 0.014, cls: 'mid', tag: '조합예탁금 등' },
      { key: 'free', name: '비과세', rate: 0, cls: 'best', tag: '서민형 등' }
    ];
    var rows = scenarios.map(function (s) {
      var tax = interest * s.rate;
      return {
        name: s.name, rate: s.rate, tax: tax,
        after: interest - tax,
        total: principal + interest - tax,
        cls: s.cls, tag: s.tag
      };
    });

    /* 상단 요약 */
    setText('outSaveInterest', won(interest));
    setText('outSaveInterestRead', readWon(interest));
    setText('outSavePrincipal', won(principal));
    setText('outSaveTotalNormal', won(rows[0].total));

    /* 비교 표 */
    var best = rows[2];
    var html = rows.map(function (r) {
      var isBest = r.name === '비과세';
      return '<tr' + (isBest ? ' class="is-best"' : '') + '>' +
        '<td><strong>' + r.name + '</strong>' + (r.tag ? '<span class="tag">' + r.tag + '</span>' : '') + '</td>' +
        '<td>' + pct(r.rate * 100) + '</td>' +
        '<td>' + won(r.tax) + '</td>' +
        '<td>' + won(r.after) + '</td>' +
        '<td><strong>' + won(r.total) + '</strong></td>' +
        '</tr>';
    }).join('');
    setHTML('outSaveTaxRows', html);

    /* 막대 차트: 세전 이자 대비 세후 이자 */
    var barHtml = rows.map(function (r) {
      var ratio = interest > 0 ? Math.max(2, (r.after / interest) * 100) : 0;
      return '<div class="bar-row">' +
        '<div class="bar-head"><span class="name">' + r.name + ' <span class="subtle">' + pct(r.rate * 100) + '</span></span>' +
        '<span class="val">' + won(r.after) + '</span></div>' +
        '<div class="bar-track"><div class="bar-fill ' + r.cls + '" style="width:' + ratio.toFixed(1) + '%"></div></div>' +
        '<p class="bar-note">세후 수령액 ' + won(r.total) + ' · 세전 이자의 ' + pct(interest > 0 ? (r.after / interest) * 100 : 0, 1) + '</p>' +
        '</div>';
    }).join('');
    setHTML('outSaveBars', barHtml);

    /* 인사이트 */
    var diff = best.total - rows[0].total;
    var note = safe('outSaveInsight');
    if (note) {
      note.className = 'notice ' + (diff > 0 ? 'good' : 'info');
      note.innerHTML = interest <= 0
        ? '금액과 기간, 이율을 입력하면 세금 3가지 결과를 바로 비교해 드립니다.'
        : '비과세 상품이면 일반과세보다 <b>' + won(diff) + '</b> 더 받습니다. 세금우대(1.4%)로도 <b>' +
          won(rows[1].total - rows[0].total) + '</b> 차이가 납니다.';
    }
  }

  /* ======================================================================
     02. 연봉·월급 실수령액
     ====================================================================== */
  var INSURANCE = {
    '2026': { pension: 0.0475, health: 0.03595, ltc: 0.1314, emp: 0.009, minBase: 410000, maxBase: 6590000 },
    '2025': { pension: 0.045, health: 0.03545, ltc: 0.1295, emp: 0.009, minBase: 400000, maxBase: 6370000 }
  };

  function earnedIncomeDeduction(total) {
    if (total <= 5000000) return total * 0.7;
    if (total <= 15000000) return 3500000 + (total - 5000000) * 0.4;
    if (total <= 45000000) return 7500000 + (total - 15000000) * 0.15;
    if (total <= 100000000) return 12000000 + (total - 45000000) * 0.05;
    return Math.min(20000000, 14750000 + (total - 100000000) * 0.02);
  }

  var TAX_BRACKETS = [
    [14000000, 0.06, 0],
    [50000000, 0.15, 1260000],
    [88000000, 0.24, 5760000],
    [150000000, 0.35, 15440000],
    [300000000, 0.38, 19940000],
    [500000000, 0.40, 25940000],
    [1000000000, 0.42, 35940000],
    [Infinity, 0.45, 65940000]
  ];

  function basicTax(base) {
    if (base <= 0) return 0;
    for (var k = 0; k < TAX_BRACKETS.length; k++) {
      var b = TAX_BRACKETS[k];
      if (base <= b[0]) return Math.max(0, base * b[1] - b[2]);
    }
    return 0;
  }

  function laborTaxCredit(calcTax, gross) {
    var credit = calcTax <= 1300000
      ? calcTax * 0.55
      : 1300000 * 0.55 + (calcTax - 1300000) * 0.3;
    var limit;
    if (gross <= 33000000) limit = 740000;
    else if (gross <= 70000000) limit = Math.max(660000, 740000 - (gross - 33000000) * 0.008);
    else if (gross <= 120000000) limit = Math.max(500000, 660000 - (gross - 70000000) * 0.5);
    else limit = Math.max(200000, 500000 - (gross - 120000000) * 0.5);
    return Math.min(credit, limit);
  }

  function floor10(x) { return Math.floor((Number(x) || 0) / 10) * 10; }

  function calcSalary() {
    var mode = segState.salaryMode || 'annual';
    var amount = money(safe('inSalaryAmount') ? safe('inSalaryAmount').value : 0);
    var mealInput = money(safe('inSalaryMeal') ? safe('inSalaryMeal').value : 0);
    var dep = Number(safe('selDependents') ? safe('selDependents').value : 1) || 1;
    var year = segState.salaryYear || '2026';
    var R = INSURANCE[year];

    var monthlyGross = mode === 'annual' ? amount / 12 : amount;
    var meal = Math.min(mealInput, monthlyGross);
    var taxable = Math.max(0, monthlyGross - meal);

    var pensionBase = taxable > 0 ? Math.min(Math.max(taxable, R.minBase), R.maxBase) : 0;
    var pension = floor10(pensionBase * R.pension);
    var health = floor10(taxable * R.health);
    var ltc = floor10(health * R.ltc);
    var emp = floor10(taxable * R.emp);
    var insTotal = pension + health + ltc + emp;

    /* 소득세(연간 근사 → 월 환산) */
    var annualGross = taxable * 12;
    var eid = earnedIncomeDeduction(annualGross);
    var incomeAmt = Math.max(0, annualGross - eid);
    var personal = 1500000 * dep;
    var deductionTotal = personal + insTotal * 12;
    var taxBase = Math.max(0, incomeAmt - deductionTotal);
    var calcTax = basicTax(taxBase);
    var credit = laborTaxCredit(calcTax, annualGross) + 130000;
    var annualTax = Math.max(0, calcTax - credit);
    var monthlyTax = floor10(annualTax / 12);
    var local = floor10(monthlyTax * 0.1);

    var deductionMonthly = insTotal + monthlyTax + local;
    var net = Math.max(0, monthlyGross - deductionMonthly);
    var dedRate = monthlyGross > 0 ? (deductionMonthly / monthlyGross) * 100 : 0;

    setText('outSalaryNet', won(net));
    setText('outSalaryNetRead', readWon(net));
    setText('outSalaryDeduct', won(deductionMonthly));
    setText('outSalaryRate', pct(dedRate, 1));

    var cap = safe('capSalary');
    if (cap) {
      cap.textContent = year + '년 요율 기준 · 과세 대상 월급 ' + won(taxable) +
        (meal > 0 ? ' (비과세 ' + won(meal) + ' 제외)' : '');
    }

    var rows = [
      ['국민연금', pct(R.pension * 100), pension, '기준소득월액 ' + won(pensionBase)],
      ['건강보험', pct(R.health * 100), health, ''],
      ['장기요양보험', '건보의 ' + pct(R.ltc * 100), ltc, ''],
      ['고용보험', pct(R.emp * 100), emp, '실업급여분'],
      ['소득세', '간이세액 근사', monthlyTax, '연 ' + won(annualTax) + ' ÷ 12'],
      ['지방소득세', '소득세의 10%', local, '']
    ];
    var html = rows.map(function (r) {
      return '<tr><td>' + r[0] + (r[3] ? '<br><span class="subtle">' + r[3] + '</span>' : '') + '</td>' +
        '<td>' + r[1] + '</td><td>' + won(r[2]) + '</td></tr>';
    }).join('');
    html += '<tr><td><strong>공제 합계</strong></td><td></td><td><strong>' + won(deductionMonthly) + '</strong></td></tr>';
    html += '<tr><td><strong>실수령액</strong></td><td></td><td><strong style="color:#1b64da">' + won(net) + '</strong></td></tr>';
    setHTML('outSalaryRows', html);

    var yearly = [
      ['세전 연봉 (총급여)', won(monthlyGross * 12)],
      ['과세 대상 연간 급여', won(annualGross)],
      ['연간 4대보험 (근로자)', won(insTotal * 12)],
      ['연간 소득세 + 지방소득세', won((monthlyTax + local) * 12)],
      ['연간 실수령액', won(net * 12)]
    ];
    setHTML('outSalaryYearly', yearly.map(function (r) {
      return '<tr><td>' + r[0] + '</td><td><strong>' + r[1] + '</strong></td></tr>';
    }).join(''));

    var note = safe('outSalaryNote');
    if (note) {
      note.className = 'notice info';
      note.innerHTML = year === '2026'
        ? '2026년 요율 적용: 국민연금 4.75%(기준소득월액 41만~659만 원), 건강보험 3.595%, 장기요양 건보의 13.14%, 고용보험 0.9%. 비과세 식대 등 비과세 소득은 4대보험료 산정에서도 제외됩니다.'
        : '2025년 요율 적용: 국민연금 4.5%(기준소득월액 40만~637만 원), 건강보험 3.545%, 장기요양 건보의 12.95%, 고용보험 0.9%.';
    }
  }

  /* ======================================================================
     03. 대출 갈아타기(대환) 손익
     ====================================================================== */
  function monthlyPayment(P, annualPercent, n) {
    if (n <= 0 || P <= 0) return 0;
    var i = annualPercent / 100 / 12;
    if (i <= 0) return P / n;
    return P * i / (1 - Math.pow(1 + i, -n));
  }

  function schedule(P, annualPercent, n, pay) {
    var rows = [];
    var bal = P;
    var i = annualPercent / 100 / 12;
    for (var t = 1; t <= n; t++) {
      var interest = bal * i;
      var principal = pay - interest;
      if (t === n) principal = bal;
      bal = Math.max(0, bal - principal);
      rows.push({ interest: Math.max(0, interest), principal: principal, balance: bal });
    }
    return rows;
  }

  function calcLoan() {
    var P = money(safe('inLoanBalance') ? safe('inLoanBalance').value : 0);
    var n = Math.max(0, Math.round(dec(safe('inLoanMonths') ? safe('inLoanMonths').value : 0)));
    var oldRate = Math.max(0, dec(safe('inLoanOldRate') ? safe('inLoanOldRate').value : 0));
    var newRate = Math.max(0, dec(safe('inLoanNewRate') ? safe('inLoanNewRate').value : 0));
    var feeRate = Math.max(0, dec(safe('inLoanFee') ? safe('inLoanFee').value : 0)) / 100;
    var extra = money(safe('inLoanExtra') ? safe('inLoanExtra').value : 0);

    var payOld = monthlyPayment(P, oldRate, n);
    var payNew = monthlyPayment(P, newRate, n);
    var intOld = Math.max(0, payOld * n - P);
    var intNew = Math.max(0, payNew * n - P);
    var saved = intOld - intNew;
    var fee = P * feeRate;
    var cost = fee + extra;
    var net = saved - cost;

    var sOld = n > 0 ? schedule(P, oldRate, n, payOld) : [];
    var sNew = n > 0 ? schedule(P, newRate, n, payNew) : [];
    var firstOld = sOld.length ? sOld[0].interest : P * oldRate / 100 / 12;
    var firstNew = sNew.length ? sNew[0].interest : P * newRate / 100 / 12;

    setText('outLoanMonthDiff', won(payOld - payNew));
    var sub = safe('outLoanMonthDiffRead');
    if (sub) {
      sub.textContent = payOld - payNew > 0
        ? '매달 ' + won(payOld - payNew) + '씩 덜 냅니다 · 연 ' + won((payOld - payNew) * 12)
        : '갈아타도 월 납입금은 줄지 않습니다';
    }
    setText('outLoanPayOld', won(payOld));
    setText('outLoanPayNew', won(payNew));

    /* 비교 표 */
    var compare = [
      ['월 납입금', won(payOld), won(payNew), (payOld - payNew >= 0 ? '−' : '+') + won(Math.abs(payOld - payNew))],
      ['첫 달 이자', won(firstOld), won(firstNew), '−' + won(Math.max(0, firstOld - firstNew))],
      ['총 이자', won(intOld), won(intNew), '−' + won(saved)],
      ['총 상환액', won(P + intOld), won(P + intNew), '−' + won(saved)]
    ];
    setHTML('outLoanCompare', compare.map(function (r) {
      return '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td><td><strong>' + r[3] + '</strong></td></tr>';
    }).join(''));

    /* 순이익 */
    var profit = [
      ['총 이자 절감액', won(saved)],
      ['중도상환수수료 (−)', won(fee)],
      ['기타 비용 (−)', won(extra)],
      ['순이익', won(net)]
    ];
    setHTML('outLoanProfit', profit.map(function (r, idx) {
      var strong = idx === profit.length - 1;
      var color = idx === 3 ? (net >= 0 ? '#0b8b52' : '#c62d39') : '';
      return '<tr><td>' + (strong ? '<strong>' + r[0] + '</strong>' : r[0]) + '</td><td>' +
        (strong ? '<strong style="color:' + color + '">' + r[1] + '</strong>' : r[1]) + '</td></tr>';
    }).join(''));

    /* 손익분기 */
    var be = null;
    if (n > 0 && P > 0) {
      var cum = 0;
      for (var t = 0; t < n; t++) {
        cum += sOld[t].interest - sNew[t].interest;
        if (be === null && cum >= cost && cost >= 0) be = t + 1;
      }
    }

    var beBox = safe('outLoanBreakEven');
    if (beBox) {
      if (cost <= 0) {
        beBox.innerHTML = '<div class="badge good"><span class="dot"></span>손익분기 없음 — 비용이 없어 첫 달부터 이득</div>';
      } else if (be === null) {
        beBox.innerHTML = '<div class="badge bad"><span class="dot"></span>잔여 기간 안에 비용 회수 불가</div>' +
          '<p class="bar-note">절감액이 수수료·비용(' + won(cost) + ')을 넘지 못합니다. 갈아타면 ' + won(Math.abs(net)) + ' 손해입니다.</p>';
      } else {
        var ratio = Math.min(100, (be / n) * 100);
        beBox.innerHTML =
          '<div class="split mb-0"><strong style="font-size:14px;">손익분기 <span style="color:#1b64da">' + be + '개월</span></strong>' +
          '<span class="subtle">전체 ' + n + '개월 중 ' + pct(ratio, 0) + '</span></div>' +
          '<div class="bar-track mt-8"><div class="bar-fill best" style="width:' + Math.max(2, ratio).toFixed(1) + '%"></div></div>' +
          '<p class="bar-note">' + be + '개월이 지나면 수수료·비용 ' + won(cost) + '을 회수하고 순이익이 발생합니다.</p>';
      }
    }

    /* 판정 배지 */
    var verdict = safe('outLoanVerdict');
    if (verdict) {
      if (net > 0) {
        verdict.innerHTML = '<span class="badge good"><span class="dot"></span>갈아타기 유리 · 순이익 ' + won(net) + '</span>' +
          (be ? '<span class="badge"><span class="dot"></span>손익분기 ' + be + '개월</span>' : '');
      } else if (net < 0) {
        verdict.innerHTML = '<span class="badge bad"><span class="dot"></span>갈아타기 불리 · ' + won(Math.abs(net)) + ' 손해</span>' +
          '<span class="badge warn"><span class="dot"></span>수수료가 절감액보다 큽니다</span>';
      } else {
        verdict.innerHTML = '<span class="badge warn"><span class="dot"></span>손익은 본전 수준</span>';
      }
    }

    var note = safe('outLoanNote');
    if (note) {
      note.className = 'notice ' + (net > 0 ? 'good' : 'info');
      note.innerHTML = net > 0
        ? '금리 차 ' + pct(Math.abs(oldRate - newRate)) + '로 ' + won(saved) + '의 이자를 아끼고, 비용 ' + won(cost) + '을 빼도 ' + won(net) + ' 이득입니다.'
        : '이자 절감액(' + won(saved) + ')에서 수수료·비용(' + won(cost) + ')을 빼면 ' + won(net) + '입니다. 금리를 더 낮추거나 기간을 늘려 다시 계산해 보세요.';
    }
  }

  /* ======================================================================
     04. 퇴직금 · 실업급여 · 연차수당
     ====================================================================== */
  function parseDate(id, fallback) {
    var el = safe(id);
    if (!el || !el.value) return fallback;
    var d = new Date(el.value + 'T00:00:00');
    return isNaN(d.getTime()) ? fallback : d;
  }
  function daysBetween(a, b) {
    return Math.round((b.getTime() - a.getTime()) / 86400000);
  }
  function minusMonths(date, n) {
    var d = new Date(date.getTime());
    var day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() - n);
    var lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, lastDay));
    return d;
  }
  function fmtDate(d) {
    return d.getFullYear() + '. ' + (d.getMonth() + 1) + '. ' + d.getDate() + '.';
  }

  function calcSeverance() {
    var today = new Date();
    var join = parseDate('inSevJoin', new Date(today.getFullYear() - 3, today.getMonth(), today.getDate()));
    var resign = parseDate('inSevResign', today);
    var pay3 = money(safe('inSevPay3') ? safe('inSevPay3').value : 0);
    var bonus = money(safe('inSevBonus') ? safe('inSevBonus').value : 0);
    var leavePay = money(safe('inSevLeavePay') ? safe('inSevLeavePay').value : 0);

    var workDays = Math.max(0, daysBetween(join, resign) + 1);
    var start3 = minusMonths(resign, 3);
    var days3 = Math.max(1, daysBetween(start3, resign));

    var bonus3 = bonus * 3 / 12;
    var leave3 = leavePay * 3 / 12;
    var base3 = pay3 + bonus3 + leave3;
    var dailyAvg = base3 / days3;
    var severance = dailyAvg * 30 * (workDays / 365);

    setText('outSevTotal', won(severance));
    setText('outSevTotalRead', readWon(severance));
    setText('outSevDaily', won(dailyAvg));
    setText('outSevDays', fmt(workDays) + '일');

    var years = Math.floor(workDays / 365);
    var months = Math.floor((workDays % 365) / 30);
    var rows = [
      ['최근 3개월 급여', won(pay3)],
      ['연간 상여금 3개월분', won(bonus3)],
      ['연간 연차수당 3개월분', won(leave3)],
      ['3개월 임금 총액', won(base3)],
      ['3개월 총일수 (' + fmtDate(start3) + '~' + fmtDate(resign) + ')', days3 + '일'],
      ['1일 평균임금', won(dailyAvg)],
      ['재직일수', fmt(workDays) + '일 (' + years + '년 ' + months + '개월)'],
      ['산식', '1일 평균임금 × 30 × (' + fmt(workDays) + ' ÷ 365)']
    ];
    setHTML('outSevRows', rows.map(function (r) {
      return '<tr><td>' + r[0] + '</td><td><strong>' + r[1] + '</strong></td></tr>';
    }).join(''));

    var note = safe('outSevNote');
    if (note) {
      if (workDays < 365) {
        note.className = 'notice warn';
        note.innerHTML = '재직일수가 <b>1년 미만</b>이라 법정 퇴직금 대상이 아닙니다(계산값은 참고용). 취업규칙이나 근로계약에서 별도로 정한 경우에만 지급 의무가 생깁니다.';
      } else if (resign < join) {
        note.className = 'notice bad';
        note.innerHTML = '퇴사일이 입사일보다 빠릅니다. 날짜를 확인해 주세요.';
      } else {
        note.className = 'notice info';
        note.innerHTML = '법정 퇴직금은 재직 1년 이상 근로자에게 발생합니다. 계산한 평균임금이 통상임금보다 낮으면 통상임금이 적용되어 실제 금액이 더 커질 수 있고, 퇴직소득세는 근속연수 공제 후 별도로 부과됩니다.';
      }
    }
  }

  var UNEMP_LIMITS = {
    '2026': { max: 68100, minWage: 10320 },
    '2025': { max: 66000, minWage: 10030 },
    '2024': { max: 66000, minWage: 9860 }
  };

  function benefitDays(months, over50) {
    var y = months / 12;
    if (y < 1) return 120;
    if (y < 3) return over50 ? 180 : 150;
    if (y < 5) return over50 ? 210 : 180;
    if (y < 10) return over50 ? 240 : 210;
    return over50 ? 270 : 240;
  }

  function calcUnemp() {
    var over50 = (segState.unempAge || 'under') === 'over';
    var months = Math.max(0, Math.round(dec(safe('inUnempMonths') ? safe('inUnempMonths').value : 0)));
    var wage = money(safe('inUnempWage') ? safe('inUnempWage').value : 0);
    var resign = parseDate('inUnempResign', new Date());
    var year = safe('selUnempYear') ? safe('selUnempYear').value : '2026';
    var L = UNEMP_LIMITS[year] || UNEMP_LIMITS['2026'];

    var days3 = Math.max(1, daysBetween(minusMonths(resign, 3), resign));
    var dailyWage = (wage * 3) / days3;
    var raw = dailyWage * 0.6;
    var floor = L.minWage * 8 * 0.8;
    var daily = Math.min(L.max, Math.max(floor, raw));
    var band = raw > L.max ? '상한액 적용' : (raw < floor ? '하한액 적용' : '평균임금의 60% 적용');
    var days = benefitDays(months, over50);
    var total = daily * days;

    setText('outUnempDaily', won(daily));
    setText('outUnempDailyRead', band);
    setText('outUnempDays', days + '일');
    setText('outUnempTotal', won(total));

    var hint = safe('hintUnempMonths');
    if (hint) {
      hint.textContent = (months >= 12 ? Math.floor(months / 12) + '년 ' : '') +
        (months % 12 ? (months % 12) + '개월' : '') +
        ' · ' + (over50 ? '50세 이상' : '50세 미만') + ' 구간 = ' + days + '일';
    }

    var rows = [
      ['이직 전 3개월 월평균 급여', won(wage)],
      ['3개월 총일수', days3 + '일'],
      ['1일 평균임금', won(dailyWage)],
      ['평균임금의 60%', won(raw)],
      ['상한액 / 하한액 (' + year + '년)', won(L.max) + ' / ' + won(floor)],
      ['적용 1일 구직급여액', won(daily) + ' <span class="subtle">' + band + '</span>'],
      ['소정급여일수', days + '일'],
      ['총 예상 수급액', won(total)]
    ];
    setHTML('outUnempRows', rows.map(function (r) {
      return '<tr><td>' + r[0] + '</td><td><strong>' + r[1] + '</strong></td></tr>';
    }).join(''));

    var note = safe('outUnempNote');
    if (note) {
      note.className = 'notice info';
      note.innerHTML = '총액은 대기기간 7일을 제외한 지급일 기준이며, 세전 금액입니다. 30일 환산 약 ' + won(daily * 30) +
        '. ' + year + '년 하한액은 최저임금 ' + fmt(L.minWage) + '원 × 8시간 × 80%입니다.';
    }
  }

  function calcAnnualLeave() {
    var base = money(safe('inAlBase') ? safe('inAlBase').value : 0);
    var fixed = money(safe('inAlFixed') ? safe('inAlFixed').value : 0);
    var days = Math.max(0, dec(safe('inAlDays') ? safe('inAlDays').value : 0));
    var weekly = Math.max(1, dec(safe('inAlWeekly') ? safe('inAlWeekly').value : 40));

    var monthHours = weekly >= 40 ? 209 : Math.round((weekly + weekly / 5) * 4.345);
    var monthlyWage = base + fixed;
    var hourly = monthHours > 0 ? monthlyWage / monthHours : 0;
    var daily = hourly * 8;
    var total = daily * days;

    setText('outAlTotal', won(total));
    setText('outAlTotalRead', readWon(total));
    setText('outAlDaily', won(daily));
    setText('outAlHourly', won(hourly));

    var hint = safe('hintAlWeekly');
    if (hint) hint.textContent = '주 ' + weekly + '시간 → 월 ' + monthHours + '시간';

    var rows = [
      ['월 통상임금 (기본급 + 고정수당)', won(monthlyWage)],
      ['월 소정근로시간', monthHours + '시간'],
      ['1시간 통상임금', won(hourly)],
      ['1일 통상임금 (8시간)', won(daily)],
      ['미사용 연차 일수', days + '일'],
      ['연차수당', won(total)]
    ];
    setHTML('outAlRows', rows.map(function (r) {
      return '<tr><td>' + r[0] + '</td><td><strong>' + r[1] + '</strong></td></tr>';
    }).join(''));

    var note = safe('outAlNote');
    if (note) {
      note.className = 'notice info';
      note.innerHTML = '세전 금액이며 실제 지급 시 소득세·4대보험료가 공제됩니다. 통상임금에는 정기적·일률적으로 지급되는 고정수당만 포함되고, 실적에 따라 달라지는 변동수당은 제외됩니다.';
    }
  }

  /* ======================================================================
     05. 청약 가점 · 전월세 전환율
     ====================================================================== */
  function calcPoints() {
    var noHouse = Math.max(0, Math.round(dec(safe('inPtNoHouse') ? safe('inPtNoHouse').value : 0)));
    var family = Math.max(0, Math.min(6, Math.round(dec(safe('selPtFamily') ? safe('selPtFamily').value : 0))));
    var account = Math.max(0, Math.round(dec(safe('inPtAccount') ? safe('inPtAccount').value : 0)));

    var pA = Math.min(32, 2 * (Math.floor(noHouse / 12) + 1));
    if (noHouse <= 0) pA = 2;
    var pB = Math.min(35, 5 * (family + 1));
    var pC;
    if (account < 6) pC = 1;
    else if (account < 12) pC = 2;
    else pC = Math.min(17, Math.floor(account / 12) + 2);

    var total = pA + pB + pC;

    setText('outPtTotal', total + ' 점');
    setText('outPtA', pA + '점');
    setText('outPtB', pB + '점');

    var grade, gradeClass;
    if (total >= 70) { grade = '상위권 · 인기 단지 도전 가능'; gradeClass = 'good'; }
    else if (total >= 60) { grade = '중상위권 · 수도권 외곽 노려볼 만'; gradeClass = 'good'; }
    else if (total >= 50) { grade = '중위권 · 지역·단지 선별 필요'; gradeClass = 'warn'; }
    else { grade = '하위권 · 추첨제·특별공급 검토'; gradeClass = 'bad'; }

    setText('outPtGrade', '84점 만점 · ' + grade);

    var rows = [
      ['무주택 기간', pA + '점', '32점'],
      ['부양가족 수', pB + '점', '35점'],
      ['청약통장 가입기간', pC + '점', '17점'],
      ['합계', '<strong>' + total + '점</strong>', '84점']
    ];
    setHTML('outPtRows', rows.map(function (r) {
      return '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td></tr>';
    }).join(''));

    var bars = [
      { name: '무주택 ' + Math.floor(noHouse / 12) + '년', val: pA, max: 32, cls: '' },
      { name: '부양가족 ' + family + '명', val: pB, max: 35, cls: 'mid' },
      { name: '통장 ' + Math.floor(account / 12) + '년 ' + (account % 12) + '개월', val: pC, max: 17, cls: 'best' }
    ];
    setHTML('outPtBars', bars.map(function (b) {
      var w = b.max > 0 ? (b.val / b.max) * 100 : 0;
      return '<div class="bar-row">' +
        '<div class="bar-head"><span class="name">' + b.name + '</span><span class="val">' + b.val + ' / ' + b.max + '점</span></div>' +
        '<div class="bar-track"><div class="bar-fill ' + b.cls + '" style="width:' + w.toFixed(1) + '%"></div></div>' +
        '</div>';
    }).join(''));

    var note = safe('outPtNote');
    if (note) {
      note.className = 'notice ' + gradeClass;
      note.innerHTML = '<b>' + total + '점</b>은 민영주택 일반공급 가점제 기준입니다. 최근 수도권 인기 단지는 60~70점대에서 당락이 갈리며, 국민주택(공공분양)은 가점 대신 저축총액·거주기간 등 다른 기준을 씁니다.';
    }
  }

  function calcConversion() {
    var mode = segState.convMode || 'd2m';
    var dep = money(safe('inConvDeposit') ? safe('inConvDeposit').value : 0);
    var mon = money(safe('inConvMonthly') ? safe('inConvMonthly').value : 0);
    var amt = money(safe('inConvAmount') ? safe('inConvAmount').value : 0);
    var ratePct = Math.max(0, dec(safe('inConvRate') ? safe('inConvRate').value : 0));
    var basePct = Math.max(0, dec(safe('inConvBase') ? safe('inConvBase').value : 0));
    var rate = ratePct / 100;
    var limitPct = basePct + 2;
    var limit = limitPct / 100;

    var newDep, newMon, delta, label;
    if (mode === 'd2m') {
      delta = amt * rate / 12;
      newDep = Math.max(0, dep - amt);
      newMon = mon + delta;
      label = '늘어나는 월세';
    } else {
      delta = rate > 0 ? amt * 12 / rate : 0;
      newDep = dep + delta;
      newMon = Math.max(0, mon - amt);
      label = '늘어나는 보증금';
    }

    setText('outConvValue', won(delta));
    setText('outConvValueRead', readWon(delta) + ' · 연 ' + pctFixed(ratePct) + ' 적용');
    setText('outConvDeposit', won(newDep));
    setText('outConvMonthly', won(newMon));

    var hint = safe('hintConvLimit');
    if (hint) {
      hint.textContent = '기준금리 ' + pctFixed(basePct) + ' + 2%p = 법정 상한 연 ' + pctFixed(limitPct);
    }

    /* 100만원당 월세 & 상한 기준 */
    var per100 = 1000000 * rate / 12;
    var per100Limit = 1000000 * limit / 12;
    var atLimit = amt * limit / 12;

    var rows = [
      ['입력 전환율', pctFixed(ratePct), '보증금 100만 원당 ' + won(per100)],
      ['법정 상한 (기준금리+2%p)', pctFixed(limitPct), '보증금 100만 원당 ' + won(per100Limit)],
      ['상한으로 전환할 때', pctFixed(limitPct), mode === 'd2m' ? '월세 ' + won(atLimit) : '보증금 ' + won(rate > 0 ? amt * 12 / limit : 0)]
    ];
    setHTML('outConvRows', rows.map(function (r) {
      return '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td></tr>';
    }).join(''));

    var verdict = safe('outConvVerdict');
    if (verdict) {
      if (ratePct > limitPct + 0.0001) {
        verdict.innerHTML = '<span class="badge bad"><span class="dot"></span>법정 상한 초과 · ' + pctFixed(ratePct) + ' > ' + pctFixed(limitPct) + '</span>' +
          (mode === 'd2m' ? '<span class="badge warn"><span class="dot"></span>초과분 ' + won(amt * (rate - limit) / 12) + '/월 무효</span>' : '');
      } else {
        verdict.innerHTML = '<span class="badge good"><span class="dot"></span>법정 상한 이내 · ' + pctFixed(ratePct) + ' ≤ ' + pctFixed(limitPct) + '</span>';
      }
    }

    var note = safe('outConvNote');
    if (note) {
      note.className = 'notice ' + (ratePct > limitPct ? 'warn' : 'info');
      note.innerHTML = '법정 전환율 상한은 한국은행 기준금리(' + pctFixed(basePct) + ') + 2.0%p = <b>연 ' + pctFixed(limitPct) +
        '</b>입니다(주택임대차보호법 제7조의2). 상한을 넘는 부분은 효력이 없으며, 이미 지급했다면 반환을 청구할 수 있습니다.';
    }
  }

  /* ================================================================ 라벨 동기 */
  var READ_PAIRS = [
    ['inSaveAmount', 'readSaveAmount'],
    ['inSalaryAmount', 'readSalaryAmount'],
    ['inSalaryMeal', 'readSalaryMeal'],
    ['inLoanBalance', 'readLoanBalance'],
    ['inLoanExtra', 'readLoanExtra'],
    ['inSevPay3', 'readSevPay3'],
    ['inSevBonus', 'readSevBonus'],
    ['inSevLeavePay', 'readSevLeavePay'],
    ['inUnempWage', 'readUnempWage'],
    ['inAlBase', 'readAlBase'],
    ['inAlFixed', 'readAlFixed'],
    ['inConvDeposit', 'readConvDeposit'],
    ['inConvMonthly', 'readConvMonthly'],
    ['inConvAmount', 'readConvAmount']
  ];

  function syncReads() {
    READ_PAIRS.forEach(function (pair) {
      var input = safe(pair[0]);
      var out = safe(pair[1]);
      if (!input || !out) return;
      out.textContent = readWon(money(input.value));
    });
  }

  /* ================================================================== 실행 */
  function computeAll() {
    syncReads();
    try { calcSave(); } catch (e) { console.error('save', e); }
    try { calcSalary(); } catch (e) { console.error('salary', e); }
    try { calcLoan(); } catch (e) { console.error('loan', e); }
    try { calcSeverance(); } catch (e) { console.error('severance', e); }
    try { calcUnemp(); } catch (e) { console.error('unemp', e); }
    try { calcAnnualLeave(); } catch (e) { console.error('annual', e); }
    try { calcPoints(); } catch (e) { console.error('points', e); }
    try { calcConversion(); } catch (e) { console.error('conv', e); }
    syncChips();
  }

  function initEvents() {
    document.addEventListener('input', function (e) {
      var t = e.target;
      if (!t) return;
      if (t.classList && t.classList.contains('js-money')) formatMoneyInput(t);
      computeAll();
    });
    document.addEventListener('change', function (e) {
      if (e.target && (e.target.tagName === 'SELECT' || e.target.type === 'date')) computeAll();
    });
  }

  function init() {
    initSegments();
    initChips();
    initTabs();
    initSubtabs();
    initEvents();
    onChangeLabels('saveType');
    onChangeLabels('salaryMode');
    onChangeLabels('convMode');
    computeAll();

    var hash = (location.hash || '').replace('#', '');
    if (TAB_NAMES.indexOf(hash) !== -1) showTab(hash);

    window.addEventListener('hashchange', function () {
      var h = (location.hash || '').replace('#', '');
      if (TAB_NAMES.indexOf(h) !== -1) showTab(h);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
