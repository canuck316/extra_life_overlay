// Dixper menu data and skill suggestion helpers

var Dixper = (function () {

  function getMenuItems() {
    return CONFIG.dixperMenu;
  }

  function getSuggestedSkillsForCurrentGame() {
    var current = Schedule.getCurrentGame();
    if (!current || !current.suggestedDixperSkills || !current.suggestedDixperSkills.length) {
      return [];
    }
    return current.suggestedDixperSkills
      .map(function (skillName) {
        return CONFIG.dixperMenu.find(function (item) { return item.skill === skillName; });
      })
      .filter(Boolean);
  }

  function init() {
    // Static data — no polling needed
  }

  return { init: init, getMenuItems: getMenuItems, getSuggestedSkillsForCurrentGame: getSuggestedSkillsForCurrentGame };
})();
