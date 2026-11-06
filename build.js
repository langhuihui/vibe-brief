#!/usr/bin/env node
/* Build all outputs:
     index.html   — paged deck, from deck.src.html (presenting)
     scroll.html  — scroll-driven story, from story.src.html (reading / sharing)
     hscroll.html — horizontal side-scroller, hscroll.src.html + story pieces
   Shared from the deck source: logos, COLORS + fillLogos, CONCEPTS (and their mention counts).
   Usage: node build.js */
const fs = require('fs'), path = require('path');
const dir = __dirname, read = f => fs.readFileSync(path.join(dir, f), 'utf8');
const src = read('deck.src.html'), logos = '<script>' + read('logos.js') + '\n' + read('avatars.js') + '\n</script>';
if (!src.includes('<!--LOGOS-->')) throw new Error('missing <!--LOGOS--> in deck.src.html');
const deck = src.replace('<!--LOGOS-->', logos);
fs.writeFileSync(path.join(dir, 'index.html'), deck);

/* ---- shared pieces for the story ---- */
const pick = (re, what) => { const m = src.match(re); if (!m) throw new Error('cannot find ' + what); return m[0]; };
/* COLORS / fillLogos / brandify / decorateTools now ship in the shared logos.js,
   injected into both outputs through <!--LOGOS--> — nothing to copy here any more. */
const concepts = pick(/const CONCEPTS=\{[\s\S]*?\n\};/, 'CONCEPTS');
const CONCEPTS = Function(concepts + ';return CONCEPTS')();
/* mention counts across the deck text (index slide excluded), same rule as the deck's word cloud */
const corpus = src.replace(/<section class="slide" id="s-index"[\s\S]*?<\/section>/, '')
  .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ');
const cnt = t => { if (!t || t.length < 2) return 0; const e = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const lat = /^[\x20-\x7e]+$/.test(t);
  return (corpus.match(new RegExp(lat ? '(?<![A-Za-z])' + e + '(?![A-Za-z])' : e, lat ? 'gi' : 'g')) || []).length; };
const N = {};
Object.values(CONCEPTS).flat().forEach(x => { let n = cnt(x[0]); if (!n) n = Math.max(0, ...x[0].split(/ \/ | · /).filter(t => /^[\x20-\x7e]{3,}$/.test(t) || t.length >= 4).map(cnt)); N[x[0]] = Math.max(1, n); });

const storySrc = read('story.src.html');
let story = storySrc;
for (const ph of ['<!--LOGOS-->', '/*SHARED*/', '/*CONCEPTS*/']) if (!story.includes(ph)) throw new Error('missing ' + ph + ' in story.src.html');
const conceptsJs = concepts + '\nconst CONCEPT_N=' + JSON.stringify(N) + ';';
story = story.replace('<!--LOGOS-->', () => logos)
  .replace('/*SHARED*/', () => '/* shared logo runtime comes from logos.js */')
  .replace('/*CONCEPTS*/', () => conceptsJs);
fs.writeFileSync(path.join(dir, 'scroll.html'), story);

/* ---- horizontal scroll: hscroll.src.html re-stages the story's own pieces ----
   Taken verbatim from story.src.html so content lives in one place:
     STORY_CSS    the story's <style> (cards, scenes, posters)
     STORY_BLOCKS every block inside #L2
     STORY_SCRIPT content generators, card scenes and far/mid/front data —
                  everything before the vertical engine */
const cut = (s, a, b, what) => { const i = s.indexOf(a), j = i < 0 ? -1 : s.indexOf(b, i + a.length); if (i < 0 || j < 0) throw new Error('cannot find ' + what + ' in story.src.html'); return s.slice(i + a.length, j); };
const hPieces = {
  '/*STORY_CSS*/': cut(storySrc, '<style>', '</style>', 'story <style>'),
  '<!--STORY_BLOCKS-->': cut(storySrc, '<div id="thread"></div>', '</div><!-- /L2 -->', '#L2 blocks'),
  '/*STORY_SCRIPT*/': cut(storySrc, '/*SHARED*/', '/* ================= engine ================= */', 'story script').replace('/*CONCEPTS*/', () => conceptsJs),
  '<!--LOGOS-->': logos
};
let hs = read('hscroll.src.html');
for (const [ph, v] of Object.entries(hPieces)) { if (!hs.includes(ph)) throw new Error('missing ' + ph + ' in hscroll.src.html'); hs = hs.replace(ph, () => v); }
fs.writeFileSync(path.join(dir, 'hscroll.html'), hs);
console.log('index.html', deck.length, '| scroll.html', story.length, '| hscroll.html', hs.length);
