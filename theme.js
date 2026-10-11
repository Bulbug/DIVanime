// Applies the saved theme before the page is drawn, so there is no flash of the wrong colors.
(function () {
  try {
    var t = localStorage.getItem("divanime-theme");
    if (t) document.documentElement.setAttribute("data-theme", t);
  } catch (e) { /* storage blocked: use the default theme */ }
})();
