/* =========================================================
   Glow Inside Out — WordPress content loader
   Used by:
   - Homepage (#latest-posts)
   - Blog page (#posts-grid)
   - Single post page (#single-post)
   ========================================================= */

// WordPress.com public API
const WP_API_BASE =
  "https://public-api.wordpress.com/wp/v2/sites/glowinsideout2.wordpress.com";

const GRADIENTS = ["a", "b", "c", "d"];
const PER_PAGE = 6;

let currentPage = 1;
let currentCategory = "";
let totalPages = 1;


/* ---------- helpers ---------- */

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function estimateReadTime(html) {
  const words = (html || "")
    .replace(/<[^>]+>/g, "")
    .trim()
    .split(/\s+/)
    .length;

  return Math.max(1, Math.round(words / 200));
}

function stripHtml(html, length) {
  const text = (html || "")
    .replace(/<[^>]+>/g, "")
    .trim();

  return length ? text.slice(0, length) : text;
}

function getPostImage(post) {

  // 1. Try featured image
  const featured =
    post._embedded?.["wp:featuredmedia"]?.[0]?.source_url;

  if (featured) return featured;

  // 2. Try first image inside post content
  const bodyHtml =
    post.content?.rendered ||
    post.excerpt?.rendered ||
    "";

  const match = bodyHtml.match(
    /<img[^>]+src=["']([^"']+)["']/i
  );

  return match ? match[1] : null;
}


/* ---------- create blog card ---------- */

function postToCardHTML(post, index, showMeta) {

  const title =
    post.title?.rendered || "Untitled";

  const excerpt =
    stripHtml(post.excerpt?.rendered, 110);

  const cat =
    post._embedded?.["wp:term"]?.[0]?.[0]?.name ||
    "Journal";

  const img = getPostImage(post);

  const gradient =
    GRADIENTS[index % GRADIENTS.length];

  const imgStyle = img
    ? `style="background-image:url('${img}'); background-size:cover; background-position:center;"`
    : "";

  const meta = showMeta
    ? `<div class="card-meta">
        ${formatDate(post.date)} ·
        ${estimateReadTime(post.content?.rendered)} min read
       </div>`
    : "";

  /*
     IMPORTANT:
     Instead of opening the WordPress URL,
     the card now opens our own post.html page.
  */

  return `
    <a
      class="card"
      href="post.html?id=${post.id}"
      style="text-decoration:none; color:inherit;"
    >

      <div
        class="card-img ${img ? "" : gradient}"
        ${imgStyle}
      >
        ${img ? "" : cat.toLowerCase()}
      </div>

      <div class="card-body">

        <div class="card-cat">
          ${cat}
        </div>

        <h3>
          ${title}
        </h3>

        <p>
          ${excerpt}…
        </p>

        ${meta}

      </div>

    </a>
  `;
}


/* ---------- show message ---------- */

function showMessage(container, text) {

  container.innerHTML = `
    <p style="
      grid-column:1/-1;
      text-align:center;
      color:#a89c8d;
    ">
      ${text}
    </p>
  `;
}


/* =========================================================
   HOMEPAGE — latest posts
   ========================================================= */

async function loadLatestPosts() {

  const container =
    document.getElementById("latest-posts");

  if (!container) return;

  showMessage(
    container,
    "Loading latest posts…"
  );

  try {

    const res = await fetch(
      `${WP_API_BASE}/posts?per_page=3&_embed`
    );

    const posts = await res.json();

    if (!Array.isArray(posts) || posts.length === 0) {

      showMessage(
        container,
        "No posts yet — check back soon."
      );

      return;
    }

    container.innerHTML =
      posts
        .map((post, i) =>
          postToCardHTML(post, i, false)
        )
        .join("");

  } catch (err) {

    showMessage(
      container,
      "Couldn't load posts. Check the WordPress API connection."
    );

    console.error(err);
  }
}


/* =========================================================
   BLOG PAGE — categories
   ========================================================= */

async function loadCategories() {

  const filterBar =
    document.getElementById("filters");

  if (!filterBar) return;

  try {

    const res = await fetch(
      `${WP_API_BASE}/categories?per_page=20&hide_empty=true`
    );

    const cats = await res.json();

    cats.forEach((cat) => {

      const btn =
        document.createElement("button");

      btn.className = "filter";

      btn.dataset.cat = cat.id;

      btn.textContent = cat.name;

      filterBar.appendChild(btn);
    });


    filterBar.addEventListener(
      "click",
      (e) => {

        if (!e.target.matches(".filter"))
          return;

        filterBar
          .querySelectorAll(".filter")
          .forEach((b) =>
            b.classList.remove("active")
          );

        e.target.classList.add("active");

        currentCategory =
          e.target.dataset.cat || "";

        currentPage = 1;

        fetchPosts(false);
      }
    );

  } catch (err) {

    console.error(
      "Couldn't load categories",
      err
    );
  }
}


