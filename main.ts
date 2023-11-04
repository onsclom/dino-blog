import { exists, emptyDir } from "https://deno.land/std@0.205.0/fs/mod.ts";
import {
  extract,
  test,
} from "https://deno.land/std@0.205.0/front_matter/any.ts";
import { parse } from "npm:marked";
import { nav, BUILD_DIR, FAVICON_EMOJI, BLOG_TITLE } from "./config.ts";

type Link = {
  title: string;
  href: string;
};

const renderNavItem = ({ title, href }: Link, curPath: string) =>
  `<a href="${href}" aria-current=${href === curPath}>${title}</a>`;

const renderNavBar = (curPath: string) =>
  `<nav>${nav.map((link) => renderNavItem(link, curPath)).join(" ")}</nav>`;

const renderPage = (
  path: string,
  title: string,
  content: string
) => `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>${FAVICON_EMOJI}</text></svg>">
  </head>
  <body>
  <header>
    <h1>🦕 ${BLOG_TITLE}</h1>
    ${renderNavBar(path)}
  </header>
  <main>
    ${content}
  </main>
  </body>
</html>`;

const buildExists = await exists(BUILD_DIR);
if (!buildExists) await Deno.mkdir(BUILD_DIR);
await emptyDir(BUILD_DIR);

const PAGES_DIR = "content/pages";
const pageFiles = await Deno.readDir(PAGES_DIR);
for await (const file of pageFiles) await renderMarkdownPage(file);

async function renderMarkdownPage(file: Deno.DirEntry) {
  const data = await extractMarkdownParts(`${PAGES_DIR}/${file.name}`);
  const title = data.attrs.title;
  if (typeof title !== "string")
    throw Error(`File ${file.name} does not have a valid title`);
  const path = file.name.split(".")[0];
  await Deno.writeTextFile(
    `${BUILD_DIR}/${path}.html`,
    renderPage(`/${path}`.replace("index", ""), title, parse(data.body))
  );
}

async function extractMarkdownParts(path: string) {
  const fileText = await Deno.readTextFile(path);
  const fileName = path.split("/").pop();
  if (!test(fileText))
    throw Error(`File ${fileName} does not have valid front matter`);
  return extract(fileText);
}

type BlogPost = {
  title: string;
  pubDate: Date;
  slug: string;
};
const blogPosts: BlogPost[] = [];
const BLOG_DIR = "content/blog";
const blogFiles = await Deno.readDir(BLOG_DIR);
await Deno.mkdir(`${BUILD_DIR}/blog`);
for await (const file of blogFiles) await renderBlogPost(file);

async function renderBlogPost(file: Deno.DirEntry) {
  const data = await extractMarkdownParts(`${BLOG_DIR}/${file.name}`);
  const title = data.attrs.title;
  const pubDate = new Date(data.attrs.pubDate as string);
  if (typeof title !== "string")
    throw Error(`File ${file.name} does not have a valid title`);
  if (isNaN(pubDate.getTime()))
    throw Error(`File ${file.name} does not have a valid pubDate`);
  const path = file.name.split(".")[0];
  await Deno.writeTextFile(
    `${BUILD_DIR}/blog/${path}.html`,
    renderPage(
      `/blog/${path}`,
      title,
      `<h1>${title}</h1>
      <p>Published on ${pubDate.toLocaleDateString()}</p>
      ${parse(data.body)}`
    )
  );
  blogPosts.push({ title, pubDate, slug: path });
}

await Deno.writeTextFile(
  `${BUILD_DIR}/blog/index.html`,
  renderPage(
    `${BUILD_DIR}/blog/index.html`,
    "Blog",
    `<ul>
  ${blogPosts
    .map(
      ({ pubDate, slug, title }) => `<li>
      <span>${pubDate.toLocaleDateString()}</span>
      <a href="/blog/${slug}">${title}</a>
    </li>`
    )
    .join(" ")}
</ul>`
  )
);
