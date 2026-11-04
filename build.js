#!/usr/bin/env node
/* Build both outputs from the single source:
     index.html  — paged deck (presenting)
     scroll.html — scroll-driven version (reading / sharing)
   Usage: node build.js */
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const read = f => fs.readFileSync(path.join(dir, f), 'utf8');

const src = read('deck.src.html');
const logos = '<script>' + read('logos.js') + '\n</script>';
if (!src.includes('<!--LOGOS-->')) throw new Error('missing <!--LOGOS--> placeholder');

/* paged deck */
const deck = src.replace('<!--LOGOS-->', logos);
fs.writeFileSync(path.join(dir, 'index.html'), deck);

/* scroll version: same slides + shared prelude of the engine, navigation part swapped */
const CUT = 'function syncChapters(';
const END = '</script>\n</body>';
const a = deck.indexOf(CUT), b = deck.lastIndexOf(END);
if (a < 0 || b < 0 || b < a) throw new Error('engine markers not found');
let scroll = deck.slice(0, a) + read('scroll.js') + '\n' + deck.slice(b);
scroll = scroll.replace('</style>', read('scroll.css') + '\n</style>');
scroll = scroll.replace(/<title>([^<]*)<\/title>/, '<title>$1 · 滚动版</title>');
fs.writeFileSync(path.join(dir, 'scroll.html'), scroll);

console.log('index.html', deck.length, '| scroll.html', scroll.length);