/* =========================================================
   BLOG PAGE — fetch posts
   ========================================================= */

async function fetchPosts(append) {

  const grid =
    document.getElementById("posts-grid");

  if (!grid) return;

  const loadMoreWrap =
    document.getElementById("load-more-wrap");

  if (!append) {

    showMessage(
      grid,
      "Loading posts…"
    );
  }

  try {

    let url =
      `${WP_API_BASE}/posts?per_page=${PER_PAGE}&page=${currentPage}&_embed`;

    if (currentCategory) {

      url +=
        `&categories=${currentCategory}`;
    }

    const res = await fetch(url);

    totalPages =
      parseInt(
        res.headers.get("X-WP-TotalPages") || "1",
        10
      );

    const posts =
      await res.json();


    if (!append) {

      grid.innerHTML = "";
    }


    if (
      posts.length === 0 &&
      !append
    ) {

      showMessage(
        grid,
        "No posts found in this category yet."
      );

    } else {

      grid.insertAdjacentHTML(
        "beforeend",

        posts
          .map((post, i) =>
            postToCardHTML(
              post,
              i,
              true
            )
          )
          .join("")
      );
    }


    if (loadMoreWrap) {

      loadMoreWrap.style.display =
        currentPage < totalPages
          ? "block"
          : "none";
    }

  } catch (err) {

    showMessage(
      grid,
      "Couldn't load posts. Check the WordPress API connection."
    );

    console.error(err);
  }
}


/* =========================================================
   BLOG PAGE — Load More button
   ========================================================= */

function initLoadMoreButton() {

  const btn =
    document.getElementById("load-more-btn");

  if (!btn) return;


  btn.addEventListener(
    "click",
    (e) => {

      e.preventDefault();

      currentPage++;

      fetchPosts(true);
    }
  );
}


/* =========================================================
   SINGLE BLOG POST PAGE
   ========================================================= */

async function loadSinglePost() {

  const container =
    document.getElementById("single-post");

  /*
     This prevents the function from doing
     anything on Home or Blog pages.
  */

  if (!container) return;


  // Get the ?id=123 from the URL

  const params =
    new URLSearchParams(
      window.location.search
    );

  const postId =
    params.get("id");


  // If there is no post ID

  if (!postId) {

    container.innerHTML = `
      <p style="
        text-align:center;
        color:#a89c8d;
      ">
        Post not found.
      </p>
    `;

    return;
  }


  try {

    /*
       Fetch the specific WordPress post
       using its ID.
    */

    const res = await fetch(
      `${WP_API_BASE}/posts/${postId}?_embed`
    );


    if (!res.ok) {

      throw new Error(
        "Post could not be found."
      );
    }


    const post =
      await res.json();


    if (!post.id) {

      container.innerHTML = `
        <p style="
          text-align:center;
          color:#a89c8d;
        ">
          Post not found.
        </p>
      `;

      return;
    }


    const title =
      post.title?.rendered ||
      "Untitled";


    const content =
      post.content?.rendered ||
      "";


    const date =
      formatDate(post.date);


    const category =
      post._embedded?.["wp:term"]?.[0]?.[0]?.name ||
      "Journal";


    /*
       Get featured image if available.
    */

    


    /*
       Display the complete post
       inside our own website.
    */

    container.innerHTML = `

      <article class="single-post-content">

        <div class="card-cat">
          ${category}
        </div>

        <h1>
          ${title}
        </h1>

        <div class="card-meta">
          ${date} ·
          ${estimateReadTime(content)}
          min read
        </div>

        <div class="post-content">
  ${content}
</div>

        <p style="margin-top:40px;">

          <a href="blog.html">
            ← Back to Journal
          </a>

        </p>

      </article>

    `;


    /*
       Change browser tab title
    */

    document.title =
      `${stripHtml(title)} — Glow Inside Out`;


  } catch (error) {

    console.error(
      "Error loading post:",
      error
    );


    container.innerHTML = `

      <div style="
        text-align:center;
        color:#a89c8d;
      ">

        <p>
          Couldn't load this post.
        </p>

        <p>
          <a href="blog.html">
            ← Back to Journal
          </a>
        </p>

      </div>

    `;
  }
}


/* =========================================================
   INITIALIZE
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    // Homepage
    loadLatestPosts();

    // Blog page
    loadCategories();

    fetchPosts(false);

    initLoadMoreButton();

    // Single post page
    loadSinglePost();

  }
);