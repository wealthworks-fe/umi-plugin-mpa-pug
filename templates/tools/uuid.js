var generateId = require('uuid/v4');
var Cookies = require('universal-cookie');

var cookie = new Cookies();

// 获取标识
function getId() {
  return cookie.get('uuid') || localStorage.getItem('uuid') || generateId();
}

// 注入标识
function injectId(uuid) {
  cookie.set('uuid', uuid, { path: '/', maxAge: 10 * 365 * 24 * 60 * 60 });
  localStorage.setItem('uuid', uuid);
}

function autoInject() {
  var uuid = getId();
  injectId(uuid);
}

module.exports = {
  init: autoInject,
  getId: getId,
};
