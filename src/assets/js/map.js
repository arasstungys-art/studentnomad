(function () {
  var el = document.getElementById("world-map");
  if (!el || typeof jsVectorMap === "undefined") return;
  var base = document.documentElement.dataset.base || "/";
  var visited = (window.VISITED || []).map(function (c) { return c.toUpperCase(); });
  var values = {};
  visited.forEach(function (c) { values[c] = 1; });

  var accent = "#c8643c";
  var land = "#e6d6bd";

  var map = new jsVectorMap({
    selector: "#world-map",
    map: "world",
    zoomButtons: !el.classList.contains("small"),
    zoomOnScroll: false,
    backgroundColor: "transparent",
    regionStyle: {
      initial: { fill: land, stroke: "#f6efe3", strokeWidth: 0.5, fillOpacity: 1 },
      hover: { fill: "#d9a07f", cursor: "pointer" },
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
