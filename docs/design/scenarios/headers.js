// @widths 1280
// The response headers table, which arrived with the rate limit headers: a
// heading over every column it shows, the name and type as machine output,
// the description between them as prose. The responses table's own Links
// column stays hidden, which is what the nested table used to inherit.
var OP = '#operations-Documents-findById_1 ';
var face = function (selector) { var n = document.querySelector(OP + selector); return n ? getComputedStyle(n).fontFamily.split(',')[0].replace(/['"]/g, '') : null; };
var shown = function (selector) { var n = document.querySelector(OP + selector); return !!n && getComputedStyle(n).display !== 'none'; };

V.open('Documents', 'findById_1', 2500);
V.until(function () { return !!document.querySelector(OP + '.headers td'); }, function () {
  var table = document.querySelector(OP + '.headers');
  var headings = table.querySelectorAll('th');
  var visible = Array.prototype.filter.call(headings, function (th) { return getComputedStyle(th).display !== 'none'; });
  var columns = table.querySelectorAll('tr:nth-child(2) td').length;
  check('every headers column has a heading', columns === 3 && visible.length === columns,
        columns + ' columns, ' + visible.length + ' of ' + headings.length + ' headings shown');
  check('the header name is machine output', face('.headers td:nth-child(1)') === 'JetBrains Mono', face('.headers td:nth-child(1)'));
  check('its description is prose', face('.headers td:nth-child(2)') === 'Inter', face('.headers td:nth-child(2)'));
  check('the responses table still hides Links', !shown('.responses-table > thead > tr > th:last-child'));
  done();
}, 20000);
