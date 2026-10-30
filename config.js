var CONFIG = {
  participantId: 574238,   // your Extra Life participant ID
  teamId: 74505,          // your Extra Life team ID

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
      suggestedDixperSkills: []
    },
    {
      game: "Peak/RV There Yet",
      startTime: "2026-11-07T10:00:00",
      endTime:   "2026-11-07T12:00:00",
      suggestedDixperSkills: []
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
      suggestedDixperSkills: []
    },
    {
      game: "Gamble With Friends",
      startTime: "2026-11-07T15:00:00",
      endTime:   "2026-11-07T17:00:00",
      suggestedDixperSkills: []
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
      suggestedDixperSkills: []
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
      suggestedDixperSkills: []
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
    // { skill: "Screen Blur", dollarAmount: 5, description: "Blurs the game screen for 30s" }
  ],

  timing: {
    donationPollMs:        60000,   // 1 min
    totalsPollMs:         120000,   // 2 min
    nextGameWidgetMs:     60000,//600000,   // 10 min
    fullScheduleWidgetMs: 90000,//1800000,  // 30 min
    dixperMenuWidgetMs:   9000,//900000,   // 15 min
    dixperSkillsWidgetMs: 6000, //420000,   // 7 min
    widgetDisplayMs:       20000,   // 20 sec
    bannerSwapMs:         5000,//900000,   // 15 min — how often bottom bar appears
    bannerDisplayMs:       3000,//60000    // 1 min  — how long bottom bar stays
  }
};
