/* Chinmaye Hotels — shared interactions (all pages).
   Booking integration point: js/booking-config.js (generated from .env)
   decides per property whether the enquiry modal hands off to the
   STAAH booking engine or to WhatsApp. */

const PROPERTY = window.PROPERTY || "inn";
const CONFIG = (window.CHINMAYE_CONFIG || {})[PROPERTY] || {};
/* A/B: pages under /en/ set window.SITE_EN and get English strings */
const EN = Boolean(window.SITE_EN);

const BOOKING = {
  phone: "+918877222233",
  whatsapp: "918877222233",
  purposeLabels: {
    stay: "book a room",
    dine: "reserve a table at Kesaria",
    event: "plan an event",
  },
  buildMessage({ purpose, room, date, guests, name }) {
    const at = CONFIG.name ? ` at ${CONFIG.name}` : "";
    const what = room && purpose === "stay" ? `book the ${room}` : this.purposeLabels[purpose] + at;
    const when = date ? ` for ${date}` : "";
    const who = guests ? `, ${guests} guest${guests > 1 ? "s" : ""}` : "";
    const sign = name ? ` — ${name}` : "";
    return `${EN ? "Hello" : "Namaste"} ${CONFIG.name || "Chinmaye"}! I'd like to ${what}${when}${who}.${sign}`;
  },
  staahActive(purpose) {
    return purpose === "stay" && CONFIG.staahEnabled && CONFIG.staahUrl;
  },
  submitEnquiry(data) {
    if (this.staahActive(data.purpose)) {
      const checkout = data.date
        ? new Date(new Date(data.date).getTime() + 864e5).toISOString().slice(0, 10)
        : "";
      const url = CONFIG.staahUrl
        .replaceAll("{checkin}", data.date || "")
        .replaceAll("{checkout}", checkout)
        .replaceAll("{adults}", data.guests || "2");
      window.open(url, "_blank", "noopener");
      return;
    }
    const url = `https://wa.me/${this.whatsapp}?text=${encodeURIComponent(this.buildMessage(data))}`;
    window.open(url, "_blank", "noopener");
  },
};

/* when STAAH is live for stays, room CTAs shouldn't promise WhatsApp */
if (BOOKING.staahActive("stay")) {
  document.querySelectorAll(".js-book").forEach((b) => {
    if (/whatsapp/i.test(b.textContent)) b.textContent = "Book online";
  });
}

/* ---------- header state ---------- */
const header = document.querySelector(".site-header");
if (header) {
  const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 24);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
}

/* ---------- full-screen menu ---------- */
const menuToggle = document.querySelector(".menu-toggle");
const menuOverlay = document.getElementById("menu-overlay");
if (menuToggle && menuOverlay) {
  const setMenu = (open) => {
    document.body.classList.toggle("menu-open", open);
    menuToggle.setAttribute("aria-expanded", String(open));
    menuToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    if (open) menuOverlay.hidden = false;
    else setTimeout(() => { if (!document.body.classList.contains("menu-open")) menuOverlay.hidden = true; }, 500);
  };
  menuToggle.addEventListener("click", () => setMenu(!document.body.classList.contains("menu-open")));
  menuOverlay.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setMenu(false)));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.body.classList.contains("menu-open")) setMenu(false);
  });
}

/* ---------- deferred hero slides ---------- */
window.addEventListener("load", () => {
  document.querySelectorAll(".hero-slide[data-src]").forEach((img) => {
    img.src = img.dataset.src;
    img.removeAttribute("data-src");
  });
});

/* ---------- lazy walkthrough video ---------- */
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
document.querySelectorAll(".video-card video[data-src]").forEach((video) => {
  const conn = navigator.connection || {};
  if (reduceMotion || conn.saveData) return; // poster only
  const load = () => {
    video.src = video.dataset.src;
    video.removeAttribute("data-src");
    video.muted = true;
    video.play().catch(() => {});
  };
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { load(); io.disconnect(); } });
    }, { rootMargin: "200px" });
    io.observe(video);
  } else load();
});

