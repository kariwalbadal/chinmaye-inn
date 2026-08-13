// Refreshes assets/rates.json with tonight's live direct rates (whole
// property + per room type) and the OTA comparison, pulled from the
// hotel's own STAAH booking engine feeds (csbe.staah.net) and its
// WatchMyRate rate-shopper widget.
// Run by .github/workflows/refresh-rates.yml (and manually via
//   node scripts/fetch-rates.mjs).
//
// All rupee figures are the engine's own display basis: 2 adults,
// 1 night, before tax ("Tax Exclusive") — so anything we show matches
// what the visitor sees after clicking through to the engine.
//
// The identifiers below are public client-side values embedded in the
// booking engine page (not secrets). If STAAH rotates them the fetch
// fails, nothing is written, and the site's rate strip simply hides.
import { writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const PROPERTY_ID = "323MjQtbChGGuyBeGdF7Z75Mjk=";
const CSBE_KEY = "cPPq1uh0xD6BpfDFpGWEx9fxnDOUA3Y25RdigC0X";
const WMR_CODE = "YmYyZmU0MWQwMWEwM2QyM2E3NzJhNWUyYTIyMDQ3ZTU6fEA2MzY4";
const ORIGIN = "https://booking.chinmaye.in";

// STAAH RoomID ↔ website room card. Verified 2026-07-29 against the live
// engine (matched by price + inventory badge on a window where all five
// room types were on sale). Each card shows the cheapest of its IDs.
const ROOM_MAP = {
  business: { ids: ["142868", "142869"], names: { 142868: "Business Class Room", 142869: "Business Twin Bed Room" } },
  executive: { ids: ["142870", "142871"], names: { 142870: "Executive Class Room", 142871: "Executive Twin Bed Room" } },
  deluxe: { ids: ["142872"], names: { 142872: "Deluxe Suite" } },
};
const ALL_ROOM_IDS = Object.values(ROOM_MAP).flatMap((m) => m.ids);

const istNow = new Date(Date.now() + 5.5 * 3600e3);
const day = (d) => d.toISOString().slice(0, 10);
const plusDays = (iso, n) => day(new Date(new Date(iso + "T00:00:00Z").getTime() + n * 864e5));
let checkin = day(istNow);
let checkout = plusDays(checkin, 1);
const dmy = (iso) => iso.split("-").reverse().join("-");

async function fetchRetry(url, init, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetch(url, { ...init, signal: AbortSignal.timeout(20000) });
      if (r.ok) return r;
      throw new Error("HTTP " + r.status);
    } catch (e) {
      console.error(`attempt ${i}/${tries} failed for ${new URL(url).host}: ${e.message}`);
      if (i === tries) throw e;
      await new Promise((r) => setTimeout(r, 5000 * i));
    }
  }
}

/* ---- 1. STAAH BE data API: per-room rates + inventory (primary) ---- */
let rooms = null; // { business: {rate, rack, left, roomName}, ... }
let night = "tonight";
async function fetchRoomsFor(ci, co) {
  const be = await fetchRetry("https://csbe.staah.net/?RequestType=bedataguest&JDRN=Y", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": CSBE_KEY, Origin: ORIGIN },
    body: JSON.stringify({
      Product: "no", PropertyId: PROPERTY_ID, CheckInDate: ci, CheckOutDate: co,
      JDRN: "Y", Country: "IN", DeviceType: "desktop", RoomID: ALL_ROOM_IDS.join(","), Lang: "EN",
      Rooms: [{ Adult: 2, Children: [] }],
    }),
  });
  const beData = await be.json();
  const byId = {};
  for (const r of beData?.Product?.[0]?.Rooms || []) {
    const inv = r.MinInventory || 0;
    let best = null;
    for (const plan of r.RatePlans || []) {
      const nightRate = plan.Rates?.[0]?.Dates?.[ci];
      if (!nightRate) continue;
      const rate = Math.round(parseFloat(nightRate.RateBeforeTax));
      const rack = Math.round(rate + (parseFloat(nightRate.Savings) || 0));
      if (!best || rate < best.rate) best = { rate, rack };
    }
    if (inv > 0 && best) byId[r.RoomId] = { ...best, left: inv };
  }
  const result = {};
  for (const [key, map] of Object.entries(ROOM_MAP)) {
    const offers = map.ids.filter((id) => byId[id]).map((id) => ({ id, ...byId[id] }));
    if (offers.length) {
      const cheapest = offers.reduce((a, b) => (b.rate < a.rate ? b : a));
      result[key] = {
        rate: cheapest.rate,
        rack: cheapest.rack > cheapest.rate ? cheapest.rack : null,
        left: cheapest.left,
        roomName: map.names[cheapest.id],
      };
    } else {
      result[key] = { rate: null }; // sold out for this night
    }
  }
  return result;
}
try {
  rooms = await fetchRoomsFor(checkin, checkout);
  // Same-night sales often close in the evening. An empty strip sells
  // nothing — quote tomorrow's night instead, clearly labelled.
  if (rooms && !Object.values(rooms).some((r) => r.rate)) {
    const ci2 = plusDays(checkin, 1);
    const co2 = plusDays(checkin, 2);
    const tomorrow = await fetchRoomsFor(ci2, co2);
    if (tomorrow && Object.values(tomorrow).some((r) => r.rate)) {
      rooms = tomorrow;
      checkin = ci2;
      checkout = co2;
      night = "tomorrow";
      console.log("tonight sold out — quoting tomorrow", ci2);
    }
  }
} catch (e) {
  console.error("csbe per-room fetch failed:", e.message);
}

