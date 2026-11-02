var CONFIG = {
  participantId: 574238,   // your Extra Life participant ID
  teamId: 74505,          // your Extra Life team ID

  // Full schedule widget: rows per page. Paged up to 3 pages, so at most
  // 3 x this many games are shown.
  fullScheduleRowsPerPage: 5,

  twitch: {
    clientId: '',       // Twitch app Client ID (from dev.twitch.tv)
    accessToken: '',    // pre-generated User Access Token (generate before event)
    broadcasterId: ''   // your numeric Twitch user ID
    // Required OAuth scopes: moderator:read:followers channel:read:subscriptions
  },

  schedule: [
    {
      game: "Burglin' Gnomes",
      startTime: "2026-11-07T08:00:00",
      endTime:   "2026-11-07T10:00:00",
      suggestedDixperSkills: ["Baby Voice", "Focus Glasses", "You Can Only Look Down", "Mess with the WASD keys"]
    },
    {
      game: "Peak/RV There Yet",
      startTime: "2026-11-07T10:00:00",
      endTime:   "2026-11-07T12:00:00",
      suggestedDixperSkills: ["Megaphone Voice", "Mouse Goose Honk", "Wind Blows My Mouse", "Swap Mouse Buttons"]
    },
    {
      game: "",
      startTime: "2026-11-07T12:00:00",
      endTime:   "2026-11-07T13:00:00",
      suggestedDixperSkills: []
    },
    {
      game: "Funnel Runners",
      startTime: "2026-11-07T13:00:00",
      endTime:   "2026-11-07T15:00:00",
      suggestedDixperSkills: ["Megaphone Voice", "Tunnel Vision", "You Can Only Look Down", "Swap Mouse Buttons"]
    },
    {
      game: "Gamble With Friends",
      startTime: "2026-11-07T15:00:00",
      endTime:   "2026-11-07T17:00:00",
      suggestedDixperSkills: ["Autotune Voice", "Celebration Fireworks", "Darkness Covers Screen", "Spam the spacebar"]
    },
    {
      game: "",
      startTime: "2026-11-07T17:00:00",
      endTime:   "2026-11-07T18:00:00",
      suggestedDixperSkills: []
    },
    {
      game: "",
      startTime: "2026-11-07T18:00:00",
      endTime:   "2026-11-07T19:00:00",
      suggestedDixperSkills: []
    },
    {
      game: "REPO",
      startTime: "2026-11-07T19:00:00",
      endTime:   "2026-11-07T21:00:00",
      suggestedDixperSkills: ["Robot Voice","Mute Microphone", "Wind Blows My Mouse","Spam the left click button"]
    },
    {
      game: "",
      startTime: "2026-11-07T21:00:00",
      endTime:   "2026-11-07T22:00:00",
      suggestedDixperSkills: []
    },
    {
      game: "",
      startTime: "2026-11-07T22:00:00",
      endTime:   "2026-11-07T23:00:00",
      suggestedDixperSkills: []
    },
    {
      game: "",
      startTime: "2026-11-07T23:00:00",
      endTime:   "2026-11-08T00:00:00",
      suggestedDixperSkills: []
    },
    {
      game: "Escape The Backrooms",
      startTime: "2026-11-08T00:00:00",
      endTime:   "2026-11-08T02:00:00",
      suggestedDixperSkills: ["Baby Voice", "Cute Jump Scare", "You Can Only Look Down", "Mess with the WASD keys"]
    },
    {
      game: "",
      startTime: "2026-11-08T02:00:00",
      endTime:   "2026-11-08T04:00:00",
      suggestedDixperSkills: []
    },
    {
      game: "",
      startTime: "2026-11-08T04:00:00",
      endTime:   "2026-11-08T06:00:00",
      suggestedDixperSkills: []
    },
    {
      game: "",
      startTime: "2026-11-08T06:00:00",
      endTime:   "2026-11-08T08:00:00",
      suggestedDixperSkills: []
    },
  ],

  dixperMenu: [
    { "name": "Megaphone Voice", "value": "1" },
    { "name": "Baby Voice", "value": "1" },
    { "name": "Autotune Voice", "value": "1" },
    { "name": "Robot Voice", "value": "1" },
    { "name": "Cute Jump Scare", "value": "2" },
    { "name": "Celebration Fireworks", "value": "2" },
    { "name": "Tunnel Vision", "value": "2" },
    { "name": "Focus Glasses", "value": "2" },
    { "name": "Darkness Covers Screen", "value": "2" },
    { "name": "This Game Is Too Scary", "value": "2" },
    { "name": "My Keyboard Sounds Like A Guitar", "value": "2" },
    { "name": "Mouse Goose Honk", "value": "2" },
    { "name": "Mute Microphone", "value": "2" },
    { "name": "Wind Blows My Mouse", "value": "3" },
    { "name": "You Can Only Look Down", "value": "3" },
    { "name": "Swap Mouse Buttons", "value": "4" },
    { "name": "Spam the left click button", "value": "4" },
    { "name": "Spam the spacebar", "value": "4" },
    { "name": "Mess with the WASD keys", "value": "4" },
  ],

  timing: {
    donationPollMs:        60000,   // 1 min
    totalsPollMs:         120000,   // 2 min
    upcomingPreviewMarksMin: [20, 15, 10, 5],  // minutes-left marks that trigger an "up next" preview
    upcomingPreviewMs:    10000,//30000,    // 30 sec — how long each preview holds
    upcomingTakeoverMin:      2,            // final minutes showing "up next" only
    fullScheduleWidgetMs: 90000,//1800000,  // 30 min
    dixperMenuWidgetMs:   9000,//900000,   // 15 min
    dixperSkillsWidgetMs: 6000, //420000,   // 7 min
    widgetDisplayMs:       20000,   // 20 sec — standard hold for one widget
    fullSchedulePageMs:    10000,   // 10 sec — per schedule page (half the standard hold)
    bannerSwapMs:         5000,//900000,   // 15 min — how often bottom bar appears
    bannerDisplayMs:       3000,//60000    // 1 min  — how long bottom bar stays
  }
};