/* ---------- scroll reveals ---------- */
const revealables = document.querySelectorAll("[data-reveal]");
if (reduceMotion || !("IntersectionObserver" in window)) {
  revealables.forEach((el) => el.classList.add("in"));
} else if (revealables.length) {
  const pending = new Set(revealables);
  const show = (el) => { el.classList.add("in"); pending.delete(el); };
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) { show(entry.target); io.unobserve(entry.target); }
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
  revealables.forEach((el, i) => {
    el.style.transitionDelay = `${(i % 4) * 0.08}s`;
    io.observe(el);
  });
  // Fast scrolls can jump past the observer window — sweep anything
  // already above the reveal line so no section is left blank.
  let sweepScheduled = false;
  const sweep = () => {
    sweepScheduled = false;
    const line = window.innerHeight * 0.92;
    pending.forEach((el) => {
      if (el.getBoundingClientRect().top < line) { show(el); io.unobserve(el); }
    });
  };
  window.addEventListener("scroll", () => {
    if (!sweepScheduled && pending.size) { sweepScheduled = true; setTimeout(sweep, 150); }
  }, { passive: true });
}

/* ---------- enquiry modal ---------- */
const modal = document.getElementById("booking-modal");
const form = document.getElementById("booking-form");
if (modal && form) {
  const dateInput = form.querySelector('input[name="date"]');
  const submitBtn = form.querySelector(".bm-submit");
  const secureNote = form.querySelector(".bm-secure");
  let pendingRoom = "";

  const refreshMode = () => {
    const purpose = form.querySelector('input[name="purpose"]:checked').value;
    const staah = BOOKING.staahActive(purpose);
    submitBtn.textContent = staah ? "Continue to secure booking" : "Send on WhatsApp";
    if (secureNote) {
      secureNote.hidden = !staah;
      if (staah) secureNote.textContent = `You'll finish on our secure booking page — it will show ${CONFIG.name}.`;
    }
  };

  function openBooking(purpose = "stay", room = "") {
    pendingRoom = room;
    const radio = form.querySelector(`input[name="purpose"][value="${purpose}"]`);
    if (radio) radio.checked = true;
    dateInput.min = new Date().toISOString().slice(0, 10);
    if (!dateInput.value) dateInput.value = dateInput.min;
    refreshMode();
    modal.showModal();
  }

  document.querySelectorAll(".js-book").forEach((btn) => {
    btn.addEventListener("click", () => openBooking(btn.dataset.purpose, btn.dataset.room || ""));
  });
  document.querySelectorAll(".js-book-link").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      openBooking(a.dataset.purpose, a.dataset.room || "");
    });
  });
  form.querySelectorAll('input[name="purpose"]').forEach((r) => r.addEventListener("change", refreshMode));
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.close("cancel"); });

  form.addEventListener("submit", (e) => {
    if (e.submitter && e.submitter.value === "cancel") return;
    if (!form.reportValidity()) { e.preventDefault(); return; }
    BOOKING.submitEnquiry({
      purpose: form.querySelector('input[name="purpose"]:checked').value,
      room: pendingRoom,
      date: dateInput.value,
      guests: form.querySelector('input[name="guests"]').value,
      name: form.querySelector('input[name="name"]').value.trim(),
    });
  });
}

