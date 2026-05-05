// Nav scroll
window.addEventListener('scroll', () => {
  document.getElementById('nav').classList.toggle('scrolled', window.scrollY > 40);
});

// Scroll reveal
const obs = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target); } });
}, { threshold: 0.07 });
document.querySelectorAll('.reveal').forEach(el => obs.observe(el));

// SLC neighborhood filter
function filterSLC(btn, hood) {
  document.querySelectorAll('.slc-pill').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('#slc-list .mini-prop').forEach(p => {
    p.style.display = (hood === 'all' || p.dataset.hood === hood) ? '' : 'none';
  });
}

// Easter egg: type "lcf"
let buf = '';
document.addEventListener('keydown', e => {
  buf += e.key.toLowerCase();
  buf = buf.slice(-3);
  if (buf === 'lcf') { document.getElementById('egg').classList.add('show'); buf = ''; }
});
function closeEgg() { document.getElementById('egg').classList.remove('show'); }