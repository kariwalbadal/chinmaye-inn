/* Chinmaye Hotels — booking engine configuration.
   GENERATED FILE — do not put secrets here.
   Run `node scripts/build-booking-config.mjs` after editing .env
   (see .env.example) to regenerate with real STAAH URLs.

   CURRENT STATE: STAAH handoff ENABLED for Inn + Grand in TEST mode —
   it routes to the /staah-demo/ placeholder so the flow can be
   reviewed end-to-end. Paste the real STAAH links into .env and
   regenerate to go live. */
window.CHINMAYE_CONFIG = {
  "inn": {
    "name": "Hotel Chinmaye Inn",
    "staahEnabled": true,
    "staahUrl": "https://kariwalbadal.github.io/chinmaye-group/staah-demo/?property=inn&checkin={checkin}&checkout={checkout}&adults={adults}"
  },
  "grand": {
    "name": "The Chinmaye Grand",
    "staahEnabled": true,
    "staahUrl": "https://kariwalbadal.github.io/chinmaye-group/staah-demo/?property=grand&checkin={checkin}&checkout={checkout}&adults={adults}"
  },
  "deoghar": {
    "name": "Chinmaye Deoghar",
    "staahEnabled": false,
    "staahUrl": ""
  }
};
