/* =========================================================================
   Online play across different internet connections
   ---------------------------------------------------------------------------
   Players on the same Wi-Fi connect directly. Players far apart (different
   internet, mobile data, strict routers) often can't reach each other
   directly and need a RELAY (a "TURN server") in between.

   Free public relays no longer exist, so get your own free one (see README,
   "Playing with friends far away"), then EITHER:
     • paste it in the game: MULTIPLAYER → CONNECTION SETUP (saved only on
       that device), OR
     • fill it in below so it works for everyone who plays your copy.

   Note: anything written here is public on GitHub, so other people could
   use your relay's free allowance. For a private game, use the in-game
   CONNECTION SETUP instead.
   ========================================================================= */
const NET_CONFIG = {
  // A link that gives fresh relay logins (for example a Metered "TURN credentials" API link):
  relayLink: '',

  // Or fixed relay servers, for example ExpressTURN:
  // { urls: ['turn:relay1.expressturn.com:3478', 'turn:relay1.expressturn.com:443?transport=tcp'], username: 'YOUR_USERNAME', credential: 'YOUR_PASSWORD' },
  relays: [
  ],
};