/* ---------- live rates: strip + per-room prices (inn) ---------- */
const rateStrip = document.getElementById("rate-strip");
if (rateStrip) {
  const inr = (n) => "₹" + n.toLocaleString("en-IN");
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  fetch("/assets/rates.json", { cache: "no-cache" })
    .then((r) => r.json())
    .then((d) => {
      const ageH = (Date.now() - new Date(d.updated).getTime()) / 36e5;
      if (ageH > 36) return; // stale — leave the static page as-is

      const otaList = (d.otas || []).filter((o) => o.rate > 0);
      const otaHtml = otaList.slice(0, 3).map((o) => `${esc(o.name)} <s>${inr(o.rate)}</s>`).join(" · ");
      const engineUrl = BOOKING.staahActive("stay")
        ? CONFIG.staahUrl
            .replaceAll("{checkin}", new Date().toISOString().slice(0, 10))
            .replaceAll("{checkout}", "")
            .replaceAll("{adults}", "2")
        : null;

      /* per-room card prices (cheapest live rate for each room type) */
      document.querySelectorAll(".room-rate[data-rate-key]").forEach((p) => {
        const r = (d.rooms || {})[p.dataset.rateKey];
        if (!r) return;
        p.classList.add("live");
        if (r.rate) {
          p.innerHTML =
            (EN ? "tonight " : "aaj ") + (r.rack ? `<s>${inr(r.rack)}</s> ` : "") +
            `<strong>${inr(r.rate)}</strong><span>/night</span>` +
            (r.left > 0 && r.left <= 5 ? `<em class="room-left">${EN ? "only " + r.left + " left" : "sirf " + r.left + " bache"}</em>` : "");
        } else {
          /* sold out tonight — still hand off to the engine, where other dates are open */
          p.insertAdjacentHTML(
            "beforeend",
            `<em class="room-left">${EN ? "sold out tonight" : "aaj sold out"}` +
              (engineUrl ? ` · <a href="${engineUrl}" target="_blank" rel="noopener">${EN ? "see other dates" : "aur dates dekhein"}</a>` : "") +
              "</em>"
          );
        }
        /* the OTA comparison speaks for one room type — show it on that card */
        if (p.dataset.rateKey === d.otaRoomKey && otaHtml)
          p.insertAdjacentHTML("afterend", `<span class="room-otas">${EN ? "This room on OTAs tonight:" : "OTAs pe yehi room aaj:"} ${otaHtml}</span>`);
      });

      if (!d.direct || !d.available) return;
      document.getElementById("rs-direct").textContent = inr(d.direct);
      if (d.strikethrough && d.strikethrough > d.direct)
        document.getElementById("rs-strike").textContent = inr(d.strikethrough);
      if (d.savingsPct)
        document.getElementById("rs-save").textContent = "Save " + d.savingsPct + "% direct";
      const cheapestEverywhere = otaList.length && otaList.every((o) => o.rate > d.direct);
      document.getElementById("rs-otas").innerHTML = otaHtml
        ? "Elsewhere tonight: " + otaHtml + (cheapestEverywhere ? ` — <strong>${EN ? "cheapest right here" : "yahin sabse sasta"}</strong>` : "")
        : "";
      const t = new Date(d.updated);
      document.getElementById("rs-note").textContent =
        `Tonight · ${d.roomName} · checked ${t.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} IST via our booking engine`;
      rateStrip.hidden = false;

      /* the tariff footnote can speak in the present tense now */
      const note = document.getElementById("rate-note");
      if (note)
        note.innerHTML = EN
          ? "The rates above are tonight’s live rates, straight from our booking engine" +
            (cheapestEverywhere ? " — lower than every OTA" : "") +
            '. Group or wedding booking? <a href="https://wa.me/918877222233?text=Hello%20Chinmaye%20Inn!%20Could%20you%20share%20today%27s%20best%20direct%20rate%3F" rel="noopener">WhatsApp the desk</a> — quick replies.'
          : "Upar ke rates aaj raat ke live rates hain — seedha hamare booking engine se" +
            (cheapestEverywhere ? ", har OTA se kam" : "") +
            '. Group ya shaadi ki booking? <a href="https://wa.me/918877222233?text=Namaste%20Chinmaye%20Inn!%20Aaj%20ka%20best%20direct%20rate%20bata%20dijiye." rel="noopener">WhatsApp the desk</a> — turant jawab.';
    })
    .catch(() => {});
}
