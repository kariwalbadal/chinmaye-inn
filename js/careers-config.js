/* Chinmaye Hotels — careers form relay. GENERATED FILE.
   Run `node scripts/build-booking-config.mjs` after editing .env.

   endpoint: the FormSubmit POST URL for info@chinmaye.in. This is a public,
   post-only endpoint id — not a secret. While it is empty the careers form
   falls back to sending the application through WhatsApp instead.

   CURRENT STATE: pointed at the address form, pending activation. The first
   submission sends a confirmation mail to info@chinmaye.in; once that link is
   clicked the reply carries a random token — swap it in below (and set
   CAREERS_FORM_ENDPOINT in .env) so the inbox is no longer exposed in source. */
window.CAREERS_FORM = {
  "endpoint": "https://formsubmit.co/info@chinmaye.in"
};
