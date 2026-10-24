/* Portfolio — Loujein Fanni (SaiKet Systems, Task 1)
 * Vanilla JavaScript, no dependencies:
 *  1. Time-of-day themes (auto or manual) + a sun/moon that follows the clock
 *  2. FR / EN translation
 *  3. Navigation (sticky header, mobile menu, active link, progress bar)
 *  4. Scroll animations, counters, typing effect
 *  5. Project filters
 *  6. Contact form with live JavaScript validation
 */
(function () {
  "use strict";

  // Optional: paste a Formspree (or similar) endpoint to really send messages.
  // Left empty, the form runs in demo mode (validation only).
  var FORM_ENDPOINT = "";

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var root = document.documentElement;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // localStorage can throw (private mode, blocked storage): never let it break the page
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
  };

  /* ------------------------------------------------------------------
     1. i18n helpers
     ------------------------------------------------------------------ */
  var lang = store.get("lf-lang") || ((navigator.language || "fr").slice(0, 2) === "en" ? "en" : "fr");

  function t(key, vars) {
    var dict = window.I18N[lang] || window.I18N.fr;
    var str = dict[key] != null ? dict[key] : window.I18N.fr[key];
    if (typeof str !== "string") return str;
    return str.replace(/\{(\w+)\}/g, function (_, name) {
      return vars && vars[name] != null ? vars[name] : "";
    });
  }

  /* ------------------------------------------------------------------
     2. Themes that follow the time of day
     ------------------------------------------------------------------ */
  var THEMES = ["auto", "dawn", "day", "dusk", "night"];
  var REPRESENTATIVE_HOUR = { dawn: 6.5, day: 13, dusk: 18.5, night: 23.5 };
  var META_COLORS = { dawn: "#e65c48", day: "#2563eb", dusk: "#311f44", night: "#080b18" };
  var themeChoice = THEMES.indexOf(store.get("lf-theme")) >= 0 ? store.get("lf-theme") : "auto";

  function phaseForHour(h) {
    if (h >= 5 && h < 9) return "dawn";
    if (h >= 9 && h < 17) return "day";
    if (h >= 17 && h < 20) return "dusk";
    return "night";
  }

  function currentHour() {
    var d = new Date();
    return d.getHours() + d.getMinutes() / 60;
  }

  // Place the sun (05:00 → 21:00) or the moon (20:00 → 05:00) on an arc across the sky
  function placeOrb(theme, hour) {
    var orb = $("#orb");
    if (!orb) return;
    var t;
    if (theme === "night") t = (((hour - 20) % 24) + 24) % 24 / 9;
    else t = (hour - 5) / 16;
    t = Math.min(1, Math.max(0, t));
    // The arc stays in the band between the header and the text so it never covers content
    var small = window.innerWidth < 640;
    var lift = Math.sin(Math.PI * t);
    orb.style.setProperty("--orb-x", (6 + 88 * t).toFixed(1) + "%");
    orb.style.setProperty("--orb-y", Math.round(small ? 100 - lift * 14 : 120 - lift * 30) + "px");
  }

  function applyTheme() {
    var hour = currentHour();
    var theme = themeChoice === "auto" ? phaseForHour(hour) : themeChoice;
    root.setAttribute("data-theme", theme);
    placeOrb(theme, themeChoice === "auto" ? hour : REPRESENTATIVE_HOUR[theme]);

    $$("[data-theme-choice]").forEach(function (btn) {
      btn.setAttribute("aria-pressed", String(btn.dataset.themeChoice === themeChoice));
    });
    var label = t("theme." + theme) + (themeChoice === "auto" ? " · Auto" : "");
    $("#footer-theme").textContent = label;
    $("#live-theme").textContent = theme;
    var meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", META_COLORS[theme]);
  }

  function setTheme(choice) {
    themeChoice = choice;
    store.set("lf-theme", choice);
    applyTheme();
  }

  $$("[data-theme-choice]").forEach(function (btn) {
    btn.addEventListener("click", function () { setTheme(btn.dataset.themeChoice); });
  });
  $("#theme-cycle").addEventListener("click", function () {
    setTheme(THEMES[(THEMES.indexOf(themeChoice) + 1) % THEMES.length]);
    showToast("info", t("theme.label") + " : " + $("#footer-theme").textContent, "");
  });

  // Live clock (hero code card + contact section); refresh the auto theme when the hour changes
  function tick() {
    var now = new Date();
    var time = now.toLocaleTimeString(lang === "en" ? "en-GB" : "fr-FR", { hour: "2-digit", minute: "2-digit" });
    $("#live-time").textContent = time;
    $("#contact-time").textContent = time;
    if (themeChoice === "auto") applyTheme();
  }

  /* ------------------------------------------------------------------
     3. Translation of the whole page
     ------------------------------------------------------------------ */
  function applyLang() {
    root.setAttribute("lang", lang);
    $$("[data-i18n]").forEach(function (el) {
      var v = t(el.dataset.i18n);
      if (typeof v === "string") el.textContent = v;
    });
    $$("[data-i18n-placeholder]").forEach(function (el) { el.placeholder = t(el.dataset.i18nPlaceholder); });
    $$("[data-i18n-aria]").forEach(function (el) { el.setAttribute("aria-label", t(el.dataset.i18nAria)); });
    $$("[data-i18n-title]").forEach(function (el) { el.title = t(el.dataset.i18nTitle); });

    var toggle = $("#lang-toggle");
    toggle.textContent = lang === "fr" ? "EN" : "FR";
    toggle.setAttribute("aria-label", t("lang.switch"));
    $("#menu-toggle").setAttribute("aria-label", t(menuOpen ? "nav.close" : "nav.open"));

    applyTheme();
    tick();
    updateProjectCount();
    startTyping();
    // Re-translate error messages already on screen
    Object.keys(fields).forEach(function (name) {
      if (fields[name].touched) validateField(name);
    });
  }

  $("#lang-toggle").addEventListener("click", function () {
    lang = lang === "fr" ? "en" : "fr";
    store.set("lf-lang", lang);
    applyLang();
  });

  /* ------------------------------------------------------------------
     4. Typing effect in the hero
     ------------------------------------------------------------------ */
  var typingTimer = null;

  function startTyping() {
    var el = $("#typed");
    var roles = t("hero.roles");
    clearTimeout(typingTimer);
    if (reduceMotion) { el.textContent = roles[0]; return; }

    var roleIndex = 0, charIndex = roles[0].length, deleting = true;
    el.textContent = roles[0];

    function step() {
      var word = roles[roleIndex];
      if (deleting) {
        charIndex--;
        if (charIndex <= 0) { deleting = false; roleIndex = (roleIndex + 1) % roles.length; word = roles[roleIndex]; }
      } else {
        charIndex++;
      }
      el.textContent = word.slice(0, Math.max(0, charIndex));
      var delay = deleting ? 35 : 70;
      if (!deleting && charIndex === word.length) { deleting = true; delay = 2000; }
      typingTimer = setTimeout(step, delay);
    }
    typingTimer = setTimeout(step, 2200);
  }

  /* ------------------------------------------------------------------
     5. Header, progress bar, back-to-top, mobile menu, active link
     ------------------------------------------------------------------ */
  var header = $("#header");
  var progress = $("#progress");
  var toTop = $("#to-top");

  function onScroll() {
    var y = window.scrollY;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.transform = "scaleX(" + (max > 0 ? y / max : 0) + ")";
    var scrolled = y > 10;
    header.classList.toggle("bg-surface/80", scrolled);
    header.classList.toggle("backdrop-blur-md", scrolled);
    header.classList.toggle("shadow-sm", scrolled);
    toTop.classList.toggle("translate-y-24", y < 600);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", applyTheme);

  var menuOpen = false;
  var menu = $("#mobile-menu");
  var menuBtn = $("#menu-toggle");

  function setMenu(open) {
    menuOpen = open;
    menu.classList.toggle("hidden", !open);
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.setAttribute("aria-label", t(open ? "nav.close" : "nav.open"));
    menuBtn.querySelector("use").setAttribute("href", open ? "#i-x" : "#i-menu");
  }
  menuBtn.addEventListener("click", function () { setMenu(!menuOpen); });
  $$("a", menu).forEach(function (a) { a.addEventListener("click", function () { setMenu(false); }); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && menuOpen) { setMenu(false); menuBtn.focus(); }
  });

  var navLinks = $$("#nav-links .nav-link");
  if ("IntersectionObserver" in window) {
    var sectionObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (link) {
          var active = link.getAttribute("href") === "#" + entry.target.id;
          link.classList.toggle("is-active", active);
          if (active) link.setAttribute("aria-current", "true");
          else link.removeAttribute("aria-current");
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    $$("main section[id]").forEach(function (s) { sectionObserver.observe(s); });
  }

  /* ------------------------------------------------------------------
     6. Reveal on scroll, counters, journey progress bar
     ------------------------------------------------------------------ */
  function animateCount(el) {
    var target = Number(el.dataset.count);
    if (reduceMotion) { el.textContent = target; return; }
    var start = performance.now();
    (function frame(now) {
      var p = Math.min(1, (now - start) / 1200);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(frame);
    })(start);
  }

  function fillJourney() {
    var bar = $("#journey-bar");
    var pct = Number(bar.dataset.target);
    bar.style.width = pct + "%";
    $("#journey-pct").textContent = pct + "%";
  }

  if ("IntersectionObserver" in window) {
    var revealObserver = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        $$("[data-count]", entry.target).forEach(animateCount);
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.12 });
    $$(".reveal").forEach(function (el) { revealObserver.observe(el); });

    new IntersectionObserver(function (entries, obs) {
      if (entries[0].isIntersecting) { fillJourney(); obs.disconnect(); }
    }, { threshold: 0.3 }).observe($("#journey"));
  } else {
    $$(".reveal").forEach(function (el) { el.classList.add("is-visible"); });
    $$("[data-count]").forEach(function (el) { el.textContent = el.dataset.count; });
    fillJourney();
  }

  /* ------------------------------------------------------------------
     7. Project filters
     ------------------------------------------------------------------ */
  var currentFilter = "all";

  function updateProjectCount() {
    var visible = $$(".project").filter(function (p) { return !p.classList.contains("is-hidden"); }).length;
    $("#project-count").textContent = t("projects.count", { n: visible });
  }

  $$("[data-filter]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      currentFilter = btn.dataset.filter;
      $$("[data-filter]").forEach(function (b) { b.setAttribute("aria-pressed", String(b === btn)); });
      $$(".project").forEach(function (card) {
        var show = currentFilter === "all" || card.dataset.category === currentFilter;
        card.classList.toggle("is-hidden", !show);
        if (show) card.classList.add("is-visible");
      });
      updateProjectCount();
    });
  });

  /* ------------------------------------------------------------------
     8. Toast notifications
     ------------------------------------------------------------------ */
  var toast = $("#toast");
  var toastTimer = null;
  var TOAST_STYLES = {
    success: { icon: "#i-check", cls: "bg-ok/15 text-ok" },
    error: { icon: "#i-alert", cls: "bg-bad/15 text-bad" },
    info: { icon: "#i-palette", cls: "bg-accent/15 text-accent" },
  };

  function showToast(type, title, text) {
    var style = TOAST_STYLES[type];
    var badge = toast.firstElementChild;
    badge.className = "grid h-10 w-10 shrink-0 place-items-center rounded-full " + style.cls;
    badge.querySelector("use").setAttribute("href", style.icon);
    $("#toast-title").textContent = title;
    $("#toast-text").textContent = text;
    $("#toast-text").hidden = !text;
    toast.hidden = false;
    requestAnimationFrame(function () { toast.classList.add("is-open"); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 5000);
  }
  function hideToast() {
    toast.classList.remove("is-open");
    toastTimer = setTimeout(function () { toast.hidden = true; }, 450);
  }
  $("#toast-close").addEventListener("click", hideToast);

  /* ------------------------------------------------------------------
     9. Contact form — JavaScript validation
     ------------------------------------------------------------------ */
  var form = $("#contact-form");
  var NAME_RE = /^[\p{L}][\p{L}\s'’.-]*$/u;
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var MESSAGE_MIN = 20;

  // Each rule returns an error key (or null when the value is valid)
  var fields = {
    name: {
      touched: false,
      check: function (v) {
        if (!v) return ["err.nameRequired"];
        if (v.length < 2) return ["err.nameShort"];
        if (!NAME_RE.test(v)) return ["err.nameChars"];
        return null;
      },
    },
    email: {
      touched: false,
      check: function (v) {
        if (!v) return ["err.emailRequired"];
        if (!EMAIL_RE.test(v)) return ["err.emailInvalid"];
        return null;
      },
    },
    subject: {
      touched: false,
      check: function (v) { return v ? null : ["err.subjectRequired"]; },
    },
    message: {
      touched: false,
      check: function (v) {
        if (!v) return ["err.messageRequired"];
        if (v.length < MESSAGE_MIN) return ["err.messageShort", { n: MESSAGE_MIN - v.length }];
        return null;
      },
    },
  };

  function validateField(name) {
    var input = form.elements[name];
    var error = fields[name].check(input.value.trim());
    var box = $("#" + name + "-error");
    input.setAttribute("aria-invalid", String(!!error));
    input.classList.toggle("is-valid", !error);
    if (error) {
      box.innerHTML = '<svg class="icon h-4 w-4"><use href="#i-alert"/></svg>';
      box.appendChild(document.createTextNode(t(error[0], error[1])));
    } else {
      box.textContent = "";
    }
    box.classList.toggle("is-visible", !!error);
    return !error;
  }

  Object.keys(fields).forEach(function (name) {
    var input = form.elements[name];
    // Validate when leaving a field, then live while typing once it has been touched
    input.addEventListener("blur", function () {
      if (input.value.trim() || fields[name].touched) {
        fields[name].touched = true;
        validateField(name);
      }
    });
    input.addEventListener(name === "subject" ? "change" : "input", function () {
      if (name === "subject") fields[name].touched = true;
      if (fields[name].touched) validateField(name);
    });
  });

  var messageCount = $("#message-count");
  form.elements.message.addEventListener("input", function () {
    var len = form.elements.message.value.length;
    messageCount.textContent = len + " / 1000";
    messageCount.classList.toggle("text-bad", len > 950);
  });

  function setSending(sending) {
    var btn = $("#submit-btn");
    btn.disabled = sending;
    btn.classList.toggle("opacity-70", sending);
    var icon = $("#submit-icon");
    icon.querySelector("use").setAttribute("href", sending ? "#i-spinner" : "#i-send");
    icon.classList.toggle("spin", sending);
    $("#submit-label").textContent = t(sending ? "form.sending" : "form.send");
  }

  function resetForm() {
    form.reset();
    messageCount.textContent = "0 / 1000";
    Object.keys(fields).forEach(function (name) {
      fields[name].touched = false;
      var input = form.elements[name];
      input.removeAttribute("aria-invalid");
      input.classList.remove("is-valid");
      var box = $("#" + name + "-error");
      box.textContent = "";
      box.classList.remove("is-visible");
    });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var invalid = Object.keys(fields).filter(function (name) {
      fields[name].touched = true;
      return !validateField(name);
    });

    if (invalid.length) {
      form.elements[invalid[0]].focus();
      showToast("error", t("err.summary", { n: invalid.length }), "");
      return;
    }

    var firstName = form.elements.name.value.trim().split(/\s+/)[0];
    var data = {
      name: form.elements.name.value.trim(),
      email: form.elements.email.value.trim(),
      subject: form.elements.subject.value,
      message: form.elements.message.value.trim(),
    };

    // Bots fill the hidden "website" field: pretend success, send nothing
    if (form.elements.website.value) { resetForm(); return; }

    setSending(true);
    var request = FORM_ENDPOINT
      ? fetch(FORM_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(data),
        }).then(function (res) { if (!res.ok) throw new Error(res.status); })
      : new Promise(function (resolve) { setTimeout(resolve, 900); });

    request
      .then(function () {
        showToast("success", t("toast.successTitle", { name: firstName }), t(FORM_ENDPOINT ? "toast.successText" : "toast.demoText"));
        resetForm();
      })
      .catch(function () {
        showToast("error", t("toast.errorTitle"), t("toast.errorText"));
      })
      .then(function () { setSending(false); });
  });

  /* ------------------------------------------------------------------
     Init
     ------------------------------------------------------------------ */
  $("#year").textContent = new Date().getFullYear();
  applyLang();
  onScroll();
  setInterval(tick, 15000);
})();
