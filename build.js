#!/usr/bin/env node
/* Build both outputs:
     index.html  — paged deck, from deck.src.html (presenting)
     scroll.html — scroll-driven story, from story.src.html (reading / sharing)
   Shared from the deck source: logos, COLORS + fillLogos, CONCEPTS (and their mention counts).
   Usage: node build.js */
const fs = require('fs'), path = require('path');
const dir = __dirname, read = f => fs.readFileSync(path.join(dir, f), 'utf8');
const src = read('deck.src.html'), logos = '<script>' + read('logos.js') + '\n</script>';
if (!src.includes('<!--LOGOS-->')) throw new Error('missing <!--LOGOS--> in deck.src.html');
const deck = src.replace('<!--LOGOS-->', logos);
fs.writeFileSync(path.join(dir, 'index.html'), deck);

/* ---- shared pieces for the story ---- */
const pick = (re, what) => { const m = src.match(re); if (!m) throw new Error('cannot find ' + what); return m[0]; };
const colors = pick(/^const COLORS=.*$/m, 'COLORS');
const fillLogos = pick(/function fillLogos\(root\)\{[\s\S]*?\n\}/, 'fillLogos');
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

let story = read('story.src.html');
for (const ph of ['<!--LOGOS-->', '/*SHARED*/', '/*CONCEPTS*/']) if (!story.includes(ph)) throw new Error('missing ' + ph + ' in story.src.html');
story = story.replace('<!--LOGOS-->', () => logos)
  .replace('/*SHARED*/', () => colors + '\n' + fillLogos)
  .replace('/*CONCEPTS*/', () => concepts + '\nconst CONCEPT_N=' + JSON.stringify(N) + ';');
fs.writeFileSync(path.join(dir, 'scroll.html'), story);
console.log('index.html', deck.length, '| scroll.html', story.length);
