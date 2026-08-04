# Katelya Impressionist Digital Garden Design

## Purpose

Transform the current Mizuki-based blog into an original personal digital garden for Katelya while keeping the current Astro 7 static-site architecture and Cloudflare Pages deployment intact.

The redesign must feel like a contemporary web experience translated through impressionist painting language: teal and blue-green atmosphere, visible brush texture, mist, reflected light, restrained gold leaf, a purple Katelya accent, and lightweight 3D spatial motion. It must not copy Cindy's colors, layout, assets, or branding; only its sense of depth, layered motion, and orbital interaction is used as inspiration.

## Brand

- Site name: `Katelya · 思囿随笔`
- Domain: `https://blog.katelya.top/`
- Positioning: personal digital garden, project laboratory, and growth archive
- Primary tagline: `在代码、生活与热爱之间，记录自己的成长轨迹。`
- Secondary lines:
  - `把折腾写成经验，把经历留作答案。`
  - `关于技术、大学生活、开源项目与仍在生长的自己。`

## Visual Language

### Palette

- Deep teal: `#10272B`
- Malachite: `#2F706D`
- Mist teal: `#7FB9B0`
- Porcelain mist: `#EAF4EF`
- Twilight purple: `#6D5AA7`
- Mineral gold: `#C8A765`

The light theme uses mist white, desaturated teal, mineral gold, and small purple highlights. The dark theme uses ink teal, blue-black, muted purple, and dim gold.

### Texture

The visual texture is procedural and original:

- SVG turbulence and displacement simulate layered brush strokes.
- Semi-transparent gradients create Monet-like mist and reflected light.
- Curved stroke paths create orbital, energetic movement.
- Gold particles appear sparingly as mineral flecks.
- No copyrighted artwork is embedded as the site background.

### Typography

- Hero headings use a high-contrast Chinese serif stack with restrained embossing and a paint-like highlight.
- Body text keeps the existing readable CJK font stack.
- Monospace text remains reserved for code and technical metadata.

## Homepage Hero

The homepage hero becomes an `Impressionist Orbit` scene:

- Central title and subtitle remain the semantic focus.
- Four lightweight orbit cards represent `技术折腾`, `开源项目`, `大学生活`, and `随笔记录`.
- Cards move on an elliptical 3D plane using CSS transforms.
- Pointer movement adds restrained parallax and depth.
- Scrolling reduces movement and lets the content grid become dominant.
- Mobile devices receive a simplified horizontal composition.
- `prefers-reduced-motion` disables orbit and parallax animation.

## Global UI

- Cards become translucent painted canvases rather than opaque white blocks.
- Borders use dual layers: cool teal edge plus a subtle mineral-gold inner highlight.
- Hover motion uses small perspective tilt and vertical lift only.
- Navbar becomes a floating frosted gallery rail with purple active state and gold micro-highlight.
- Page background includes low-contrast pigment clouds and paper grain.
- Article pages reduce effects to protect readability.

## Information Architecture

Primary navigation:

- 首页
- 归档
- 友链
- 探索
  - 项目实验室
  - 成长时间线
  - 日常片段
  - 技能图谱
- 关于
- 更多
  - RSS 订阅
  - 站点地图

Unused feature pages remain in code but are hidden until their content is ready.

## Content Migration

Use `katelya77/MyBlog` as the only legacy content source.

Migrate now:

- Chinese site branding
- Profile and social links
- About page
- Project data for Katelya Space, DecoTV, KatelyaTV, and K-Vault
- The representative `Katelya Space 正式上线` article

Do not migrate old build configuration, stale theme code, or the deprecated `katelya77/Katelya-Blog` repository.

## Performance and Accessibility

- No full-screen WebGL dependency in phase one.
- Use CSS 3D, SVG, and small DOM scenes.
- Disable or simplify motion on mobile and reduced-motion devices.
- Preserve text contrast and keyboard navigation.
- Keep Astro static output and Cloudflare Pages compatibility.
- Avoid external image APIs in the hero.
- Use local text-based SVG assets to keep deployment deterministic.

## Acceptance Criteria

- `pnpm build` succeeds with the existing Astro 7 toolchain.
- Homepage visibly differs from the stock Mizuki template.
- The hero has an original blue-green painted background and a restrained 3D orbit scene.
- Site identity, profile, navigation, about page, project data, and primary article are Katelya-specific.
- The canonical site URL is `https://blog.katelya.top/`.
- Desktop, mobile, dark mode, and reduced-motion behavior remain usable.
- No legacy author profile or legacy project links remain in the edited user-facing files.
