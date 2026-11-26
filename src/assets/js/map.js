(function () {
  var el = document.getElementById("world-map");
  if (!el || typeof jsVectorMap === "undefined") return;
  var base = document.documentElement.dataset.base || "/";
  var visited = (window.VISITED || []).map(function (c) { return c.toUpperCase(); });
  var values = {};
  visited.forEach(function (c) { values[c] = 1; });

  var dark = el.dataset.theme === "dark";
  var accent = dark ? "#f4b9a0" : "#d9643a";
  var land = dark ? "#3b5a4a" : "#e7dccb";

  var map = new jsVectorMap({
    selector: "#world-map",
    map: "world",
    zoomButtons: !el.classList.contains("small"),
    zoomOnScroll: false,
    backgroundColor: "transparent",
    regionStyle: {
      initial: { fill: land, stroke: dark ? "#1f3b2d" : "#fbf6ee", strokeWidth: 0.5, fillOpacity: 1 },
      hover: { fill: dark ? "#d9643a" : "#e9a17f", cursor: "pointer" },
      selected: { fill: accent }
    },
    selectedRegions: visited,
    regionsSelectable: false,
    onRegionTooltipShow: function (event, tooltip, code) {
      var name = tooltip.text();
      tooltip.text(name + (visited.indexOf(code) > -1 ? " · visited ✓" : ""), true);
    },
    onRegionClick: function (event, code) {
      if (visited.indexOf(code) > -1) {
        window.location.href = base + "countries/" + code.toLowerCase() + "/";
      }
    }
  });
  window.addEventListener("resize", function () { map.updateSize(); });
})();
