/* Chinmaye Hotels — booking engine configuration.
   GENERATED FILE — do not put secrets here.
   Run `node scripts/build-booking-config.mjs` after editing .env
   (see .env.example) to regenerate.

   CURRENT STATE: Inn is wired to the LIVE STAAH booking engine
   (masked at booking.chinmaye.in). Grand reverts to WhatsApp
   enquiries until its own engine exists. */
window.CHINMAYE_CONFIG = {
  "inn": {
    "name": "Hotel Chinmaye Inn",
    "staahEnabled": true,
    "staahUrl": "https://booking.chinmaye.in/inst/#/home?propertyId=323MjQtbChGGuyBeGdF7Z75Mjk=&JDRN=Y&RoomID=142868,142869,142870,142871,142872&gsId=323MjQtbChGGuyBeGdF7Z75Mjk="
  },
  "grand": {
    "name": "The Chinmaye Grand",
    "staahEnabled": false,
    "staahUrl": ""
  },
  "deoghar": {
    "name": "Chinmaye Deoghar",
    "staahEnabled": false,
    "staahUrl": ""
  }
};