/* ---- 2. WatchMyRate: OTA comparison (+ fallback direct rate) ---- */
let otas = [];
let wmrDirect = null;
try {
  const res = await fetchRetry("https://watchmyrate.com/wmrwidgetcall_common.php", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: ORIGIN, Referer: ORIGIN + "/" },
    body: new URLSearchParams({
      wmr_secure_code: WMR_CODE,
      checkin_cmdate: dmy(checkin), checkout_cmdate: dmy(checkout),
      date_cmformat: "dd-M-yy", checkpopupflag: "1", domain_name: "homes",
      wmrInstant: "0", wmr_currency: "INR", wmrFTERateId: "",
    }).toString(),
  });
  const wmr = JSON.parse((await res.text()).trim());
  if (wmr.status === 1 && Array.isArray(wmr.data)) {
    otas = wmr.data
      .filter((d) => !/book direct/i.test(d.channelName) && d.rate > 0)
      .map((d) => ({ name: d.channelName, rate: d.rate }));
    wmrDirect = wmr.data.find((d) => /book direct/i.test(d.channelName)) || null;
  }
} catch (e) {
  console.error("WatchMyRate fetch failed:", e.message);
}

/* ---- 3. Assemble ---- */
const sellable = rooms ? Object.values(rooms).filter((r) => r.rate) : [];
let direct = null, strikethrough = null, roomName = null;
if (sellable.length) {
  const lead = sellable.reduce((a, b) => (b.rate < a.rate ? b : a));
  direct = lead.rate;
  strikethrough = lead.rack;
  roomName = lead.roomName;
} else if (!rooms && wmrDirect?.rate) {
  // engine feed down but rate shopper up — degrade to the old behaviour
  direct = wmrDirect.rate;
  strikethrough = wmrDirect.discount_rate || null;
  roomName = (wmrDirect.roomName || "").replace(/\+/g, " ");
} else if (!rooms) {
  throw new Error("Both rate sources failed — keeping previous rates.json");
}

// which site card the OTA comparison speaks for (WMR compares one room type)
let otaRoomKey = null;
const wmrRoomName = (wmrDirect?.roomName || "").replace(/\+/g, " ").trim().toLowerCase();
if (wmrRoomName)
  for (const [key, map] of Object.entries(ROOM_MAP))
    if (Object.values(map.names).some((n) => n.toLowerCase() === wmrRoomName)) otaRoomKey = key;

const bestOta = otas.length ? Math.min(...otas.map((o) => o.rate)) : null;
const out = {
  updated: new Date().toISOString(),
  night,
  checkin,
  roomName,
  direct,
  strikethrough,
  otas,
  savingsPct: bestOta && direct ? Math.round((1 - direct / bestOta) * 100) : null,
  available: Boolean(direct),
  otaRoomKey,
  rooms,
  source: "STAAH booking engine · WatchMyRate",
};

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const path = join(root, "assets/rates.json");
let previous = null;
try { previous = JSON.parse(readFileSync(path, "utf8")); } catch {}
writeFileSync(path, JSON.stringify(out, null, 2) + "\n");
console.log("rates.json:", JSON.stringify(out));
if (previous && previous.direct !== out.direct)
  console.log(`rate change: ${previous.direct} -> ${out.direct}`);
