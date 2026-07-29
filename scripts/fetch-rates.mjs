// Refreshes assets/rates.json with tonight's live direct rate + OTA
// comparison, pulled from the hotel's own STAAH booking engine feeds
// (csbe.staah.net) and its WatchMyRate rate-shopper widget.
// Run by .github/workflows/refresh-rates.yml (and manually via
//   node scripts/fetch-rates.mjs).
//
// The identifiers below are public client-side values embedded in the
// booking engine page (not secrets). If STAAH rotates them the fetch
// fails, nothing is written, and the site's rate strip simply hides.
import { writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const PROPERTY_ID = "323MjQtbChGGuyBeGdF7Z75Mjk=";
const ROOM_IDS = "142868,142869,142870,142871,142872";
const CSBE_KEY = "cPPq1uh0xD6BpfDFpGWEx9fxnDOUA3Y25RdigC0X";
const WMR_CODE = "YmYyZmU0MWQwMWEwM2QyM2E3NzJhNWUyYTIyMDQ3ZTU6fEA2MzY4";
const ORIGIN = "https://booking.chinmaye.in";

const istNow = new Date(Date.now() + 5.5 * 3600e3);
const day = (d) => d.toISOString().slice(0, 10);
const checkin = day(istNow);
const checkout = day(new Date(istNow.getTime() + 864e5));
const dmy = (iso) => iso.split("-").reverse().join("-");

const wmrBody = new URLSearchParams({
  wmr_secure_code: WMR_CODE,
  checkin_cmdate: dmy(checkin),
  checkout_cmdate: dmy(checkout),
  date_cmformat: "dd-M-yy",
  checkpopupflag: "1",
  domain_name: "homes",
  wmrInstant: "0",
  wmr_currency: "INR",
  wmrFTERateId: "",
});

const res = await fetch("https://watchmyrate.com/wmrwidgetcall_common.php", {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    Origin: ORIGIN,
    Referer: ORIGIN + "/",
  },
  body: wmrBody.toString(),
});
if (!res.ok) throw new Error("WMR HTTP " + res.status);
const wmr = JSON.parse((await res.text()).trim());
if (wmr.status !== 1 || !Array.isArray(wmr.data) || !wmr.data.length)
  throw new Error("WMR payload unexpected: " + JSON.stringify(wmr).slice(0, 200));

const direct = wmr.data.find((d) => /book direct/i.test(d.channelName));
const otas = wmr.data
  .filter((d) => !/book direct/i.test(d.channelName) && d.rate > 0)
  .map((d) => ({ name: d.channelName, rate: d.rate }));
if (!direct || !direct.rate) throw new Error("No direct rate in WMR payload");

// cross-check availability via the BE data API (same source the engine uses)
let available = true;
try {
  const be = await fetch("https://csbe.staah.net/?RequestType=bedataguest&JDRN=Y", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": CSBE_KEY, Origin: ORIGIN },
    body: JSON.stringify({
      Product: "no", PropertyId: PROPERTY_ID, CheckInDate: checkin, CheckOutDate: checkout,
      JDRN: "Y", Country: "IN", DeviceType: "desktop", RoomID: ROOM_IDS, Lang: "EN",
      Rooms: [{ Adult: 2, Children: [] }],
    }),
  });
  const beData = await be.json();
  const rooms = beData?.Product?.[0]?.Rooms || [];
  available = rooms.some((r) => Object.values(r.Inventory || {}).some((v) => v > 0));
} catch { /* availability check is best-effort */ }

const bestOta = otas.length ? Math.min(...otas.map((o) => o.rate)) : null;
const out = {
  updated: new Date().toISOString(),
  checkin,
  roomName: (direct.roomName || "").replace(/\+/g, " "),
  direct: direct.rate,
  strikethrough: direct.discount_rate || null,
  otas,
  savingsPct: bestOta ? Math.round((1 - direct.rate / bestOta) * 100) : null,
  available,
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
