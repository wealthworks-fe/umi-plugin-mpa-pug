import FastClick from 'fastclick';

global.FastClick = FastClick;

if ('addEventListener' in document) {
  document.addEventListener(
    'DOMContentLoaded',
    function() {
      FastClick.attach(document.body);
    },
    false,
  );
}
