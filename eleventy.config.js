import { HtmlBasePlugin } from "@11ty/eleventy";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(HtmlBasePlugin);

  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({ "src/uploads": "uploads" });
  // The writer's desk is a static app: copied as-is, not processed as templates.
  eleventyConfig.addPassthroughCopy({ "src/escritorio": "escritorio" });
  eleventyConfig.ignores.add("src/escritorio/**");
  // Self-hosted libraries & fonts (no external CDNs needed)
  eleventyConfig.addPassthroughCopy({
    "node_modules/jsvectormap/dist/jsvectormap.min.js": "assets/vendor/jsvectormap/jsvectormap.min.js",
    "node_modules/jsvectormap/dist/jsvectormap.min.css": "assets/vendor/jsvectormap/jsvectormap.min.css",
    "node_modules/jsvectormap/dist/maps/world.js": "assets/vendor/jsvectormap/world.js",
    "node_modules/@fontsource-variable/bricolage-grotesque/index.css": "assets/vendor/fonts/bricolage/index.css",
    "node_modules/@fontsource-variable/bricolage-grotesque/files": "assets/vendor/fonts/bricolage/files",
    "node_modules/@fontsource-variable/inter/index.css": "assets/vendor/fonts/inter/index.css",
    "node_modules/@fontsource-variable/inter/files": "assets/vendor/fonts/inter/files",
    "node_modules/@fontsource/caveat/files": "assets/vendor/fonts/caveat/files",
  });
  eleventyConfig.addPassthroughCopy({ "node_modules/@fontsource/caveat/500.css": "assets/vendor/fonts/caveat/500.css" });

  // Collections
  eleventyConfig.addCollection("stories", (api) =>
    api.getFilteredByGlob("src/posts/*.md")
      .filter((p) => !p.data.draft)
      .sort((a, b) => b.date - a.date)
  );
  eleventyConfig.addCollection("visited", (api) =>
    api.getFilteredByGlob("src/countries/*.md")
      .sort((a, b) => a.data.name.localeCompare(b.data.name))
  );

  // Filters
  eleventyConfig.addFilter("flag", (code = "") =>
    code.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
  );
  eleventyConfig.addFilter("readableDate", (d) => {
    const date = new Date(d);
    return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
  });
  eleventyConfig.addFilter("isoDate", (d) => new Date(d).toISOString().slice(0, 10));
  eleventyConfig.addFilter("readingTime", (content = "") => {
    const words = String(content).replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 220)) + " min read";
  });
  eleventyConfig.addFilter("limit", (arr = [], n) => arr.slice(0, n));
  eleventyConfig.addFilter("byCountry", (arr = [], code) =>
    arr.filter((p) => (p.data.country || "").toLowerCase() === (code || "").toLowerCase())
  );
  eleventyConfig.addFilter("countryName", (code, world) => {
    const c = (world || []).find((x) => x.code === (code || "").toLowerCase());
    return c ? c.name : code;
  });
  eleventyConfig.addFilter("visitedCodes", (visited = []) => visited.map((c) => (c.data.code || "").toLowerCase()));
  eleventyConfig.addFilter("featured", (visited = []) => visited.filter((c) => c.data.featured));
  eleventyConfig.addFilter("json", (v) => JSON.stringify(v));
  eleventyConfig.addFilter("groupByContinent", (world = []) => {
    const groups = {};
    world.forEach((c) => (groups[c.continent] ||= []).push(c));
    return Object.keys(groups).sort().map((k) => ({ name: k, countries: groups[k] }));
  });
  eleventyConfig.addFilter("galleryItems", (gallery = [], stories = [], visited = []) => {
    const items = [...(gallery || [])];
    stories.forEach((p) => p.data.cover && items.push({ image: p.data.cover, caption: p.data.title, link: p.url }));
    visited.forEach((c) => c.data.cover && items.push({ image: c.data.cover, caption: c.data.name, link: c.url }));
    return items;
  });

  return {
    dir: { input: "src", output: "_site", includes: "_includes", data: "_data" },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    // Set by the GitHub Action to "/<repo>/" for project pages; "/" for a custom domain.
    pathPrefix: process.env.PATH_PREFIX || "/",
  };
}
