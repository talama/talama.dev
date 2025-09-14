import type dayjs from "dayjs";

// Datetime format
// https://day.js.org/docs/en/display/format

// English
const en = {
  archives: {
    title: "Archives",
    desc: "All the articles I've posted.",
  },
  posts: {
    title: "Posts",
    desc: "All the articles I've posted.",
  },
  tags: {
    title: "Tags",
    desc: "All the tags used in posts.",
  },
  tag: {
    title: "Tag: ",
    desc: (tag: string) => `All the articles with the tag "${tag}".`,
  },
  categories: {
    title: "Categories",
    desc: "All the categories.",
  },
  category: {
    title: "Category: ",
    desc: (category: string) =>
      `All the articles in the category "${category}".`,
  },
  about: {
    title: "About",
  },
  search: {
    title: "Search",
    desc: "Search any article ...",
  },
  notFoundPage: {
    title: "Page Not Found",
    toHome: "Go back home",
    toSearch: "Try searching",
  },
  date: {
    shortFormat(datetime: dayjs.Dayjs): string {
      return datetime.format("MMM D, YYYY");
    },
    fullFormat(datetime: dayjs.Dayjs): string {
      return datetime.format("MMMM D, YYYY hh:mm A");
    },
    published(strDate: string): string {
      return `Published: ${strDate}`;
    },
    updated(strDate: string): string {
      return `Updated: ${strDate}`;
    },
  },
  pagination: {
    next: "Next",
    previous: "Prev",
  },
  license: {
    copyright: "Copyright",
    statement: "All rights reserved",
  },
  common: {
    backToTop: "Back to Top",
    themeBtn: "Toggle light & dark mode",
    allPosts: "All Posts",
    featuredPosts: "Featured",
    recentPosts: "Recent Posts",
  },
};

export const _t = en;
