// An interface inventory of the console: every distinct corner radius, type
// size and weight, family and border colour the page actually renders, with
// how often each occurs and one element that uses it. A coherent system has
// few values; a rare one is usually a leftover. Opens operations, a live
// response and the schemas first, so their styles are in the count.
//
//   python docs/design/verify.py docs/design/inventory.js --wait 30000
V.execute('Authentication', 'login', '{"username":"admin","password":"admin123"}', 2000);
V.open('Documents', 'getDocument', 4000);
V.open('Tenants', 'createTenant', 5000);
setTimeout(function () {
  var models = document.querySelector('.models-control');
  if (models && models.getAttribute('aria-expanded') !== 'true') models.click();
}, 6000);

setTimeout(function () {
  var tally = { radius: {}, type: {}, family: {}, border: {} };
  function name(node) {
    return node.tagName.toLowerCase() + (node.id ? '#' + node.id : '') +
      (typeof node.className === 'string' && node.className.trim() ? '.' + node.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  }
  function add(kind, value, node) {
    if (!value || value === '0px' || value === 'none') return;
    var entry = tally[kind][value] || (tally[kind][value] = { count: 0, example: name(node) });
    entry.count++;
  }
  document.querySelectorAll('body *').forEach(function (node) {
    var box = node.getBoundingClientRect();
    if (!box.width || !box.height) return;
    var style = getComputedStyle(node);
    add('radius', style.borderTopLeftRadius, node);
    var ownText = Array.prototype.some.call(node.childNodes, function (child) {
      return child.nodeType === 3 && child.textContent.trim();
    });
    if (ownText) {
      add('type', style.fontSize + ' ' + style.fontWeight, node);
      add('family', style.fontFamily.split(',')[0].replace(/['"]/g, ''), node);
    }
    if (style.borderTopWidth !== '0px' && style.borderTopStyle !== 'none') add('border', style.borderTopWidth + ' ' + style.borderTopColor, node);
  });
  Object.keys(tally).forEach(function (kind) {
    var rows = Object.keys(tally[kind]).map(function (value) {
      return tally[kind][value].count + '  ' + value + '  (' + tally[kind][value].example + ')';
    }).sort(function (a, b) { return parseInt(b, 10) - parseInt(a, 10); });
    L(kind, { distinct: rows.length, values: rows });
  });
  done();
}, 9000);
