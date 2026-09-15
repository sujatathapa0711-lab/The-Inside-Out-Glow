/* =========================================================
   Glow Inside Out — WordPress content loader
   Used by: homepage (#latest-posts) and blog page (#posts-grid)
   ========================================================= */

// Your site is a free .wordpress.com blog, which does NOT expose /wp-json
// directly — it must be accessed through WordPress.com's public API proxy.
// Self-hosted WordPress sites would instead use: "https://yoursite.com/wp-json/wp/v2"
const WP_API_BASE = "https://public-api.wordpress.com/wp/v2/sites/glowinsideout2.wordpress.com";

const GRADIENTS = ["a", "b", "c", "d"];
const PER_PAGE = 6;

let currentPage = 1;
let currentCategory = "";
let totalPages = 1;

/* ---------- helpers ---------- */

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function estimateReadTime(html) {
  const words = (html || "").replace(/<[^>]+>/g, "").trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

function stripHtml(html, length) {
  const text = (html || "").replace(/<[^>]+>/g, "").trim();
  return length ? text.slice(0, length) : text;
}

function getPostImage(post) {
  // 1. Try the official featured image (requires _embed + a Featured Image set in WP)
  const featured = post._embedded?.["wp:featuredmedia"]?.[0]?.source_url;
  if (featured) return featured;

  // 2. Fallback: pull the first <img> found inside the post body.
  //    Many posts (especially on wordpress.com) have images in the body
  //    but never had a "Featured Image" explicitly set.
  const bodyHtml = post.content?.rendered || post.excerpt?.rendered || "";
  const match = bodyHtml.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? match[1] : null;
}

function postToCardHTML(post, index, showMeta) {
  const title = post.title?.rendered || "Untitled";
  const excerpt = stripHtml(post.excerpt?.rendered, 110);
  const cat = post._embedded?.["wp:term"]?.[0]?.[0]?.name || "Journal";
  const img = getPostImage(post);
  const gradient = GRADIENTS[index % GRADIENTS.length];
  const imgStyle = img
    ? `style="background-image:url('${img}'); background-size:cover; background-position:center;"`
    : "";
  const meta = showMeta
    ? `<div class="card-meta">${formatDate(post.date)} · ${estimateReadTime(post.content?.rendered)} min read</div>`
    : "";

  return `
    <a class="card" href="${post.link}" style="text-decoration:none; color:inherit;">
      <div class="card-img ${img ? "" : gradient}" ${imgStyle}>${img ? "" : cat.toLowerCase()}</div>
      <div class="card-body">
        <div class="card-cat">${cat}</div>
        <h3>${title}</h3>
        <p>${excerpt}…</p>
        ${meta}
      </div>
    </a>`;
}

function showMessage(container, text) {
  container.innerHTML = `<p style="grid-column:1/-1; text-align:center; color:#a89c8d;">${text}</p>`;
}

/* ---------- homepage: latest posts ---------- */

async function loadLatestPosts() {
  const container = document.getElementById("latest-posts");
  if (!container) return; // not on this page

  showMessage(container, "Loading latest posts…");
  try {
    const res = await fetch(`${WP_API_BASE}/posts?per_page=3&_embed`);
    const posts = await res.json();

    if (!Array.isArray(posts) || posts.length === 0) {
      showMessage(container, "No posts yet — check back soon.");
      return;
    }
    container.innerHTML = posts.map((post, i) => postToCardHTML(post, i, false)).join("");
  } catch (err) {
    showMessage(container, "Couldn't load posts. Check the WordPress API connection.");
    console.error(err);
  }
}

/* ---------- blog page: category filters + paginated grid ---------- */

async function loadCategories() {
  const filterBar = document.getElementById("filters");
  if (!filterBar) return; // not on this page

  try {
    const res = await fetch(`${WP_API_BASE}/categories?per_page=20&hide_empty=true`);
    const cats = await res.json();

    cats.forEach((cat) => {
      const btn = document.createElement("button");
      btn.className = "filter";
      btn.dataset.cat = cat.id;
      btn.textContent = cat.name;
      filterBar.appendChild(btn);
    });

    filterBar.addEventListener("click", (e) => {
      if (!e.target.matches(".filter")) return;
      filterBar.querySelectorAll(".filter").forEach((b) => b.classList.remove("active"));
      e.target.classList.add("active");
      currentCategory = e.target.dataset.cat || "";
      currentPage = 1;
      fetchPosts(false);
    });
  } catch (err) {
    console.error("Couldn't load categories", err);
  }
}

async function fetchPosts(append) {
  const grid = document.getElementById("posts-grid");
  if (!grid) return; // not on this page

  const loadMoreWrap = document.getElementById("load-more-wrap");
  if (!append) showMessage(grid, "Loading posts…");

  try {
    let url = `${WP_API_BASE}/posts?per_page=${PER_PAGE}&page=${currentPage}&_embed`;
    if (currentCategory) url += `&categories=${currentCategory}`;

    const res = await fetch(url);
    totalPages = parseInt(res.headers.get("X-WP-TotalPages") || "1", 10);
    const posts = await res.json();

    if (!append) grid.innerHTML = "";
    if (posts.length === 0 && !append) {
      showMessage(grid, "No posts found in this category yet.");
    } else {
      grid.insertAdjacentHTML(
        "beforeend",
        posts.map((post, i) => postToCardHTML(post, i, true)).join("")
      );
    }

    if (loadMoreWrap) {
      loadMoreWrap.style.display = currentPage < totalPages ? "block" : "none";
    }
  } catch (err) {
    showMessage(grid, "Couldn't load posts. Check the WordPress API connection.");
    console.error(err);
  }
}

function initLoadMoreButton() {
  const btn = document.getElementById("load-more-btn");
  if (!btn) return; // not on this page

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    currentPage++;
    fetchPosts(true);
  });
}

/* ---------- init ---------- */

document.addEventListener("DOMContentLoaded", () => {
  loadLatestPosts();      // runs only if #latest-posts exists (homepage)
  loadCategories();       // runs only if #filters exists (blog page)
  fetchPosts(false);      // runs only if #posts-grid exists (blog page)
  initLoadMoreButton();   // runs only if #load-more-btn exists (blog page)
});