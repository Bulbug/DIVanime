// Applies the saved theme before the page is drawn, so there is no flash of the wrong colors.
(function () {
  try {
    var t = localStorage.getItem("divanime-theme");
    // older versions used these names, so keep working for people who saved one
    var old = { night: "midnight", day: "light", sunset: "abyss" };
    if (old[t]) t = old[t];
    if (t) document.documentElement.setAttribute("data-theme", t);
  } catch (e) { /* storage blocked: use the default theme */ }
})();
