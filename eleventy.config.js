export default async function (eleventyConfig) {
  return {
    markdownTemplteEngine: "njk",
    dir: {
      output: "dist",
      input: "src",
      includes: "_includes",
      layouts: "_layouts",
    },
  };
}
