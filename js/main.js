/* Chinmaye Hotels — shared interactions (all pages).
   Booking integration point: js/booking-config.js (generated from .env)
   decides per property whether the enquiry modal hands off to the
   STAAH booking engine or to WhatsApp. */

const PROPERTY = window.PROPERTY || "inn";
const CONFIG = (window.CHINMAYE_CONFIG || {})[PROPERTY] || {};

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
    return `Namaste ${CONFIG.name || "Chinmaye"}! I'd like to ${what}${when}${who}.${sign}`;
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
