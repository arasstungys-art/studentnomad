export default {
  layout: "layouts/post.njk",
  eleventyComputed: {
    // Drafts are not published.
    permalink: (data) => (data.draft ? false : `/stories/${data.page.fileSlug}/`),
  },
};
