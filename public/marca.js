(function () {
  var AUTOR = 'Andrés Lugo';
  var CONTACTO = 'andreslugo51@gmail.com';

  var UNIVERSIDAD = 'Universidad Fermín Toro';
  var SEDE = 'Sede Cabudare · Lara';
  var anio = new Date().getFullYear();

  document.title += ' · UFT Cabudare';

  function div(cls, txt) {
    var d = document.createElement('div');
    if (cls) d.className = cls;
    if (txt) d.textContent = txt;
    return d;
  }

  function cabecera() {
    var c = div('marca');
    var mono = div('marca-mono', 'UFT');
    var img = new Image();
    img.className = 'marca-img';
    img.alt = 'Logo de la ' + UNIVERSIDAD;
    img.onload = function () { if (mono.parentNode) mono.parentNode.replaceChild(img, mono); };
    img.src = '/logo.png';
    c.appendChild(mono);
    c.appendChild(div('marca-uni', UNIVERSIDAD));
    c.appendChild(div('marca-sede', SEDE));
    return c;
  }

  function pie() {
    var p = div('pie');
    p.appendChild(div('', 'UFT Pass · Proyecto de Sistemas 2 · ' + anio));
    if (AUTOR) p.appendChild(div('', 'Desarrollado por ' + AUTOR));
    if (CONTACTO) p.appendChild(div('', 'Soporte: ' + CONTACTO));
    return p;
  }

  document.querySelectorAll('.ios-card').forEach(function (card) {
    card.insertBefore(cabecera(), card.firstChild);
    if (card.querySelector('#formLogin, #formAdmin')) {
      card.appendChild(div('ayuda', '¿Problemas para entrar? Contacta al administrador.'));
    }
    card.appendChild(pie());
  });
})();
